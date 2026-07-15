'use strict';

/**
 * Experiment 11 workload — CheckAccess (evaluate / read path).
 * Each worker registers one document up front (owner grant is implicit),
 * then repeatedly evaluates CheckAccess for the owner, which exercises the
 * same ledger-evaluated ACL decision the backend makes on the release path.
 */

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class CheckAccessWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex,
                                   roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers,
            roundIndex, roundArguments, sutAdapter, sutContext);
        this.docId = `CAL-CA-${workerIndex}`;
        try {
            await this.sutAdapter.sendRequests({
                contractId: 'legalcc',
                contractFunction: 'RegisterDocument',
                contractArguments: [
                    this.docId, 'CASE-CALIPER', '0'.repeat(64),
                    'QmCaliperBenchDoc', 'bench-user', 'FirmAMSP',
                    new Date().toISOString(),
                ],
                readOnly: false,
            });
        } catch (e) {
            // Already registered by a previous round — expected.
        }
    }

    async submitTransaction() {
        await this.sutAdapter.sendRequests({
            contractId: 'legalcc',
            contractFunction: 'CheckAccess',
            contractArguments: [this.docId, 'bench-user', 'FirmAMSP'],
            readOnly: true,
        });
    }
}

module.exports.createWorkloadModule = () => new CheckAccessWorkload();
