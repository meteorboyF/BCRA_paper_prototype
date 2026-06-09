package com.pangochain.backend.esignature;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "esignatures")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ESignature {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "signer_id", nullable = false)
    private UUID signerId;

    @Column(name = "document_hash", length = 128)
    private String documentHash;

    @Column(name = "signature_hash", length = 128)
    private String signatureHash;

    // ECDSA P-256 signature fields (populated for all new signatures)
    @Column(name = "signature_b64", columnDefinition = "TEXT")
    private String signatureB64;

    @Column(name = "document_hash_b64", columnDefinition = "TEXT")
    private String documentHashB64;

    @Column(name = "signing_public_key", columnDefinition = "TEXT")
    private String signingPublicKey;

    @Column(name = "verification_status", length = 20)
    @Builder.Default
    private String verificationStatus = "PENDING";

    @Column(name = "fabric_tx_id", length = 128)
    private String fabricTxId;

    @Column(name = "signed_at", nullable = false, updatable = false)
    private Instant signedAt;

    @PrePersist
    void prePersist() { signedAt = Instant.now(); }
}
