package com.pangochain.backend.config;

import com.pangochain.backend.auth.JwtAuthenticationFilter;
import com.pangochain.backend.config.ratelimit.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                // CSRF disabled: this is a stateless REST API authenticated via JWT Bearer tokens.
                // CSRF tokens are only needed for cookie-based session auth. JWT in Authorization
                // header is not sent by browsers automatically, so CSRF attacks are not applicable.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Security headers on every response. X-Content-Type-Options: nosniff and
                // HSTS (over HTTPS only) are emitted by Spring Security defaults; the rest are
                // set explicitly via StaticHeadersWriter for version-stable behaviour.
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .addHeaderWriter(new StaticHeadersWriter("Content-Security-Policy",
                                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                                        + "img-src 'self' data:; "
                                        + "connect-src 'self' http://localhost:5001 http://localhost:5002; "
                                        + "frame-ancestors 'none'"))
                        .addHeaderWriter(new StaticHeadersWriter("Referrer-Policy",
                                "strict-origin-when-cross-origin"))
                        .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy",
                                "camera=(), microphone=(), geolocation=()")))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/mfa/setup").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/mfa/verify").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/mfa/challenge").permitAll()
                        // Recovery login: user has only a challenge token, not a full JWT
                        .requestMatchers(HttpMethod.POST, "/api/auth/mfa/recovery").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        // WebSocket/SockJS handshake — STOMP CONNECT is authenticated by
                        // StompAuthChannelInterceptor using the JWT in the CONNECT frame.
                        .requestMatchers("/ws/**").permitAll()
                        .anyRequest().authenticated()
                )
                // Both custom filters are anchored before UsernamePasswordAuthenticationFilter
                // (a registered filter type). Spring Security preserves insertion order, so the
                // rate limiter is added first and therefore runs before the JWT filter — shedding
                // abusive auth traffic before any authentication work.
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * Prevent Boot from also auto-registering the @Component RateLimitFilter in the plain
     * servlet chain — it must run only once, inside the Spring Security filter chain.
     */
    @Bean
    public org.springframework.boot.web.servlet.FilterRegistrationBean<RateLimitFilter>
            rateLimitFilterRegistration(RateLimitFilter filter) {
        var reg = new org.springframework.boot.web.servlet.FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:3000", "http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
