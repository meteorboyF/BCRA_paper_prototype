--liquibase formatted sql

-- Sprint 2: audit anomaly detection. A scheduled (and on-demand) statistical sweep of the
-- audit log writes alerts here — e.g. an actor whose access frequency is a statistical outlier,
-- or a burst of accesses in a short window. Each alert links back to the audit evidence.

--changeset pangochain:014-security-alerts
CREATE TABLE security_alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity      VARCHAR(10) NOT NULL DEFAULT 'LOW',
    alert_type    VARCHAR(60) NOT NULL,
    description   TEXT NOT NULL,
    actor_id      UUID,
    actor_label   VARCHAR(200),
    metric        DOUBLE PRECISION,
    fabric_tx_id  VARCHAR(128),
    signature     VARCHAR(200),
    acknowledged  BOOLEAN NOT NULL DEFAULT FALSE,
    auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    detected_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_alerts_ack ON security_alerts(acknowledged);
--rollback DROP TABLE security_alerts;
