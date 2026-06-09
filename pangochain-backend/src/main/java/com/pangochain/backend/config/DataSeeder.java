package com.pangochain.backend.config;

import com.pangochain.backend.cases.Case;
import com.pangochain.backend.cases.CaseMember;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.caseevent.CaseEvent;
import com.pangochain.backend.caseevent.CaseEventRepository;
import com.pangochain.backend.chat.ChatService;
import com.pangochain.backend.crypto.Pbkdf2Service;
import com.pangochain.backend.hearing.Hearing;
import com.pangochain.backend.hearing.HearingRepository;
import com.pangochain.backend.reminder.Reminder;
import com.pangochain.backend.reminder.ReminderRepository;
import com.pangochain.backend.user.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final FirmRepository firmRepository;
    private final CaseRepository caseRepository;
    private final HearingRepository hearingRepository;
    private final ReminderRepository reminderRepository;
    private final CaseEventRepository caseEventRepository;
    private final Pbkdf2Service pbkdf2Service;
    private final ChatService chatService;

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean baseAlreadySeeded = userRepository.existsByEmail("admin@pangolawfirm.com");
        if (!baseAlreadySeeded) {
            seedBaseData();
        } else {
            log.info("Base seed already present — running additive team/chat seed only");
        }
        // Idempotent: associates A–D, their case membership, and starter chat messages.
        seedTeamAndChat();
        // Idempotent: demo data for Sprint 1–3 features (settlement offers, billing, milestones,
        // deadlines, satisfaction feedback) on the Chen v. Meridian case so they're visible live.
        seedFeatureDemoData();
        seedShowcaseDemoData();
    }

    private void seedBaseData() {
        log.info("Seeding demo data…");

        Firm firmA = firmRepository.findAll().stream()
                .filter(f -> "FirmAMSP".equals(f.getMspId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("FirmA not found — run migrations first"));

        // ── Users ──────────────────────────────────────────────────────────────
        User admin = createUser("admin@pangolawfirm.com", "Admin123!", "Alexandra Webb",
                UserRole.MANAGING_PARTNER, firmA, AccountStatus.ACTIVE);

        User lawyer = createUser("lawyer@pangolawfirm.com", "Lawyer123!", "James Harrington",
                UserRole.ASSOCIATE_SENIOR, firmA, AccountStatus.ACTIVE);

        User paralegal = createUser("paralegal@pangolawfirm.com", "Paralegal123!", "Priya Nair",
                UserRole.PARALEGAL, firmA, AccountStatus.ACTIVE);

        User client = createUser("client@demo.com", "Client123!", "Marcus Chen",
                UserRole.CLIENT_PRIMARY, null, AccountStatus.ACTIVE);

        User client2 = createUser("client2@demo.com", "Client123!", "Sofia Delgado",
                UserRole.CLIENT_SECONDARY, null, AccountStatus.ACTIVE);

        // ── Cases ──────────────────────────────────────────────────────────────
        Case case1 = Case.builder()
                .title("Chen v. Meridian Holdings — Contract Dispute")
                .description("Client Marcus Chen disputes breach of commercial lease agreement by Meridian Holdings Ltd. Damages sought: $485,000.")
                .caseType("Commercial Litigation")
                .firm(firmA)
                .createdBy(lawyer)
                .build();
        caseRepository.save(case1);

        Case case2 = Case.builder()
                .title("Delgado Estate — Probate Proceedings")
                .description("Probate and estate administration for the Delgado family following the passing of Roberto Delgado. Multiple assets under review.")
                .caseType("Probate & Estate")
                .firm(firmA)
                .createdBy(admin)
                .build();
        caseRepository.save(case2);

        Case case3 = Case.builder()
                .title("In Re: Pinnacle Corp Data Breach")
                .description("Class action defence representing Pinnacle Corp against claims of negligent data handling affecting 12,000 customers.")
                .caseType("Data Privacy / Class Action")
                .firm(firmA)
                .createdBy(admin)
                .build();
        caseRepository.save(case3);

        // ── Case Members ───────────────────────────────────────────────────────
        saveMember(case1.getId(), lawyer.getId(), "Lead Counsel", lawyer.getId());
        saveMember(case1.getId(), paralegal.getId(), "Paralegal", lawyer.getId());
        saveMember(case1.getId(), client.getId(), "Primary Client", lawyer.getId());

        saveMember(case2.getId(), admin.getId(), "Lead Partner", admin.getId());
        saveMember(case2.getId(), client2.getId(), "Primary Client", admin.getId());

        saveMember(case3.getId(), admin.getId(), "Lead Partner", admin.getId());
        saveMember(case3.getId(), lawyer.getId(), "Senior Associate", admin.getId());

        // ── Case Clients (client portal association) ───────────────────────────
        saveClientCase(case1.getId(), client.getId(), lawyer.getId());
        saveClientCase(case2.getId(), client2.getId(), admin.getId());

        // ── Hearings ───────────────────────────────────────────────────────────
        Hearing h1 = Hearing.builder()
                .legalCase(case1)
                .title("Preliminary Injunction Hearing")
                .hearingDate(Instant.now().plus(14, ChronoUnit.DAYS))
                .location("Courtroom 4B, Superior Court")
                .courtName("Los Angeles Superior Court")
                .hearingType("INJUNCTION_HEARING")
                .notes("Prepare lease termination exhibits. Opposing counsel may seek continuance.")
                .createdBy(lawyer)
                .build();
        hearingRepository.save(h1);

        Hearing h2 = Hearing.builder()
                .legalCase(case1)
                .title("Discovery Conference")
                .hearingDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .location("Zoom — Remote Hearing")
                .courtName("Los Angeles Superior Court")
                .hearingType("CONFERENCE")
                .notes("Exchange of document lists. Ensure all Fabric-anchored docs are listed.")
                .createdBy(lawyer)
                .build();
        hearingRepository.save(h2);

        Hearing h3 = Hearing.builder()
                .legalCase(case2)
                .title("Estate Valuation Hearing")
                .hearingDate(Instant.now().plus(21, ChronoUnit.DAYS))
                .location("Probate Court, Room 12")
                .courtName("County Probate Court")
                .hearingType("PROBATE_HEARING")
                .notes("Expert valuator to present asset assessment report.")
                .createdBy(admin)
                .build();
        hearingRepository.save(h3);

        Hearing h4 = Hearing.builder()
                .legalCase(case3)
                .title("Class Certification Hearing")
                .hearingDate(Instant.now().plus(45, ChronoUnit.DAYS))
                .location("Federal Court, Courtroom 22A")
                .courtName("US District Court, Central District CA")
                .hearingType("COURT_HEARING")
                .notes("Opposition brief due 7 days prior. Technical expert on data security required.")
                .createdBy(admin)
                .build();
        hearingRepository.save(h4);

        // Past hearing for realism
        Hearing h5 = Hearing.builder()
                .legalCase(case1)
                .title("Case Management Conference")
                .hearingDate(Instant.now().minus(10, ChronoUnit.DAYS))
                .location("Courtroom 4B, Superior Court")
                .courtName("Los Angeles Superior Court")
                .hearingType("CONFERENCE")
                .notes("Initial scheduling order issued. Trial date set for Q3.")
                .createdBy(lawyer)
                .build();
        hearingRepository.save(h5);

        // ── Reminders from lawyer to client ────────────────────────────────────
        Reminder r1 = Reminder.builder()
                .legalCase(case1)
                .sender(lawyer)
                .recipient(client)
                .title("Upload signed retainer agreement")
                .body("Please upload the signed retainer agreement to your Document Vault as soon as possible. We need it before the Discovery Conference next week. Use the CONFIDENTIAL flag when uploading.")
                .dueAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .priority("HIGH")
                .read(false)
                .build();
        reminderRepository.save(r1);

        Reminder r2 = Reminder.builder()
                .legalCase(case1)
                .sender(lawyer)
                .recipient(client)
                .title("Provide list of communications with Meridian Holdings")
                .body("We need all emails, letters, or texts you exchanged with Meridian Holdings between Jan 2023 – Dec 2023. Please upload as separate documents, categorised as CORRESPONDENCE.")
                .dueAt(Instant.now().plus(3, ChronoUnit.DAYS))
                .priority("HIGH")
                .read(false)
                .build();
        reminderRepository.save(r2);

        Reminder r3 = Reminder.builder()
                .legalCase(case1)
                .sender(lawyer)
                .recipient(client)
                .title("Hearing reminder — Discovery Conference in 7 days")
                .body("Your presence is requested (optional) at the Discovery Conference on " +
                        Instant.now().plus(7, ChronoUnit.DAYS).toString().substring(0, 10) +
                        ". This will be conducted via Zoom. I will send the link 24 hours before.")
                .dueAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .priority("NORMAL")
                .read(false)
                .build();
        reminderRepository.save(r3);

        Reminder r4 = Reminder.builder()
                .legalCase(case2)
                .sender(admin)
                .recipient(client2)
                .title("Sign estate declaration form")
                .body("The probate court requires a signed declaration from all beneficiaries. Please review and sign the form I have uploaded to your Document Vault, then re-upload the signed version.")
                .dueAt(Instant.now().plus(10, ChronoUnit.DAYS))
                .priority("HIGH")
                .read(false)
                .build();
        reminderRepository.save(r4);

        // ── Case Events (timeline) ─────────────────────────────────────────────
        saveCaseEvent(case1, "CASE_OPENED", "Case Opened", "Commercial lease dispute registered in PangoChain ledger.", lawyer);
        saveCaseEvent(case1, "DOCUMENT_UPLOADED", "Lease Agreement Uploaded", "Original lease agreement (2021) encrypted and anchored to Fabric.", lawyer);
        saveCaseEvent(case1, "HEARING_SCHEDULED", "Discovery Conference Scheduled", "Remote conference scheduled via Superior Court e-filing system.", lawyer);
        saveCaseEvent(case1, "HEARING_SCHEDULED", "Preliminary Injunction Hearing Scheduled", "In-person injunction hearing before Hon. R. Martinez.", lawyer);
        saveCaseEvent(case1, "ACCESS_GRANTED", "Paralegal Priya Nair granted document access", "Read access granted to lease agreement for discovery preparation.", lawyer);
        saveCaseEvent(case1, "HEARING_COMPLETED", "Case Management Conference Completed", "Scheduling order issued. Trial date provisionally set for Q3 2026.", lawyer);

        saveCaseEvent(case2, "CASE_OPENED", "Probate Case Opened", "Estate administration proceedings initiated following death of Roberto Delgado.", admin);
        saveCaseEvent(case2, "DOCUMENT_UPLOADED", "Death Certificate Uploaded", "Certified copy of death certificate encrypted and registered on blockchain.", admin);
        saveCaseEvent(case2, "HEARING_SCHEDULED", "Estate Valuation Hearing Scheduled", "Expert valuator appointed by Probate Court.", admin);

        saveCaseEvent(case3, "CASE_OPENED", "Class Action Defence Opened", "Pinnacle Corp class action defence registered. Data breach incident: Oct 2024.", admin);
        saveCaseEvent(case3, "DOCUMENT_UPLOADED", "Incident Report Uploaded", "Internal security incident report (CONFIDENTIAL) anchored to Fabric ledger.", admin);
        saveCaseEvent(case3, "HEARING_SCHEDULED", "Class Certification Hearing Scheduled", "Federal court hearing date set. Technical expert retained.", lawyer);

        log.info("✅ Seed data complete — 4 users, 3 cases, 4+ hearings, 4 reminders, timeline events");
        log.info("──────────────────────────────────────────────────────────────────");
        log.info("  Managing Partner : admin@pangolawfirm.com  / Admin123!");
        log.info("  Senior Associate : lawyer@pangolawfirm.com / Lawyer123!");
        log.info("  Paralegal        : paralegal@pangolawfirm.com / Paralegal123!");
        log.info("  Client (primary) : client@demo.com         / Client123!");
        log.info("  Client 2         : client2@demo.com        / Client123!");
        log.info("──────────────────────────────────────────────────────────────────");
    }

    private User createUser(String email, String password, String fullName,
                            UserRole role, Firm firm, AccountStatus status) {
        String salt = pbkdf2Service.generateSalt();
        String hash = pbkdf2Service.hash(password, salt);
        User u = User.builder()
                .email(email)
                .passwordHash(hash)
                .salt(salt)
                .fullName(fullName)
                .role(role)
                .firm(firm)
                .status(status)
                .build();
        return userRepository.save(u);
    }

    /**
     * Additive seed (runs every startup, idempotent): four associates A–D under the senior
     * associate for the delegation story, added to the Chen v. Meridian case team, plus a
     * couple of starter chat messages so the case and firm channels aren't empty.
     */
    private void seedTeamAndChat() {
        Firm firmA = firmRepository.findAll().stream()
                .filter(f -> "FirmAMSP".equals(f.getMspId())).findFirst().orElse(null);
        if (firmA == null) return;
        User lawyer = userRepository.findByEmail("lawyer@pangolawfirm.com").orElse(null);
        if (lawyer == null) return; // base seed not present yet

        User a = ensureUser("a@pangolawfirm.com", "Assoc123!", "Aaron Avers (Associate A)", UserRole.ASSOCIATE_JUNIOR, firmA);
        User b = ensureUser("b@pangolawfirm.com", "Assoc123!", "Bianca Bose (Associate B)", UserRole.ASSOCIATE_JUNIOR, firmA);
        User c = ensureUser("c@pangolawfirm.com", "Assoc123!", "Carlos Cruz (Associate C)", UserRole.ASSOCIATE_JUNIOR, firmA);
        User d = ensureUser("d@pangolawfirm.com", "Assoc123!", "Dana Diaz (Associate D)", UserRole.ASSOCIATE_JUNIOR, firmA);

        Case case1 = caseRepository.findAll().stream()
                .filter(x -> x.getTitle() != null && x.getTitle().startsWith("Chen v. Meridian"))
                .findFirst().orElse(null);
        if (case1 != null) {
            for (User u : java.util.List.of(a, b, c, d)) {
                saveMemberIfAbsent(case1.getId(), u.getId(), "Associate", lawyer.getId());
            }
            UUID conv = chatService.ensureCaseConversationId(case1);
            if (chatService.isEmpty(conv)) {
                chatService.post(conv, lawyer, "Team — kicking off Chen v. Meridian. I'll distribute the document set shortly.");
                chatService.post(conv, a, "On it. I'll take the lease exhibits.");
                chatService.post(conv, b, "I'll start the correspondence review.");
            }
        }
        UUID firmConv = chatService.ensureFirmConversationId(firmA.getId());
        if (chatService.isEmpty(firmConv)) {
            User admin = userRepository.findByEmail("admin@pangolawfirm.com").orElse(lawyer);
            chatService.post(firmConv, admin, "Welcome to the firm channel — use this for firm-wide coordination.");
            chatService.post(firmConv, lawyer, "Thanks. Chen v. Meridian team is staffed and moving.");
        }
        log.info("✅ Team/chat seed complete — associates a–d@pangolawfirm.com / Assoc123!");
    }

    private User ensureUser(String email, String password, String fullName, UserRole role, Firm firm) {
        return userRepository.findByEmail(email)
                .orElseGet(() -> createUser(email, password, fullName, role, firm, AccountStatus.ACTIVE));
    }

    private void saveMemberIfAbsent(java.util.UUID caseId, java.util.UUID userId, String roleInCase, java.util.UUID addedBy) {
        em.createNativeQuery(
                "INSERT INTO case_members (case_id, user_id, role_in_case, added_by, added_at) " +
                "VALUES (:c, :u, :r, :a, now()) ON CONFLICT DO NOTHING")
                .setParameter("c", caseId).setParameter("u", userId)
                .setParameter("r", roleInCase).setParameter("a", addedBy)
                .executeUpdate();
    }

    private void saveMember(java.util.UUID caseId, java.util.UUID userId, String roleInCase, java.util.UUID addedBy) {
        CaseMember cm = CaseMember.builder()
                .caseId(caseId)
                .userId(userId)
                .roleInCase(roleInCase)
                .addedBy(addedBy)
                .build();
        em.persist(cm);
    }

    private void saveClientCase(java.util.UUID caseId, java.util.UUID clientId, java.util.UUID addedBy) {
        em.createNativeQuery(
                "INSERT INTO case_clients (case_id, client_id, added_by) VALUES (:c, :u, :a) ON CONFLICT DO NOTHING"
        ).setParameter("c", caseId).setParameter("u", clientId).setParameter("a", addedBy).executeUpdate();
    }

    private void saveCaseEvent(Case legalCase, String eventType, String title, String description, User actor) {
        CaseEvent ev = CaseEvent.builder()
                .legalCase(legalCase)
                .eventType(eventType)
                .title(title)
                .description(description)
                .actor(actor)
                .build();
        caseEventRepository.save(ev);
    }

    // ── Sprint 1–3 feature demo data (idempotent) ────────────────────────────────
    private void seedFeatureDemoData() {
        User lawyer = userRepository.findByEmail("lawyer@pangolawfirm.com").orElse(null);
        User client = userRepository.findByEmail("client@demo.com").orElse(null);
        if (lawyer == null || client == null) return;
        Case case1 = caseRepository.findAll().stream()
                .filter(x -> x.getTitle() != null && x.getTitle().startsWith("Chen v. Meridian"))
                .findFirst().orElse(null);
        if (case1 == null) return;
        UUID caseId = case1.getId();
        UUID lawyerId = lawyer.getId();
        UUID clientId = client.getId();

        seedCaseParties(case1);
        seedCaseJourneyDemoData(case1, lawyer);

        // Settlement offers — client can compare and accept/reject these live.
        if (count("settlement_offers", "case_id", caseId) == 0) {
            insertSettlement(caseId, lawyerId, "Opening offer — lump sum", 18_000_000L,
                    "Confidentiality; no admission of liability.",
                    "Low relative to the $485k claim. Recommend rejecting as an anchor.");
            insertSettlement(caseId, lawyerId, "Revised offer — structured", 32_000_000L,
                    "Payment over 12 months; mutual NDA; neutral reference.",
                    "Closer to fair value. Worth a counter around $400k.");
            insertSettlement(caseId, lawyerId, "Best-and-final", 41_000_000L,
                    "Single payment within 30 days; full mutual release.",
                    "Strong given litigation risk and cost. Recommend accepting.");
        }

        // Billing — time entries + one issued invoice (lawyer billing + client expense portal).
        if (count("time_entries", "case_id", caseId) == 0) {
            insertTimeEntry(caseId, lawyerId, "Drafted preliminary injunction motion", 180, 45_000, true, 3);
            insertTimeEntry(caseId, lawyerId, "Reviewed lease agreement and exhibits", 120, 45_000, true, 2);
            insertTimeEntry(caseId, lawyerId, "Client conference — settlement strategy", 60, 45_000, false, 1);
            insertTimeEntry(caseId, lawyerId, "Prepared discovery document list", 90, 35_000, false, 0);
            em.createNativeQuery("INSERT INTO invoices (case_id, invoice_number, status, amount_cents, minutes_total, created_by, issued_at) " +
                    "VALUES (:c, 'INV-CHEN-001', 'SENT', 225000, 300, :by, now() - interval '1 day')")
                    .setParameter("c", caseId).setParameter("by", lawyerId).executeUpdate();
        }

        // Case progress milestones (client-visible timeline).
        if (count("case_milestones", "case_id", caseId) == 0) {
            insertMilestone(caseId, lawyerId, "Intake & Engagement", "Retainer signed; conflict check cleared.", "COMPLETED", 0, "now() - interval '60 days'", "now() - interval '58 days'");
            insertMilestone(caseId, lawyerId, "Investigation & Evidence", "Lease, correspondence and exhibits collected and anchored.", "COMPLETED", 1, "now() - interval '30 days'", "now() - interval '28 days'");
            insertMilestone(caseId, lawyerId, "Discovery", "Document exchange with opposing counsel in progress.", "IN_PROGRESS", 2, "now() + interval '20 days'", null);
            insertMilestone(caseId, lawyerId, "Pre-Trial Motions", "Injunction and summary-judgment motions.", "PENDING", 3, "now() + interval '40 days'", null);
            insertMilestone(caseId, lawyerId, "Hearing / Trial", "Preliminary injunction hearing then trial.", "PENDING", 4, "now() + interval '60 days'", null);
            insertMilestone(caseId, lawyerId, "Resolution", "Settlement or judgment and case closure.", "PENDING", 5, "now() + interval '90 days'", null);
        }

        // Deadlines & statute-of-limitations tracker (colour-coded urgency).
        if (count("case_deadlines", "case_id", caseId) == 0) {
            insertDeadline(caseId, lawyerId, "Statute of Limitations — Breach of Contract", "4-year SoL from date of breach.", "STATUTE_OF_LIMITATIONS", "now() + interval '400 days'");
            insertDeadline(caseId, lawyerId, "Discovery cutoff", "All written discovery to be completed.", "DISCOVERY", "now() + interval '25 days'");
            insertDeadline(caseId, lawyerId, "Expert witness disclosure", "Disclose data-security expert and report.", "FILING", "now() + interval '5 days'");
        } else {
            em.createNativeQuery("UPDATE case_deadlines SET deadline_type = 'STATUTE_OF_LIMITATIONS' WHERE case_id = :c AND deadline_type = 'STATUTE'")
                    .setParameter("c", caseId)
                    .executeUpdate();
        }

        // Client satisfaction feedback (Managing Partner sees aggregates).
        if (count("feedback_responses", "case_id", caseId) == 0) {
            insertFeedback(clientId, caseId, 5, "James kept me informed throughout — excellent communication.", "HEARING");
            insertFeedback(clientId, caseId, 4, "Smooth process. Would have liked slightly faster document turnaround.", "GENERAL");
        }

        // Admin-visible demo rows for anomaly detection and GDPR request processing.
        if (countAll("security_alerts") == 0) {
            insertSecurityAlert(lawyerId, lawyer.getEmail(), "HIGH", "BURST_DOCUMENT_ACCESS",
                    "James Harrington accessed 18 confidential documents in a 12-minute preparation window before the discovery conference.",
                    18.0, "demo-alert-burst-document-access");
        }
        if (count("deletion_requests", "user_id", clientId) == 0) {
            insertDeletionRequest(clientId,
                    "Please review whether inactive draft uploads can be erased while preserving required ledger records.");
        }

        log.info("✅ Feature demo data seeded on Chen v. Meridian (settlement, billing, milestones, deadlines, feedback, admin alerts).");
    }

    /**
     * Additive, idempotent showcase data for demos. These rows make every major screen feel
     * populated: board statuses, document actions, custody/history, signatures, billing, client
     * portal, admin security, and case journey.
     */
    private void seedShowcaseDemoData() {
        Firm firmA = firmRepository.findAll().stream()
                .filter(f -> "FirmAMSP".equals(f.getMspId())).findFirst().orElse(null);
        User admin = userRepository.findByEmail("admin@pangolawfirm.com").orElse(null);
        User lawyer = userRepository.findByEmail("lawyer@pangolawfirm.com").orElse(null);
        User paralegal = userRepository.findByEmail("paralegal@pangolawfirm.com").orElse(null);
        User client = userRepository.findByEmail("client@demo.com").orElse(null);
        User client2 = userRepository.findByEmail("client2@demo.com").orElse(null);
        if (firmA == null || admin == null || lawyer == null || client == null) return;

        User partner = ensureUser("partner@pangolawfirm.com", "Partner123!", "Nadia Rahman", UserRole.PARTNER_SENIOR, firmA);
        User secretary = ensureUser("secretary@pangolawfirm.com", "Secretary123!", "Mina Patel", UserRole.SECRETARY, firmA);
        User regulator = ensureUser("regulator@pangolawfirm.com", "Regulator123!", "Owen Brooks", UserRole.REGULATOR, firmA);
        ensureDemoPublicKeys();
        User associateA = userRepository.findByEmail("a@pangolawfirm.com").orElse(lawyer);
        User associateB = userRepository.findByEmail("b@pangolawfirm.com").orElse(lawyer);

        Case chen = findCase("Chen v. Meridian").orElse(null);
        Case delgado = findCase("Delgado Estate").orElse(null);
        Case pinnacle = findCase("In Re: Pinnacle Corp").orElse(null);
        Case atlas = ensureDemoCase("Atlas BioPharma Licensing Review",
                "Contract review and regulatory-risk assessment for a cross-border biologics licensing package.",
                "Life Sciences / Transactional", "Atlas BioPharma", "HelixNova Therapeutics",
                "FDA liaison; EMEA counsel; BioBridge IP Holdings", firmA, partner, "ACTIVE");
        Case northstar = ensureDemoCase("Northstar Energy — Arbitration Closure",
                "Closed arbitration file with award enforcement checklist and final client reporting.",
                "Energy Arbitration", "Northstar Energy", "Harbor Grid Services",
                "JAMS; Energy Market Monitor; GridSure Insurance", firmA, admin, "CLOSED");
        Case archive = ensureDemoCase("Archived: Vega Retail Lease Portfolio",
                "Archived lease portfolio review retained for records and conflict checks.",
                "Real Estate Portfolio", "Vega Retail Group", "Multiple landlords",
                "Cedar Mall LLC; Oakline Properties; MetroZone Holdings", firmA, lawyer, "ARCHIVED");

        if (delgado != null) updateCaseStatus(delgado, "CLOSED");
        if (pinnacle != null) updateCaseStatus(pinnacle, "ACTIVE");

        for (Case c : java.util.List.of(atlas, northstar, archive)) {
            saveMemberIfAbsent(c.getId(), partner.getId(), "Supervising Partner", admin.getId());
            saveMemberIfAbsent(c.getId(), lawyer.getId(), "Senior Associate", partner.getId());
            saveMemberIfAbsent(c.getId(), secretary.getId(), "Docketing", partner.getId());
        }
        if (chen != null) {
            saveMemberIfAbsent(chen.getId(), partner.getId(), "Supervising Partner", admin.getId());
            saveMemberIfAbsent(chen.getId(), secretary.getId(), "Docketing", lawyer.getId());
            saveMemberIfAbsent(chen.getId(), regulator.getId(), "Read-only Regulator", admin.getId());
            seedShowcaseDocuments(chen, lawyer, client, paralegal, associateA, associateB, secretary);
            seedShowcaseCaseActivity(chen, lawyer, client, partner, secretary);
        }
        if (delgado != null && client2 != null) {
            seedClosedCaseDemo(delgado, admin, client2, paralegal != null ? paralegal : secretary);
        }
        seedTransactionalCaseDemo(atlas, partner, client, secretary);
        seedClosedCaseDemo(northstar, admin, client, secretary);

        log.info("✅ Showcase demo data seeded — portfolio cases, documents, signatures, annotations, custody, billing, and client/admin stories.");
    }

    private void ensureDemoPublicKeys() {
        String eciesPublicJwk = """
                {"key_ops":[],"ext":true,"kty":"EC","x":"1ppV0lOMaLqtylioKdgcIGkq0V3Vz2xa3tspgtyRMyQ","y":"DpE5aWrWirrFs9cbZLXOriZK_dq8bJNqyfi6uPh4YPo","crv":"P-256"}
                """.trim();
        String signingPublicJwk = """
                {"key_ops":["verify"],"ext":true,"kty":"EC","x":"kCSbE1cJqS-Y0flpwc0ZYT9dQGoyTYj8rnRxZYiovBs","y":"9pqWHiiQ36SG98SgialNtMY0c7As1Bh1G8tWu9LQdyU","crv":"P-256"}
                """.trim();
        em.createNativeQuery("""
                UPDATE users
                SET public_key_ecies = COALESCE(public_key_ecies, :ecies),
                    signing_public_key = COALESCE(signing_public_key, :signing)
                WHERE email IN (
                    'admin@pangolawfirm.com',
                    'lawyer@pangolawfirm.com',
                    'paralegal@pangolawfirm.com',
                    'client@demo.com',
                    'client2@demo.com',
                    'a@pangolawfirm.com',
                    'b@pangolawfirm.com',
                    'c@pangolawfirm.com',
                    'd@pangolawfirm.com',
                    'partner@pangolawfirm.com',
                    'secretary@pangolawfirm.com',
                    'regulator@pangolawfirm.com'
                )
                """)
                .setParameter("ecies", eciesPublicJwk)
                .setParameter("signing", signingPublicJwk)
                .executeUpdate();
    }

    private java.util.Optional<Case> findCase(String titlePrefix) {
        return caseRepository.findAll().stream()
                .filter(x -> x.getTitle() != null && x.getTitle().startsWith(titlePrefix))
                .findFirst();
    }

    private Case ensureDemoCase(String title, String description, String caseType, String clientName,
                                String opposingParty, String relatedParties, Firm firm, User owner,
                                String status) {
        Case existing = findCase(title).orElse(null);
        if (existing != null) {
            updateCaseStatus(existing, status);
            return existing;
        }
        Case c = Case.builder()
                .title(title)
                .description(description)
                .caseType(caseType)
                .clientName(clientName)
                .opposingParty(opposingParty)
                .relatedParties(relatedParties)
                .firm(firm)
                .createdBy(owner)
                .status(com.pangochain.backend.cases.CaseStatus.valueOf(status))
                .build();
        return caseRepository.save(c);
    }

    private void updateCaseStatus(Case legalCase, String status) {
        em.createNativeQuery("""
                UPDATE cases
                SET status = CAST(:status AS case_status),
                    closed_at = CASE WHEN :status IN ('CLOSED', 'ARCHIVED') THEN COALESCE(closed_at, now() - interval '6 days') ELSE NULL END
                WHERE id = :id
                """)
                .setParameter("status", status)
                .setParameter("id", legalCase.getId())
                .executeUpdate();
    }

    private void seedShowcaseDocuments(Case legalCase, User lawyer, User client, User paralegal,
                                       User associateA, User associateB, User secretary) {
        UUID lease = ensureDocument(legalCase, lawyer, "Chen Lease Agreement - Executed.pdf", "CONTRACT", true, 1, null, 50);
        UUID leaseV2 = ensureDocument(legalCase, lawyer, "Chen Lease Agreement - Executed v2 annotated.pdf", "CONTRACT", true, 2, lease, 42);
        UUID termination = ensureDocument(legalCase, client, "Meridian Termination Notice.pdf", "CORRESPONDENCE", true, 1, null, 36);
        UUID ledger = ensureDocument(legalCase, lawyer, "Rent Payment Ledger Q1-Q4.xlsx", "EVIDENCE", false, 1, null, 28);
        UUID motion = ensureDocument(legalCase, lawyer, "Draft Preliminary Injunction Motion.docx", "PLEADING", true, 1, null, 8);
        UUID redacted = ensureDocument(legalCase, lawyer, "Meridian Termination Notice v2 redacted.pdf", "CORRESPONDENCE", false, 2, termination, 4);
        UUID settlement = ensureDocument(legalCase, lawyer, "Settlement Evaluation Memo.pdf", "MEMO", true, 1, null, 2);

        grantAccess(lease, lawyer, lawyer, "owner", 50);
        grantAccess(lease, paralegal, lawyer, "write", 48);
        grantAccess(lease, associateA, lawyer, "read", 47);
        grantAccess(leaseV2, lawyer, lawyer, "owner", 42);
        grantAccess(leaseV2, paralegal, lawyer, "write", 41);
        grantAccess(termination, client, client, "owner", 36);
        grantAccess(termination, lawyer, client, "write", 35);
        grantAccess(termination, associateB, lawyer, "read", 32);
        grantAccess(redacted, lawyer, lawyer, "owner", 4);
        grantAccess(redacted, secretary, lawyer, "read", 3);
        grantAccess(ledger, lawyer, lawyer, "owner", 28);
        grantAccess(ledger, paralegal, lawyer, "write", 27);
        grantAccess(motion, lawyer, lawyer, "owner", 8);
        grantAccess(motion, associateA, lawyer, "write", 7);
        grantAccess(settlement, lawyer, lawyer, "owner", 2);
        grantAccess(settlement, client, lawyer, "read", 1);

        seedAnnotationSet(motion, lawyer, associateA, paralegal);
        seedRedaction(termination, redacted, lawyer);
        seedSigningWorkflow(leaseV2, legalCase, lawyer, client, "Lease Evidence Certification", true);
        seedSigningWorkflow(settlement, legalCase, lawyer, client, "Settlement Authority Acknowledgement", false);
        seedDocumentClassification(lease, "CONTRACT", 94, lawyer);
        seedDocumentClassification(termination, "CORRESPONDENCE", 89, client);
        seedDocumentClassification(ledger, "EVIDENCE", 91, paralegal);

        seedAudit(legalCase.getId().toString(), "CASE", "CASE_VIEWED", lawyer, "Case reviewed from dashboard", 6);
        seedAudit(lease.toString(), "DOCUMENT", "DOCUMENT_UPLOADED", lawyer, "Executed lease uploaded and encrypted", 50);
        seedAudit(lease.toString(), "DOCUMENT", "ACCESS_GRANTED", lawyer, "Priya Nair granted write access", 48);
        seedAudit(leaseV2.toString(), "DOCUMENT", "DOCUMENT_VERSION_CREATED", lawyer, "Annotated version uploaded", 42);
        seedAudit(termination.toString(), "DOCUMENT", "DOCUMENT_DOWNLOADED", associateB, "Termination notice downloaded for review", 29);
        seedAudit(redacted.toString(), "DOCUMENT", "REDACTION_CREATED", lawyer, "Client identifiers redacted in browser", 4);
        seedAudit(settlement.toString(), "DOCUMENT", "DOCUMENT_SHARED_WITH_CLIENT", lawyer, "Settlement memo shared with Marcus Chen", 1);
    }

    private void seedShowcaseCaseActivity(Case legalCase, User lawyer, User client, User partner, User secretary) {
        if (count("hearings", "case_id", legalCase.getId()) < 6) {
            insertHearing(legalCase, lawyer, "Settlement Status Conference", 18, "Zoom - Dept. 12", "Los Angeles Superior Court", "SETTLEMENT_CONFERENCE",
                    "Prepare settlement range, authority memo, and redacted notice exhibit.");
            insertHearing(legalCase, lawyer, "Motion Cutoff Review", 32, "Courtroom 4B", "Los Angeles Superior Court", "COURT_HEARING",
                    "Court will review remaining injunction briefing and exhibit objections.");
        }
        if (!caseEventExists(legalCase.getId(), "Demo: Redacted notice shared")) {
            saveCaseEvent(legalCase, "REDACTION_CREATED", "Demo: Redacted notice shared",
                    "PII-safe notice copy created and shared with docketing team.", lawyer);
            saveCaseEvent(legalCase, "SIGNING_WORKFLOW_STARTED", "Demo: Signing workflow opened",
                    "Lease evidence certification sent to Marcus Chen for digital signature.", lawyer);
            saveCaseEvent(legalCase, "CLIENT_REMINDER_SENT", "Demo: Client settlement reminder",
                    "Marcus Chen reminded to review settlement authority before conference.", secretary);
        }
        if (!reminderExists(client.getId(), "Review settlement authority memo")) {
            insertReminder(legalCase, lawyer, client, "Review settlement authority memo",
                    "Please review the shared settlement memo and confirm your approved negotiation range before the status conference.",
                    2, "HIGH");
            insertReminder(legalCase, secretary, client, "Upload missing January invoice",
                    "The payment ledger is complete except for the January invoice from Meridian. Upload it under Evidence when available.",
                    4, "NORMAL");
        }
        if (count("settlement_offers", "case_id", legalCase.getId()) < 5) {
            insertSettlement(legalCase.getId(), lawyer.getId(), "Client counterproposal", 44_500_000L,
                    "Single payment; mutual release; no confidentiality clause for public filing record.",
                    "Best client position if Meridian wants to avoid injunction hearing.");
        }
        if (count("time_entries", "case_id", legalCase.getId()) < 8) {
            insertTimeEntry(legalCase.getId(), partner.getId(), "Partner review of injunction strategy", 45, 65_000, false, 0);
            insertTimeEntry(legalCase.getId(), secretary.getId(), "Prepared hearing binder index", 75, 15_000, false, 1);
        }
    }

    private void seedTransactionalCaseDemo(Case legalCase, User partner, User client, User secretary) {
        UUID agreement = ensureDocument(legalCase, partner, "Atlas BioPharma License Agreement Markup.docx", "CONTRACT", true, 1, null, 12);
        UUID memo = ensureDocument(legalCase, partner, "Regulatory Risk Matrix.pdf", "MEMO", false, 1, null, 10);
        grantAccess(agreement, partner, partner, "owner", 12);
        grantAccess(agreement, secretary, partner, "read", 10);
        grantAccess(memo, partner, partner, "owner", 10);
        if (client != null) grantAccess(memo, client, partner, "read", 8);
        if (count("case_milestones", "case_id", legalCase.getId()) == 0) {
            insertMilestone(legalCase.getId(), partner.getId(), "Term Sheet Review", "Business terms mapped to legal risk.", "COMPLETED", 0, "now() - interval '14 days'", "now() - interval '12 days'");
            insertMilestone(legalCase.getId(), partner.getId(), "Markup Round", "License agreement redline in progress.", "IN_PROGRESS", 1, "now() + interval '6 days'", null);
            insertMilestone(legalCase.getId(), partner.getId(), "Board Approval Package", "Prepare final risk memo and signature set.", "PENDING", 2, "now() + interval '18 days'", null);
        }
        if (count("case_deadlines", "case_id", legalCase.getId()) == 0) {
            insertDeadline(legalCase.getId(), partner.getId(), "Board packet delivery", "Final markup and risk memo due to Atlas board.", "FILING", "now() + interval '6 days'");
            insertDeadline(legalCase.getId(), partner.getId(), "Exclusivity expiry", "Term sheet exclusivity period ends.", "CUSTOM", "now() + interval '21 days'");
        }
        seedSigningWorkflow(agreement, legalCase, partner, client != null ? client : secretary, "Atlas License Signature Packet", false);
        seedDocumentClassification(agreement, "CONTRACT", 96, partner);
        seedDocumentClassification(memo, "MEMO", 88, partner);
    }

    private void seedClosedCaseDemo(Case legalCase, User owner, User client, User support) {
        UUID award = ensureDocument(legalCase, owner, legalCase.getTitle().startsWith("Delgado")
                ? "Final Probate Distribution Order.pdf"
                : "Final Arbitration Award.pdf", "COURT_ORDER", false, 1, null, 16);
        UUID closing = ensureDocument(legalCase, owner, "Client Closing Letter.pdf", "CORRESPONDENCE", false, 1, null, 7);
        grantAccess(award, owner, owner, "owner", 16);
        grantAccess(award, support, owner, "read", 15);
        grantAccess(closing, owner, owner, "owner", 7);
        if (client != null) {
            grantAccess(closing, client, owner, "read", 7);
            saveClientCase(legalCase.getId(), client.getId(), owner.getId());
        }
        if (count("case_milestones", "case_id", legalCase.getId()) == 0) {
            insertMilestone(legalCase.getId(), owner.getId(), "Matter Opened", "Initial intake and documents collected.", "COMPLETED", 0, "now() - interval '80 days'", "now() - interval '78 days'");
            insertMilestone(legalCase.getId(), owner.getId(), "Evidence Complete", "All required exhibits finalized.", "COMPLETED", 1, "now() - interval '30 days'", "now() - interval '29 days'");
            insertMilestone(legalCase.getId(), owner.getId(), "Final Order", "Court/order package completed.", "COMPLETED", 2, "now() - interval '8 days'", "now() - interval '7 days'");
            insertMilestone(legalCase.getId(), owner.getId(), "Closed", "Closing letter sent and archive ready.", "COMPLETED", 3, "now() - interval '2 days'", "now() - interval '2 days'");
        }
        if (!caseEventExists(legalCase.getId(), "Demo: Closing package delivered")) {
            saveCaseEvent(legalCase, "CASE_CLOSED", "Demo: Closing package delivered",
                    "Final order and client closing letter delivered through the portal.", owner);
        }
        updateCaseStatus(legalCase, "CLOSED");
    }

    private void seedCaseJourneyDemoData(Case case1, User lawyer) {
        User associateA = userRepository.findByEmail("a@pangolawfirm.com").orElse(lawyer);
        User associateB = userRepository.findByEmail("b@pangolawfirm.com").orElse(lawyer);
        User paralegal = userRepository.findByEmail("paralegal@pangolawfirm.com").orElse(lawyer);
        User admin = userRepository.findByEmail("admin@pangolawfirm.com").orElse(lawyer);

        if (!caseNodeExists(case1.getId(), "Lease clause 7 notice requirement")) {
            UUID root = ensureJourneyRoot(case1, lawyer, "Case opened",
                    "Commercial lease dispute intake completed. Initial issue map created for breach, notice, damages, and mitigation.",
                    "now() - interval '55 days'");
            UUID leaseReview = UUID.randomUUID();
            UUID rentLedger = UUID.randomUUID();
            UUID noticeIssue = UUID.randomUUID();
            UUID mitigation = UUID.randomUUID();
            UUID research = UUID.randomUUID();
            UUID filing = UUID.randomUUID();
            UUID hearing = UUID.randomUUID();

            insertCaseNode(leaseReview, case1.getId(), root, null, associateA.getId(), "EVIDENCE",
                    "Lease clause 7 notice requirement",
                    "Clause 7 requires ten business days' written notice before termination. Meridian's letter appears to give only five calendar days.",
                    null, "now() - interval '44 days'", false);
            insertCaseNode(rentLedger, case1.getId(), root, null, paralegal.getId(), "EVIDENCE",
                    "Payment ledger supports cure period",
                    "Rent ledger shows the disputed arrears were cured before Meridian locked the premises.",
                    null, "now() - interval '38 days'", false);
            insertCaseNode(noticeIssue, case1.getId(), leaseReview, null, lawyer.getId(), "FINDING",
                    "Notice defect is primary injunction theory",
                    "Combine clause 7 with the termination letter timeline. This becomes the cleanest factual route for urgent relief.",
                    null, "now() - interval '31 days'", false);
            insertCaseNode(mitigation, case1.getId(), root, null, associateB.getId(), "LOOPHOLE",
                    "Meridian mitigation evidence is thin",
                    "Opposing disclosure has no replacement-tenant search records. This weakens their damages offset argument.",
                    null, "now() - interval '24 days'", false);
            insertCaseNode(research, case1.getId(), noticeIssue, null, associateA.getId(), "RESEARCH",
                    "Precedent on defective commercial lease notices",
                    "Two district cases treat shortened notice as irreparable procedural prejudice where lockout follows immediately.",
                    null, "now() - interval '17 days'", true);
            insertCaseNode(filing, case1.getId(), mitigation, null, lawyer.getId(), "FILING",
                    "Preliminary injunction motion bundle",
                    "Draft bundle will consolidate mitigation and notice research into the filing record.",
                    null, "now() - interval '9 days'", false);
            insertCaseNode(hearing, case1.getId(), noticeIssue, null, lawyer.getId(), "HEARING",
                    "Preliminary Injunction Hearing",
                    "Argument plan: lead with notice defect, then payment cure, then business disruption.",
                    null, "now() + interval '14 days'", false);
            setMergeTarget(leaseReview, hearing);
            setMergeTarget(rentLedger, hearing);
            setMergeTarget(noticeIssue, hearing);
            setMergeTarget(mitigation, filing);
            setMergeTarget(research, filing);
        }

        caseRepository.findAll().stream()
                .filter(x -> x.getTitle() != null && x.getTitle().startsWith("Delgado Estate"))
                .findFirst()
                .ifPresent(c -> {
                    if (!caseNodeExists(c.getId(), "Asset inventory incomplete")) {
                        UUID root = ensureJourneyRoot(c, admin, "Probate intake opened",
                                "Estate file opened; beneficiaries and known assets identified.",
                                "now() - interval '42 days'");
                        UUID inventory = UUID.randomUUID();
                        UUID valuation = UUID.randomUUID();
                        UUID hearing = UUID.randomUUID();
                        insertCaseNode(inventory, c.getId(), root, null, paralegal.getId(), "FINDING",
                                "Asset inventory incomplete",
                                "Two brokerage accounts need updated statements before the valuation hearing.",
                                null, "now() - interval '28 days'", false);
                        insertCaseNode(valuation, c.getId(), inventory, null, admin.getId(), "EVIDENCE",
                                "Independent valuation ordered",
                                "Northstar Appraisals instructed to value the commercial property and art collection.",
                                null, "now() - interval '16 days'", false);
                        insertCaseNode(hearing, c.getId(), valuation, null, admin.getId(), "HEARING",
                                "Estate Valuation Hearing",
                                "Consolidate asset inventory and appraisal evidence for the probate court.",
                                null, "now() + interval '21 days'", false);
                        setMergeTarget(inventory, hearing);
                        setMergeTarget(valuation, hearing);
                    }
                });

        caseRepository.findAll().stream()
                .filter(x -> x.getTitle() != null && x.getTitle().startsWith("In Re: Pinnacle Corp"))
                .findFirst()
                .ifPresent(c -> {
                    if (!caseNodeExists(c.getId(), "Incident timeline narrows exposure window")) {
                        UUID root = ensureJourneyRoot(c, admin, "Class action defence opened",
                                "Initial defence map split into breach timeline, vendor responsibility, and certification opposition.",
                                "now() - interval '70 days'");
                        UUID incident = UUID.randomUUID();
                        UUID vendor = UUID.randomUUID();
                        UUID cert = UUID.randomUUID();
                        insertCaseNode(incident, c.getId(), root, null, lawyer.getId(), "EVIDENCE",
                                "Incident timeline narrows exposure window",
                                "Forensic report indicates anomalous access lasted 36 hours rather than the pleaded 12-day window.",
                                null, "now() - interval '49 days'", false);
                        insertCaseNode(vendor, c.getId(), root, null, associateB.getId(), "LOOPHOLE",
                                "Vendor indemnity clause may shift notification costs",
                                "Northwind Security contract includes express indemnity for delayed breach escalation.",
                                null, "now() - interval '36 days'", false);
                        insertCaseNode(cert, c.getId(), incident, null, admin.getId(), "HEARING",
                                "Class Certification Hearing",
                                "Certification opposition will combine exposure-window evidence and vendor-control arguments.",
                                null, "now() + interval '45 days'", false);
                        setMergeTarget(incident, cert);
                        setMergeTarget(vendor, cert);
                    }
                });
    }

    private boolean caseNodeExists(UUID caseId, String title) {
        Object n = em.createNativeQuery("SELECT count(*) FROM case_nodes WHERE case_id = :caseId AND title = :title")
                .setParameter("caseId", caseId)
                .setParameter("title", title)
                .getSingleResult();
        return ((Number) n).longValue() > 0;
    }

    private UUID ensureJourneyRoot(Case legalCase, User author, String title, String description, String nodeDateExpr) {
        @SuppressWarnings("unchecked")
        java.util.List<Object> rows = em.createNativeQuery(
                        "SELECT id FROM case_nodes WHERE case_id = :caseId AND node_type = 'ROOT' ORDER BY created_at ASC LIMIT 1")
                .setParameter("caseId", legalCase.getId())
                .getResultList();
        if (!rows.isEmpty()) return (UUID) rows.get(0);

        UUID root = UUID.randomUUID();
        insertCaseNode(root, legalCase.getId(), null, null, author.getId(), "ROOT",
                title, description, null, nodeDateExpr, false);
        return root;
    }

    private void setMergeTarget(UUID nodeId, UUID mergeIntoId) {
        em.createNativeQuery("UPDATE case_nodes SET merge_into_id = :target WHERE id = :node")
                .setParameter("target", mergeIntoId)
                .setParameter("node", nodeId)
                .executeUpdate();
    }

    private void seedCaseParties(Case case1) {
        User admin = userRepository.findByEmail("admin@pangolawfirm.com").orElse(null);
        UUID case1Id = case1.getId();
        em.createNativeQuery("""
                UPDATE cases
                SET client_name = COALESCE(client_name, 'Marcus Chen'),
                    opposing_party = COALESCE(opposing_party, 'Meridian Holdings Ltd.'),
                    related_parties = COALESCE(related_parties, 'Meridian Property Group; Apex Leasing Services; Elaine Porter'),
                    created_at = now() - interval '1 hour'
                WHERE id = :id
                """)
                .setParameter("id", case1Id)
                .executeUpdate();

        caseRepository.findAll().stream()
                .filter(x -> x.getTitle() != null && x.getTitle().startsWith("Delgado Estate"))
                .findFirst()
                .ifPresent(c -> em.createNativeQuery("""
                        UPDATE cases
                        SET client_name = COALESCE(client_name, 'Sofia Delgado'),
                            opposing_party = COALESCE(opposing_party, 'Estate of Roberto Delgado'),
                            related_parties = COALESCE(related_parties, 'Delgado Family Trust; Maria Delgado; Northstar Appraisals'),
                            created_at = now() - interval '2 hours'
                        WHERE id = :id
                        """)
                        .setParameter("id", c.getId())
                        .executeUpdate());

        caseRepository.findAll().stream()
                .filter(x -> x.getTitle() != null && x.getTitle().startsWith("In Re: Pinnacle Corp"))
                .findFirst()
                .ifPresent(c -> em.createNativeQuery("""
                        UPDATE cases
                        SET client_name = COALESCE(client_name, 'Pinnacle Corp'),
                            opposing_party = COALESCE(opposing_party, 'Data Breach Claimant Class'),
                            related_parties = COALESCE(related_parties, 'Northwind Security; Acme Cloud Services; Regulator Office'),
                            created_at = now() - interval '3 hours'
                        WHERE id = :id
                        """)
                        .setParameter("id", c.getId())
                        .executeUpdate());

        if (admin != null && countAll("conflict_check_log") == 0) {
            em.createNativeQuery("""
                    INSERT INTO conflict_check_log (firm_id, requested_by, query_terms, match_count, matched_case_ids, acknowledged, created_at)
                    VALUES (:firm, :by, 'meridian holdings | apex leasing', 1, :caseIds, true, now() - interval '2 days')
                    """)
                    .setParameter("firm", admin.getFirm() != null ? admin.getFirm().getId() : null)
                    .setParameter("by", admin.getId())
                    .setParameter("caseIds", case1Id.toString())
                    .executeUpdate();
        }
    }

    private long count(String table, String column, UUID value) {
        Object n = em.createNativeQuery("SELECT count(*) FROM " + table + " WHERE " + column + " = :v")
                .setParameter("v", value).getSingleResult();
        return ((Number) n).longValue();
    }

    private long countAll(String table) {
        Object n = em.createNativeQuery("SELECT count(*) FROM " + table).getSingleResult();
        return ((Number) n).longValue();
    }

    private UUID ensureDocument(Case legalCase, User owner, String fileName, String category,
                                boolean confidential, int version, UUID previousVersionId, int daysAgo) {
        @SuppressWarnings("unchecked")
        java.util.List<Object> rows = em.createNativeQuery(
                        "SELECT id FROM documents WHERE case_id = :caseId AND file_name = :fileName ORDER BY created_at ASC LIMIT 1")
                .setParameter("caseId", legalCase.getId())
                .setParameter("fileName", fileName)
                .getResultList();
        if (!rows.isEmpty()) return (UUID) rows.get(0);

        UUID id = UUID.randomUUID();
        String hash = demoHash(fileName + "|" + legalCase.getId() + "|" + version);
        String cid = "QmDemo" + demoHash(fileName).substring(0, 38);
        String tx = "demo-tx-" + demoHash(id.toString()).substring(0, 24);
        em.createNativeQuery("""
                INSERT INTO documents
                    (id, case_id, file_name, ipfs_cid, document_hash_sha256, fabric_tx_id,
                     owner_id, version, previous_version_id, status, key_rotation_pending,
                     category, confidential, created_at)
                VALUES
                    (:id, :caseId, :fileName, :cid, :hash, :tx, :owner, :version, :previous,
                     CAST('ACTIVE' AS doc_status), false, :category, :confidential,
                     now() - make_interval(days => :days))
                """)
                .setParameter("id", id)
                .setParameter("caseId", legalCase.getId())
                .setParameter("fileName", fileName)
                .setParameter("cid", cid)
                .setParameter("hash", hash)
                .setParameter("tx", tx)
                .setParameter("owner", owner.getId())
                .setParameter("version", version)
                .setParameter("previous", previousVersionId)
                .setParameter("category", category)
                .setParameter("confidential", confidential)
                .setParameter("days", daysAgo)
                .executeUpdate();
        return id;
    }

    private void grantAccess(UUID docId, User grantee, User granter, String capability, int daysAgo) {
        if (docId == null || grantee == null || granter == null) return;
        em.createNativeQuery("""
                INSERT INTO document_access
                    (doc_id, user_id, capability, granted_by, granted_at, wrapped_key_token, token_obsolete)
                SELECT :doc, :user, CAST(:cap AS capability), :by,
                       now() - make_interval(days => :days), :token, false
                WHERE NOT EXISTS (
                    SELECT 1 FROM document_access
                    WHERE doc_id = :doc AND user_id = :user AND revoked_at IS NULL
                )
                """)
                .setParameter("doc", docId)
                .setParameter("user", grantee.getId())
                .setParameter("cap", capability)
                .setParameter("by", granter.getId())
                .setParameter("days", daysAgo)
                .setParameter("token", "demo-wrapped-key-" + demoHash(docId + grantee.getEmail()).substring(0, 24))
                .executeUpdate();
    }

    private void seedAnnotationSet(UUID docId, User lawyer, User associate, User paralegal) {
        if (annotationExists(docId, "Tighten irreparable harm paragraph before filing.")) return;
        UUID root = UUID.randomUUID();
        em.createNativeQuery("""
                INSERT INTO document_annotations
                    (id, document_id, version_hash, page, position_json, body, author_id, status, created_at)
                VALUES
                    (:id, :doc, :hash, 2, '{"x":0.62,"y":0.34,"w":0.18,"h":0.06}',
                     'Tighten irreparable harm paragraph before filing.', :author, 'OPEN', now() - interval '2 days')
                """)
                .setParameter("id", root)
                .setParameter("doc", docId)
                .setParameter("hash", demoHash(docId.toString()))
                .setParameter("author", lawyer.getId())
                .executeUpdate();
        insertAnnotationReply(docId, root, associate, "Added citation to the lockout cases and shortened the damages section.", false);
        insertAnnotationReply(docId, root, paralegal, "Exhibit references checked against the binder index.", true);
    }

    private boolean annotationExists(UUID docId, String body) {
        Object n = em.createNativeQuery("SELECT count(*) FROM document_annotations WHERE document_id = :doc AND body = :body")
                .setParameter("doc", docId)
                .setParameter("body", body)
                .getSingleResult();
        return ((Number) n).longValue() > 0;
    }

    private void insertAnnotationReply(UUID docId, UUID parentId, User author, String body, boolean resolved) {
        if (author == null) return;
        em.createNativeQuery("""
                INSERT INTO document_annotations
                    (document_id, version_hash, parent_id, page, position_json, body, author_id,
                     status, resolved_by, resolved_at, created_at)
                VALUES
                    (:doc, :hash, :parent, 2, '{"x":0.70,"y":0.40}', :body, :author,
                     :status, :resolver, CASE WHEN :resolved THEN now() - interval '12 hours' ELSE NULL END,
                     now() - interval '1 day')
                """)
                .setParameter("doc", docId)
                .setParameter("hash", demoHash(docId.toString()))
                .setParameter("parent", parentId)
                .setParameter("body", body)
                .setParameter("author", author.getId())
                .setParameter("status", resolved ? "RESOLVED" : "OPEN")
                .setParameter("resolver", resolved ? author.getId() : null)
                .setParameter("resolved", resolved)
                .executeUpdate();
    }

    private void seedRedaction(UUID originalDocId, UUID redactedDocId, User redactor) {
        Object n = em.createNativeQuery("""
                SELECT count(*) FROM document_redactions
                WHERE original_doc_id = :original AND redacted_doc_id = :redacted
                """)
                .setParameter("original", originalDocId)
                .setParameter("redacted", redactedDocId)
                .getSingleResult();
        if (((Number) n).longValue() > 0) return;
        em.createNativeQuery("""
                INSERT INTO document_redactions
                    (original_doc_id, redacted_doc_id, original_cid, redacted_cid, redaction_count,
                     redacting_user_id, fabric_tx_id, created_at)
                VALUES (:original, :redacted, :originalCid, :redactedCid, 4, :user, :tx, now() - interval '4 days')
                """)
                .setParameter("original", originalDocId)
                .setParameter("redacted", redactedDocId)
                .setParameter("originalCid", "QmDemoOriginal" + demoHash(originalDocId.toString()).substring(0, 30))
                .setParameter("redactedCid", "QmDemoRedacted" + demoHash(redactedDocId.toString()).substring(0, 30))
                .setParameter("user", redactor.getId())
                .setParameter("tx", "demo-redaction-" + demoHash(redactedDocId.toString()).substring(0, 18))
                .executeUpdate();
    }

    private void seedSigningWorkflow(UUID docId, Case legalCase, User initiator, User signer, String title, boolean completed) {
        if (docId == null || legalCase == null || initiator == null || signer == null) return;
        @SuppressWarnings("unchecked")
        java.util.List<Object> rows = em.createNativeQuery(
                        "SELECT id FROM signing_workflows WHERE document_id = :doc AND title = :title LIMIT 1")
                .setParameter("doc", docId)
                .setParameter("title", title)
                .getResultList();
        if (!rows.isEmpty()) return;
        UUID workflowId = UUID.randomUUID();
        em.createNativeQuery("""
                INSERT INTO signing_workflows
                    (id, document_id, case_id, title, document_hash_b64, initiated_by, status,
                     fabric_tx_id, created_at, completed_at)
                VALUES
                    (:id, :doc, :caseId, :title, :hash, :by, :status, :tx,
                     now() - interval '2 days', CASE WHEN :done THEN now() - interval '1 day' ELSE NULL END)
                """)
                .setParameter("id", workflowId)
                .setParameter("doc", docId)
                .setParameter("caseId", legalCase.getId())
                .setParameter("title", title)
                .setParameter("hash", demoHash(docId + title))
                .setParameter("by", initiator.getId())
                .setParameter("status", completed ? "COMPLETED" : "PENDING")
                .setParameter("tx", completed ? "demo-signing-" + demoHash(title).substring(0, 18) : null)
                .setParameter("done", completed)
                .executeUpdate();
        insertSigningRequest(workflowId, initiator, 1, completed);
        insertSigningRequest(workflowId, signer, 2, false);
    }

    private void insertSigningRequest(UUID workflowId, User signer, int order, boolean signed) {
        em.createNativeQuery("""
                INSERT INTO signing_requests
                    (workflow_id, signer_id, sign_order, status, signature_b64, signing_public_key,
                     fabric_tx_id, signed_at)
                VALUES
                    (:workflow, :signer, :ord, :status, :sig, :pub, :tx,
                     CASE WHEN :signed THEN now() - interval '1 day' ELSE NULL END)
                """)
                .setParameter("workflow", workflowId)
                .setParameter("signer", signer.getId())
                .setParameter("ord", order)
                .setParameter("status", signed ? "SIGNED" : "PENDING")
                .setParameter("sig", signed ? "demo-signature-" + demoHash(workflowId + signer.getEmail()).substring(0, 32) : null)
                .setParameter("pub", "demo-public-key-" + demoHash(signer.getEmail()).substring(0, 24))
                .setParameter("tx", signed ? "demo-sig-tx-" + demoHash(signer.getId().toString()).substring(0, 18) : null)
                .setParameter("signed", signed)
                .executeUpdate();
    }

    private void seedDocumentClassification(UUID docId, String category, int confidence, User requestedBy) {
        Object n = em.createNativeQuery("SELECT count(*) FROM document_classification_log WHERE doc_id = :doc AND accepted_category = :category")
                .setParameter("doc", docId)
                .setParameter("category", category)
                .getSingleResult();
        if (((Number) n).longValue() > 0) return;
        em.createNativeQuery("""
                INSERT INTO document_classification_log
                    (doc_id, file_name, suggested_category, confidence, accepted_category, requested_by, created_at)
                SELECT id, file_name, :category, :confidence, :category, :by, now() - interval '3 days'
                FROM documents WHERE id = :doc
                """)
                .setParameter("doc", docId)
                .setParameter("category", category)
                .setParameter("confidence", confidence)
                .setParameter("by", requestedBy != null ? requestedBy.getId() : null)
                .executeUpdate();
    }

    private void seedAudit(String resourceId, String resourceType, String eventType, User actor,
                           String summary, int hoursAgo) {
        Object n = em.createNativeQuery("""
                SELECT count(*) FROM audit_log
                WHERE resource_id = :resource AND event_type = :event AND metadata_json LIKE :needle
                """)
                .setParameter("resource", resourceId)
                .setParameter("event", eventType)
                .setParameter("needle", "%" + summary + "%")
                .getSingleResult();
        if (((Number) n).longValue() > 0) return;
        em.createNativeQuery("""
                INSERT INTO audit_log
                    (event_type, actor_id, actor_role, resource_type, resource_id, fabric_tx_id,
                     timestamp, metadata_json, ip_address)
                VALUES
                    (:event, :actor, :role, :type, :resource, :tx,
                     now() - make_interval(hours => :hours), :metadata, :ip)
                """)
                .setParameter("event", eventType)
                .setParameter("actor", actor != null ? actor.getId() : null)
                .setParameter("role", actor != null ? actor.getRole().name() : "SYSTEM")
                .setParameter("type", resourceType)
                .setParameter("resource", resourceId)
                .setParameter("tx", "demo-audit-" + demoHash(resourceId + eventType).substring(0, 18))
                .setParameter("hours", hoursAgo)
                .setParameter("metadata", "{\"summary\":\"" + summary.replace("\"", "'") + "\"}")
                .setParameter("ip", "127.0.0.1")
                .executeUpdate();
    }

    private void insertHearing(Case legalCase, User by, String title, int daysFromNow,
                               String location, String court, String type, String notes) {
        Object n = em.createNativeQuery("SELECT count(*) FROM hearings WHERE case_id = :caseId AND title = :title")
                .setParameter("caseId", legalCase.getId())
                .setParameter("title", title)
                .getSingleResult();
        if (((Number) n).longValue() > 0) return;
        Hearing h = Hearing.builder()
                .legalCase(legalCase)
                .title(title)
                .hearingDate(Instant.now().plus(daysFromNow, ChronoUnit.DAYS))
                .location(location)
                .courtName(court)
                .hearingType(type)
                .notes(notes)
                .createdBy(by)
                .build();
        hearingRepository.save(h);
    }

    private boolean caseEventExists(UUID caseId, String title) {
        Object n = em.createNativeQuery("SELECT count(*) FROM case_events WHERE case_id = :caseId AND title = :title")
                .setParameter("caseId", caseId)
                .setParameter("title", title)
                .getSingleResult();
        return ((Number) n).longValue() > 0;
    }

    private boolean reminderExists(UUID recipientId, String title) {
        Object n = em.createNativeQuery("SELECT count(*) FROM reminders WHERE recipient_id = :recipient AND title = :title")
                .setParameter("recipient", recipientId)
                .setParameter("title", title)
                .getSingleResult();
        return ((Number) n).longValue() > 0;
    }

    private void insertReminder(Case legalCase, User sender, User recipient, String title,
                                String body, int dueDays, String priority) {
        Reminder reminder = Reminder.builder()
                .legalCase(legalCase)
                .sender(sender)
                .recipient(recipient)
                .title(title)
                .body(body)
                .dueAt(Instant.now().plus(dueDays, ChronoUnit.DAYS))
                .priority(priority)
                .read(false)
                .build();
        reminderRepository.save(reminder);
    }

    private String demoHash(String value) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private void insertSettlement(UUID caseId, UUID by, String title, long valueCents, String terms, String analysis) {
        em.createNativeQuery("INSERT INTO settlement_offers (case_id, title, monetary_value_cents, currency, non_monetary_terms, analysis, status, created_by, created_at) " +
                "VALUES (:c, :t, :v, 'USD', :terms, :a, 'PROPOSED', :by, now())")
                .setParameter("c", caseId).setParameter("t", title).setParameter("v", valueCents)
                .setParameter("terms", terms).setParameter("a", analysis).setParameter("by", by)
                .executeUpdate();
    }

    private void insertTimeEntry(UUID caseId, UUID userId, String desc, int minutes, int rateCents, boolean invoiced, int daysAgo) {
        em.createNativeQuery("INSERT INTO time_entries (case_id, user_id, description, minutes, rate_cents, entry_date, invoiced, created_at) " +
                "VALUES (:c, :u, :d, :m, :r, now() - make_interval(days => :days), :inv, now())")
                .setParameter("c", caseId).setParameter("u", userId).setParameter("d", desc)
                .setParameter("m", minutes).setParameter("r", rateCents).setParameter("days", daysAgo)
                .setParameter("inv", invoiced).executeUpdate();
    }

    private void insertMilestone(UUID caseId, UUID by, String title, String desc, String status, int sort, String targetExpr, String completedExpr) {
        em.createNativeQuery("INSERT INTO case_milestones (case_id, title, description, status, target_date, completed_at, sort_order, created_by, created_at) " +
                "VALUES (:c, :t, :d, :s, " + targetExpr + ", " + (completedExpr != null ? completedExpr : "NULL") + ", :sort, :by, now())")
                .setParameter("c", caseId).setParameter("t", title).setParameter("d", desc)
                .setParameter("s", status).setParameter("sort", sort).setParameter("by", by)
                .executeUpdate();
    }

    private void insertDeadline(UUID caseId, UUID by, String title, String desc, String type, String dateExpr) {
        em.createNativeQuery("INSERT INTO case_deadlines (case_id, title, description, deadline_type, deadline_date, completed, created_by, created_at) " +
                "VALUES (:c, :t, :d, :type, " + dateExpr + ", false, :by, now())")
                .setParameter("c", caseId).setParameter("t", title).setParameter("d", desc)
                .setParameter("type", type).setParameter("by", by).executeUpdate();
    }

    private void insertFeedback(UUID clientId, UUID caseId, int rating, String comment, String context) {
        em.createNativeQuery("INSERT INTO feedback_responses (client_id, case_id, rating, comment, context, created_at) " +
                "VALUES (:cl, :c, :r, :cm, :ctx, now())")
                .setParameter("cl", clientId).setParameter("c", caseId).setParameter("r", rating)
                .setParameter("cm", comment).setParameter("ctx", context).executeUpdate();
    }

    private void insertCaseNode(UUID id, UUID caseId, UUID parentId, UUID mergeIntoId, UUID authorId,
                                String nodeType, String title, String description, UUID linkedDocId,
                                String nodeDateExpr, boolean merged) {
        em.createNativeQuery("""
                INSERT INTO case_nodes
                    (id, case_id, parent_id, merge_into_id, author_id, node_type, title, description,
                     linked_doc_id, node_date, merged, merged_at, created_at)
                VALUES
                    (:id, :caseId, :parentId, :mergeIntoId, :authorId, :nodeType, :title, :description,
                     :linkedDocId, """ + nodeDateExpr + ", :merged, " + (merged ? "now() - interval '3 days'" : "NULL") + ", now())")
                .setParameter("id", id)
                .setParameter("caseId", caseId)
                .setParameter("parentId", parentId)
                .setParameter("mergeIntoId", mergeIntoId)
                .setParameter("authorId", authorId)
                .setParameter("nodeType", nodeType)
                .setParameter("title", title)
                .setParameter("description", description)
                .setParameter("linkedDocId", linkedDocId)
                .setParameter("merged", merged)
                .executeUpdate();
    }

    private void insertSecurityAlert(UUID actorId, String actorLabel, String severity, String alertType,
                                     String description, double metric, String signature) {
        em.createNativeQuery("""
                INSERT INTO security_alerts
                    (severity, alert_type, description, actor_id, actor_label, metric, signature, acknowledged, auto_generated, detected_at)
                VALUES (:sev, :type, :desc, :actor, :label, :metric, :sig, false, true, now() - interval '4 hours')
                """)
                .setParameter("sev", severity)
                .setParameter("type", alertType)
                .setParameter("desc", description)
                .setParameter("actor", actorId)
                .setParameter("label", actorLabel)
                .setParameter("metric", metric)
                .setParameter("sig", signature)
                .executeUpdate();
    }

    private void insertDeletionRequest(UUID clientId, String reason) {
        em.createNativeQuery("""
                INSERT INTO deletion_requests (user_id, status, reason, created_at)
                VALUES (:u, 'PENDING', :reason, now() - interval '1 day')
                """)
                .setParameter("u", clientId)
                .setParameter("reason", reason)
                .executeUpdate();
    }
}
