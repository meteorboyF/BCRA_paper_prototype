#!/usr/bin/env node
/**
 * Experiment 2 re-run — fixture setup.
 *
 * Creates a case and one browser-encrypted document owned by rahman, using the
 * real REST flows and the same client-side crypto as the frontend, then prints
 * a one-line JSON fixture ({jwt, docId, caseId, ...}) on stdout.
 *
 * The measured principal is the document *owner*, matching the original Exp 2
 * run. Post-M5 the owner still passes CheckAccess through the user-level ACL
 * branch, because RegisterDocument issues the uploader an explicit grant — the
 * removed implicit ownership fallback was never on this path (the user-level
 * grant is checked first). Measuring the owner therefore keeps the comparison
 * like-for-like against the 6.51 ms figure.
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
  return {
    ciphertextB64: b64(new Uint8Array(ct)), ivB64: b64(iv),
    hashB64: b64(new Uint8Array(hD)), keyB64: b64(new Uint8Array(rawKey)),
  }
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
const rahman = s.users.rahman
if (!rahman?.id) throw new Error('seed_state.json missing rahman UUID — run ui_retake_seed/seed_demo.mjs first')

const token = await login(rahman.email)
err(`[setup] logged in owner ${rahman.email}`)

const { json: caseJson } = await api('POST', '/cases', {
  title: `Exp2 rerun fixture ${new Date().toISOString()}`,
  description: 'Throwaway case created by experiments/function_latency_exp2/setup.mjs',
}, token)
const caseId = caseJson.id
err(`[setup] case ${caseId}`)

const enc = await encryptDocument(makePdf('Experiment 2 re-run fixture document — function-level latency.'))
const wrappedOwner = await eciesWrapKey(rahman.ecies.publicJwk, enc.keyB64)
const { json: docJson } = await api('POST', '/documents/upload', {
  caseId: String(caseId), fileName: `exp2_fixture_${Date.now()}.pdf`, category: 'CONTRACT',
  ivBase64: enc.ivB64, ciphertextBase64: enc.ciphertextB64,
  documentHashSha256: enc.hashB64, wrappedKeyTokenForOwner: wrappedOwner,
}, token)
const docId = docJson.id
err(`[setup] document ${docId} (fabricTx ${docJson.fabricTxId ?? 'none'})`)
if (!docJson.fabricTxId && process.env.REQUIRE_FABRIC_TX !== 'false') {
  throw new Error('upload returned no fabricTxId — the ledger write path is not live; refusing to measure')
}

// Prove the read path the measurement will exercise actually returns 200 before
// committing to 120 samples of it.
const probe = await api('GET', `/documents/${docId}/wrapped-key`, null, token)
err(`[setup] wrapped-key probe -> ${probe.status}`)

process.stdout.write(JSON.stringify({
  jwt: token, docId, caseId, ownerId: rahman.id, ownerEmail: rahman.email, ownerMsp: 'FirmAMSP',
}) + '\n')
