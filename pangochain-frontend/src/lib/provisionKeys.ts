import api from './api'
import {
  generateEciesKeypair,
  generateEcdsaKeypair,
  storeWrappedPrivateKey,
  storeWrappedEcdsaKey,
  loadWrappedPrivateKey,
} from './crypto'

/**
 * First-login key provisioning. Accounts created server-side (e.g. seeded demo users)
 * have no cryptographic keys until they log in through a browser. On first login we
 * generate the ECIES (encryption) and ECDSA (signing) keypairs locally, keep the
 * PBKDF2-wrapped private keys in localStorage (client-only), and register the public
 * keys with the server — exactly what browser registration does, just lazily.
 *
 * No-op if this device already holds the user's wrapped private key.
 * Failures are swallowed by the caller so they never block login; the user can still
 * use non-E2E features and provisioning will retry next login.
 */
export async function ensureUserKeys(userId: string, password: string): Promise<boolean> {
  if (loadWrappedPrivateKey(userId)) return false // already provisioned on this device

  const [ecies, ecdsa] = await Promise.all([
    generateEciesKeypair(password),
    generateEcdsaKeypair(password),
  ])

  storeWrappedPrivateKey(userId, {
    encryptedB64: ecies.privateKeyEncryptedB64,
    saltB64: ecies.saltB64,
    ivB64: ecies.ivB64,
  })
  storeWrappedEcdsaKey(userId, {
    encryptedB64: ecdsa.privateKeyEncryptedB64,
    saltB64: ecdsa.saltB64,
    ivB64: ecdsa.ivB64,
  })

  await api.put('/users/me/public-keys', {
    publicKeyJwk: JSON.stringify(ecies.publicKeyJwk),
    signingPublicKeyJwk: JSON.stringify(ecdsa.publicKeyJwk),
  })
  return true
}
