package com.pangochain.backend.ipfs;

public class IpfsException extends RuntimeException {
    public IpfsException(String message) { super(message); }
    public IpfsException(String message, Throwable cause) { super(message, cause); }
}
