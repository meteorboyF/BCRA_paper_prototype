package com.pangochain.backend.template;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A versioned, parameterised legal-document template. Body uses {{variable}} placeholders that
 *  are substituted client-side; fieldsJson describes the guided form for those variables. */
@Entity
@Table(name = "document_templates")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DocumentTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "template_key", nullable = false)
    private String templateKey;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private String category = "CONTRACT";

    @Column(nullable = false)
    @Builder.Default
    private int version = 1;

    @Column
    private String description;

    @Column(name = "fields_json", nullable = false, columnDefinition = "text")
    private String fieldsJson;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
