'use strict';

/**
 * Experiment 11 workload — RegisterDocument (submit / write path).
 * Every transaction registers a document with a unique docID, driving the
 * full endorse -> order -> commit pipeline (majority endorsement policy,
 * collected by the peer gateway).
 */

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class RegisterDocumentWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex,
                                   roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers,
            roundIndex, roundArguments, sutAdapter, sutContext);
        // Unique per run + worker + round so reruns never collide on the ledger.
        this.prefix = `CAL-REG-${Date.now().toString(36)}-${workerIndex}-${roundIndex}`;
        this.txIndex = 0;
    }

    async submitTransaction() {
        const docId = `${this.prefix}-${this.txIndex++}`;
        await this.sutAdapter.sendRequests({
            contractId: 'legalcc',
            contractFunction: 'RegisterDocument',
            contractArguments: [
                docId, 'CASE-CALIPER', '0'.repeat(64), 'QmCaliperBenchDoc',
                'bench-user', 'FirmAMSP', new Date().toISOString(),
            ],
            readOnly: false,
        });
    }
}

module.exports.createWorkloadModule = () => new RegisterDocumentWorkload();
