// PangoChain Experiment 6 — Crypto Benchmark (Node.js WebCrypto)
// Mirrors experiments/crypto-benchmark.html logic exactly
// Node 18+ required (globalThis.crypto.subtle)
import { randomBytes } from 'crypto';

const subtle = globalThis.crypto.subtle;
// getRandomValues is limited to 65536 bytes per call; wrap for small buffers
const getRandomValues = (arr) => globalThis.crypto.getRandomValues(arr);
// For large test data, use Node's randomBytes (same entropy, no 64KB limit)
const randomBuf = (n) => new Uint8Array(randomBytes(n));

function ms(t) { return t.toFixed(2) + 'ms'; }

async function bench(fn, label, reps = 1) {
  const results = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    await fn();
    results.push(performance.now() - t0);
  }
  const avg = results.reduce((a, b) => a + b, 0) / reps;
  const min = Math.min(...results);
  const max = Math.max(...results);
  console.log(`  ${label.padEnd(55)} avg=${ms(avg)}  min=${ms(min)}  max=${ms(max)}`);
  return { avg, min, max };
}

async function run() {
  console.log('=== PangoChain Experiment 6 — WebCrypto Benchmark ===');
  console.log(`Environment: Node.js ${process.version} / ${process.platform}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  // ── PBKDF2 ────────────────────────────────────────────────────────────────
  console.log('--- PBKDF2 (NIST SP 800-132, 600k iterations, SHA-256) ---');
  const pwBytes = new TextEncoder().encode('TestPassword123!');
  const salt = getRandomValues(new Uint8Array(32));
  const pbkdf2 = await bench(async () => {
    const base = await subtle.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveKey']);
    await subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600_000 },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
    );
  }, 'PBKDF2 600k iter (32-byte salt, AES-256 output)', 3);
  console.log(`  Note: <1000ms on modern hardware. Paper claims: <800ms p50.`);
  console.log('');

  // ── ECIES P-256 ────────────────────────────────────────────────────────────
  console.log('--- ECIES P-256 Key Generation and Wrapping ---');
  const eciesKeygen = await bench(async () => {
    await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  }, 'ECDH P-256 keygen', 10);

  const recipientKp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const docKey = getRandomValues(new Uint8Array(32));

  const eciesWrap = await bench(async () => {
    const ephemeral = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const wk = await subtle.deriveKey(
      { name: 'ECDH', public: recipientKp.publicKey },
      ephemeral.privateKey,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt']
    );
    const iv = getRandomValues(new Uint8Array(12));
    const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, wk, docKey);
    const pub = await subtle.exportKey('raw', ephemeral.publicKey);
    const total = new Uint8Array(pub.byteLength + iv.length + wrapped.byteLength);
    total.set(new Uint8Array(pub), 0);
    total.set(iv, pub.byteLength);
    total.set(new Uint8Array(wrapped), pub.byteLength + iv.length);
    return total;
  }, 'ECIES wrap 32-byte doc key (P-256)', 20);

  console.log('');
  console.log('  ECIES wrapped token size: 65 (ephPubRaw) + 12 (iv) + 48 (ciphertext+tag) = 125 bytes');
  console.log('  RSA-OAEP 2048 wrapped key size: 256 bytes');
  console.log('  Reduction: (256 - 125) / 256 = 51.2% smaller token');
  console.log('');

  // ── AES-256-GCM Document Encrypt ───────────────────────────────────────────
  console.log('--- AES-256-GCM Document Encryption ---');
  const aesResults = {};
  for (const [label, sizeBytes] of [['1MB', 1024*1024], ['10MB', 10*1024*1024], ['50MB', 50*1024*1024]]) {
    const plaintext = randomBuf(sizeBytes);
    const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const iv = getRandomValues(new Uint8Array(12));
    aesResults[label] = await bench(async () => {
      await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
    }, `AES-256-GCM encrypt ${label}`, 3);
  }
  console.log('');

  // ── RSA-OAEP 2048 comparison ───────────────────────────────────────────────
  console.log('--- RSA-OAEP 2048 key wrap (for comparison) ---');
  const rsaKp = await subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    false, ['encrypt', 'decrypt']
  );
  const rsaWrap = await bench(async () => {
    await subtle.encrypt({ name: 'RSA-OAEP' }, rsaKp.publicKey, docKey);
  }, 'RSA-OAEP 2048 wrap 32-byte doc key', 20);
  console.log('');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('=== Summary for Paper ===');
  console.log(`  PBKDF2 600k iterations:          ${ms(pbkdf2.avg)}`);
  console.log(`  ECDH P-256 keygen:               ${ms(eciesKeygen.avg)}`);
  console.log(`  ECIES P-256 key wrap:            ${ms(eciesWrap.avg)}`);
  console.log(`  RSA-OAEP 2048 key wrap:          ${ms(rsaWrap.avg)}`);
  console.log(`  ECIES vs RSA speedup:            ${(rsaWrap.avg / eciesWrap.avg).toFixed(1)}x faster`);
  console.log(`  AES-256-GCM 1MB encrypt:         ${ms(aesResults['1MB'].avg)}`);
  console.log(`  AES-256-GCM 10MB encrypt:        ${ms(aesResults['10MB'].avg)}`);
  console.log(`  AES-256-GCM 50MB encrypt:        ${ms(aesResults['50MB'].avg)}`);
  console.log(`  ECIES token size:                125 bytes`);
  console.log(`  RSA-OAEP 2048 token size:        256 bytes`);
  console.log(`  Token size reduction:            51.2%`);

  return {
    pbkdf2, eciesKeygen, eciesWrap, rsaWrap,
    aes1mb: aesResults['1MB'], aes10mb: aesResults['10MB'], aes50mb: aesResults['50MB'],
    speedup: rsaWrap.avg / eciesWrap.avg
  };
}

run().catch(console.error);
