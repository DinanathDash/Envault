import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // For GCM mode, 12-16 bytes is recommended
const AUTH_TAG_LENGTH = 16
const ENCODING = 'hex'

/**
 * Get the encryption key from environment variables
 * The key must be 32 bytes (64 hex characters) for AES-256
 * IMPORTANT: This must be a server-side only environment variable (NOT NEXT_PUBLIC_)
 */
function getEncryptionKey(): Buffer {
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
 * Encrypts a plaintext string using AES-256-GCM
 * Returns a base64-encoded string containing: IV + encrypted data + auth tag
 */
export function encrypt(text: string): string {
    try {
        const key = getEncryptionKey()
        const iv = crypto.randomBytes(IV_LENGTH)

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

        let encrypted = cipher.update(text, 'utf8', ENCODING)
        encrypted += cipher.final(ENCODING)

        const authTag = cipher.getAuthTag()

        // Combine IV + encrypted data + auth tag
        const combined = Buffer.concat([
            iv,
            Buffer.from(encrypted, ENCODING),
            authTag
        ])

        // Return as base64 for easy storage
        return combined.toString('base64')
    } catch (error) {
        console.error('Encryption error:', error)
        throw new Error('Failed to encrypt data')
    }
}

/**
 * Decrypts an encrypted string that was created by the encrypt function
 * Expects a base64-encoded string containing: IV + encrypted data + auth tag
 */
export function decrypt(encryptedText: string): string {
    try {
        const key = getEncryptionKey()

        // Decode from base64
        const combined = Buffer.from(encryptedText, 'base64')

        // Extract IV, encrypted data, and auth tag
        const iv = combined.subarray(0, IV_LENGTH)
        const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
        const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encrypted.toString(ENCODING), ENCODING, 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (error) {
        console.error('Decryption error:', error)
        throw new Error('Failed to decrypt data')
    }
}

/**
 * Generates a random encryption key suitable for AES-256
 * Use this to generate a new ENCRYPTION_KEY for your .env.local file
 * Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString(ENCODING)
}
