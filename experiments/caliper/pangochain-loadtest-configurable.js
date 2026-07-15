#!/usr/bin/env node
/**
 * PangoChain configurable load harness — P2-A / P2-B experiments.
 * Env vars:
 *   PANGOCHAIN_JWT_TOKEN       — required
 *   PANGOCHAIN_TEST_CASE_ID    — required
 *   PANGOCHAIN_TEST_DOC_ID     — required
 *   PANGOCHAIN_CONCURRENCY     — concurrent workers (default 200)
 *   PANGOCHAIN_DURATION_SEC    — test duration in seconds (default 60)
 *   PANGOCHAIN_API_URL         — base URL (default http://localhost:8080/api)
 *
 * Output (one line):
 *   TPS=XX.X P50=XXXms P95=XXXms errors=N elapsed=XX.Xs concurrency=N
 */
'use strict';

const http = require('http');

const JWT         = process.env.PANGOCHAIN_JWT_TOKEN    || '';
const CASE_ID     = process.env.PANGOCHAIN_TEST_CASE_ID || '';
const DOC_ID      = process.env.PANGOCHAIN_TEST_DOC_ID  || '';
const CONCURRENCY = parseInt(process.env.PANGOCHAIN_CONCURRENCY  || '200', 10);
const DURATION_MS = parseInt(process.env.PANGOCHAIN_DURATION_SEC || '60',  10) * 1000;
const WRITE_RATIO = 0.20;
const TIMEOUT_MS  = 10000;

if (!JWT || !CASE_ID || !DOC_ID) {
  console.error('ERROR: set PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_CASE_ID, PANGOCHAIN_TEST_DOC_ID');
  process.exit(1);
}

const WRITE_BODY = JSON.stringify({
  caseId: CASE_ID,
  fileName: 'bench.bin',
  ivBase64: 'AAAAAAAAAAAAAAAA',
  ciphertextBase64: 'A'.repeat(1024),
  documentHashSha256: '0'.repeat(64),
  wrappedKeyTokenForOwner: 'A'.repeat(125),
});

const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY + 50 });

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 8080,
      path: '/api' + path, method, agent,
      headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
    };
    const start = Date.now();
    const req = http.request(options, (res) => {
      res.resume();
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
  if (!sorted.length) return 'N/A';
  return sorted[Math.min(Math.floor(sorted.length * p / 100), sorted.length - 1)];
}

function printResult(latencies, errors, start) {
  const elapsed = (Date.now() - start) / 1000;
  const tps     = (latencies.length / elapsed).toFixed(1);
  const sorted  = latencies.slice().sort((a, b) => a - b);
  console.log(`TPS=${tps} P50=${percentile(sorted,50)} P95=${percentile(sorted,95)} errors=${errors} elapsed=${elapsed.toFixed(1)}s concurrency=${CONCURRENCY}`);
}

async function run() {
  const latencies = [];
  let errors = 0, inFlight = 0;
  const start = Date.now();
  const deadline = start + DURATION_MS;

  // Safety valve: force-print and exit if sockets hang after deadline+timeout
  let forceExited = false;
  const forceExitTimer = setTimeout(() => {
    forceExited = true;
    printResult(latencies, errors, start);
    process.exit(0);
  }, DURATION_MS + TIMEOUT_MS + 3000);

  await new Promise((resolve) => {
    let settled = false;
    function finish() {
      if (!settled) {
        settled = true;
        clearTimeout(forceExitTimer);
        resolve();
      }
    }

    function dispatch() {
      while (inFlight < CONCURRENCY && Date.now() < deadline) {
        inFlight++;
        const isWrite = Math.random() < WRITE_RATIO;
        const p = isWrite
          ? makeRequest('POST', '/documents/upload', WRITE_BODY)
          : makeRequest('GET',  `/documents/${DOC_ID}/wrapped-key`, null);
        p.then((ms) => {
          latencies.push(ms);
          inFlight--;
          if (Date.now() < deadline) dispatch();
          else if (inFlight === 0) finish();
        }).catch(() => {
          errors++;
          inFlight--;
          if (Date.now() < deadline) dispatch();
          else if (inFlight === 0) finish();
        });
      }
    }

    dispatch();
    const ticker = setInterval(() => {
      if (Date.now() >= deadline) {
        clearInterval(ticker);
        if (inFlight === 0) finish();
      } else {
        dispatch();
      }
    }, 50);
  });

  if (!forceExited) {
    printResult(latencies, errors, start);
  }
}

run().catch((e) => { console.error(e.message); process.exit(1); });
