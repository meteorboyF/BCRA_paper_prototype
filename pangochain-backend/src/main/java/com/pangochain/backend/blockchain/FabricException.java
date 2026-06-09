package com.pangochain.backend.blockchain;

public class FabricException extends Exception {

    public FabricException(String message) {
        super(message);
    }

    public FabricException(String message, Throwable cause) {
        super(message, cause);
    }
}
