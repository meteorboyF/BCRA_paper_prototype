#!/usr/bin/env node
// The honest client's half of the restore-race (audit v2, case E): performs the
// EXACT flow TeamAccessPanel.tsx performs at grant time, against the live API,
// while the database holds whatever key the adversary has published.
//   1. GET /users/{id}/public-key            (the string the browser would see)
//   2. SHA-256 over the exact fetched string (crypto.ts attestKeyHash)
//   3. ECDH-ES wrap of the document key under the parsed fetched key
// Prints JSON {fetchedKeyHash, wrappedKeyToken} for the harness, which then lets
// the adversary restore the original key before submitting the grant.
//
// Usage: client_fetch_wrap.mjs <ownerToken> <recipientUserId> <docKeyB64>
import { webcrypto as crypto } from 'node:crypto'
const { subtle } = crypto
const BASE = process.env.API_URL || 'http://localhost:8080/api'
const [token, recipientId, docKeyB64] = process.argv.slice(2)
if (!token || !recipientId || !docKeyB64) {
  console.error('usage: client_fetch_wrap.mjs <ownerToken> <recipientUserId> <docKeyB64>')
  process.exit(2)
}
const b64 = (u8) => Buffer.from(u8).toString('base64')
const ub64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))

const res = await fetch(`${BASE}/users/${recipientId}/public-key`, {
  headers: { Authorization: `Bearer ${token}` },
})
if (!res.ok) { console.error(`public-key fetch failed: HTTP ${res.status}`); process.exit(1) }
const body = await res.json()
const fetchedString = body.publicKeyJwk // exact string, hashed as fetched (crypto.ts semantics)

const digest = await subtle.digest('SHA-256', new TextEncoder().encode(fetchedString))
const fetchedKeyHash = Buffer.from(digest).toString('hex')

const jwk = JSON.parse(fetchedString)
const pub = await subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
const wk = await subtle.deriveKey({ name: 'ECDH', public: pub }, eph.privateKey,
  { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
const iv = crypto.getRandomValues(new Uint8Array(12))
const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, wk, ub64(docKeyB64))
const ephRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey))
const out = new Uint8Array(ephRaw.length + iv.length + wrapped.byteLength)
out.set(ephRaw, 0); out.set(iv, ephRaw.length); out.set(new Uint8Array(wrapped), ephRaw.length + iv.length)

console.log(JSON.stringify({ fetchedKeyHash, wrappedKeyToken: b64(out) }))
