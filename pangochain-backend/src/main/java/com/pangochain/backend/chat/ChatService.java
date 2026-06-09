package com.pangochain.backend.chat;

import com.pangochain.backend.cases.Case;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.chat.ChatDtos.ChatMessageDto;
import com.pangochain.backend.chat.ChatDtos.ConversationDto;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Team chat: auto-provisioned CASE and FIRM channels, server-readable (encrypted at rest).
 * Channel membership mirrors the case team + client (CASE) or all firm lawyers (FIRM).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatCryptoService crypto;
    private final CaseRepository caseRepository;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager em;

    private static boolean isClient(User u) {
        return u.getRole() != null && u.getRole().name().startsWith("CLIENT_");
    }

    // ─── Provisioning ───────────────────────────────────────────────────────

    @Transactional
    public List<ConversationDto> listConversations(User user) {
        // Lazily provision the channels this user should belong to.
        if (user.getFirm() != null && !isClient(user)) {
            ensureFirmConversation(user.getFirm().getId());
        }
        for (Case c : casesForUser(user)) {
            ensureCaseConversation(c);
        }

        List<UUID> convIds = memberRepository.findByUserId(user.getId()).stream()
                .map(ConversationMember::getConversationId).toList();
        if (convIds.isEmpty()) return List.of();

        return conversationRepository.findByIdIn(convIds).stream()
                .map(c -> toDto(c, user))
                .sorted(Comparator.comparing(
                        (ConversationDto d) -> d.lastMessageAt() != null ? d.lastMessageAt() : Instant.EPOCH)
                        .reversed())
                .toList();
    }

    /**
     * Find-or-create the 1:1 DIRECT conversation between the caller and another user.
     * DIRECT channels are not auto-provisioned; they spring into existence the first time
     * someone opens a DM. Both participants must belong to the same firm.
     */
    @Transactional
    public ConversationDto openDirect(User me, UUID otherUserId) {
        if (me.getId().equals(otherUserId)) {
            throw new IllegalArgumentException("Cannot start a direct message with yourself");
        }
        User other = userRepository.findById(otherUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + otherUserId));
        UUID myFirm = me.getFirm() != null ? me.getFirm().getId() : null;
        UUID otherFirm = other.getFirm() != null ? other.getFirm().getId() : null;
        if (myFirm == null || !myFirm.equals(otherFirm)) {
            throw new AccessDeniedException("You can only message members of your own firm");
        }

        Conversation conv = conversationRepository
                .findDirectBetween(Conversation.Type.DIRECT, me.getId(), otherUserId)
                .stream().findFirst()
                .orElseGet(() -> {
                    Conversation created = conversationRepository.save(Conversation.builder()
                            .type(Conversation.Type.DIRECT)
                            .firmId(myFirm)
                            .title("Direct message")
                            .build());
                    syncMembers(created.getId(), Set.of(me.getId(), otherUserId));
                    return created;
                });
        return toDto(conv, me);
    }

    private List<Case> casesForUser(User user) {
        if (isClient(user)) {
            @SuppressWarnings("unchecked")
            List<UUID> ids = em.createNativeQuery(
                    "SELECT case_id FROM case_clients WHERE client_id = :uid")
                    .setParameter("uid", user.getId())
                    .getResultList();
            return ids.isEmpty() ? List.of() : caseRepository.findAllById(ids);
        }
        return caseRepository.findByMember(user.getId());
    }

    private Conversation ensureFirmConversation(UUID firmId) {
        Conversation conv = conversationRepository
                .findByTypeAndFirmId(Conversation.Type.FIRM, firmId)
                .orElseGet(() -> conversationRepository.save(Conversation.builder()
                        .type(Conversation.Type.FIRM)
                        .firmId(firmId)
                        .title("Firm — All Lawyers")
                        .build()));
        // Sync members: every non-client user in the firm.
        Set<UUID> participants = userRepository.findByFirm_Id(firmId).stream()
                .filter(u -> !isClient(u))
                .map(User::getId)
                .collect(Collectors.toSet());
        syncMembers(conv.getId(), participants);
        return conv;
    }

    private Conversation ensureCaseConversation(Case c) {
        Conversation conv = conversationRepository.findByCaseId(c.getId())
                .orElseGet(() -> conversationRepository.save(Conversation.builder()
                        .type(Conversation.Type.CASE)
                        .caseId(c.getId())
                        .firmId(c.getFirm() != null ? c.getFirm().getId() : null)
                        .title(c.getTitle())
                        .build()));
        syncMembers(conv.getId(), caseParticipantIds(c.getId()));
        return conv;
    }

    @SuppressWarnings("unchecked")
    private Set<UUID> caseParticipantIds(UUID caseId) {
        List<UUID> ids = em.createNativeQuery(
                "SELECT user_id FROM case_members WHERE case_id = :cid " +
                "UNION SELECT client_id FROM case_clients WHERE case_id = :cid")
                .setParameter("cid", caseId)
                .getResultList();
        return new HashSet<>(ids);
    }

    private void syncMembers(UUID conversationId, Set<UUID> userIds) {
        Set<UUID> existing = memberRepository.findByConversationId(conversationId).stream()
                .map(ConversationMember::getUserId).collect(Collectors.toSet());
        for (UUID uid : userIds) {
            if (!existing.contains(uid)) {
                memberRepository.save(ConversationMember.builder()
                        .conversationId(conversationId).userId(uid).build());
            }
        }
    }

    // ─── Messages ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ChatMessageDto> history(UUID conversationId, User user) {
        requireMember(conversationId, user);
        return messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId, PageRequest.of(0, 200))
                .stream().map(this::toMessageDto).toList();
    }

    @Transactional
    public ChatMessageDto post(UUID conversationId, User user, String body) {
        requireMember(conversationId, user);
        ChatMessage saved = messageRepository.save(ChatMessage.builder()
                .conversationId(conversationId)
                .senderId(user.getId())
                .bodyCiphertext(crypto.encrypt(body))
                .build());
        return toMessageDto(saved);
    }

    @Transactional
    public void markRead(UUID conversationId, User user) {
        memberRepository.findById(new ConversationMember.Id(conversationId, user.getId()))
                .ifPresent(m -> { m.setLastReadAt(Instant.now()); memberRepository.save(m); });
    }

    public boolean isMember(UUID conversationId, UUID userId) {
        return memberRepository.existsByConversationIdAndUserId(conversationId, userId);
    }

    // ─── Seeding helpers (used by DataSeeder) ──────────────────────────────────

    @Transactional
    public UUID ensureCaseConversationId(Case c) {
        return ensureCaseConversation(c).getId();
    }

    @Transactional
    public UUID ensureFirmConversationId(UUID firmId) {
        return ensureFirmConversation(firmId).getId();
    }

    public boolean isEmpty(UUID conversationId) {
        return messageRepository.findTopByConversationIdOrderByCreatedAtDesc(conversationId) == null;
    }

    private void requireMember(UUID conversationId, User user) {
        if (!isMember(conversationId, user.getId())) {
            throw new AccessDeniedException("Not a member of this conversation");
        }
    }

    // ─── Mapping ────────────────────────────────────────────────────────────

    private ConversationDto toDto(Conversation c, User viewer) {
        List<ConversationMember> members = memberRepository.findByConversationId(c.getId());
        ChatMessage last = messageRepository.findTopByConversationIdOrderByCreatedAtDesc(c.getId());
        String preview = last != null ? crypto.decrypt(last.getBodyCiphertext()) : null;
        if (preview != null && preview.length() > 80) preview = preview.substring(0, 80) + "…";

        // A DIRECT channel has no fixed title — show the *other* participant's name to the viewer.
        String title = c.getTitle();
        if (c.getType() == Conversation.Type.DIRECT) {
            title = members.stream()
                    .map(ConversationMember::getUserId)
                    .filter(uid -> !uid.equals(viewer.getId()))
                    .findFirst()
                    .flatMap(userRepository::findById)
                    .map(User::getFullName)
                    .orElse("Direct message");
        }
        return new ConversationDto(
                c.getId(), c.getType().name(), title, c.getCaseId(),
                members.size(), preview, last != null ? last.getCreatedAt() : null);
    }

    private ChatMessageDto toMessageDto(ChatMessage m) {
        String senderName = userRepository.findById(m.getSenderId())
                .map(User::getFullName).orElse("Unknown");
        return new ChatMessageDto(
                m.getId(), m.getConversationId(), m.getSenderId(), senderName,
                crypto.decrypt(m.getBodyCiphertext()), m.getCreatedAt());
    }
}
