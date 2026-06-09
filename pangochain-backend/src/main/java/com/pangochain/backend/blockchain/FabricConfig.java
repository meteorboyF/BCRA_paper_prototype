package com.pangochain.backend.blockchain;

import org.hyperledger.fabric.client.Gateway;
import org.hyperledger.fabric.client.Network;
import org.hyperledger.fabric.client.identity.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.grpc.ChannelCredentials;
import io.grpc.Grpc;
import io.grpc.ManagedChannel;
import io.grpc.TlsChannelCredentials;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.concurrent.TimeUnit;

@Configuration
@ConditionalOnProperty(name = "fabric.enabled", havingValue = "true")
public class FabricConfig {

    @Value("${fabric.msp-id}")
    private String mspId;

    @Value("${fabric.peer-endpoint}")
    private String peerEndpoint;

    @Value("${fabric.peer-host-override}")
    private String peerHostOverride;

    @Value("${fabric.tls-cert-path}")
    private String tlsCertPath;

    @Value("${fabric.cert-path}")
    private String certPath;

    @Value("${fabric.key-path}")
    private String keyPath;

    @Value("${fabric.channel-name}")
    private String channelName;

    @Bean
    public ManagedChannel fabricGrpcChannel() throws IOException {
        ChannelCredentials credentials = TlsChannelCredentials.newBuilder()
                .trustManager(Path.of(tlsCertPath).toFile())
                .build();
        return Grpc.newChannelBuilder(peerEndpoint, credentials)
                .overrideAuthority(peerHostOverride)
                .build();
    }

    @Bean
    public Gateway fabricGateway(ManagedChannel fabricGrpcChannel) throws Exception {
        X509Certificate certificate = Identities.readX509Certificate(
                Files.newBufferedReader(Path.of(certPath)));
        PrivateKey privateKey = Identities.readPrivateKey(
                Files.newBufferedReader(Path.of(keyPath)));

        return Gateway.newInstance()
                .identity(new X509Identity(mspId, certificate))
                .signer(Signers.newPrivateKeySigner(privateKey))
                .connection(fabricGrpcChannel)
                .evaluateOptions(options -> options.withDeadlineAfter(30, TimeUnit.SECONDS))
                .submitOptions(options -> options.withDeadlineAfter(60, TimeUnit.SECONDS))
                .connect();
    }

    @Bean
    public Network fabricNetwork(Gateway fabricGateway,
            @Value("${fabric.channel-name}") String channelName) {
        return fabricGateway.getNetwork(channelName);
    }
}
