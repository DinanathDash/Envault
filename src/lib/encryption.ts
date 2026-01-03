import CryptoJS from 'crypto-js';

// Configuration for "Military Grade" Security
const CONFIG = {
    iterations: 100000,
    keySize: 256 / 32, // 256 bits
    digest: 'sha256'
};

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'envault-secure-storage-key-v1';

export interface EncryptedData {
    s: string; // Salt (Hex)
    iv: string; // Initialization Vector (Hex)
    ct: string; // Ciphertext (Base64)
    m: string; // MAC (Hex)
}

/**
 * Encrypts data using AES-256-CBC with PBKDF2 key derivation and HMAC-SHA256 integrity check.
 * Strategy: Encrypt-then-MAC
 */
export const encrypt = (data: string): string => {
    // 1. Generate random Salt (128-bit) and IV (128-bit)
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);

    // 2. Derive Keys using PBKDF2
    // We derive 512 bits: 256 bits for Encryption Key, 256 bits for HMAC Key
    const derivedParams = CryptoJS.PBKDF2(SECRET_KEY, salt, {
        keySize: (256 / 32) * 2,
        iterations: CONFIG.iterations,
        hasher: CryptoJS.algo.SHA256
    });

    // Split the derived parameters into two keys
    const encKey = CryptoJS.lib.WordArray.create(derivedParams.words.slice(0, 8));
    const macKey = CryptoJS.lib.WordArray.create(derivedParams.words.slice(8, 16));

    // 3. Encrypt
    const encrypted = CryptoJS.AES.encrypt(data, encKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    // We store the ciphertext string (Base64)
    const ciphertextStr = encrypted.ciphertext.toString(CryptoJS.enc.Base64);

    // 4. Calculate HMAC (Integrity Check) on IV + Ciphertext
    // Use the ciphertext WordArray directly to avoid encoding issues
    const dataToMac = iv.clone().concat(encrypted.ciphertext);
    const mac = CryptoJS.HmacSHA256(dataToMac, macKey);

    // 5. Pack result
    const result: EncryptedData = {
        s: salt.toString(CryptoJS.enc.Hex),
        iv: iv.toString(CryptoJS.enc.Hex),
        ct: ciphertextStr,
        m: mac.toString(CryptoJS.enc.Hex)
    };

    return JSON.stringify(result);
};

export const decrypt = (jsonStr: string): string => {
    try {
        const parsed: EncryptedData = JSON.parse(jsonStr);

        // Basic validation
        if (!parsed.s || !parsed.iv || !parsed.ct || !parsed.m) {
            return '';
        }

        const salt = CryptoJS.enc.Hex.parse(parsed.s);
        const iv = CryptoJS.enc.Hex.parse(parsed.iv);
        const mac = CryptoJS.enc.Hex.parse(parsed.m);
        const ciphertext = CryptoJS.enc.Base64.parse(parsed.ct);

        // 1. Re-derive Keys
        const derivedParams = CryptoJS.PBKDF2(SECRET_KEY, salt, {
            keySize: (256 / 32) * 2,
            iterations: CONFIG.iterations,
            hasher: CryptoJS.algo.SHA256
        });

        const encKey = CryptoJS.lib.WordArray.create(derivedParams.words.slice(0, 8));
        const macKey = CryptoJS.lib.WordArray.create(derivedParams.words.slice(8, 16));

        // 2. Verify HMAC (Integrity Check)
        const dataToMac = iv.clone().concat(ciphertext);
        const calculatedMac = CryptoJS.HmacSHA256(dataToMac, macKey);

        const macStr = mac.toString(CryptoJS.enc.Hex);
        const calcMacStr = calculatedMac.toString(CryptoJS.enc.Hex);

        if (macStr !== calcMacStr) {
            return '';
        }

        // 3. Decrypt
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext } as CryptoJS.lib.CipherParams,
            encKey,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );

        return decrypted.toString(CryptoJS.enc.Utf8);

    } catch (error) {
        return '';
    }
};
