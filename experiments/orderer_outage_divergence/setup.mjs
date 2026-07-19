#!/usr/bin/env node
/**
 * Experiment 16 setup — creates a fresh, self-contained fixture for the
 * orderer-only outage divergence run:
 *   1. a new case owned by LawFirmA (rahman),
 *   2. a freshly uploaded, browser-encrypted document, and
 *   3. an active cross-firm read grant to LawFirmB (chowdhury), with the
 *      document key ECIES-wrapped under chowdhury's public key.
 *
 * Every byte is produced through the real REST flows and the same
 * client-side crypto as the frontend (src/lib/crypto.ts), so the grant the
 * outage sequence later exercises is genuine ledger + DB state, not injected.
 *
 * Reuses the demo users registered by ui_retake_seed/seed_demo.mjs (their
 * UUIDs and public keys live in ui_retake_seed/seed_state.json). Prints a
 * one-line JSON fixture ({docId, granteeId, caseId, ...}) on stdout for run.sh.
 *
 * Usage: node setup.mjs [path-to-seed_state.json]
 */
import { readFileSync } from 'node:fs'

const BASE = process.env.API_URL || 'http://localhost:8080/api'
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026#Secure'
const subtle = globalThis.crypto.subtle
const STATE = process.argv[2] || new URL('../../ui_retake_seed/seed_state.json', import.meta.url).pathname

const b64 = (u8) => Buffer.from(u8).toString('base64')
const ub64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))
const err = (...a) => console.error(...a)

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  return { status: res.status, json }
}

async function login(email) {
  const { json } = await api('POST', '/auth/login', { email, password: PASSWORD })
  if (!json.accessToken) throw new Error(`login failed for ${email}: ${JSON.stringify(json).slice(0, 200)}`)
  return json.accessToken
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
  return { ciphertextB64: b64(ctBytes), ivB64: b64(iv), hashB64: b64(new Uint8Array(hD)), keyB64: b64(new Uint8Array(rawKey)) }
}

async function eciesWrapKey(recipientPublicKeyJwk, keyB64) {
  const pub = await subtle.importKey('jwk', recipientPublicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const wk = await subtle.deriveKey({ name: 'ECDH', public: pub }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, wk, ub64(keyB64))
  const ephRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey))
  const out = new Uint8Array(ephRaw.length + iv.length + wrapped.byteLength)
  out.set(ephRaw, 0); out.set(iv, ephRaw.length); out.set(new Uint8Array(wrapped), ephRaw.length + iv.length)
  return b64(out)
}

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

const s = JSON.parse(readFileSync(STATE, 'utf8'))
const rahman = s.users.rahman, chowdhury = s.users.chowdhury
if (!rahman?.id || !chowdhury?.id) throw new Error('seed_state.json missing user UUIDs — run ui_retake_seed/seed_demo.mjs first')
if (!chowdhury.ecies?.publicJwk) throw new Error('seed_state.json missing chowdhury ECIES public key')

const tokenA = await login(rahman.email)
err(`[setup] logged in owner ${rahman.email}`)

const { json: caseJson } = await api('POST', '/cases', {
  title: `Exp16 orderer-outage fixture ${new Date().toISOString()}`,
  description: 'Throwaway case created by experiments/orderer_outage_divergence/setup.mjs',
}, tokenA)
const caseId = caseJson.id
err(`[setup] case ${caseId}`)

const enc = await encryptDocument(makePdf('Experiment 16 fixture document — orderer-only outage divergence.'))
const wrappedOwner = await eciesWrapKey(rahman.ecies.publicJwk, enc.keyB64)
const { json: docJson } = await api('POST', '/documents/upload', {
  caseId: String(caseId), fileName: `exp16_fixture_${Date.now()}.pdf`, category: 'CONTRACT',
  ivBase64: enc.ivB64, ciphertextBase64: enc.ciphertextB64,
  documentHashSha256: enc.hashB64, wrappedKeyTokenForOwner: wrappedOwner,
}, tokenA)
const docId = docJson.id
err(`[setup] document ${docId} (fabricTx ${docJson.fabricTxId ?? 'none'})`)

const wrapped = await eciesWrapKey(chowdhury.ecies.publicJwk, enc.keyB64)
await api('POST', '/access/grant', {
  docId: String(docId), granteeId: chowdhury.id, capability: 'read',
  wrappedKeyToken: wrapped, expiresAtEpochMs: Date.now() + 30 * 24 * 3600 * 1000,
}, tokenA)
err(`[setup] granted read on ${docId} to ${chowdhury.email} (30-day expiry)`)

// One-line JSON fixture for run.sh (stdout only; all human logs go to stderr).
process.stdout.write(JSON.stringify({
  docId, granteeId: chowdhury.id, granterId: rahman.id,
  granteeEmail: chowdhury.email, granterEmail: rahman.email,
  granteeMsp: 'FirmBMSP', ownerMsp: rahman.firmId ? 'FirmAMSP' : 'FirmAMSP', caseId,
}) + '\n')
