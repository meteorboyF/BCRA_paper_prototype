/**
 * PangoChain Client-Side Cryptography
 *
 * All document encryption occurs here — plaintext NEVER leaves the browser.
 * Implements:
 *   - ECIES P-256 keypair generation (registration)
 *   - PBKDF2-SHA256 600k iterations (password key derivation)
 *   - AES-256-GCM document encryption/decryption
 *   - ECIES key wrapping (ECDH + AES-GCM) for sharing document keys
 */

const subtle = window.crypto.subtle

// ─── PBKDF2 ───────────────────────────────────────────────────────────────────
// Parameters per NIST SP 800-132 (2023): SHA-256, 600,000 iterations, 256-bit random salt per user.
const PBKDF2_ITERATIONS = 600_000 as const

export async function derivePbkdf2Key(password: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const salt = base64ToBytes(saltBase64)

  const baseKey = await subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'],
  )

  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ─── ECIES P-256 Keypair ──────────────────────────────────────────────────────

export interface EciesKeyPair {
  publicKeyJwk: JsonWebKey
  privateKeyEncryptedB64: string  // skU wrapped under PBKDF2-derived key
  saltB64: string                 // salt for PBKDF2 re-derivation on login
  ivB64: string                   // IV for private key ciphertext
}

export async function generateEciesKeypair(password: string): Promise<EciesKeyPair> {
  // 1. Generate ECDH P-256 keypair
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,   // extractable — we export the private key to wrap it
    ['deriveKey'],
  )

  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey)
  const privateKeyRaw = await subtle.exportKey('pkcs8', keyPair.privateKey)

  // 2. Derive wrapping key from password via PBKDF2
  const saltBytes = crypto.getRandomValues(new Uint8Array(32))
  const saltB64 = bytesToBase64(saltBytes)
  const wrappingKey = await derivePbkdf2Key(password, saltB64)

  // 3. Encrypt private key under wrapping key (AES-256-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    privateKeyRaw,
  )

  return {
    publicKeyJwk,
    privateKeyEncryptedB64: bytesToBase64(new Uint8Array(ciphertext)),
    saltB64,
    ivB64: bytesToBase64(iv),
  }
}

export async function unwrapPrivateKey(
  password: string,
  saltB64: string,
  ivB64: string,
  encryptedB64: string,
): Promise<CryptoKey> {
  const wrappingKey = await derivePbkdf2Key(password, saltB64)
  const iv = base64ToBytes(ivB64)
  const ciphertext = base64ToBytes(encryptedB64)

  const rawPrivateKey = await subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ciphertext)

  return subtle.importKey('pkcs8', rawPrivateKey, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
}

// ─── AES-256-GCM Document Encryption ─────────────────────────────────────────

export interface EncryptedDocument {
  ciphertextB64: string
  ivB64: string
  hashB64: string   // SHA-256 of original plaintext for on-chain anchoring
  keyB64: string    // raw AES-256 key bytes (base64) — wrap before sending to server
}

export async function encryptDocument(file: ArrayBuffer): Promise<EncryptedDocument> {
  // Fresh key + IV per document
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const [ciphertext, hashBuffer, rawKey] = await Promise.all([
    subtle.encrypt({ name: 'AES-GCM', iv }, key, file),
    subtle.digest('SHA-256', file),
    subtle.exportKey('raw', key),
  ])

  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
    hashB64: bytesToBase64(new Uint8Array(hashBuffer)),
    keyB64: bytesToBase64(new Uint8Array(rawKey)),
  }
}

export async function decryptDocument(
  ciphertextB64: string,
  ivB64: string,
  keyB64: string,
): Promise<ArrayBuffer> {
  const rawKey = base64ToBytes(keyB64)
  const iv = base64ToBytes(ivB64)
  const ciphertext = base64ToBytes(ciphertextB64)

  const key = await subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  return subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
}

// ─── ECIES Key Wrapping (ECDH + AES-GCM) ────────────────────────────────────

/**
 * Wrap a document key (keyB64) with recipient's P-256 public key.
 * Uses ECDH to derive a shared secret, then AES-GCM to encrypt the key.
 * Output is a single base64 blob: ephemeralPubKey(65) || iv(12) || wrapped(32+16)
 */
