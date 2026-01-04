import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodeCrypto from "node:crypto";
import { Buffer } from "node:buffer";
import { Redis } from 'https://esm.sh/@upstash/redis'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MASTER_KEY_HEX = Deno.env.get('ENCRYPTION_KEY')!
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const ENCODING = 'hex'
const CHUNK_SIZE = 500 // Process 500 secrets per invocation to avoid timeouts

// --- Helper Functions ---
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
    try {
        let decrypted = decipher.update(encrypted.toString(ENCODING), ENCODING, 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
    } catch (e) {
        throw new Error('Decryption Failed')
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Parse Request
        const { job_id } = await req.json().catch(() => ({ job_id: null }))

        // Mode 1: Initialization (No job_id provided)
        if (!job_id) {
            return await initializeRotationJob(supabaseClient)
        }

        // Mode 2: Processing Loop (job_id provided)
        return await processRotationChunk(supabaseClient, job_id)

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})


async function initializeRotationJob(supabase: any) {
    // 1. Create NEW Data Key
    const newKeyBuffer = nodeCrypto.randomBytes(32)
    const masterKey = getMasterKey()
    const newKeyHex = newKeyBuffer.toString('hex')
    const encryptedNewKey = encryptWithKey(newKeyHex, masterKey)

    // 2. Store Key in DB
    const { data: newKeyData, error: newKeyError } = await supabase
        .from('encryption_keys')
        .insert({
            encrypted_key: encryptedNewKey,
            status: 'migrating'
        })
        .select()
        .single()

    if (newKeyError) throw new Error(`Failed to create new key: ${newKeyError.message}`)

    // 3. Count Total Secrets
    const { count, error: countError } = await supabase
        .from('secrets')
        .select('*', { count: 'exact', head: true })

    if (countError) throw new Error(`Failed to count secrets: ${countError.message}`)

    // 4. Create Job Record
    const { data: jobData, error: jobError } = await supabase
        .from('key_rotation_jobs')
        .insert({
            new_key_id: newKeyData.id,
            status: 'pending',
            total_secrets: count || 0,
            processed_secrets: 0
        })
        .select()
        .single()

    if (jobError) throw new Error(`Failed to create job: ${jobError.message}`)

    // 5. Trigger Async Processing (Recursion Start)
    // We invoke the SAME function, but pass the job_id
    // Supabase Functions can invoke themselves via `functions.invoke` or raw fetch.
    // We'll use raw fetch to the PUBLIC URL if possible, or just re-invoke via client?
    // Using `supabase.functions.invoke` is cleaner if available in this client version, 
    // but `supabase-js` in Edge environment sometimes restricts this.
    // Secure way: We rely on the client (Dashboard) to trigger? No, that's brittle.
    // We must self-trigger. 
    // We will attempt to use `functions.invoke`.

    try {
        await supabase.functions.invoke('rotate-keys', {
            body: { job_id: jobData.id }
        })
    } catch (e) {
        console.error("Failed to trigger self-invocation:", e)
        // If we fail to trigger, we return the job ID and hope the user/caller retries.
    }

    return new Response(
        JSON.stringify({
            success: true,
            job_id: jobData.id,
            message: 'Rotation job started'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}


async function processRotationChunk(supabase: any, job_id: string) {
    // 1. Fetch Job State
    const { data: job, error: jobFetchError } = await supabase
        .from('key_rotation_jobs')
        .select('*')
        .eq('id', job_id)
        .single()

    if (jobFetchError || !job) throw new Error(`Job not found: ${jobFetchError?.message}`)

    if (job.status === 'completed' || job.status === 'failed') {
        return new Response(
            JSON.stringify({ message: 'Job already finished', status: job.status }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // 2. Fetch Helper: New Key
    const { data: newKeyData } = await supabase
        .from('encryption_keys')
        .select('encrypted_key')
        .eq('id', job.new_key_id)
        .single()

    if (!newKeyData) throw new Error("New key data missing")

    const masterKey = getMasterKey()
    const newKeyUnwrapped = Buffer.from(decryptWithKey(newKeyData.encrypted_key, masterKey), 'hex')

    // 3. Fetch Chunk of Secrets (Keyset Pagination)
    let query = supabase
        .from('secrets')
        .select('*')
        .neq('key_id', job.new_key_id) // Only fetch ones not yet migrated? 
        // Or safely fetch by specific order? 
        // Ideally: Order by ID ASC, Key > last_processed_secret_id
        .order('id', { ascending: true })
        .limit(CHUNK_SIZE)

    if (job.last_processed_secret_id) {
        query = query.gt('id', job.last_processed_secret_id)
    }

    const { data: secretsChunk, error: chunkError } = await query

    if (chunkError) throw new Error(`Chunk fetch error: ${chunkError.message}`)

    // 4. Process Chunk
    if (!secretsChunk || secretsChunk.length === 0) {
        // DONE! No more secrets to process.
        // Finalize: Switch Active Key
        await supabase.from('encryption_keys').update({ status: 'retired' }).eq('status', 'active')
        await supabase.from('encryption_keys').update({ status: 'active' }).eq('id', job.new_key_id)
        await supabase.from('key_rotation_jobs').update({ status: 'completed' }).eq('id', job_id)

        // Invalid Redis Cache
        try {
            const redis = new Redis({
                url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
                token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
            })
            await redis.del('active_key')
        } catch (e) {
            console.error('Failed to invalidate Redis:', e)
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Rotation COMPLETED', job_id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Update Init Status
    if (job.status === 'pending') {
        await supabase.from('key_rotation_jobs').update({ status: 'processing' }).eq('id', job_id)
    }

    // Process Items
    const failedIds: string[] = []
    let lastId = job.last_processed_secret_id
    let processedCount = 0

    // Key Cache for decryption (Old Keys)
    const oldKeyCache = new Map<string, Buffer>()

    for (const secret of secretsChunk) {
        try {
            let decryptedValue = ''

            // Decrypt Logic
            if (!secret.key_id) {
                decryptedValue = decryptWithKey(secret.value, masterKey)
            } else {
                let oldKeyBuffer = oldKeyCache.get(secret.key_id)
                if (!oldKeyBuffer) {
                    const { data: oldKeyData } = await supabase
                        .from('encryption_keys')
                        .select('encrypted_key')
                        .eq('id', secret.key_id)
                        .single()
                    if (oldKeyData) {
                        const hex = decryptWithKey(oldKeyData.encrypted_key, masterKey)
                        oldKeyBuffer = Buffer.from(hex, 'hex')
                        oldKeyCache.set(secret.key_id, oldKeyBuffer)
                    }
                }

                if (oldKeyBuffer) {
                    if (secret.value.startsWith('v1:')) {
                        const parts = secret.value.split(':')
                        decryptedValue = decryptWithKey(parts[2], oldKeyBuffer)
                    } else {
                        decryptedValue = decryptWithKey(secret.value, oldKeyBuffer)
                    }
                }
            }

            // Encrypt with NEW Key
            if (decryptedValue) {
                const ciphertext = encryptWithKey(decryptedValue, newKeyUnwrapped)
                const storedValue = `v1:${job.new_key_id}:${ciphertext}`

                await supabase
                    .from('secrets')
                    .update({ value: storedValue, key_id: job.new_key_id })
                    .eq('id', secret.id)
            }

            processedCount++
            lastId = secret.id

        } catch (e) {
            console.error(`Failed secret ${secret.id}`, e)
            failedIds.push(secret.id)
            // We continue processing the chunk even if one fails?
            // Yes, but log it.
        }
    }

    // 5. Update Job State
    await supabase.from('key_rotation_jobs').update({
        processed_secrets: (job.processed_secrets || 0) + processedCount,
        last_processed_secret_id: lastId,
        updated_at: new Date().toISOString()
    }).eq('id', job_id)

    // 6. Recurse (Trigger Next Chunk)
    await supabase.functions.invoke('rotate-keys', {
        body: { job_id: job_id }
    })

    return new Response(
        JSON.stringify({
            success: true,
            message: 'Chunk processed',
            processed: processedCount,
            next_cursor: lastId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}
