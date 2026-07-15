#!/usr/bin/env node
import { webcrypto, randomFillSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const subtle = webcrypto.subtle;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(repoRoot, 'results');
const csvPath = path.join(resultsDir, 'exp6_crypto.csv');
const summaryPath = path.join(resultsDir, 'exp6_crypto.summary.json');
const environmentPath = path.join(resultsDir, 'exp6_crypto.environment.json');
const rawPath = path.join(resultsDir, 'exp6_crypto.raw.txt');

const TRIALS = Number.parseInt(process.env.EXP6_TRIALS || '10', 10);
const PBKDF2_ITERATIONS = 600_000;
const SIZES = [1, 10, 50].map((mb) => ({ mb, bytes: mb * 1024 * 1024 }));
const commandUsed = `node ${path.relative(repoRoot, fileURLToPath(import.meta.url))}`;
const timestamp = new Date().toISOString();
const rawLog = [];

function log(line = '') {
  rawLog.push(line);
  console.log(line);
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function randomBytes(length) {
  const b = new Uint8Array(length);
  randomFillSync(b);
  return b;
}

function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    const bytes = part instanceof Uint8Array ? part : new Uint8Array(part);
    out.set(bytes, offset);
    offset += bytes.byteLength;
  }
  return out;
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const pick = (q) => sorted[Math.min(n - 1, Math.ceil(q * n) - 1)];
  return {
    n,
    mean: Number(mean.toFixed(6)),
    p50: Number(pick(0.50).toFixed(6)),
    p95: Number(pick(0.95).toFixed(6)),
    min: Number(sorted[0].toFixed(6)),
    max: Number(sorted[n - 1].toFixed(6)),
    stdev: Number(Math.sqrt(variance).toFixed(6)),
    raw_latency_ms: values.map((v) => Number(v.toFixed(6))),
  };
}

async function timeMs(fn) {
  const start = performance.now();
  const result = await fn();
  return { latency: performance.now() - start, result };
}

async function detectBrowserTooling() {
  const attempts = [];
  for (const pkg of ['playwright', 'puppeteer']) {
    try {
      await import(pkg);
      attempts.push({ package: pkg, available: true });
      return { browserAvailable: true, selected: pkg, attempts };
    } catch (err) {
      attempts.push({ package: pkg, available: false, error: err.code || err.message });
    }
  }
  return { browserAvailable: false, selected: null, attempts };
}

const browserDetection = await detectBrowserTooling();
const runtime = browserDetection.browserAvailable ? 'browser-webcrypto' : 'node-webcrypto';
const browserName = browserDetection.browserAvailable ? browserDetection.selected : 'n/a';
const browserVersion = 'n/a';
const userAgent = `Node.js ${process.version} (${process.platform}; ${process.arch}) crypto.webcrypto.subtle`;
const platform = `${os.type()} ${os.release()} ${os.arch()}`;
const rows = [];
const notesBase = browserDetection.browserAvailable
  ? `Browser tooling ${browserDetection.selected} detected; benchmark still executed by Node harness in this version.`
  : 'Playwright/Puppeteer not installed; used Node.js crypto.webcrypto.subtle fallback.';

function addRow(operation, trial, latencyMs, inputSizeBytes, outputSizeBytes, notes = '') {
  rows.push({
    experiment: 'exp6_crypto',
    operation,
    trial,
    runtime,
    platform,
    user_agent: userAgent,
    node_version: process.version,
    browser_name: browserName,
    browser_version: browserVersion,
    input_size_bytes: inputSizeBytes ?? '',
    latency_ms: Number(latencyMs.toFixed(6)),
    output_size_bytes: outputSizeBytes ?? '',
    notes: notes ? `${notesBase} ${notes}` : notesBase,
  });
}

log('=== PangoChain Experiment 6 Crypto Benchmark ===');
log(`Timestamp: ${timestamp}`);
log(`Runtime: ${runtime}`);
log(`Command: ${commandUsed}`);
log(`Trials per operation: ${TRIALS}`);
log(`Browser tooling detection: ${JSON.stringify(browserDetection.attempts)}`);
log('');

// Shared keys and buffers.
const documentKey = randomBytes(32);

