#!/usr/bin/env node
/**
 * Experiment 6b — cost of binding recipient identity as AAD (reviewer item 20).
 *
 * The review asked for Experiment 6 to be re-run to confirm that AAD binding
 * "costs nothing measurable". This measures that specific question directly
 * rather than re-running the whole Exp 6 campaign, for two reasons: a wholesale
 * re-run would overwrite the canonical `results/exp6_crypto.*` bundle the
 * manuscript quotes, and it would confound the AAD question with host
 * differences between campaigns. Here both arms run interleaved in one process,
 * so the comparison is paired and the host is held constant by construction.
 *
 * AAD is authenticated but not transmitted, so the token stays 125 bytes; that
 * invariant is asserted rather than assumed.
 *
 * Usage: node bench.mjs [--reps 200] [--out results/<stamp>]
 */
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const subtle = webcrypto.subtle;
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const REPS = parseInt(arg('reps', '200'), 10);
const OUT = arg('out', path.join(import.meta.dirname, 'results',
  new Date().toISOString().replace(/[-:T]/g, '').replace(/\..*$/, '')));
fs.mkdirSync(OUT, { recursive: true });

const AAD_LABEL = 'pangochain:wrap:v1:recipient=user-alice-0001';
const aad = new TextEncoder().encode(AAD_LABEL);

const recipient = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
const documentKey = webcrypto.getRandomValues(new Uint8Array(32));

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

async function wrap(withAad) {
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const wk = await subtle.deriveKey({ name: 'ECDH', public: recipient.publicKey },
    eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const params = withAad ? { name: 'AES-GCM', iv, additionalData: aad } : { name: 'AES-GCM', iv };
  const wrapped = new Uint8Array(await subtle.encrypt(params, wk, documentKey));
  const ephRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey));
  return concat(ephRaw, iv, wrapped);
}

async function unwrap(token, withAad) {
  const ephPub = await subtle.importKey('raw', token.slice(0, 65),
    { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const wk = await subtle.deriveKey({ name: 'ECDH', public: ephPub },
    recipient.privateKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const iv = token.slice(65, 77);
  const params = withAad ? { name: 'AES-GCM', iv, additionalData: aad } : { name: 'AES-GCM', iv };
  return subtle.decrypt(params, wk, token.slice(77));
}

// Invariant the manuscript depends on: AAD is authenticated, not transmitted.
const boundTok = await wrap(true);
const plainTok = await wrap(false);
if (boundTok.byteLength !== 125 || plainTok.byteLength !== 125) {
  console.error(`FAIL: token size changed (bound=${boundTok.byteLength} unbound=${plainTok.byteLength})`);
  process.exit(2);
}
// And the binding must actually bind.
let rejected = false;
try {
  await unwrap(boundTok, false);
} catch { rejected = true; }
if (!rejected) {
  console.error('FAIL: AAD-bound token decrypted without the AAD — binding is not in force');
  process.exit(3);
}

const stats = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (s.length - 1));
  return {
    n: s.length, p50: s[Math.floor(s.length * 0.5)], mean, sd,
    p95: s[Math.floor(s.length * 0.95)], min: s[0], max: s[s.length - 1],
  };
};

const samples = { wrap_aad: [], wrap_noaad: [], unwrap_aad: [], unwrap_noaad: [] };
const WARM = 20;
// Interleaved so any drift during the run hits both arms equally, and the order
// within each pair alternates: running one arm consistently first lets warm-cache
// effects masquerade as the treatment, which at a ~0.04 ms effect size would
// dominate the result.
for (let i = 0; i < REPS + WARM; i++) {
  const order = i % 2 === 0 ? [true, false] : [false, true];
  for (const withAad of order) {
    let t = process.hrtime.bigint();
    const tok = await wrap(withAad);
    const wrapMs = Number(process.hrtime.bigint() - t) / 1e6;

    t = process.hrtime.bigint();
    await unwrap(tok, withAad);
    const unwrapMs = Number(process.hrtime.bigint() - t) / 1e6;

    if (i >= WARM) {
      samples[withAad ? 'wrap_aad' : 'wrap_noaad'].push(wrapMs);
      samples[withAad ? 'unwrap_aad' : 'unwrap_noaad'].push(unwrapMs);
    }
  }
}

const S = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, stats(v)]));
const delta = (a, b) => ({
  p50_delta_ms: S[a].p50 - S[b].p50,
  mean_delta_ms: S[a].mean - S[b].mean,
  // Welch SE on the mean difference, for a 90% interval.
  ci90: (() => {
    const se = Math.sqrt(S[a].sd ** 2 / S[a].n + S[b].sd ** 2 / S[b].n);
    const d = S[a].mean - S[b].mean;
    return [d - 1.645 * se, d + 1.645 * se];
  })(),
});

const out = {
  reps: REPS, warmup_discarded: WARM,
  token_bytes_bound: boundTok.byteLength, token_bytes_unbound: plainTok.byteLength,
  aad_enforced: rejected,
  runtime: `node ${process.version} webcrypto`,
  stats: S,
  wrap_cost_of_aad: delta('wrap_aad', 'wrap_noaad'),
  unwrap_cost_of_aad: delta('unwrap_aad', 'unwrap_noaad'),
};
fs.writeFileSync(path.join(OUT, 'aad_binding.json'), JSON.stringify(out, null, 2));

const fmt = (k) => `${k.padEnd(14)} n=${S[k].n} P50=${S[k].p50.toFixed(4)}ms mean=${S[k].mean.toFixed(4)}ms SD=${S[k].sd.toFixed(4)}`;
console.log(`=== Experiment 6b — AAD binding cost (${process.version}) ===\n`);
for (const k of Object.keys(S)) console.log(fmt(k));
for (const [label, d] of [['wrap', out.wrap_cost_of_aad], ['unwrap', out.unwrap_cost_of_aad]]) {
  console.log(`\n${label}: AAD costs ${d.mean_delta_ms >= 0 ? '+' : ''}${d.mean_delta_ms.toFixed(4)} ms at the mean ` +
    `(P50 ${d.p50_delta_ms >= 0 ? '+' : ''}${d.p50_delta_ms.toFixed(4)} ms), ` +
    `90% CI [${d.ci90[0].toFixed(4)}, ${d.ci90[1].toFixed(4)}]`);
}
console.log(`\ntoken size unchanged at ${boundTok.byteLength} bytes; AAD enforced: ${rejected}`);
console.log(`wrote ${path.join(OUT, 'aad_binding.json')}`);
