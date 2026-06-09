package com.pangochain.backend.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentAccessRepository extends JpaRepository<DocumentAccess, UUID> {

    @Query("SELECT da FROM DocumentAccess da WHERE da.docId = :docId AND da.revokedAt IS NULL")
    List<DocumentAccess> findActiveByDoc(@Param("docId") UUID docId);

    @Query("SELECT da FROM DocumentAccess da WHERE da.docId = :docId AND da.userId = :userId AND da.revokedAt IS NULL")
    Optional<DocumentAccess> findActiveEntry(@Param("docId") UUID docId, @Param("userId") UUID userId);

    @Query("SELECT da FROM DocumentAccess da WHERE da.userId = :userId AND da.revokedAt IS NULL")
    List<DocumentAccess> findActiveByUser(@Param("userId") UUID userId);

    @Query("SELECT da FROM DocumentAccess da WHERE da.docId = :docId AND da.revokedAt IS NULL AND da.capability <> :ownerCap")
    List<DocumentAccess> findActiveNonOwnerByDoc(@Param("docId") UUID docId, @Param("ownerCap") DocumentAccess.Capability ownerCap);
}
