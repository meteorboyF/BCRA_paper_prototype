package com.pangochain.backend.auth;

public class MfaChallengeRequiredException extends RuntimeException {
    private final String challengeToken;

    public MfaChallengeRequiredException(String challengeToken) {
        super("Enter your 6-digit authenticator code");
        this.challengeToken = challengeToken;
    }

    public String getChallengeToken() { return challengeToken; }
}
