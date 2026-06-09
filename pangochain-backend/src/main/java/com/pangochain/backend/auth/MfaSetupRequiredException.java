package com.pangochain.backend.auth;

public class MfaSetupRequiredException extends RuntimeException {
    private final String setupToken;

    public MfaSetupRequiredException(String setupToken) {
        super("MFA enrollment required for your role");
        this.setupToken = setupToken;
    }

    public String getSetupToken() { return setupToken; }
}
