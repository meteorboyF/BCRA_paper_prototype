import { describe, it, expect } from 'vitest'
import {
  encryptDocument,
  decryptDocument,
  eciesWrapKey,
  eciesUnwrapKey,
  verifyIntegrity,
  generateEciesKeypair,
  unwrapPrivateKey,
  bytesToBase64,
  base64ToBytes,
} from '../lib/crypto'

// jsdom ships with a Web Crypto implementation — use it directly
const subtle = globalThis.crypto.subtle

describe('encryptDocument', () => {
  it('returns ciphertextB64, ivB64, hashB64, keyB64', async () => {
    const plaintext = new TextEncoder().encode('Hello PangoChain').buffer as ArrayBuffer
    const result = await encryptDocument(plaintext)

    expect(result.ciphertextB64).toBeTruthy()
    expect(result.ivB64).toBeTruthy()
    expect(result.hashB64).toBeTruthy()
    expect(result.keyB64).toBeTruthy()
  })

  it('IV decodes to exactly 12 bytes', async () => {
    const plaintext = new TextEncoder().encode('IV length test').buffer as ArrayBuffer
    const { ivB64 } = await encryptDocument(plaintext)
    const iv = base64ToBytes(ivB64)
    expect(iv.length).toBe(12)
  })
})

describe('decryptDocument', () => {
  it('decrypts back to original plaintext', async () => {
    const original = 'Secret legal document content'
    const plaintext = new TextEncoder().encode(original).buffer as ArrayBuffer

    const { ciphertextB64, ivB64, keyB64 } = await encryptDocument(plaintext)
    const decrypted = await decryptDocument(ciphertextB64, ivB64, keyB64)

    const decoded = new TextDecoder().decode(decrypted)
    expect(decoded).toBe(original)
  })

  it('rejects decryption with wrong key', async () => {
    const plaintext = new TextEncoder().encode('Confidential').buffer as ArrayBuffer
    const { ciphertextB64, ivB64 } = await encryptDocument(plaintext)

    // Generate a different key
    const wrongKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const wrongKeyRaw = await subtle.exportKey('raw', wrongKey)
    const wrongKeyB64 = bytesToBase64(new Uint8Array(wrongKeyRaw))

    await expect(decryptDocument(ciphertextB64, ivB64, wrongKeyB64)).rejects.toThrow()
  })
})

describe('verifyIntegrity', () => {
  it('returns true for matching hash', async () => {
    const plaintext = new TextEncoder().encode('Legal document').buffer as ArrayBuffer
    const hashBuffer = await subtle.digest('SHA-256', plaintext)
    const expectedHashB64 = bytesToBase64(new Uint8Array(hashBuffer))

    const result = await verifyIntegrity(plaintext, expectedHashB64)
    expect(result).toBe(true)
  })

  it('returns false for wrong hash — never throws', async () => {
    const plaintext = new TextEncoder().encode('Tampered content').buffer as ArrayBuffer
    const wrongHashB64 = bytesToBase64(new Uint8Array(32)) // all zeros

    const result = await verifyIntegrity(plaintext, wrongHashB64)
    expect(result).toBe(false)
  })
})

describe('ECIES key wrap/unwrap roundtrip', () => {
  it('wraps and unwraps a document key correctly', async () => {
    const password = 'test-password-123'
    const { publicKeyJwk, privateKeyEncryptedB64, saltB64, ivB64 } = await generateEciesKeypair(password)

    // Generate a document key to wrap
    const docKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const rawDocKey = await subtle.exportKey('raw', docKey)
    const docKeyB64 = bytesToBase64(new Uint8Array(rawDocKey))

    // Wrap under recipient's public key
    const wrappedToken = await eciesWrapKey(publicKeyJwk, docKeyB64)
    expect(wrappedToken).toBeTruthy()

    // Unwrap using private key
    const privateKey = await unwrapPrivateKey(password, saltB64, ivB64, privateKeyEncryptedB64)
    const unwrappedKeyB64 = await eciesUnwrapKey(privateKey, wrappedToken)

    expect(unwrappedKeyB64).toBe(docKeyB64)
  })

  it('full roundtrip: encrypt → wrap → unwrap → decrypt → verify', async () => {
    const original = 'End-to-end encrypted legal document'
    const plaintext = new TextEncoder().encode(original).buffer as ArrayBuffer
    const password = 'vault-password'

    // 1. Encrypt document
    const { ciphertextB64, ivB64, hashB64, keyB64 } = await encryptDocument(plaintext)

    // 2. Generate ECIES keypair and wrap doc key
    const { publicKeyJwk, privateKeyEncryptedB64, saltB64, ivB64: pkIvB64 } = await generateEciesKeypair(password)
    const wrappedToken = await eciesWrapKey(publicKeyJwk, keyB64)

    // 3. Unwrap doc key using private key
    const privateKey = await unwrapPrivateKey(password, saltB64, pkIvB64, privateKeyEncryptedB64)
    const recoveredKeyB64 = await eciesUnwrapKey(privateKey, wrappedToken)

    // 4. Decrypt document
    const decrypted = await decryptDocument(ciphertextB64, ivB64, recoveredKeyB64)

    // 5. Verify integrity
    const valid = await verifyIntegrity(decrypted, hashB64)

    expect(valid).toBe(true)
    expect(new TextDecoder().decode(decrypted)).toBe(original)
  })
})
