#!/usr/bin/env node
/**
 * PangoChain WAN Latency Load Test — Experiment 5
 * Fixed at 200 concurrent clients (single round).
 * Run 5 times per RTT level via shell loop.
 * Traffic mix: 20% RegisterDocument writes, 80% CheckAccess reads.
 */

'use strict';

const http = require('http');
const { execSync } = require('child_process');

const BASE_URL = process.env.PANGOCHAIN_API_URL    || 'http://localhost:8080/api';
const JWT      = process.env.PANGOCHAIN_JWT_TOKEN  || '';
const CASE_ID  = process.env.PANGOCHAIN_TEST_CASE_ID || '';
const DOC_ID   = process.env.PANGOCHAIN_TEST_DOC_ID  || '';

if (!JWT || !CASE_ID || !DOC_ID) {
  console.error('ERROR: set PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_CASE_ID, PANGOCHAIN_TEST_DOC_ID');
  process.exit(1);
}

const CONCURRENCY  = 200;
const TOTAL_TX     = 2000;
const WRITE_RATIO  = 0.20;

const WRITE_BODY = JSON.stringify({
  caseId: CASE_ID,
  fileName: 'wan-bench.bin',
  ivBase64: 'AAAAAAAAAAAAAAAA',
  ciphertextBase64: 'A'.repeat(1024),
  documentHashSha256: '0'.repeat(64),
  wrappedKeyTokenForOwner: 'A'.repeat(125),
});

const agent = new http.Agent({ keepAlive: true, maxSockets: 400 });

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: '/api' + path,
      method,
      agent,
      headers: {
        'Authorization': `Bearer ${JWT}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
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
  if (sorted.length === 0) return 'N/A';
  return sorted[Math.min(Math.floor(sorted.length * p / 100), sorted.length - 1)];
}

function getCpuRam() {
  try {
    const java = execSync(`pgrep -f PangochainApplication 2>/dev/null | head -1`).toString().trim();
    if (!java) return { cpu: '—', ram: '—' };
    const ps = execSync(`ps -p ${java} -o %cpu=,rss= 2>/dev/null`).toString().trim().split(/\s+/);
    return { cpu: ps[0] || '—', ram: ps[1] ? String(Math.round(parseInt(ps[1]) / 1024)) : '—' };
  } catch (_) { return { cpu: '—', ram: '—' }; }
}

async function run() {
  const latencies = [];
  let errors = 0;
  let inFlight = 0, dispatched = 0;
  const start = Date.now();

  await new Promise((resolve) => {
    function dispatch() {
      while (inFlight < CONCURRENCY && dispatched < TOTAL_TX) {
        dispatched++; inFlight++;
        const isWrite = Math.random() < WRITE_RATIO;
        const p = isWrite
          ? makeRequest('POST', '/documents/upload', WRITE_BODY)
          : makeRequest('GET', `/documents/${DOC_ID}/wrapped-key`, null);
        p.then((ms) => {
          latencies.push(ms); inFlight--;
          if (dispatched < TOTAL_TX) dispatch();
          else if (inFlight === 0) resolve();
        }).catch(() => {
          errors++; inFlight--;
          if (dispatched < TOTAL_TX) dispatch();
          else if (inFlight === 0) resolve();
        });
      }
    }
    dispatch();
  });

  const elapsed = (Date.now() - start) / 1000;
  const tps = (latencies.length / elapsed).toFixed(1);
  const sorted = latencies.slice().sort((a, b) => a - b);
  const { cpu, ram } = getCpuRam();

  console.log(`TPS=${tps} P50=${percentile(sorted,50)}ms P95=${percentile(sorted,95)}ms errors=${errors} cpu=${cpu}% ram=${ram}MB elapsed=${elapsed.toFixed(1)}s`);
}

run().catch((e) => { console.error(e); process.exit(1); });
