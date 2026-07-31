/**
 * Registers (or reuses) a LawFirmA user who holds no grant on the fixture document.
 *
 * This user is the same-organization adversary for Experiment 18 case 3: they are not on
 * the document's ACL in either store, so under per-user enforcement they should be denied.
 * Prints {"id":..., "email":...} on stdout.
 *
 * Usage: node setup-attacker.mjs
 */
const BASE = process.env.API_URL || 'http://localhost:8080/api'
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026#Secure'
const FIRM_A = process.env.FIRM_A_ID || '27bf6a54-c85f-43f9-aa80-dbf8960cb9fd'
const EMAIL = process.env.ATTACKER_EMAIL || 'insider.firma@lawfirm-a.example'
const subtle = globalThis.crypto.subtle
const err = (m) => process.stderr.write(m + '\n')

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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function login(email) {
  return api('POST', '/auth/login', { email, password: PASSWORD })
}

async function exportJwk() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  return JSON.stringify(await subtle.exportKey('jwk', kp.publicKey))
}

// Reuse the account across runs so repeated runs do not accumulate users.
let session
try {
  session = await login(EMAIL)
  err(`[attacker] reusing existing ${EMAIL}`)
} catch {
  err(`[attacker] registering ${EMAIL} in LawFirmA`)
  await api('POST', '/auth/register', {
    email: EMAIL,
    password: PASSWORD,
    fullName: 'Insider FirmA',
    firmId: FIRM_A,
    role: 'ASSOCIATE_JUNIOR',
    publicKeyJwk: await exportJwk(),
    signingPublicKeyJwk: await exportJwk(),
  })
  session = await login(EMAIL)
}
process.stdout.write(JSON.stringify({ id: session.userId, email: EMAIL, firmId: session.firmId }) + '\n')
