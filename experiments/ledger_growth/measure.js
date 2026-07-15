'use strict';

/**
 * Experiment 12 measurement — CheckAccess and GetDocumentHistory latency at
 * the current world-state size. Random preloaded docIDs (LG-0..count-1) are
 * sampled so lookups hit arbitrary keys, n samples per function (default 100
 * for Exp 2 continuity), sequential with warmup, appended to per-sample CSV.
 *
 * Usage: node measure.js --checkpoint 100000 --out <dir> [--samples 100]
 */

const fs = require('fs');
const path = require('path');
const { connectGateway } = require('./gateway');

function arg(name, dflt) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : dflt;
}

const CHECKPOINT = parseInt(arg('checkpoint', ''), 10);
const OUT_DIR = arg('out', '');
const SAMPLES = parseInt(arg('samples', '100'), 10);
const WARMUP = 10;
if (!Number.isFinite(CHECKPOINT) || !OUT_DIR) {
    console.error('usage: node measure.js --checkpoint N --out DIR [--samples 100]');
    process.exit(1);
}

const state = JSON.parse(fs.readFileSync(path.join(__dirname, '.state.json'), 'utf8'));
if (state.next < CHECKPOINT) {
    console.error(`ERROR: state has ${state.next} docs, expected >= ${CHECKPOINT}`);
    process.exit(1);
}

const dec = new TextDecoder();
const randomDocId = () => `LG-${Math.floor(Math.random() * CHECKPOINT)}`;

function pct(sorted, q) {
    return sorted[Math.min(Math.floor(sorted.length * q), sorted.length - 1)];
}

async function bench(contract, fn, argsFor) {
    const rows = [];
    for (let i = 0; i < WARMUP + SAMPLES; i++) {
        const docId = randomDocId();
        const t0 = process.hrtime.bigint();
        const result = dec.decode(await contract.evaluateTransaction(fn, ...argsFor(docId)));
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (fn === 'CheckAccess' && result !== 'true') {
            throw new Error(`CheckAccess(${docId}) returned ${result}, expected true`);
        }
        if (i >= WARMUP) {
            rows.push({ checkpoint: CHECKPOINT, function: fn, sample: i - WARMUP,
                        doc_id: docId, latency_ms: ms.toFixed(2) });
        }
    }
    return rows;
}

async function main() {
    const { gateway, client, contract } = connectGateway();
    try {
        const all = [];
        all.push(...await bench(contract, 'CheckAccess',
            d => [d, 'bench-user', 'FirmAMSP']));
        all.push(...await bench(contract, 'GetDocumentHistory', d => [d]));

        const csvPath = path.join(OUT_DIR, 'latency_samples.csv');
        const header = 'checkpoint,function,sample,doc_id,latency_ms\n';
        const lines = all.map(r =>
            `${r.checkpoint},${r.function},${r.sample},${r.doc_id},${r.latency_ms}`).join('\n') + '\n';
        fs.writeFileSync(csvPath, (fs.existsSync(csvPath) ? '' : header) + lines,
            { flag: 'a' });

        for (const fn of ['CheckAccess', 'GetDocumentHistory']) {
            const lat = all.filter(r => r.function === fn)
                .map(r => parseFloat(r.latency_ms)).sort((a, b) => a - b);
            console.log(`  ${fn} @ ${CHECKPOINT} docs: n=${lat.length} ` +
                        `P50=${pct(lat, 0.5).toFixed(2)}ms P95=${pct(lat, 0.95).toFixed(2)}ms`);
        }
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
