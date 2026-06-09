package com.pangochain.backend.custody;

import com.pangochain.backend.custody.CustodyService.CustodyGraph;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/documents/{id}/custody")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CustodyController {

    private final CustodyService custodyService;

    @GetMapping
    public ResponseEntity<CustodyGraph> custody(@PathVariable UUID id) {
        return ResponseEntity.ok(custodyService.forDocument(id));
    }
}
