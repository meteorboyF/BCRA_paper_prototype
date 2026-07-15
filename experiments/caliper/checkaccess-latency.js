// experiments/caliper/checkaccess-latency.js
// PangoChain — CheckAccess Single-Operation Latency Benchmark
// Experiment 2 supplement: isolates CheckAccess overhead
// 1 client, sequential calls, no concurrency
// Run twice: once with fabric.enabled=true, once with fabric.enabled=false
// Usage: node checkaccess-latency.js

'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const BASE_URL = process.env.PANGOCHAIN_API_URL   || 'http://localhost:8080/api';
const JWT      = process.env.PANGOCHAIN_JWT_TOKEN  || '';
const DOC_ID   = process.env.PANGOCHAIN_TEST_DOC_ID || '';
const MODE     = process.env.FABRIC_MODE           || 'unknown';

const WARMUP  = 20;
const SAMPLES = 100;

const RESULTS_FILE = path.resolve(__dirname, '../../experiment_results.md');

if (!JWT || !DOC_ID) {
  console.error('ERROR: set PANGOCHAIN_JWT_TOKEN and PANGOCHAIN_TEST_DOC_ID');
  console.error('       set FABRIC_MODE=fabric or FABRIC_MODE=db-only');
  process.exit(1);
}

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.get(
      `http://localhost:8080${urlPath}`,
      { headers: { Authorization: `Bearer ${JWT}` } },
      (res) => {
        res.resume();
        res.on('end', () => {
          const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
          resolve({ status: res.statusCode, ms: elapsed });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(new Error('timeout')); });
  });
}

function percentile(sorted, p) {
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx].toFixed(2);
}

function appendToResults(block) {
  const separator = '\n---\n';
  fs.appendFileSync(RESULTS_FILE, separator + block + '\n', 'utf8');
  console.log(`\nResults appended to: ${RESULTS_FILE}`);
}

async function main() {
  const endpoint = `/api/documents/${DOC_ID}/wrapped-key`;
  const runDate  = new Date().toISOString();

  console.log(`\nEndpoint : ${endpoint}`);
  console.log(`Mode     : ${MODE}`);
  console.log(`Warmup   : ${WARMUP} calls`);
  console.log(`Samples  : ${SAMPLES} calls`);
  console.log(`Date     : ${runDate}\n`);

  // Warmup
  process.stdout.write('Warming up... ');
  for (let i = 0; i < WARMUP; i++) {
    await httpGet(endpoint);
  }
  console.log('done.\n');

  // Measure
  process.stdout.write('Measuring ');
  const timings = [];
  let errors = 0;

  for (let i = 0; i < SAMPLES; i++) {
    try {
      const { ms } = await httpGet(endpoint);
      timings.push(ms);
    } catch (e) {
      errors++;
    }
    if (i % 20 === 19) process.stdout.write('.');
  }
  console.log(' done.\n');

  timings.sort((a, b) => a - b);
  const mean = (timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(2);
  const p50  = percentile(timings, 0.50);
  const p95  = percentile(timings, 0.95);
  const p99  = percentile(timings, 0.99);
  const min  = timings[0].toFixed(2);
  const max  = timings[timings.length - 1].toFixed(2);

  const report = [
    `## Experiment 2 Supplement — CheckAccess Single-Operation Latency`,
    ``,
    `**Date:** ${runDate}`,
    `**Mode:** ${MODE} (fabric.enabled=${MODE === 'fabric' ? 'true' : 'false'})`,
    `**Endpoint:** GET ${endpoint}`,
    `**Method:** Sequential, 1 client, no concurrency`,
    `**Warmup:** ${WARMUP} calls discarded`,
    `**Samples:** ${timings.length} completed / ${SAMPLES} attempted`,
    `**Errors:** ${errors}`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Mean   | ${mean} ms |`,
    `| P50    | ${p50} ms |`,
    `| P95    | ${p95} ms |`,
    `| P99    | ${p99} ms |`,
    `| Min    | ${min} ms |`,
    `| Max    | ${max} ms |`,
  ].join('\n');

  console.log('=== CheckAccess Single-Operation Latency ===');
  console.log(`Mode    : ${MODE}`);
  console.log(`Mean    : ${mean} ms`);
  console.log(`P50     : ${p50} ms`);
  console.log(`P95     : ${p95} ms`);
  console.log(`P99     : ${p99} ms`);
  console.log(`Min     : ${min} ms`);
  console.log(`Max     : ${max} ms`);
  console.log(`Errors  : ${errors}`);
  console.log('============================================\n');

  appendToResults(report);
}

main().catch(e => { console.error(e); process.exit(1); });
