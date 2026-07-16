'use strict';

/**
 * Experiment 14 load generator — GET /api/documents/{id}/ciphertext through
 * the real REST gateway, closed-loop concurrency sweep. Run once per backend
 * mode (on-path enforcement vs audit-log-only baseline profile).
 *
 * Usage: node loadgen.js --mode onpath --out DIR
 *        [--conc 10,50,100,200] [--requests 2000]
 * Env:   PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_DOC_ID
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

function arg(name, dflt) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : dflt;
}

const MODE = arg('mode', '');
const OUT = arg('out', '');
const CONCS = arg('conc', '10,50,100,200').split(',').map(Number);
const REQUESTS = parseInt(arg('requests', '2000'), 10);
const PORT = parseInt(process.env.PANGOCHAIN_BACKEND_PORT || '8080', 10);
const TOKEN = process.env.PANGOCHAIN_JWT_TOKEN || '';
const DOC = process.env.PANGOCHAIN_TEST_DOC_ID || '';
if (!MODE || !OUT || !TOKEN || !DOC) {
    console.error('need --mode/--out and PANGOCHAIN_JWT_TOKEN/PANGOCHAIN_TEST_DOC_ID');
    process.exit(1);
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 1024 });
// Guard against all-failed levels (empty latency array) — crashed a prior run.
const pct = (s, q) => s.length ? s[Math.min(Math.floor(s.length * q), s.length - 1)] : NaN;
const fx = (v, d) => Number.isFinite(v) ? v.toFixed(d) : '';

function one() {
    return new Promise(resolve => {
        const t0 = process.hrtime.bigint();
        const req = http.get({
            host: 'localhost', port: PORT,
            path: `/api/documents/${DOC}/ciphertext`,
            agent, headers: { Authorization: `Bearer ${TOKEN}` },
        }, res => {
            res.on('data', () => {});
            res.on('end', () => resolve({
                status: res.statusCode,
                ms: Number(process.hrtime.bigint() - t0) / 1e6,
            }));
        });
        req.on('error', () => resolve({
            status: 0, ms: Number(process.hrtime.bigint() - t0) / 1e6,
        }));
        req.setTimeout(30000, () => req.destroy());
    });
}

async function level(conc) {
    // warmup
    await Promise.all(Array.from({ length: Math.min(conc, 20) }, one));
    const results = [];
    let issued = 0;
    const t0 = process.hrtime.bigint();
    async function worker() {
        for (;;) {
            if (issued >= REQUESTS) return;
            issued++;
            results.push(await one());
        }
    }
    await Promise.all(Array.from({ length: conc }, worker));
    const wallS = Number(process.hrtime.bigint() - t0) / 1e9;
    const ok = results.filter(r => r.status === 200);
    const lat = ok.map(r => r.ms).sort((a, b) => a - b);
    return { conc, n: results.length, ok: ok.length, fail: results.length - ok.length,
             tps: results.length / wallS, lat, results };
}

async function main() {
    // CSVs are appended per level so a crash or abort never loses prior levels.
    const sPath = path.join(OUT, 'samples.csv');
    const lPath = path.join(OUT, 'levels.csv');
    for (const conc of CONCS) {
        const r = await level(conc);
        const sampleRows = r.results.map((x, i) =>
            `${MODE},${conc},${i},${x.status},${x.ms.toFixed(2)}`);
        fs.writeFileSync(sPath,
            (fs.existsSync(sPath) ? '' : 'mode,conc,sample,status,latency_ms\n') +
            sampleRows.join('\n') + '\n', { flag: 'a' });
        const mean = r.lat.length ? r.lat.reduce((a, b) => a + b, 0) / r.lat.length : NaN;
        fs.writeFileSync(lPath,
            (fs.existsSync(lPath) ? '' : 'mode,conc,n,ok,fail,tps,p50_ms,p95_ms,mean_ms\n') +
            [MODE, conc, r.n, r.ok, r.fail, r.tps.toFixed(1), fx(pct(r.lat, 0.5), 2),
             fx(pct(r.lat, 0.95), 2), fx(mean, 2)].join(',') + '\n', { flag: 'a' });
        console.log(`  ${MODE} conc=${conc}: ${r.tps.toFixed(1)} req/s ` +
            `P50=${fx(pct(r.lat, 0.5), 1)}ms P95=${fx(pct(r.lat, 0.95), 1)}ms ` +
            `ok=${r.ok}/${r.n}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