export async function eciesWrapKey(recipientPublicKeyJwk: JsonWebKey, keyB64: string): Promise<string> {
  const recipientPubKey = await subtle.importKey(
    'jwk', recipientPublicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )

  // Generate ephemeral keypair for this wrapping operation
  const ephemeral = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'],
  )

  // ECDH shared secret → AES-256-GCM wrapping key
  const wrappingKey = await subtle.deriveKey(
    { name: 'ECDH', public: recipientPubKey },
    ephemeral.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const docKeyBytes = base64ToBytes(keyB64)
  const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, docKeyBytes)

  // Export ephemeral public key in raw (uncompressed) form — 65 bytes
  const ephPubRaw = new Uint8Array(await subtle.exportKey('raw', ephemeral.publicKey))

  // Pack: [ephPubRaw(65) || iv(12) || wrapped(48)]
  const total = new Uint8Array(ephPubRaw.length + iv.length + wrapped.byteLength)
  total.set(ephPubRaw, 0)
  total.set(iv, ephPubRaw.length)
  total.set(new Uint8Array(wrapped), ephPubRaw.length + iv.length)

  return bytesToBase64(total)
}

/**
 * Unwrap a document key using the recipient's private ECDH key.
 */
export async function eciesUnwrapKey(
  recipientPrivateKey: CryptoKey,
  wrappedTokenB64: string,
): Promise<string> {
  const blob = base64ToBytes(wrappedTokenB64)

  const ephPubRaw = blob.slice(0, 65)
  const iv = blob.slice(65, 77)
  const wrapped = blob.slice(77)

  const ephPubKey = await subtle.importKey(
    'raw', ephPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )

  const wrappingKey = await subtle.deriveKey(
    { name: 'ECDH', public: ephPubKey },
    recipientPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )

  const rawKey = await subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, wrapped)
  return bytesToBase64(new Uint8Array(rawKey))
}

// ─── ECDSA P-256 Keypair (signing) ───────────────────────────────────────────

export interface EcdsaKeyPair {
  publicKeyJwk: JsonWebKey
  privateKeyEncryptedB64: string
  saltB64: string
  ivB64: string
}

export async function generateEcdsaKeypair(password: string): Promise<EcdsaKeyPair> {
  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )

  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey)
  const privateKeyRaw = await subtle.exportKey('pkcs8', keyPair.privateKey)

  const saltBytes = crypto.getRandomValues(new Uint8Array(32))
  const saltB64 = bytesToBase64(saltBytes)
  const wrappingKey = await derivePbkdf2Key(password, saltB64)

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, privateKeyRaw)

  return {
    publicKeyJwk,
    privateKeyEncryptedB64: bytesToBase64(new Uint8Array(ciphertext)),
    saltB64,
    ivB64: bytesToBase64(iv),
  }
}

export async function unwrapEcdsaPrivateKey(
  password: string,
  saltB64: string,
  ivB64: string,
  encryptedB64: string,
): Promise<CryptoKey> {
  const wrappingKey = await derivePbkdf2Key(password, saltB64)
  const iv = base64ToBytes(ivB64)
  const ciphertext = base64ToBytes(encryptedB64)
  const rawPrivateKey = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ciphertext,
  )
  return subtle.importKey('pkcs8', rawPrivateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

export async function signDocumentHash(hashB64: string, privateKey: CryptoKey): Promise<string> {
  const hashBytes = base64ToBytes(hashB64)
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    hashBytes,
  )
  return bytesToBase64(new Uint8Array(signature))
}

const ECDSA_KEY_PREFIX = 'pangochain_signing_key_'

export function storeWrappedEcdsaKey(userId: string, data: {
  encryptedB64: string
  saltB64: string
  ivB64: string
}) {
  localStorage.setItem(ECDSA_KEY_PREFIX + userId, JSON.stringify(data))
}

export function loadWrappedEcdsaKey(userId: string): {
  encryptedB64: string
  saltB64: string
  ivB64: string
} | null {
  const raw = localStorage.getItem(ECDSA_KEY_PREFIX + userId)
  return raw ? JSON.parse(raw) : null
}

// ─── Integrity Verification ──────────────────────────────────────────────────

export async function verifyIntegrity(plaintext: ArrayBuffer, expectedHashB64: string): Promise<boolean> {
  const hashBuffer = await subtle.digest('SHA-256', plaintext)
  const actualHashB64 = bytesToBase64(new Uint8Array(hashBuffer))
  return actualHashB64 === expectedHashB64
}

// ─── Local Key Storage (localStorage) ───────────────────────────────────────

const KEY_PREFIX = 'pangochain_key_'

export function storeWrappedPrivateKey(userId: string, data: {
  encryptedB64: string
  saltB64: string
  ivB64: string
}) {
  localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(data))
}

export function loadWrappedPrivateKey(userId: string): {
  encryptedB64: string
  saltB64: string
  ivB64: string
} | null {
  const raw = localStorage.getItem(KEY_PREFIX + userId)
  return raw ? JSON.parse(raw) : null
}

export function clearStoredKey(userId: string) {
  localStorage.removeItem(KEY_PREFIX + userId)
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length) as Uint8Array<ArrayBuffer>
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