log('Generating reusable key material...');
const recipientEcdh = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
const rsaOaep = await subtle.generateKey(
  { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['encrypt', 'decrypt'],
);
const aesKeys = new Map();
const aesInputs = new Map();
const aesCiphertexts = new Map();
for (const { bytes } of SIZES) {
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const plaintext = randomBytes(bytes);
  const iv = randomBytes(12);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  aesKeys.set(bytes, { key, iv });
  aesInputs.set(bytes, plaintext);
  aesCiphertexts.set(bytes, new Uint8Array(ciphertext));
}
const ecdsa = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const docHash = new Uint8Array(await subtle.digest('SHA-256', randomBytes(1024 * 1024)));
const docSignature = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, ecdsa.privateKey, docHash));
log('Reusable key material ready.');
log('');

async function runOperation(operation, inputSizeBytes, outputSizeBytes, fn, notes = '') {
  log(`Running ${operation}...`);
  for (let trial = 1; trial <= TRIALS; trial += 1) {
    const { latency, result } = await timeMs(fn);
    const measuredOutputSize = typeof outputSizeBytes === 'function' ? outputSizeBytes(result) : outputSizeBytes;
    addRow(operation, trial, latency, inputSizeBytes, measuredOutputSize, notes);
  }
}

await runOperation(
  'pbkdf2_sha256_600k_aes256',
  32,
  32,
  async () => {
    const password = new TextEncoder().encode('PangoChain-Experiment-6-Test-Password');
    const salt = randomBytes(32);
    const baseKey = await subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
    return subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
      baseKey,
      256,
    );
  },
  `${PBKDF2_ITERATIONS} iterations, 32-byte salt, 256-bit output.`,
);

await runOperation(
  'ecdh_p256_keygen',
  0,
  0,
  () => subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']),
);

await runOperation(
  'ecdsa_p256_keygen',
  0,
  0,
  () => subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']),
);

const wrapTokens = [];
await runOperation(
  'ecies_p256_wrap_32b_doc_key',
  32,
  (token) => token.byteLength,
  async () => {
    const ephemeral = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const wrappingKey = await subtle.deriveKey(
      { name: 'ECDH', public: recipientEcdh.publicKey },
      ephemeral.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const iv = randomBytes(12);
    const wrapped = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, documentKey));
    const ephPubRaw = new Uint8Array(await subtle.exportKey('raw', ephemeral.publicKey));
    const token = concatBytes(ephPubRaw, iv, wrapped);
    wrapTokens.push(token);
    return token;
  },
  'Token is raw ephemeral public key + IV + AES-GCM ciphertext/tag.',
);

const unwrapToken = wrapTokens.at(-1);
const unwrapEphPub = unwrapToken.slice(0, 65);
const unwrapIv = unwrapToken.slice(65, 77);
const unwrapCiphertext = unwrapToken.slice(77);
await runOperation(
  'ecies_p256_unwrap_32b_doc_key',
  unwrapToken.byteLength,
  32,
  async () => {
    const ephPublicKey = await subtle.importKey(
      'raw',
      unwrapEphPub,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const wrappingKey = await subtle.deriveKey(
      { name: 'ECDH', public: ephPublicKey },
      recipientEcdh.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    return subtle.decrypt({ name: 'AES-GCM', iv: unwrapIv }, wrappingKey, unwrapCiphertext);
  },
  'Imports raw ephemeral P-256 public key and decrypts AES-GCM wrapped document key.',
);

await runOperation(
  'rsa_oaep_2048_wrap_32b_doc_key',
  32,
  (ciphertext) => ciphertext.byteLength,
  () => subtle.encrypt({ name: 'RSA-OAEP' }, rsaOaep.publicKey, documentKey),
  'RSA-OAEP SHA-256, 2048-bit modulus.',
);

for (const { mb, bytes } of SIZES) {
  await runOperation(
    `aes_256_gcm_encrypt_${mb}mb`,
    bytes,
    (ciphertext) => ciphertext.byteLength,
    async () => {
      const { key } = aesKeys.get(bytes);
      const iv = randomBytes(12);
      return subtle.encrypt({ name: 'AES-GCM', iv }, key, aesInputs.get(bytes));
    },
  );
}

for (const { mb, bytes } of SIZES) {
  await runOperation(
    `aes_256_gcm_decrypt_${mb}mb`,
    bytes + 16,
    bytes,
    async () => {
      const { key, iv } = aesKeys.get(bytes);
      return subtle.decrypt({ name: 'AES-GCM', iv }, key, aesCiphertexts.get(bytes));
    },
  );
}

for (const { mb, bytes } of SIZES) {
  await runOperation(
    `sha256_hash_${mb}mb`,
    bytes,
    32,
    () => subtle.digest('SHA-256', aesInputs.get(bytes)),
  );
}

await runOperation(
  'ecdsa_p256_sign_sha256_hash',
  32,
  (signature) => signature.byteLength,
  () => subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, ecdsa.privateKey, docHash),
);

await runOperation(
  'ecdsa_p256_verify_signature',
  docHash.byteLength + docSignature.byteLength,
  1,
  async () => {
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, ecdsa.publicKey, docSignature, docHash);
    if (!ok) throw new Error('ECDSA verification failed');
    return new Uint8Array([1]);
  },
);

