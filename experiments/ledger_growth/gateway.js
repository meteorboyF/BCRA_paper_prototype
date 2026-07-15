'use strict';

/** Shared fabric-gateway connection helper for Experiment 12. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');

const CRYPTO_DIR = path.join(__dirname, 'crypto');
const PEER_ENDPOINT = process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051';
const PEER_HOST_OVERRIDE = process.env.FABRIC_PEER_HOST_OVERRIDE || 'peer0.firma.pangochain.com';

function connectGateway() {
    const tlsCert = fs.readFileSync(path.join(CRYPTO_DIR, 'tlsca-cert.pem'));
    const certPem = fs.readFileSync(path.join(CRYPTO_DIR, 'admin-cert.pem'));
    const keyPem = fs.readFileSync(path.join(CRYPTO_DIR, 'admin-key.pem'));

    const client = new grpc.Client(PEER_ENDPOINT,
        grpc.credentials.createSsl(tlsCert), {
            'grpc.ssl_target_name_override': PEER_HOST_OVERRIDE,
        });
    const gateway = connect({
        client,
        identity: { mspId: 'FirmAMSP', credentials: certPem },
        signer: signers.newPrivateKeySigner(crypto.createPrivateKey(keyPem)),
        evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
        endorseOptions: () => ({ deadline: Date.now() + 30000 }),
        submitOptions: () => ({ deadline: Date.now() + 30000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });
    const contract = gateway.getNetwork('legal-channel').getContract('legalcc');
    return { gateway, client, contract };
}

module.exports = { connectGateway };
