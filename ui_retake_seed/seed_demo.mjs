#!/usr/bin/env node
/**
 * UI-retake demo seeding — drives ONLY real REST flows against the running
 * backend, mirroring the frontend's client-side crypto byte-for-byte
 * (src/lib/crypto.ts: encryptDocument + eciesWrapKey), so every hash, CID,
 * wrapped-key token, and ledger transaction in the screenshots is genuine.
 *
 * Usage:
 *   node seed_demo.mjs register   # create the three formal users (PENDING)
 *   node seed_demo.mjs flows      # case + uploads + grant/download/revoke
 * Between the two phases the users must be activated and their UUIDs
 * appended to seed_state.json (see seed.sh).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const BASE = process.env.API_URL || 'http://localhost:8080/api'
const subtle = globalThis.crypto.subtle
const STATE = new URL('./seed_state.json', import.meta.url).pathname

const b64 = (u8) => Buffer.from(u8).toString('base64')
const ub64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))
const state = () => JSON.parse(readFileSync(STATE, 'utf8'))
const save = (s) => writeFileSync(STATE, JSON.stringify(s, null, 2))

const PASSWORD = 'Demo2026#Secure'
const USERS = [
  { key: 'rahman',    email: 'a.rahman@lawfirm-a.example',    fullName: 'A. Rahman',    role: 'ASSOCIATE_SENIOR', firmId: '27bf6a54-c85f-43f9-aa80-dbf8960cb9fd' },
  { key: 'chowdhury', email: 's.chowdhury@lawfirm-b.example', fullName: 'S. Chowdhury', role: 'ASSOCIATE_JUNIOR', firmId: '0aa13526-51b2-4125-86ae-8a766724b0c3' },
  { key: 'karim',     email: 'm.karim@regulator.example',     fullName: 'M. Karim',     role: 'REGULATOR',        firmId: 'd56e4dca-ac83-4fe1-befd-defdeb57a87b' },
]

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok && res.status !== 409) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return { status: res.status, json }
}

// ─── crypto mirrors of src/lib/crypto.ts ────────────────────────────────────

async function genKeypairJwk(alg, usages) {
  const kp = await subtle.generateKey({ name: alg, namedCurve: 'P-256' }, true, usages)
  return {
    publicJwk: await subtle.exportKey('jwk', kp.publicKey),
    privateJwk: await subtle.exportKey('jwk', kp.privateKey),
  }
}

async function encryptDocument(bytes) {
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const [ct, hD, rawKey] = await Promise.all([
    subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes),
    subtle.digest('SHA-256', bytes),
    subtle.exportKey('raw', key),
  ])
  const ctBytes = new Uint8Array(ct)
  const payload = new Uint8Array(iv.length + ctBytes.length)
  payload.set(iv, 0); payload.set(ctBytes, iv.length)
  const hC = await subtle.digest('SHA-256', payload)
  return {
    ciphertextB64: b64(ctBytes), ivB64: b64(iv),
    hashB64: b64(new Uint8Array(hD)), ciphertextHashB64: b64(new Uint8Array(hC)),
    keyB64: b64(new Uint8Array(rawKey)),
  }
}

async function eciesWrapKey(recipientPublicKeyJwk, keyB64) {
  const pub = await subtle.importKey('jwk', recipientPublicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const wk = await subtle.deriveKey({ name: 'ECDH', public: pub }, eph.privateKey,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, wk, ub64(keyB64))
  const ephRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey))
  const out = new Uint8Array(ephRaw.length + iv.length + wrapped.byteLength)
  out.set(ephRaw, 0); out.set(iv, ephRaw.length); out.set(new Uint8Array(wrapped), ephRaw.length + iv.length)
  return b64(out)
}

// Minimal valid single-page PDF with the given line of text.
function makePdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const objs = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  for (const o of objs) { offsets.push(pdf.length); pdf += o + '\n' }
  const xref = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n` +
    offsets.map((x) => `${String(x).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

const DOCS = [
  { fileName: 'Lease_Agreement_2019.pdf',   category: 'CONTRACT', text: 'Commercial Lease Agreement (2019) - premises at Plot 14, Motijheel C/A.' },
  { fileName: 'Amendment_No2_2021.pdf',     category: 'CONTRACT', text: 'Amendment No. 2 (2021) to the Commercial Lease Agreement.' },
  { fileName: 'Rent_Schedule_2022.pdf',     category: 'FINANCIAL', text: 'Agreed rent schedule for calendar year 2022.' },
  { fileName: 'Inspection_Report_2023.pdf', category: 'REPORT', text: 'Independent premises inspection report, March 2023.' },
]

async function phaseRegister() {
  const s = existsSync(STATE) ? state() : { users: {} }
  for (const u of USERS) {
    const ecies = await genKeypairJwk('ECDH', ['deriveKey'])
    const ecdsa = await genKeypairJwk('ECDSA', ['sign', 'verify'])
    const { status } = await api('POST', '/auth/register', {
      email: u.email, password: PASSWORD, fullName: u.fullName, role: u.role,
      firmId: u.firmId,
      publicKeyJwk: JSON.stringify(ecies.publicJwk),
      signingPublicKeyJwk: JSON.stringify(ecdsa.publicJwk),
    })
    s.users[u.key] = { ...u, ecies, ecdsa }
    console.log(`registered ${u.fullName} (${u.email}) -> HTTP ${status}`)
  }
  save(s)
}

async function login(email) {
  const { json } = await api('POST', '/auth/login', { email, password: PASSWORD })
  if (!json.accessToken) throw new Error(`login failed for ${email}: ${JSON.stringify(json).slice(0, 200)}`)
  return json.accessToken
}

async function phaseFlows() {
  const s = state()
  const rahman = s.users.rahman, chowdhury = s.users.chowdhury
  if (!chowdhury.id) throw new Error('user UUIDs missing — run the activation step (seed.sh) first')

  const tokenA = await login(rahman.email)

  // Case
  const { json: caseJson } = await api('POST', '/cases', {
    title: 'Case 2026-014 - Commercial Lease Dispute',
    description: 'Cross-firm document production for a commercial lease dispute (demo dataset).',
  }, tokenA)
  const caseId = caseJson.id
  console.log(`case created: ${caseId}`)

  // Uploads (real client-side encryption, real per-owner wrapped keys)
  s.docs = []
  for (const d of DOCS) {
    const enc = await encryptDocument(makePdf(d.text))
    const wrappedOwner = await eciesWrapKey(rahman.ecies.publicJwk, enc.keyB64)
    const { json } = await api('POST', '/documents/upload', {
      caseId: String(caseId), fileName: d.fileName, category: d.category,
      ivBase64: enc.ivB64, ciphertextBase64: enc.ciphertextB64,
      documentHashSha256: enc.hashB64, wrappedKeyTokenForOwner: wrappedOwner,
    }, tokenA)
    s.docs.push({ id: json.id, fileName: d.fileName, keyB64: enc.keyB64 })
    console.log(`uploaded ${d.fileName} -> ${json.id} (tx ${json.fabricTxId ?? 'none'})`)
  }
  save(s)

  // Cross-firm grant with expiry (doc 0 -> S. Chowdhury, 30 days)
  const wrapped0 = await eciesWrapKey(chowdhury.ecies.publicJwk, s.docs[0].keyB64)
  await api('POST', '/access/grant', {
    docId: String(s.docs[0].id), granteeId: chowdhury.id, capability: 'read',
    wrappedKeyToken: wrapped0, expiresAtEpochMs: Date.now() + 30 * 24 * 3600 * 1000,
  }, tokenA)
  console.log(`granted read on ${s.docs[0].fileName} to ${chowdhury.fullName} (30-day expiry)`)

  // Second grant that will be revoked (doc 1)
  const wrapped1 = await eciesWrapKey(chowdhury.ecies.publicJwk, s.docs[1].keyB64)
  await api('POST', '/access/grant', {
    docId: String(s.docs[1].id), granteeId: chowdhury.id, capability: 'read',
    wrappedKeyToken: wrapped1, expiresAtEpochMs: Date.now() + 30 * 24 * 3600 * 1000,
  }, tokenA)

  // Cross-firm download by the grantee (real CheckAccess on the release path)
  const tokenB = await login(chowdhury.email)
  const dl = await fetch(`${BASE}/documents/${s.docs[0].id}/download`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  })
  console.log(`grantee download of ${s.docs[0].fileName} -> HTTP ${dl.status} (${(await dl.arrayBuffer()).byteLength} bytes ciphertext)`)
  const wk = await api('GET', `/documents/${s.docs[0].id}/wrapped-key`, null, tokenB)
  console.log(`grantee wrapped-key fetch -> HTTP ${wk.status}`)

  // Revoke the second grant
  await api('DELETE', `/access/${s.docs[1].id}/user/${chowdhury.id}`, null, tokenA)
  console.log(`revoked ${chowdhury.fullName}'s grant on ${s.docs[1].fileName}`)

  console.log('flows complete')
}

const phase = process.argv[2]
if (phase === 'register') await phaseRegister()
else if (phase === 'flows') await phaseFlows()
else { console.error('usage: seed_demo.mjs register|flows'); process.exit(1) }
