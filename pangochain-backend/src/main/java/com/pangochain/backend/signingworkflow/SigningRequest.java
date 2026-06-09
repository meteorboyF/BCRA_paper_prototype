package com.pangochain.backend.signingworkflow;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** One signatory's slot in a {@link SigningWorkflow}, signed in sign_order sequence. */
@Entity
@Table(name = "signing_requests")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SigningRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "workflow_id", nullable = false)
    private UUID workflowId;

    @Column(name = "signer_id", nullable = false)
    private UUID signerId;

    @Column(name = "sign_order", nullable = false)
    @Builder.Default
    private int signOrder = 0;

    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "signature_b64", columnDefinition = "text")
    private String signatureB64;

    @Column(name = "signing_public_key", columnDefinition = "text")
    private String signingPublicKey;

    @Column(name = "fabric_tx_id")
    private String fabricTxId;

    @Column(name = "signed_at")
    private Instant signedAt;
}
