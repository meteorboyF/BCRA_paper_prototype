#!/usr/bin/env node
/**
 * PangoChain Load Test — Experiment 1 (Scalability)
 * Replaces Caliper frontend; same measurement logic.
 * Traffic mix: 20% RegisterDocument writes, 80% CheckAccess reads.
 * Metrics: mean TPS, P50/P95 latency (ms), CPU%, RAM (MB).
 */

'use strict';

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

const BASE_URL  = process.env.PANGOCHAIN_API_URL   || 'http://localhost:8080/api';
const JWT       = process.env.PANGOCHAIN_JWT_TOKEN  || '';
const CASE_ID   = process.env.PANGOCHAIN_TEST_CASE_ID || '';
const DOC_ID    = process.env.PANGOCHAIN_TEST_DOC_ID  || '';

if (!JWT || !CASE_ID || !DOC_ID) {
  console.error('ERROR: set PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_CASE_ID, PANGOCHAIN_TEST_DOC_ID');
  process.exit(1);
}

const WRITE_RATIO = 0.20;
const ROUNDS = [50, 100, 150, 200, 300, 400, 500, 600];
const TX_PER_CLIENT = 10; // each concurrency level sends clients * TX_PER_CLIENT total transactions

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
      hostname: url.hostname,
      port: url.port || 8080,
      path: url.pathname,
      method,
      agent,
      headers: {
        'Authorization': `Bearer ${JWT}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    };
    const start = Date.now();
    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(Date.now() - start);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function percentile(sorted, p) {
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function getCpuRam() {
  try {
    // CPU: /proc/stat snapshot delta would be ideal; use pidstat or top -bn1
    const pid = process.pid;
    const java = execSync(`pgrep -f PangochainApplication 2>/dev/null | head -1`).toString().trim();
    let cpuStr = '—', ramStr = '—';
    if (java) {
      const ps = execSync(`ps -p ${java} -o %cpu=,rss= 2>/dev/null`).toString().trim().split(/\s+/);
      cpuStr = ps[0] || '—';
      ramStr = ps[1] ? String(Math.round(parseInt(ps[1]) / 1024)) : '—';
    }
    return { cpu: cpuStr, ram: ramStr };
  } catch (_) { return { cpu: '—', ram: '—' }; }
}

async function runRound(concurrency) {
  const totalTx = concurrency * TX_PER_CLIENT;
  const latencies = [];
  let errors = 0;

  // Dispatch totalTx transactions with up to `concurrency` in-flight at once
  const queue = Array.from({ length: totalTx }, (_, i) => i);
  let inFlight = 0;
  let dispatched = 0;
  const roundStart = Date.now();

  await new Promise((resolve) => {
    function dispatch() {
      while (inFlight < concurrency && dispatched < totalTx) {
        dispatched++;
        inFlight++;
        const isWrite = Math.random() < WRITE_RATIO;
        const p = isWrite
          ? makeRequest('POST', '/documents/upload', WRITE_BODY)
          : makeRequest('GET',  `/documents/${DOC_ID}/wrapped-key`, null);
        p.then((ms) => {
          latencies.push(ms);
          inFlight--;
          if (dispatched < totalTx) dispatch();
          else if (inFlight === 0) resolve();
        }).catch((_) => {
          errors++;
          inFlight--;
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
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const { cpu, ram } = getCpuRam();

  return { concurrency, totalTx, success: latencies.length, errors, tps, p50, p95, cpu, ram, elapsed: elapsed.toFixed(1) };
}

async function main() {
  console.log('=== PangoChain Experiment 1 — Scalability Under Load ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Traffic mix: ${(WRITE_RATIO*100).toFixed(0)}% writes / ${((1-WRITE_RATIO)*100).toFixed(0)}% reads`);
  console.log(`Tx per round: clients × ${TX_PER_CLIENT}`);
  console.log('');
  console.log('Warming up with 50-client round (results discarded)...');
  await runRound(50); // warm-up
  console.log('Warm-up done.\n');

  const results = [];
  for (const c of ROUNDS) {
    process.stdout.write(`Running ${c} clients (${c * TX_PER_CLIENT} tx)... `);
    const r = await runRound(c);
    results.push(r);
    console.log(`TPS=${r.tps} P50=${r.p50}ms P95=${r.p95}ms errors=${r.errors} cpu=${r.cpu}% ram=${r.ram}MB elapsed=${r.elapsed}s`);
  }

  console.log('\n=== FABRIC MODE RESULTS (copy to experiment_results.md) ===');
  console.log('| Concurrent Clients | Mean TPS | P50 Latency (ms) | P95 Latency (ms) | CPU % | RAM (MB) |');
  console.log('|-------------------|----------|-----------------|-----------------|-------|---------|');
  for (const r of results) {
    console.log(`| ${r.concurrency} | ${r.tps} | ${r.p50} | ${r.p95} | ${r.cpu} | ${r.ram} |`);
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
