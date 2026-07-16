'use strict';

/**
 * Experiment 13 benchmark — one topology point.
 * Write path: RegisterDocument, closed-loop (--write-conc in-flight, matching
 * the Exp 11/12 client model) for --write-tx transactions -> TPS + latency.
 * Read path: CheckAccess, sequential n=--read-samples after warmup.
 * Appends one row to <out>/matrix.csv and per-sample rows to
 * <out>/samples.csv, tagged with the point label.
 *
 * Usage: node bench.js --label o3p1-majority --orgs 3 --peers 1 \
 *          --policy majority --out <dir> [--write-conc 100] [--write-tx 2000]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');

function arg(name, dflt) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : dflt;
}

const LABEL = arg('label', '');
const ORGS = parseInt(arg('orgs', '0'), 10);
const PEERS = parseInt(arg('peers', '0'), 10);
const POLICY = arg('policy', '');
const OUT = arg('out', '');
const WRITE_CONC = parseInt(arg('write-conc', '100'), 10);
const WRITE_TX = parseInt(arg('write-tx', '2000'), 10);
const READ_N = parseInt(arg('read-samples', '100'), 10);
const WARMUP = 10;
if (!LABEL || !OUT || !ORGS) {
    console.error('usage: bench.js --label L --orgs N --peers P --policy X --out DIR');
    process.exit(1);
}

const CRYPTO_DIR = path.join(__dirname, 'crypto');

function connectGateway() {
    const client = new grpc.Client('localhost:7051',
        grpc.credentials.createSsl(fs.readFileSync(path.join(CRYPTO_DIR, 'tlsca-cert.pem'))),
        { 'grpc.ssl_target_name_override': 'peer0.org1.pangochain.com' });
    const gateway = connect({
        client,
        identity: { mspId: 'Org1MSP',
                    credentials: fs.readFileSync(path.join(CRYPTO_DIR, 'admin-cert.pem')) },
        signer: signers.newPrivateKeySigner(
            crypto.createPrivateKey(fs.readFileSync(path.join(CRYPTO_DIR, 'admin-key.pem')))),
        evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
        endorseOptions: () => ({ deadline: Date.now() + 60000 }),
        submitOptions: () => ({ deadline: Date.now() + 60000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 120000 }),
    });
    return { gateway, client,
             contract: gateway.getNetwork('legal-channel').getContract('legalcc') };
}

const pct = (s, q) => s[Math.min(Math.floor(s.length * q), s.length - 1)];
const dec = new TextDecoder();

async function main() {
    const { gateway, client, contract } = connectGateway();
    const runId = Date.now().toString(36);
    const samples = [];
    try {
        // -------- write phase (closed loop) --------
        let seq = 0, failed = 0;
        const writeLat = [];
        const t0 = process.hrtime.bigint();
        async function writer() {
            for (;;) {
                const my = seq++;
                if (my >= WRITE_TX) return;
                const s0 = process.hrtime.bigint();
                try {
                    await contract.submitTransaction('RegisterDocument',
                        `NS-${runId}-${my}`, 'CASE-NS', 'b'.repeat(64),
                        'QmNetScaleBenchPayloadCid00000000000000000000',
                        'bench-user', 'Org1MSP', new Date().toISOString());
                    writeLat.push(Number(process.hrtime.bigint() - s0) / 1e6);
                } catch (e) {
                    failed++;
                    if (failed <= 3) console.error(`  write fail: ${String(e.message).slice(0, 100)}`);
                }
            }
        }
        await Promise.all(Array.from({ length: WRITE_CONC }, writer));
        const wallS = Number(process.hrtime.bigint() - t0) / 1e9;
        const tps = writeLat.length / wallS;
        writeLat.sort((a, b) => a - b);
        for (let i = 0; i < writeLat.length; i++) {
            samples.push(`${LABEL},RegisterDocument,${i},${writeLat[i].toFixed(2)}`);
        }

        // -------- read phase (sequential) --------
        const readLat = [];
        const docId = `NS-${runId}-0`;
        for (let i = 0; i < WARMUP + READ_N; i++) {
            const s0 = process.hrtime.bigint();
            const r = dec.decode(await contract.evaluateTransaction(
                'CheckAccess', docId, 'bench-user', 'Org1MSP'));
            const ms = Number(process.hrtime.bigint() - s0) / 1e6;
            if (r !== 'true') throw new Error(`CheckAccess returned ${r}`);
            if (i >= WARMUP) {
                readLat.push(ms);
                samples.push(`${LABEL},CheckAccess,${i - WARMUP},${ms.toFixed(2)}`);
            }
        }
        readLat.sort((a, b) => a - b);

        // -------- output --------
        const row = [LABEL, ORGS, PEERS, POLICY, WRITE_CONC, writeLat.length, failed,
            tps.toFixed(1), pct(writeLat, 0.5).toFixed(0), pct(writeLat, 0.95).toFixed(0),
            READ_N, pct(readLat, 0.5).toFixed(2), pct(readLat, 0.95).toFixed(2)].join(',');
        const header = 'label,orgs,peers_per_org,policy,write_conc,write_ok,write_fail,' +
            'write_tps,write_p50_ms,write_p95_ms,read_n,read_p50_ms,read_p95_ms\n';
        const mPath = path.join(OUT, 'matrix.csv');
        fs.writeFileSync(mPath, (fs.existsSync(mPath) ? '' : header) + row + '\n', { flag: 'a' });
        const sPath = path.join(OUT, 'samples.csv');
        fs.writeFileSync(sPath,
            (fs.existsSync(sPath) ? '' : 'label,function,sample,latency_ms\n') +
            samples.join('\n') + '\n', { flag: 'a' });

        console.log(`  ${LABEL}: write ${tps.toFixed(1)} TPS ` +
            `(P50 ${pct(writeLat, 0.5).toFixed(0)}ms, ${failed} failed) | ` +
            `read P50 ${pct(readLat, 0.5).toFixed(2)}ms`);
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
