package com.pangochain.backend.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiCaseService {

    protected final Optional<ChatClient> chatClient;
    protected final AiAvailability availability;
}
