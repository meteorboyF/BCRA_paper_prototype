'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const axios = require('axios');

const BASE_URL = process.env.PANGOCHAIN_API_URL || 'http://localhost:8080/api';
const JWT_TOKEN = process.env.PANGOCHAIN_JWT_TOKEN || '';  // set via: export PANGOCHAIN_JWT_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@pangolawfirm.com","password":"Admin123!"}' | jq -r .accessToken)
const TEST_CASE_ID = process.env.PANGOCHAIN_TEST_CASE_ID || '';
const TEST_DOC_ID  = process.env.PANGOCHAIN_TEST_DOC_ID  || '';

const WRITE_RATIO = 0.20;  // 20% writes

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json',
};

class PangochainWorkload extends WorkloadModuleBase {
  async submitTransaction() {
    const isWrite = Math.random() < WRITE_RATIO;

    try {
      if (isWrite) {
        // Simulate RegisterDocument — POST ciphertext metadata
        // (ciphertext is pre-generated; we measure API + Fabric round-trip)
        await axios.post(`${BASE_URL}/documents/upload`, {
          caseId: TEST_CASE_ID,
          fileName: `bench-${Date.now()}.bin`,
          ivBase64: 'AAAAAAAAAAAAAAAA',       // 12-byte zero IV (test only)
          ciphertextBase64: 'A'.repeat(1024),  // 768-byte fake ciphertext
          documentHashSha256: '0'.repeat(64),
          wrappedKeyTokenForOwner: 'A'.repeat(125),
        }, { headers, timeout: 10000 });
      } else {
        // CheckAccess — GET ciphertext (two-layer ACL measured end-to-end)
        await axios.get(`${BASE_URL}/documents/${TEST_DOC_ID}/wrapped-key`, {
          headers,
          timeout: 10000,
        });
      }
    } catch (err) {
      // Caliper counts this as a failed transaction
      throw err;
    }
  }
}

module.exports.createWorkloadModule = () => new PangochainWorkload();
