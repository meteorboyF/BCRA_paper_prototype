#!/usr/bin/env node
/**
 * PangoChain Experiment 1 — SINGLE ROUND (fixed-count, closed-loop).
 * Extracted verbatim from pangochain-loadtest.js runRound() so the canonical
 * Exp1 methodology (clients × TX_PER_CLIENT transactions, up to `concurrency`
 * in-flight, TPS = successes / wall-clock) is preserved exactly. Driven once
 * per (concurrency, trial) by run-exp1-v1.sh so we can emit per-run rows + stdev.
 *
 * Env:
 *   PANGOCHAIN_JWT_TOKEN / _TEST_CASE_ID / _TEST_DOC_ID  (required)
 *   PANGOCHAIN_CONCURRENCY   (default 50)
 *   PANGOCHAIN_TX_PER_CLIENT (default 10)
 * Output (one line):
 *   TPS=.. P50=.. P95=.. errors=.. success=.. elapsed=.. cpu=.. ram=.. concurrency=..
 */
'use strict';

const http = require('http');
const { execSync } = require('child_process');

const BASE_URL  = process.env.PANGOCHAIN_API_URL     || 'http://localhost:8080/api';
const JWT       = process.env.PANGOCHAIN_JWT_TOKEN    || '';
const CASE_ID   = process.env.PANGOCHAIN_TEST_CASE_ID || '';
const DOC_ID    = process.env.PANGOCHAIN_TEST_DOC_ID  || '';
const CONCURRENCY    = parseInt(process.env.PANGOCHAIN_CONCURRENCY   || '50', 10);
const TX_PER_CLIENT  = parseInt(process.env.PANGOCHAIN_TX_PER_CLIENT || '10', 10);
const WRITE_RATIO = 0.20;

if (!JWT || !CASE_ID || !DOC_ID) {
  console.error('ERROR: set PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_CASE_ID, PANGOCHAIN_TEST_DOC_ID');
  process.exit(1);
}

const WRITE_BODY = JSON.stringify({
  caseId: CASE_ID,
  fileName: 'bench-loadtest.bin',
  ivBase64: 'AAAAAAAAAAAAAAAA',
  ciphertextBase64: 'A'.repeat(1024),
  documentHashSha256: '0'.repeat(64),
  wrappedKeyTokenForOwner: 'A'.repeat(125),
});

const agent = new http.Agent({ keepAlive: true, maxSockets: 800 });

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname, port: url.port || 8080, path: url.pathname,
      method, agent,
      headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    const start = Date.now();
    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(Date.now() - start);
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 'NA';
  return sorted[Math.min(Math.floor(sorted.length * p / 100), sorted.length - 1)];
}

function getCpuRam() {
  try {
    const java = execSync(`pgrep -f 'java -jar target/pangochain' 2>/dev/null | head -1`).toString().trim();
    if (!java) return { cpu: 'NA', ram: 'NA' };
    const ps = execSync(`ps -p ${java} -o %cpu=,rss= 2>/dev/null`).toString().trim().split(/\s+/);
    return { cpu: ps[0] || 'NA', ram: ps[1] ? String(Math.round(parseInt(ps[1]) / 1024)) : 'NA' };
  } catch (_) { return { cpu: 'NA', ram: 'NA' }; }
}

async function runRound(concurrency) {
  const totalTx = concurrency * TX_PER_CLIENT;
  const latencies = [];
  let errors = 0, inFlight = 0, dispatched = 0;
  const roundStart = Date.now();

  await new Promise((resolve) => {
    function dispatch() {
      while (inFlight < concurrency && dispatched < totalTx) {
        dispatched++; inFlight++;
        const isWrite = Math.random() < WRITE_RATIO;
        const p = isWrite
          ? makeRequest('POST', '/documents/upload', WRITE_BODY)
          : makeRequest('GET',  `/documents/${DOC_ID}/wrapped-key`, null);
        p.then((ms) => {
          latencies.push(ms); inFlight--;
          if (dispatched < totalTx) dispatch();
          else if (inFlight === 0) resolve();
        }).catch(() => {
          errors++; inFlight--;
          if (dispatched < totalTx) dispatch();
          else if (inFlight === 0) resolve();
        });
      }
    }
    dispatch();
  });

  const elapsed = (Date.now() - roundStart) / 1000;
  const tps = (latencies.length / elapsed).toFixed(1);
  const sorted = latencies.slice().sort((a, b) => a - b);
  const { cpu, ram } = getCpuRam();
  console.log(`TPS=${tps} P50=${percentile(sorted,50)} P95=${percentile(sorted,95)} errors=${errors} success=${latencies.length} elapsed=${elapsed.toFixed(1)} cpu=${cpu} ram=${ram} concurrency=${concurrency}`);
}

runRound(CONCURRENCY).catch((e) => { console.error(e.message); process.exit(1); });
