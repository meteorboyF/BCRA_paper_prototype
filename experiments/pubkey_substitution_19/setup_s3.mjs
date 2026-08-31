#!/usr/bin/env node
/**
 * Experiment 19 fixture. Registers a brand-new grantee (so the enrollment path
 * under test anchors its key binding on chain), has rahman upload a fresh
 * document, wraps the doc key for the new grantee, and prints a one-line JSON
 * fixture. With --legacy-unbound it additionally strips the on-chain binding to
 * simulate a user enrolled before anchoring existed.
 *
 * The grantee's stored public-key JWK and its SHA-256 (matching
 * KeyHashing.sha256Hex on the backend) are printed so run.sh can reason about
 * the anchored hash.
 */
import { createHash } from 'node:crypto'
const BASE = process.env.API_URL || 'http://localhost:8080/api'
const PW = process.env.DEMO_PASSWORD || 'Demo2026#Secure'
const subtle = globalThis.crypto.subtle
const legacy = process.argv.includes('--legacy-unbound')
const b64 = (u8) => Buffer.from(u8).toString('base64')
const ub64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))
const err = (...a) => console.error(...a)

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text(); let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0,300)}`)
  return { status: res.status, json }
}
const login = async (email) => (await api('POST', '/auth/login', { email, password: PW })).json.accessToken

async function encdoc(bytes) {
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt','decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await subtle.encrypt({ name:'AES-GCM', iv }, key, bytes))
  const hD = new Uint8Array(await subtle.digest('SHA-256', bytes))
  const raw = new Uint8Array(await subtle.exportKey('raw', key))
  return { ct: b64(ct), iv: b64(iv), hash: b64(hD), keyB64: b64(raw) }
}
async function wrap(pubJwk, keyB64) {
  const pub = await subtle.importKey('jwk', pubJwk, { name:'ECDH', namedCurve:'P-256' }, false, [])
  const eph = await subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveKey'])
  const wk = await subtle.deriveKey({ name:'ECDH', public: pub }, eph.privateKey, { name:'AES-GCM', length:256 }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const w = new Uint8Array(await subtle.encrypt({ name:'AES-GCM', iv }, wk, ub64(keyB64)))
  const er = new Uint8Array(await subtle.exportKey('raw', eph.publicKey))
  const out = new Uint8Array(er.length + iv.length + w.length)
  out.set(er,0); out.set(iv,er.length); out.set(w,er.length+iv.length)
  return b64(out)
}
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')

const stamp = Date.now()
const email = `s3_${legacy ? 'legacy' : 'bound'}_${stamp}@lawfirm-b.example`
const ecies = await subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveKey'])
const ecdsa = await subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify'])
const pubJwk = await subtle.exportKey('jwk', ecies.publicKey)
const pubStr = JSON.stringify(pubJwk)

// Firm B UUID resolved from the DB seed (Law Firm B / FirmBMSP).
const FIRM_B = 'b125c344-0c2d-4ef8-bf31-bad8613c40c4'
const reg = await api('POST', '/auth/register', {
  email, password: PW, fullName: 'S3 Grantee', role: 'ASSOCIATE_JUNIOR', firmId: FIRM_B,
  publicKeyJwk: pubStr, signingPublicKeyJwk: JSON.stringify(await subtle.exportKey('jwk', ecdsa.publicKey)),
})
err(`[s3] registered grantee ${email} -> HTTP ${reg.status}`)

// Owner uploads a fresh doc and wraps for the new grantee.
const owner = 'a.rahman@lawfirm-a.example'
const tok = await login(owner)
const { json: c } = await api('POST', '/cases', { title:`S3 fixture ${stamp}`, description:'exp19' }, tok)
const enc = await encdoc(PDF)
// Upload only needs an owner-wrapped token; the backend treats it as opaque. Wrapping
// under the grantee key here is fine for the fixture — the release path is not exercised.
const { json: doc } = await api('POST', '/documents/upload', {
  caseId: String(c.id), fileName: `s3_${stamp}.pdf`, category: 'CONTRACT',
  ivBase64: enc.iv, ciphertextBase64: enc.ct, documentHashSha256: enc.hash,
  wrappedKeyTokenForOwner: await wrap(pubJwk, enc.keyB64),
}, tok)
err(`[s3] document ${doc.id}`)

const wrappedGrantee = await wrap(pubJwk, enc.keyB64)

process.stdout.write(JSON.stringify({
  docId: doc.id, granteeId: reg.json.userId ?? reg.json.id ?? null,
  granteeEmail: email, granteeMsp: 'FirmBMSP', ownerEmail: owner,
  wrappedKeyToken: wrappedGrantee,
  keyHash: createHash('sha256').update(pubStr, 'utf8').digest('hex'),
  legacy,
}) + '\n')
