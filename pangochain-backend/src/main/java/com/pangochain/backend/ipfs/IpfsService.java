package com.pangochain.backend.ipfs;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * IPFS Kubo client with 2-node cross-pinning for availability.
 * Upload to primary (ipfs1), then pin on secondary (ipfs2).
 * cat() falls back to ipfs2 if ipfs1 is unavailable.
 *
 * Upload:  POST /api/v0/add            → returns { Name, Hash, Size }
 * Pin:     POST /api/v0/pin/add?arg=   → pins CID on secondary
 * Fetch:   POST /api/v0/cat?arg=CID   → returns raw bytes
 */
@Service
@Slf4j
public class IpfsService {

    private final WebClient primary;
    private final WebClient secondary;

    public IpfsService(
            @Value("${ipfs.api.host:http://localhost}") String host,
            @Value("${ipfs.api.port:5001}") int port,
            @Value("${ipfs.api.host2:http://localhost}") String host2,
            @Value("${ipfs.api.port2:5002}") int port2,
            WebClient.Builder webClientBuilder) {
        this.primary   = webClientBuilder.clone().baseUrl(host  + ":" + port ).build();
        this.secondary = webClientBuilder.clone().baseUrl(host2 + ":" + port2).build();
    }

    /**
     * Uploads ciphertext bytes to the primary IPFS node and pins on the secondary.
     * The ciphertext is already AES-256-GCM encrypted by the browser — no plaintext here.
     */
    public String add(byte[] ciphertextBytes, String fileName) {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", new ByteArrayResource(ciphertextBytes) {
            @Override public String getFilename() { return fileName; }
        }, MediaType.APPLICATION_OCTET_STREAM);

        @SuppressWarnings("unchecked")
        Map<String, String> response = primary.post()
                .uri("/api/v0/add")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body.build()))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null || !response.containsKey("Hash")) {
            throw new IpfsException("IPFS add returned no CID");
        }
        String cid = response.get("Hash");
        log.info("Uploaded {} bytes to primary IPFS CID={}", ciphertextBytes.length, cid);

        pinOnSecondary(cid);
        return cid;
    }

    /**
     * Fetches raw ciphertext bytes from IPFS by CID.
     * Tries primary first; falls back to secondary if primary fails.
     */
    public byte[] cat(String cid) {
        try {
            byte[] bytes = primary.post()
                    .uri("/api/v0/cat?arg={cid}", cid)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block();
            if (bytes != null) {
                log.info("Fetched {} bytes from primary IPFS CID={}", bytes.length, cid);
                return bytes;
            }
        } catch (Exception e) {
            log.warn("Primary IPFS unavailable for CID={}, trying secondary: {}", cid, e.getMessage());
        }

        byte[] bytes = secondary.post()
                .uri("/api/v0/cat?arg={cid}", cid)
                .retrieve()
                .bodyToMono(byte[].class)
                .block();
        if (bytes == null) throw new IpfsException("IPFS cat returned null for CID=" + cid);
        log.info("Fetched {} bytes from secondary IPFS CID={}", bytes.length, cid);
        return bytes;
    }

    private void pinOnSecondary(String cid) {
        try {
            secondary.post()
                    .uri("/api/v0/pin/add?arg={cid}", cid)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            log.info("Pinned CID {} on both IPFS nodes", cid);
        } catch (Exception e) {
            log.warn("Failed to pin CID {} on secondary IPFS node: {}", cid, e.getMessage());
        }
    }
}
