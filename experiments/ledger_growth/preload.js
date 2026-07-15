'use strict';

/**
 * Experiment 12 preload — bulk RegisterDocument up to a cumulative target.
 * Resumable: progress is tracked in .state.json (next sequence number), so
 * a later invocation with a higher --target continues where this left off.
 * DocIDs are LG-<seq>; payload shapes match production use (64-char hash,
 * 46-char CID).
 *
 * Usage: node preload.js --target 100000 [--concurrency 200]
 */

const fs = require('fs');
const path = require('path');
const { connectGateway } = require('./gateway');

const STATE_FILE = path.join(__dirname, '.state.json');

function arg(name, dflt) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : dflt;
}

const TARGET = parseInt(arg('target', ''), 10);
const CONCURRENCY = parseInt(arg('concurrency', '200'), 10);
if (!Number.isFinite(TARGET)) {
    console.error('usage: node preload.js --target N [--concurrency 200]');
    process.exit(1);
}

function readState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
    catch { return { next: 0 }; }
}
function writeState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

async function main() {
    const state = readState();
    if (state.next >= TARGET) {
        console.log(`preload: already at ${state.next} >= target ${TARGET}, nothing to do`);
        return;
    }
    console.log(`preload: ${state.next} -> ${TARGET} (concurrency ${CONCURRENCY})`);
    const { gateway, client, contract } = connectGateway();
    const t0 = Date.now();
    let seq = state.next;
    let done = 0;
    let failed = 0;      // transient, retried
    let permanent = 0;   // exhausted retries, seq skipped

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function worker() {
        for (;;) {
            const mySeq = seq++;
            if (mySeq >= TARGET) return;
            const docId = `LG-${mySeq}`;
            let ok = false;
            for (let attempt = 0; attempt < 3 && !ok; attempt++) {
                try {
                    await contract.submitTransaction('RegisterDocument',
                        docId, `CASE-LG-${mySeq % 100}`,
                        'a'.repeat(64), 'QmLedgerGrowthBenchmarkPayloadCid0000000000000',
                        'bench-user', 'FirmAMSP', new Date().toISOString());
                    ok = true;
                } catch (e) {
                    if (String(e.message).includes('already registered')) {
                        ok = true; // resumed run re-walking committed seqs
                        break;
                    }
                    failed++;
                    if (failed <= 5) console.error(`  fail ${docId} (attempt ${attempt + 1}): ${String(e.message).slice(0, 120)}`);
                    await sleep(500 * (attempt + 1));
                }
            }
            if (!ok) {
                permanent++;
                if (permanent > 100) throw new Error(`too many permanent failures (${permanent}); aborting`);
                continue;
            }
            done++;
            if (done % 5000 === 0) {
                const rate = done / ((Date.now() - t0) / 1000);
                writeState({ next: mySeq + 1 });
                console.log(`  ${state.next + done}/${TARGET} (${rate.toFixed(0)} tx/s)`);
            }
        }
    }

    try {
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        writeState({ next: TARGET });
        const secs = (Date.now() - t0) / 1000;
        console.log(`preload done: ${done} registered, ${failed} transient failures, ` +
                    `${permanent} skipped, ${secs.toFixed(0)}s (${(done / secs).toFixed(0)} tx/s)`);
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
