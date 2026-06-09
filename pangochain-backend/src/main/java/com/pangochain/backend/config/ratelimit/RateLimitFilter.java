package com.pangochain.backend.config.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP rate limiting for sensitive auth endpoints, backed by in-memory token buckets.
 * Runs before authentication. On limit exceeded: 429 with a Retry-After header.
 *
 * Limits (per the brief):
 *   POST /api/auth/login    10/min
 *   POST /api/auth/refresh  20/min
 *   POST /api/auth/mfa/**    5/min  (TOTP brute-force protection)
 */
@Component
@Order(1) // before the JWT filter
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String method, String prefix, int limit, long windowMs) {}

    private static final long MIN = 60_000L;
    private static final List<Rule> RULES = List.of(
            new Rule("POST", "/api/auth/login",   10, MIN),
            new Rule("POST", "/api/auth/refresh",  20, MIN),
            new Rule("POST", "/api/auth/mfa",       5, MIN)
    );

    // key = ruleIndex + "|" + clientIp
    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Rule rule = matchRule(request);
        if (rule != null) {
            String ip = clientIp(request);
            String key = rule.prefix() + "|" + ip;
            TokenBucket bucket = buckets.computeIfAbsent(key,
                    k -> new TokenBucket(rule.limit(), rule.windowMs()));
            if (!bucket.tryConsume()) {
                long retryAfter = bucket.secondsUntilRefill();
                log.warn("Rate limit exceeded: {} {} from {}", request.getMethod(), request.getRequestURI(), ip);
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(retryAfter));
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"error\":\"RATE_LIMITED\",\"message\":\"Too many requests. Please retry later.\","
                        + "\"retryAfterSeconds\":" + retryAfter + "}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private Rule matchRule(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String method = request.getMethod();
        for (Rule r : RULES) {
            if (r.method().equals(method) && uri.startsWith(r.prefix())) return r;
        }
        return null;
    }

    private static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
