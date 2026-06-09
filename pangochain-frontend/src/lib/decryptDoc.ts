import api from './api'
import { eciesUnwrapKey, base64ToBytes, verifyIntegrity } from './crypto'

/**
 * Fetch a document's ciphertext + wrapped key, unwrap the AES key with the caller's already-unlocked
 * ECIES private key, AES-256-GCM decrypt, and optionally verify the SHA-256 against the ledger hash.
 * Returns the plaintext bytes. Shared by the secure-download flow, court-bundle assembly, and the
 * case-archive export so the decryption path lives in one place.
 */
export async function decryptDocumentToBytes(
  docId: string,
  privateKey: CryptoKey,
  expectedHash?: string,
): Promise<ArrayBuffer> {
  const [ciphertextRes, wrappedKeyRes] = await Promise.all([
    api.get(`/documents/${docId}/ciphertext`, { responseType: 'arraybuffer' }),
    api.get(`/documents/${docId}/wrapped-key`),
  ])
  const ciphertextBytes: ArrayBuffer = ciphertextRes.data
  const wrappedKeyToken: string = wrappedKeyRes.data

  const docKeyB64 = await eciesUnwrapKey(privateKey, wrappedKeyToken)

  const fullBytes = new Uint8Array(ciphertextBytes)
  const iv = fullBytes.slice(0, 12)
  const ciphertext = fullBytes.slice(12)
  const docKey = base64ToBytes(docKeyB64)
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw', docKey.buffer as ArrayBuffer, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  )
  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, cryptoKey, ciphertext.buffer as ArrayBuffer,
  )

  if (expectedHash) {
    const valid = await verifyIntegrity(plaintext, expectedHash)
    if (!valid) throw new Error('INTEGRITY_FAILED')
  }
  return plaintext
}

/** Decode bytes as UTF-8 text if they look textual (no NUL bytes in the first 512 bytes). */
export function bytesToTextIfPrintable(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  const sample = bytes.subarray(0, 512)
  for (const b of sample) {
    if (b === 0) return null // NUL → almost certainly binary
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return null
  }
}
