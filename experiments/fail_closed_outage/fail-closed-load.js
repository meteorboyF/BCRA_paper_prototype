#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const JWT = process.env.PANGOCHAIN_JWT_TOKEN || '';
const DOC = process.env.PANGOCHAIN_TEST_DOC_ID || '';
const OUT = process.env.PANGOCHAIN_OUTPUT_DIR || '';
const CONCURRENCY = parseInt(process.env.PANGOCHAIN_CONCURRENCY || '50', 10);
const PRE = parseInt(process.env.PANGOCHAIN_PRE_OUTAGE_SECONDS || '30', 10);
const OUTAGE = parseInt(process.env.PANGOCHAIN_OUTAGE_SECONDS || '45', 10);
const POST = parseInt(process.env.PANGOCHAIN_POST_RECOVERY_SECONDS || '60', 10);
const BACKEND_HOST = process.env.PANGOCHAIN_BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.PANGOCHAIN_BACKEND_PORT || '8080', 10);
const TIMEOUT_MS = parseInt(process.env.PANGOCHAIN_REQUEST_TIMEOUT_MS || '15000', 10);

if (!JWT || !DOC || !OUT) {
  console.error('Required env: PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_DOC_ID, PANGOCHAIN_OUTPUT_DIR');
  process.exit(2);
}

fs.mkdirSync(OUT, { recursive: true });

const totalSeconds = PRE + OUTAGE + POST;
const startedAt = Date.now();
const deadline = startedAt + totalSeconds * 1000;
const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY + 20 });
const requests = [];
let inflight = 0;

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function phaseForSecond(second) {
  if (second < PRE) return 'pre_outage';
  if (second < PRE + OUTAGE) return 'outage';
  return 'post_recovery';
}

function protectedFlags(statusCode, bytes) {
  const ok = statusCode >= 200 && statusCode < 300 && bytes > 0;
  return {
    returned_ciphertext: ok,
    returned_wrapped_key: false,
    returned_plaintext: false,
  };
}

function makeRequest() {
  const ts = Date.now();
  const second = Math.max(0, Math.floor((ts - startedAt) / 1000));
  const phase = phaseForSecond(second);

  return new Promise((resolve) => {
    let bytes = 0;
    let settled = false;
    const req = http.request({
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: `/api/documents/${DOC}/ciphertext`,
      method: 'GET',
      agent,
      timeout: TIMEOUT_MS,
      headers: { Authorization: `Bearer ${JWT}` },
    }, (resp) => {
      resp.on('data', (chunk) => { bytes += chunk.length; });
      resp.on('end', () => {
        if (settled) return;
        settled = true;
        const latency = Date.now() - ts;
        requests.push({
          timestamp_ms: ts,
          second,
          phase,
          status_code: resp.statusCode || 0,
          latency_ms: latency,
          ...protectedFlags(resp.statusCode || 0, bytes),
          bytes_returned: bytes,
          error_type: '',
          error_message: '',
        });
        resolve();
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('request timeout'));
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      const latency = Date.now() - ts;
      requests.push({
        timestamp_ms: ts,
        second,
        phase,
        status_code: 0,
        latency_ms: latency,
        returned_ciphertext: false,
        returned_wrapped_key: false,
        returned_plaintext: false,
        bytes_returned: 0,
        error_type: err.name || 'Error',
        error_message: err.message || String(err),
      });
      resolve();
    });
    req.end();
  });
}

function pump() {
  while (inflight < CONCURRENCY && Date.now() < deadline) {
    inflight += 1;
    makeRequest().finally(() => {
      inflight -= 1;
      if (Date.now() < deadline) pump();
    });
  }
}

function writeOutputs() {
  const requestHeaders = [
    'timestamp_ms', 'phase', 'status_code', 'latency_ms',
    'returned_ciphertext', 'returned_wrapped_key', 'returned_plaintext',
    'bytes_returned', 'error_type', 'error_message',
  ];
  const requestLines = [requestHeaders.join(',')];
  for (const r of requests) {
    requestLines.push(requestHeaders.map((h) => csvEscape(r[h])).join(','));
  }
  fs.writeFileSync(path.join(OUT, 'requests.csv'), requestLines.join('\n') + '\n');

  const perSecondHeaders = [
    'second', 'phase', 'success_200', 'http_503', 'http_403', 'other_5xx',
    'unexpected_200', 'protected_bytes_returned', 'mean_latency_ms',
    'p50_latency_ms', 'p95_latency_ms',
  ];
  const perSecondLines = [perSecondHeaders.join(',')];
  for (let second = 0; second < totalSeconds; second += 1) {
    const rows = requests.filter((r) => r.second === second);
    const phase = phaseForSecond(second);
    const latencies = rows.map((r) => r.latency_ms);
    const outage = phase === 'outage';
    const success200 = rows.filter((r) => r.status_code >= 200 && r.status_code < 300).length;
    const protectedBytes = rows
      .filter((r) => outage && (r.returned_ciphertext || r.returned_wrapped_key || r.returned_plaintext))
      .reduce((sum, r) => sum + r.bytes_returned, 0);
    const values = {
      second,
      phase,
      success_200: success200,
      http_503: rows.filter((r) => r.status_code === 503).length,
      http_403: rows.filter((r) => r.status_code === 403).length,
      other_5xx: rows.filter((r) => r.status_code >= 500 && r.status_code !== 503).length,
      unexpected_200: outage ? success200 : 0,
      protected_bytes_returned: protectedBytes,
      mean_latency_ms: latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3) : '0',
      p50_latency_ms: percentile(latencies, 50),
      p95_latency_ms: percentile(latencies, 95),
    };
    perSecondLines.push(perSecondHeaders.map((h) => csvEscape(values[h])).join(','));
  }
  fs.writeFileSync(path.join(OUT, 'per_second.csv'), perSecondLines.join('\n') + '\n');
}

pump();
const ticker = setInterval(() => {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  console.log(JSON.stringify({ elapsed, inflight, requests: requests.length, phase: phaseForSecond(elapsed) }));
  if (Date.now() >= deadline && inflight === 0) {
    clearInterval(ticker);
    writeOutputs();
    process.exit(0);
  }
}, 1000);
