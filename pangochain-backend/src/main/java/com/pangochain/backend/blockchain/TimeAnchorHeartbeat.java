package com.pangochain.backend.blockchain;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Periodically advances the chaincode's TimeAnchor.
 *
 * Grant expiry is evaluated inside CheckAccess from the timestamp in the caller's proposal,
 * and on an evaluate that caller is this gateway - the component the architecture claims to
 * remove from the authorization TCB (reviewer finding M2). UpdateTimeAnchor is a submit, so
 * each endorsing peer independently checks the heartbeat's timestamp against its own clock
 * before endorsing; the committed anchor is therefore a time reference this gateway cannot
 * unilaterally move. CheckAccess refuses proposals that sit implausibly far behind it.
 *
 * One submit per interval, not per request: the cost is a fixed background rate rather than
 * anything on the release path. That trade is measured in Experiment 17.
 *
 * Note this heartbeat does not make the gateway trusted - it makes the gateway unable to
 * *rewind* time. A compromised gateway can still withhold heartbeats, which stalls the
 * anchor; bounding that is the chaincode's staleness ceiling, not this class.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "fabric.time-anchor.enabled", havingValue = "true", matchIfMissing = true)
public class TimeAnchorHeartbeat {

    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;

    @Value("${fabric.time-anchor.enabled:true}")
    private boolean enabled;

    private volatile Instant lastSuccess;
    private volatile int consecutiveFailures;

    @Scheduled(
            initialDelayString = "${fabric.time-anchor.initial-delay-ms:15000}",
            fixedDelayString = "${fabric.time-anchor.interval-ms:60000}")
    public void beat() {
        if (!enabled || fabricGatewayService == null) return;
        try {
            String txId = fabricGatewayService.submitTransaction("UpdateTimeAnchor");
            lastSuccess = Instant.now();
            if (consecutiveFailures > 0) {
                log.info("Time anchor heartbeat recovered after {} failed attempt(s), txId={}",
                        consecutiveFailures, txId);
                consecutiveFailures = 0;
            } else {
                log.debug("Time anchor advanced, txId={}", txId);
            }
        } catch (FabricException e) {
            consecutiveFailures++;
            // Expected whenever ordering is unavailable. Log the first failure at WARN and
            // then stay quiet: the reconciliation worker already reports outages, and a
            // heartbeat that logs every interval would bury it. Staleness is a chaincode-side
            // policy decision, so there is nothing to retry more aggressively here.
            if (consecutiveFailures == 1) {
                log.warn("Time anchor heartbeat failed, anchor will go stale until ordering recovers: {}",
                        e.getMessage());
            } else if (consecutiveFailures % 10 == 0) {
                log.warn("Time anchor heartbeat still failing after {} attempts; anchor stale for {}",
                        consecutiveFailures,
                        lastSuccess == null ? "the lifetime of this process"
                                : Duration.between(lastSuccess, Instant.now()));
            }
        }
    }

    /** Age of the last successfully committed heartbeat, or null if none has succeeded. */
    public Duration anchorAge() {
        Instant seen = lastSuccess;
        return seen == null ? null : Duration.between(seen, Instant.now());
    }
}
