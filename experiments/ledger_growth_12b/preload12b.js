'use strict';

/**
 * Experiment 12b preload — bulk RegisterDocument on the CURRENT build, to
 * re-measure per-document ledger cost without wiping the ledger.
 *
 * Same transaction shape as Experiment 12's preload.js (64-char hash, 46-char
 * CID, production-shaped payload) so the resulting bytes/doc is comparable to
 * the published ~7 KB/doc/peer. Two deliberate differences:
 *
 *   1. docIDs are prefixed `LG12B-<runId>-<seq>`, not `LG-<seq>`. Experiment 12
 *      ran against a freshly wiped ledger; this runs against the live one, which
 *      may still hold `LG-*` keys, and a collision would silently turn
 *      RegisterDocument into an "already registered" no-op — a preload that
 *      writes nothing while appearing to succeed.
 *   2. No resumable .state.json. This measures a bounded delta in one pass, so
 *      resumption would only create ways for the count to disagree with the
 *      bytes.
 *
 * Usage: node preload12b.js --count 2000 [--concurrency 40] [--run-id <id>]
 */

const { connectGateway } = require('../ledger_growth/gateway');

function arg(name, dflt) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : dflt;
}

const COUNT = parseInt(arg('count', '2000'), 10);
const CONCURRENCY = parseInt(arg('concurrency', '40'), 10);
const RUN_ID = arg('run-id', String(Date.now()).slice(-8));
if (!Number.isFinite(COUNT)) {
    console.error('usage: preload12b.js --count N [--concurrency 40]');
    process.exit(1);
}

async function main() {
    console.log(`preload12b: ${COUNT} documents, concurrency ${CONCURRENCY}, prefix LG12B-${RUN_ID}-`);
    const { gateway, client, contract } = connectGateway();
    const t0 = Date.now();
    let seq = 0, done = 0, transient = 0, permanent = 0, duplicate = 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function worker() {
        for (;;) {
            const mySeq = seq++;
            if (mySeq >= COUNT) return;
            const docId = `LG12B-${RUN_ID}-${mySeq}`;
            let ok = false;
            for (let attempt = 0; attempt < 3 && !ok; attempt++) {
                try {
                    await contract.submitTransaction('RegisterDocument',
                        docId, `CASE-LG12B-${mySeq % 100}`,
                        'a'.repeat(64), 'QmLedgerGrowthBenchmarkPayloadCid0000000000000',
                        'bench-user', 'FirmAMSP', new Date().toISOString());
                    ok = true;
                } catch (e) {
                    // A duplicate here means the prefix collided, which would make the
                    // byte delta not correspond to COUNT documents. Count it loudly
                    // rather than treating it as success the way a resumable preload must.
                    if (String(e.message).includes('already registered')) {
                        duplicate++; ok = true; break;
                    }
                    transient++;
                    if (transient <= 5) {
                        console.error(`  fail ${docId} (attempt ${attempt + 1}): ${String(e.message).slice(0, 140)}`);
                    }
                    await sleep(500 * (attempt + 1));
                }
            }
            if (!ok) {
                permanent++;
                if (permanent > 50) throw new Error(`too many permanent failures (${permanent}); aborting`);
                continue;
            }
            done++;
            if (done % 250 === 0) {
                const rate = done / ((Date.now() - t0) / 1000);
                console.log(`  ${done}/${COUNT} (${rate.toFixed(1)} tx/s)`);
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    const elapsed = (Date.now() - t0) / 1000;
    gateway.close(); client.close();

    const summary = {
        requested: COUNT, committed: done, duplicate, transient_retries: transient,
        permanent_failures: permanent, elapsed_s: Number(elapsed.toFixed(1)),
        tps: Number((done / elapsed).toFixed(1)), run_id: RUN_ID,
        doc_id_prefix: `LG12B-${RUN_ID}-`,
    };
    console.log(JSON.stringify(summary));
    if (duplicate > 0) {
        console.error(`WARNING: ${duplicate} docIDs already existed — bytes/doc from this run is INVALID`);
        process.exit(3);
    }
    if (permanent > 0) {
        console.error(`WARNING: ${permanent} documents never committed — divide bytes by 'committed', not 'requested'`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
