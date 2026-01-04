import crypto from 'crypto'
import { createClient } from './supabase/server' // We need server client to fetch keys

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const ENCODING = 'hex'

// Cache the unwrapped data keys to avoid DB hits on every decrypt
// Map<KeyId, Buffer>
const keyCache = new Map<string, Buffer>()

/**
 * Get the MASTER encryption key from environment variables
 * Used to encrypt/decrypt the Data Keys (KEK)
 * AND used for legacy data decryption
 */
function getMasterKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY

    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set')
    }

    if (key.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
    }

    return Buffer.from(key, ENCODING)
}

/**
 * Fetch and unwrap a specific Data Key
 */
async function getDataKey(keyId: string): Promise<Buffer> {
    if (keyCache.has(keyId)) {
        return keyCache.get(keyId)!
    }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('encryption_keys')
        .select('encrypted_key')
        .eq('id', keyId)
        .single()

    if (error || !data) {
        throw new Error(`Failed to fetch encryption key ${keyId}: ${error?.message}`)
    }

    // Decrypt the Data Key using the Master Key
    // The Data Key itself is stored as an encrypted string in the DB
    const masterKey = getMasterKey()
    const unwrappedKey = decryptWithKey(data.encrypted_key, masterKey)

    // Convert hex string back to buffer
    const keyBuffer = Buffer.from(unwrappedKey, ENCODING)

    keyCache.set(keyId, keyBuffer)
    return keyBuffer
}

/**
 * Fetch the currently ACTIVE Data Key
 * If no active key exists, it falls back to using the Master Key (Legacy Mode)
 * or throws invalid state depending on strictness.
 * For this implementation, we assume if we are encrypting NEW data,
 * we MUST have an active key in the DB.
 */
async function getActiveKey(): Promise<{ id: string; key: Buffer }> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('encryption_keys')
        .select('id, encrypted_key')
        .eq('status', 'active')
        .single()

    if (error || !data) {
        throw new Error('No ACTIVE encryption key found. Please run the migration/init script.')
    }

    const masterKey = getMasterKey()
    const unwrappedKey = decryptWithKey(data.encrypted_key, masterKey)
    const keyBuffer = Buffer.from(unwrappedKey, ENCODING)

    // Cache it
    keyCache.set(data.id, keyBuffer)

    return { id: data.id, key: keyBuffer }
}

/**
 * Low-level decrypt helper
 */
function decryptWithKey(encryptedText: string, key: Buffer): string {
    const combined = Buffer.from(encryptedText, 'base64')
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted.toString(ENCODING), ENCODING, 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

/**
 * Encrypts data using the currently ACTIVE Data Key.
 * Returns: `v1:{keyId}:{ciphertext}`
 */
export async function encrypt(text: string): Promise<string> {
    try {
        const { id, key } = await getActiveKey()

        const iv = crypto.randomBytes(IV_LENGTH)
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

        let encrypted = cipher.update(text, 'utf8', ENCODING)
        encrypted += cipher.final(ENCODING)
        const authTag = cipher.getAuthTag()

        const combined = Buffer.concat([iv, Buffer.from(encrypted, ENCODING), authTag])
        const ciphertext = combined.toString('base64')

        // Prefix with Key ID for checking during decrypt
        return `v1:${id}:${ciphertext}`
    } catch (error) {
        console.error('Encryption error:', error)
        throw new Error('Failed to encrypt data')
    }
}

/**
 * Decrypts data. 
 * Handles both Legacy (no prefix) and New (v1 prefix) formats.
 */
export async function decrypt(text: string): Promise<string> {
    try {
        // Check for version prefix
        if (text.startsWith('v1:')) {
            // Format: v1:{keyId}:{ciphertext}
            const parts = text.split(':')
            if (parts.length !== 3) throw new Error('Invalid encrypted format')

            const keyId = parts[1]
            const ciphertext = parts[2]

            const key = await getDataKey(keyId)
            return decryptWithKey(ciphertext, key)
        } else {
            // FALLBACK: Legacy format (encrypted with Master Key)
            const masterKey = getMasterKey()
            return decryptWithKey(text, masterKey)
        }
    } catch (error) {
        console.error('Decryption error:', error)
        throw new Error('Failed to decrypt data')
    }
}

/**
 * Generate a new random key (returned as hex string)
 */
export function generateRandomKey(): string {
    return crypto.randomBytes(32).toString(ENCODING)
}