const headers = [
  'experiment',
  'operation',
  'trial',
  'runtime',
  'platform',
  'user_agent',
  'node_version',
  'browser_name',
  'browser_version',
  'input_size_bytes',
  'latency_ms',
  'output_size_bytes',
  'notes',
];

fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(
  csvPath,
  `${headers.join(',')}\n${rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')).join('\n')}\n`,
);

const byOperation = {};
for (const row of rows) {
  byOperation[row.operation] ||= [];
  byOperation[row.operation].push(row);
}

const eciesTokenSize = Math.max(...byOperation.ecies_p256_wrap_32b_doc_key.map((row) => Number(row.output_size_bytes)));
const rsaTokenSize = Math.max(...byOperation.rsa_oaep_2048_wrap_32b_doc_key.map((row) => Number(row.output_size_bytes)));
const tokenSizeReductionPct = ((rsaTokenSize - eciesTokenSize) / rsaTokenSize) * 100;

const operations = {};
for (const [operation, opRows] of Object.entries(byOperation)) {
  const latencies = opRows.map((row) => Number(row.latency_ms));
  const inputSizes = [...new Set(opRows.map((row) => row.input_size_bytes).filter((v) => v !== '').map(Number))];
  const outputSizes = [...new Set(opRows.map((row) => row.output_size_bytes).filter((v) => v !== '').map(Number))];
  operations[operation] = {
    ...stats(latencies),
    input_size_bytes: inputSizes.length === 1 ? inputSizes[0] : inputSizes,
    output_size_bytes: outputSizes.length === 1 ? outputSizes[0] : outputSizes,
  };
}

const environment = {
  experiment: 'exp6_crypto',
  timestamp,
  runtime,
  browser_webcrypto_used: runtime === 'browser-webcrypto',
  node_webcrypto_used: runtime === 'node-webcrypto',
  command_used: commandUsed,
  platform,
  os: {
    type: os.type(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().map((cpu) => cpu.model),
    totalmem_bytes: os.totalmem(),
  },
  node_version: process.version,
  user_agent: userAgent,
  browser_name: browserName,
  browser_version: browserVersion,
  browser_tooling_detection: browserDetection.attempts,
  notes: notesBase,
};

const summary = {
  experiment: 'exp6_crypto',
  timestamp,
  command_used: commandUsed,
  runtime_information: environment,
  browser_webcrypto_used: runtime === 'browser-webcrypto',
  node_webcrypto_used: runtime === 'node-webcrypto',
  trials_per_operation: TRIALS,
  pbkdf2_iterations: PBKDF2_ITERATIONS,
  operations,
  ecies_token_size_bytes: eciesTokenSize,
  rsa_oaep_2048_token_size_bytes: rsaTokenSize,
  token_size_reduction_percentage: Number(tokenSizeReductionPct.toFixed(6)),
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);

log('');
log('=== Summary ===');
log('| Operation | n | p50 ms | p95 ms | output bytes |');
log('|---|---:|---:|---:|---:|');
for (const [operation, opSummary] of Object.entries(operations)) {
  log(`| ${operation} | ${opSummary.n} | ${opSummary.p50} | ${opSummary.p95} | ${JSON.stringify(opSummary.output_size_bytes)} |`);
}
log('');
log(`ECIES token size: ${eciesTokenSize} bytes`);
log(`RSA-OAEP 2048 token size: ${rsaTokenSize} bytes`);
log(`Token-size reduction: ${tokenSizeReductionPct.toFixed(6)}%`);
log(`CSV rows: ${rows.length}`);
log(`Wrote ${path.relative(repoRoot, csvPath)}`);
log(`Wrote ${path.relative(repoRoot, summaryPath)}`);
log(`Wrote ${path.relative(repoRoot, environmentPath)}`);
log(`Wrote ${path.relative(repoRoot, rawPath)}`);
log('Experiment 6 crypto benchmark completed');

fs.writeFileSync(rawPath, `${rawLog.join('\n')}\n`);
