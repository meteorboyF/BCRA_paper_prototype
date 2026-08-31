package com.pangochain.backend.blockchain;

public class FabricException extends Exception {

    /**
     * True when the failure is a deterministic chaincode/endorsement rejection (the peers
     * evaluated the proposal and refused it) rather than a transport or ordering failure.
     * A deterministic rejection will never succeed on retry, so it must not be queued in the
     * durable outbox — it is a policy answer, not an outage. Distinguishes, e.g., a
     * recipient-key-mismatch refusal (S3) from an orderer being unreachable.
     */
    private final boolean deterministicRejection;

    public FabricException(String message) {
        this(message, null, false);
    }

    public FabricException(String message, Throwable cause) {
        this(message, cause, false);
    }

    public FabricException(String message, Throwable cause, boolean deterministicRejection) {
        super(message, cause);
        this.deterministicRejection = deterministicRejection;
    }

    public boolean isDeterministicRejection() {
        return deterministicRejection;
    }
}
