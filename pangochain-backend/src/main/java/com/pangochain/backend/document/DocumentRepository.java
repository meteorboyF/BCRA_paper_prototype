package com.pangochain.backend.document;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByLegalCaseIdAndStatus(UUID caseId, DocStatus status);

    Page<Document> findByLegalCaseIdAndStatus(UUID caseId, DocStatus status, Pageable pageable);

    Page<Document> findByLegalCaseId(UUID caseId, Pageable pageable);

    @Query("""
        SELECT d FROM Document d
        JOIN DocumentAccess da ON da.docId = d.id
        WHERE da.userId = :userId AND da.revokedAt IS NULL
        AND d.status = :status
        ORDER BY d.createdAt DESC
        """)
    List<Document> findAccessibleByUser(@Param("userId") UUID userId,
                                        @Param("status") DocStatus status);

    @Query("""
        SELECT d FROM Document d
        JOIN DocumentAccess da ON da.docId = d.id
        WHERE da.userId = :userId AND da.revokedAt IS NULL
        AND d.status = :status
        ORDER BY d.createdAt DESC
        """)
    Page<Document> findAccessibleByUser(@Param("userId") UUID userId,
                                        @Param("status") DocStatus status,
                                        Pageable pageable);

    @Query(value = """
        SELECT DISTINCT d.* FROM documents d
        JOIN document_access da ON da.doc_id = d.id
        JOIN users o ON o.id = d.owner_id
        WHERE da.user_id = :userId AND da.revoked_at IS NULL
        AND d.status = CAST(:status AS doc_status)
        AND (CAST(:category AS text) IS NULL OR UPPER(COALESCE(d.category, 'GENERAL')) = CAST(:category AS text))
        AND (
            CAST(:q AS text) IS NULL
            OR LOWER(d.file_name) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(d.ipfs_cid) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(d.document_hash_sha256) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(COALESCE(d.fabric_tx_id, '')) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(o.email) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(COALESCE(d.category, 'GENERAL')) LIKE '%' || CAST(:q AS text) || '%'
        )
        ORDER BY d.created_at DESC
        """,
        countQuery = """
        SELECT COUNT(DISTINCT d.id) FROM documents d
        JOIN document_access da ON da.doc_id = d.id
        JOIN users o ON o.id = d.owner_id
        WHERE da.user_id = :userId AND da.revoked_at IS NULL
        AND d.status = CAST(:status AS doc_status)
        AND (CAST(:category AS text) IS NULL OR UPPER(COALESCE(d.category, 'GENERAL')) = CAST(:category AS text))
        AND (
            CAST(:q AS text) IS NULL
            OR LOWER(d.file_name) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(d.ipfs_cid) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(d.document_hash_sha256) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(COALESCE(d.fabric_tx_id, '')) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(o.email) LIKE '%' || CAST(:q AS text) || '%'
            OR LOWER(COALESCE(d.category, 'GENERAL')) LIKE '%' || CAST(:q AS text) || '%'
        )
        """,
        nativeQuery = true)
    Page<Document> searchAccessibleByUser(@Param("userId") UUID userId,
                                          @Param("status") String status,
                                          @Param("q") String q,
                                          @Param("category") String category,
                                          Pageable pageable);

    long countByLegalCaseIdAndStatus(UUID caseId, DocStatus status);

    long countByOwnerId(UUID ownerId);

    @Query("""
        SELECT COUNT(DISTINCT d) FROM Document d
        JOIN DocumentAccess da ON da.docId = d.id
        WHERE da.userId = :userId AND da.revokedAt IS NULL
        AND d.status = :status
        """)
    long countAccessibleByUser(@Param("userId") UUID userId,
                               @Param("status") DocStatus status);

    /** Direct successors in the version chain (documents whose previous_version_id is this doc). */
    List<Document> findByPreviousVersionId(UUID previousVersionId);
}
