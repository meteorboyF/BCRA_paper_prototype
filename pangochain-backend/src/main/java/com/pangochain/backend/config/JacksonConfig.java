package com.pangochain.backend.config;

import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.codec.CodecConfigurer;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class JacksonConfig {

    // Raise Jackson's default 20MB string-length cap so large base64 ciphertexts parse correctly.
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonLargePayloadCustomizer() {
        return builder -> builder.postConfigurer(mapper -> {
            StreamReadConstraints constraints = StreamReadConstraints.builder()
                    .maxStringLength(Integer.MAX_VALUE)
                    .build();
            mapper.getFactory().setStreamReadConstraints(constraints);
        });
    }

    // Raise WebClient in-memory buffer to 100 MB so IpfsService can upload large ciphertexts.
    @Bean
    public WebClient.Builder webClientBuilder() {
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(configurer -> configurer.defaultCodecs()
                        .maxInMemorySize(100 * 1024 * 1024))
                .build();
        return WebClient.builder().exchangeStrategies(strategies);
    }
}
