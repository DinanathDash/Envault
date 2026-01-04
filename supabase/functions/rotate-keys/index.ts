import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodeCrypto from "node:crypto";
import { Buffer } from "node:buffer";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuration
const MASTER_KEY_HEX = Deno.env.get('ENCRYPTION_KEY')!
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const ENCODING = 'hex'

function getMasterKey(): Buffer {
    if (!MASTER_KEY_HEX || MASTER_KEY_HEX.length !== 64) {
        throw new Error('Invalid ENCRYPTION_KEY')
    }
    return Buffer.from(MASTER_KEY_HEX, ENCODING)
}

function encryptWithKey(text: string, key: Buffer): string {
    const iv = nodeCrypto.randomBytes(IV_LENGTH)
    const cipher = nodeCrypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(text, 'utf8', ENCODING)
    encrypted += cipher.final(ENCODING)
    const authTag = cipher.getAuthTag()
    const combined = Buffer.concat([iv, Buffer.from(encrypted, ENCODING), authTag])
    return combined.toString('base64')
}

function decryptWithKey(encryptedText: string, key: Buffer): string {
    const combined = Buffer.from(encryptedText, 'base64')
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)
    const decipher = nodeCrypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted.toString(ENCODING), ENCODING, 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Init Supabase Admin Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Create NEW Data Key
        const newKeyBuffer = nodeCrypto.randomBytes(32)
        const masterKey = getMasterKey()

        // Encrypt the new Data Key with Master Key
        // We treat the buffer as a hex string to match our encryption format or keep generic? 
        // Our encryptWithKey expects string input. Let's encode the buffer to hex first.
        const newKeyHex = newKeyBuffer.toString('hex')
        const encryptedNewKey = encryptWithKey(newKeyHex, masterKey)

        // 3. Store NEW Key in DB as 'migrating'
        const { data: newKeyData, error: newKeyError } = await supabaseClient
            .from('encryption_keys')
            .insert({
                encrypted_key: encryptedNewKey,
                status: 'migrating'
            })
            .select()
            .single()

        if (newKeyError) throw new Error(`Failed to create new key: ${newKeyError.message}`)
        const newKeyId = newKeyData.id

        // 4. Fetch ALL Secrets
        // Note: In production with millions of rows, this needs pagination. 
        // For this MVP/Start, fetching all is acceptable.
        const { data: allSecrets, error: secretsError } = await supabaseClient
            .from('secrets')
            .select('*')

        if (secretsError) throw new Error(`Failed to fetch secrets: ${secretsError.message}`)

        let migratedCount = 0

        // 5. Re-Encrypt Loop
        for (const secret of allSecrets) {
            // Skip if already on the new key (shouldn't happen in single transaction logic but good safety)
            if (secret.key_id === newKeyId) continue;

            let decryptedValue = ''

            try {
                if (!secret.key_id) {
                    // LEGACY: Decrypt with Master Key directly
                    decryptedValue = decryptWithKey(secret.value, masterKey)
                } else {
                    // WRAPPED: Need to fetch the OLD key
                    // OPTIMIZATION: We could cache these older keys in a map outside the loop
                    const { data: oldKeyData } = await supabaseClient
                        .from('encryption_keys')
                        .select('encrypted_key')
                        .eq('id', secret.key_id)
                        .single()

                    if (oldKeyData) {
                        const oldKeyHex = decryptWithKey(oldKeyData.encrypted_key, masterKey)
                        const oldKeyBuffer = Buffer.from(oldKeyHex, 'hex')
                        // The secret value is stored as "v1:keyId:ciphertext" in the new format... 
                        // WAIT. My encrypt function in encryption.ts produces `v1:${id}:${ciphertext}`.
                        // But the DB column `value` stores that WHOLE string.
                        // My local `decrypt` function handles the parsing. 
                        // Here I need to replicate that parsing logic.

                        if (secret.value.startsWith('v1:')) {
                            const parts = secret.value.split(':')
                            const ciphertext = parts[2]
                            decryptedValue = decryptWithKey(ciphertext, oldKeyBuffer)
                        } else {
                            // Fallback? Or error?
                            decryptedValue = decryptWithKey(secret.value, oldKeyBuffer)
                        }
                    }
                }

                // Encrypt with NEW Key
                // Format: v1:{newKeyId}:{ciphertext}
                // Note: We use 'v1' as the format version, not the key version.
                const ciphertext = encryptWithKey(decryptedValue, newKeyBuffer)
                const storedValue = `v1:${newKeyId}:${ciphertext}`

                // Update Secret
                await supabaseClient
                    .from('secrets')
                    .update({
                        value: storedValue,
                        key_id: newKeyId
                    })
                    .eq('id', secret.id)

                migratedCount++

            } catch (e) {
                console.error(`Failed to migrate secret ${secret.id}:`, e)
                // Continue? Or abort? For safety, we generally abort to avoid half-states if possible, 
                // but since we are not in a single SQL transaction across all REST calls, we might have partials.
                // Since we are creating a new key, partial migration is OK as long as we don't switch the new key to 'active' prematurely?
                // Actually, if we fail, we should probably throw and NOT activate the new key.
                throw e
            }
        }

        // 6. Switch New Key to 'active' and Old Keys to 'retired'
        await supabaseClient
            .from('encryption_keys')
            .update({ status: 'retired' })
            .eq('status', 'active')

        await supabaseClient
            .from('encryption_keys')
            .update({ status: 'active' })
            .eq('id', newKeyId)


        return new Response(
            JSON.stringify({
                success: true,
                message: 'Key rotation completed',
                migrated: migratedCount,
                newKeyId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
