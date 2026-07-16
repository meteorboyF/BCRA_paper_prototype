package com.pangochain.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Bounded executor for {@code @Async} methods (primarily AuditService's
 * Fabric audit anchoring).
 *
 * Without this, Spring's async support cannot pick a unique TaskExecutor —
 * {@code @EnableWebSocketMessageBroker} registers several — and silently
 * falls back to SimpleAsyncTaskExecutor, which spawns an unbounded NEW
 * THREAD PER TASK. Each audit anchor waits ~2 s (BatchTimeout) in
 * commitStatus, so under sustained load the backend accumulated thousands
 * of threads whose post-commit DB writes arrived in 2 s waves against the
 * connection pool, capping gateway throughput at ~14 req/s (discovered by
 * experiments/baseline_auditlog, IMPROVEMENTS.md item 3.5a).
 *
 * Bounded pool + large bounded queue: audit anchoring drains in the
 * background without blocking callers. If the queue ever fills, tasks are
 * rejected (logged); audit anchoring at sustained rates beyond the drain
 * rate needs batched submission — documented as future work.
 */
@Configuration
@Slf4j
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("async-task-");
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(50_000);
        executor.setRejectedExecutionHandler((r, ex) ->
                log.error("Async task rejected (queue full, {} pending) — audit anchor lost",
                        ex.getQueue().size()));
        executor.initialize();
        return executor;
    }
}
