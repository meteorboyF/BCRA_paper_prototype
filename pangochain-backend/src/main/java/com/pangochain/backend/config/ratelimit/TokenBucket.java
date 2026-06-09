package com.pangochain.backend.config.ratelimit;

/**
 * Minimal thread-safe token bucket. Refills linearly to {@code capacity} over
 * {@code refillPeriodMillis}. {@link #tryConsume()} returns false when empty.
 *
 * Hand-rolled (rather than Bucket4j) to avoid an extra dependency; the brief
 * explicitly permits "a simple in-memory token bucket".
 */
public class TokenBucket {

    private final int capacity;
    private final double refillPerMilli;
    private double tokens;
    private long lastRefillNanos;

    public TokenBucket(int capacity, long refillPeriodMillis) {
        this.capacity = capacity;
        this.refillPerMilli = (double) capacity / refillPeriodMillis;
        this.tokens = capacity;
        this.lastRefillNanos = System.nanoTime();
    }

    public synchronized boolean tryConsume() {
        refill();
        if (tokens >= 1.0) {
            tokens -= 1.0;
            return true;
        }
        return false;
    }

    /** Seconds until at least one token is available (for Retry-After), min 1. */
    public synchronized long secondsUntilRefill() {
        refill();
        if (tokens >= 1.0) return 0;
        double needed = 1.0 - tokens;
        return Math.max(1, (long) Math.ceil(needed / refillPerMilli / 1000.0));
    }

    private void refill() {
        long now = System.nanoTime();
        double elapsedMillis = (now - lastRefillNanos) / 1_000_000.0;
        if (elapsedMillis <= 0) return;
        tokens = Math.min(capacity, tokens + elapsedMillis * refillPerMilli);
        lastRefillNanos = now;
    }
}
