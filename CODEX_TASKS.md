# Codex Task List — PangoChain Hackathon Repo Setup

## Context

You are setting up the hackathon submission repo for **PangoChain**.

- **Source (read-only):** `/home/angkon/Pangochain_AOOP/`
- **Destination (your working repo):** `/home/angkon/Fardeen_Codex_Dhaka_Meetup/`
- **Remote:** `https://github.com/meteorboyF/Fardeen_Codex_Dhaka_Meetup_Hackathon.git`

Execute each numbered task in order. Each task ends with a `git add` + `git commit`. Do not batch commits. Do not skip tasks. After all tasks, do one final `git push`.

---

## GLOBAL EXCLUSION RULE

When copying any files from the source, **never copy**:
- `*.csv` files
- JSON files inside `results/`, `experiment_scripts/`, or `experiments/` folders
- `figures/` directories
- `results/` directories
- `experiment_scripts/` directories
- `EXPERIMENT_SCRIPTS_BUNDLE.md`
- `SESSION.md`
- `.git/` directory

---

## TASK 0 — Initialize repo and set remote

```bash
cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git init
git remote add origin https://github.com/meteorboyF/Fardeen_Codex_Dhaka_Meetup_Hackathon.git
```

No commit for this task.

---

## TASK 1 — Commit existing docs (Commit 1)

The files `README.md` and `pangochain.md` and `Guideline.md` already exist in the destination folder.
Also copy `CODEX_TASKS.md` (this file) itself.

```bash
cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add README.md pangochain.md Guideline.md CODEX_TASKS.md
git commit -m "docs: add project README, hackathon brief, and Codex task list"
```

---

## TASK 2 — Infrastructure config (Commit 2)

```bash
# Copy files
cp /home/angkon/Pangochain_AOOP/docker-compose.yml /home/angkon/Fardeen_Codex_Dhaka_Meetup/
cp /home/angkon/Pangochain_AOOP/SETUP.md /home/angkon/Fardeen_Codex_Dhaka_Meetup/
cp /home/angkon/Pangochain_AOOP/FEATURES.md /home/angkon/Fardeen_Codex_Dhaka_Meetup/
cp -r /home/angkon/Pangochain_AOOP/scripts /home/angkon/Fardeen_Codex_Dhaka_Meetup/

# Commit
cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add docker-compose.yml SETUP.md FEATURES.md scripts/
git commit -m "infra: add Docker Compose stack and dev setup scripts"
```

---

## TASK 3 — Backend project skeleton (Commit 3)

```bash
# Create destination backend directory
mkdir -p /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend
mkdir -p /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/resources

# Copy Maven wrapper and project files
cp /home/angkon/Pangochain_AOOP/pangochain-backend/pom.xml /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/
cp /home/angkon/Pangochain_AOOP/pangochain-backend/mvnw /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/
cp /home/angkon/Pangochain_AOOP/pangochain-backend/mvnw.cmd /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/ 2>/dev/null || true
cp -r /home/angkon/Pangochain_AOOP/pangochain-backend/.mvn /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/

# Copy application config
cp /home/angkon/Pangochain_AOOP/pangochain-backend/src/main/resources/application.yml \
   /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/resources/

# Copy main app entry point
cp /home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend/PangochainApplication.java \
   /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend/

# Copy config module
cp -r /home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend/config \
      /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend/

# Commit
cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/
git commit -m "feat(backend): add Spring Boot project skeleton and configuration"
```

---

## TASK 4 — Database migrations (Commit 4)

```bash
mkdir -p /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/resources/db/changelog

cp -r /home/angkon/Pangochain_AOOP/pangochain-backend/src/main/resources/db/changelog/. \
      /home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/resources/db/changelog/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/resources/db/
git commit -m "feat(db): add 23 Liquibase schema migrations (users through document redactions)"
```

---

## TASK 5 — Auth and crypto modules (Commit 5)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

cp -r $SRC/auth $DST/
cp -r $SRC/crypto $DST/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/auth/ \
        pangochain-backend/src/main/java/com/pangochain/backend/crypto/
git commit -m "feat(auth): add JWT authentication, MFA (TOTP), and PBKDF2 key derivation"
```

---

## TASK 6 — User and admin management (Commit 6)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

cp -r $SRC/user $DST/
cp -r $SRC/admin $DST/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/user/ \
        pangochain-backend/src/main/java/com/pangochain/backend/admin/
git commit -m "feat(user): add user/firm management and admin panel backend"
```

---

## TASK 7 — Case management modules (Commit 7)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

for module in cases caseevent casenode milestone deadline; do
  cp -r $SRC/$module $DST/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/cases/ \
        pangochain-backend/src/main/java/com/pangochain/backend/caseevent/ \
        pangochain-backend/src/main/java/com/pangochain/backend/casenode/ \
        pangochain-backend/src/main/java/com/pangochain/backend/milestone/ \
        pangochain-backend/src/main/java/com/pangochain/backend/deadline/
git commit -m "feat(cases): add case management, journey nodes, milestones, and deadlines"
```

---

## TASK 8 — Document management and IPFS (Commit 8)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

cp -r $SRC/document $DST/
cp -r $SRC/ipfs $DST/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/document/ \
        pangochain-backend/src/main/java/com/pangochain/backend/ipfs/
git commit -m "feat(docs): add encrypted document management with IPFS dual-node storage"
```

---

## TASK 9 — Blockchain integration + chaincode + Fabric network (Commit 9)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

cp -r $SRC/blockchain $DST/

cp -r /home/angkon/Pangochain_AOOP/pangochain-chaincode \
      /home/angkon/Fardeen_Codex_Dhaka_Meetup/

cp -r /home/angkon/Pangochain_AOOP/pangochain-fabric \
      /home/angkon/Fardeen_Codex_Dhaka_Meetup/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/blockchain/ \
        pangochain-chaincode/ \
        pangochain-fabric/
git commit -m "feat(blockchain): add Hyperledger Fabric integration, chaincode, and 3-org network config"
```

---

## TASK 10 — Access control and e-signatures (Commit 10)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

cp -r $SRC/access $DST/
cp -r $SRC/esignature $DST/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/access/ \
        pangochain-backend/src/main/java/com/pangochain/backend/esignature/
git commit -m "feat(security): add ECIES access control, per-document ACL, and ECDSA e-signatures"
```

---

## TASK 11 — Communication modules (Commit 11)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

for module in chat message notification reminder; do
  cp -r $SRC/$module $DST/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/chat/ \
        pangochain-backend/src/main/java/com/pangochain/backend/message/ \
        pangochain-backend/src/main/java/com/pangochain/backend/notification/ \
        pangochain-backend/src/main/java/com/pangochain/backend/reminder/
git commit -m "feat(comms): add E2E encrypted chat, P2P messaging, notifications, and reminders"
```

---

## TASK 12 — Audit, dashboard, reporting, and custody (Commit 12)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

for module in audit dashboard report custody; do
  cp -r $SRC/$module $DST/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/audit/ \
        pangochain-backend/src/main/java/com/pangochain/backend/dashboard/ \
        pangochain-backend/src/main/java/com/pangochain/backend/report/ \
        pangochain-backend/src/main/java/com/pangochain/backend/custody/
git commit -m "feat(audit): add audit trail, dashboard stats, PDF reports, and chain-of-custody"
```

---

## TASK 13 — Advanced legal features (Commit 13)

```bash
SRC=/home/angkon/Pangochain_AOOP/pangochain-backend/src/main/java/com/pangochain/backend
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-backend/src/main/java/com/pangochain/backend

for module in billing settlement template redaction annotation signingworkflow classification feedback privacy; do
  cp -r $SRC/$module $DST/
done

# security/alert is a nested path
mkdir -p $DST/security
cp -r $SRC/security/alert $DST/security/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-backend/src/main/java/com/pangochain/backend/billing/ \
        pangochain-backend/src/main/java/com/pangochain/backend/settlement/ \
        pangochain-backend/src/main/java/com/pangochain/backend/template/ \
        pangochain-backend/src/main/java/com/pangochain/backend/redaction/ \
        pangochain-backend/src/main/java/com/pangochain/backend/annotation/ \
        pangochain-backend/src/main/java/com/pangochain/backend/signingworkflow/ \
        pangochain-backend/src/main/java/com/pangochain/backend/classification/ \
        pangochain-backend/src/main/java/com/pangochain/backend/security/ \
        pangochain-backend/src/main/java/com/pangochain/backend/feedback/ \
        pangochain-backend/src/main/java/com/pangochain/backend/privacy/
git commit -m "feat(legal): add billing, settlement, templates, redaction, annotations, signing workflows, and classification"
```

---

## TASK 14 — Frontend project skeleton (Commit 14)

```bash
FSRC=/home/angkon/Pangochain_AOOP/pangochain-frontend
FDST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend

mkdir -p $FDST/src/{layout,store,lib,test,pages,components}

# Config files
for f in package.json vite.config.ts tailwind.config.ts postcss.config.js tsconfig.json tsconfig.app.json tsconfig.node.json index.html; do
  cp $FSRC/$f $FDST/ 2>/dev/null || true
done

# Source entry points
cp $FSRC/src/main.tsx $FDST/src/
cp $FSRC/src/App.tsx $FDST/src/

# Core directories
cp -r $FSRC/src/layout/. $FDST/src/layout/
cp -r $FSRC/src/store/. $FDST/src/store/
cp -r $FSRC/src/lib/. $FDST/src/lib/
cp -r $FSRC/src/test/. $FDST/src/test/ 2>/dev/null || true

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/
git commit -m "feat(frontend): add React + Vite + Tailwind skeleton with auth store and crypto utilities"
```

---

## TASK 15 — Frontend auth pages (Commit 15)

```bash
FPAGES=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/pages
DPAGES=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/pages

for page in Landing.tsx Login.tsx Register.tsx MfaSetup.tsx Profile.tsx; do
  cp $FPAGES/$page $DPAGES/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/pages/Landing.tsx \
        pangochain-frontend/src/pages/Login.tsx \
        pangochain-frontend/src/pages/Register.tsx \
        pangochain-frontend/src/pages/MfaSetup.tsx \
        pangochain-frontend/src/pages/Profile.tsx
git commit -m "feat(frontend): add authentication pages — landing, login, register, MFA setup"
```

---

## TASK 16 — Frontend case pages + components (Commit 16)

```bash
FPAGES=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/pages
DPAGES=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/pages
FCOMP=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/components
DCOMP=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/components

for page in Cases.tsx CaseDetail.tsx NewCase.tsx CaseJourney.tsx CaseInsights.tsx; do
  cp $FPAGES/$page $DPAGES/
done

for comp in MilestoneTimeline.tsx CaseDeadlinesPanel.tsx CaseArchiveModal.tsx; do
  cp $FCOMP/$comp $DCOMP/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/pages/Cases.tsx \
        pangochain-frontend/src/pages/CaseDetail.tsx \
        pangochain-frontend/src/pages/NewCase.tsx \
        pangochain-frontend/src/pages/CaseJourney.tsx \
        pangochain-frontend/src/pages/CaseInsights.tsx \
        pangochain-frontend/src/components/MilestoneTimeline.tsx \
        pangochain-frontend/src/components/CaseDeadlinesPanel.tsx \
        pangochain-frontend/src/components/CaseArchiveModal.tsx
git commit -m "feat(frontend): add case management pages and milestone/deadline components"
```

---

## TASK 17 — Frontend document pages + components (Commit 17)

```bash
FPAGES=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/pages
DPAGES=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/pages
FCOMP=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/components
DCOMP=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/components

for page in Documents.tsx DataRooms.tsx DistributeAccess.tsx; do
  cp $FPAGES/$page $DPAGES/
done

for comp in DocumentUploadDropzone.tsx SecureDownloadModal.tsx VersionHistoryPanel.tsx \
            TeamAccessPanel.tsx AccessControlPanel.tsx ChainOfCustodyModal.tsx \
            DocumentEditorModal.tsx RedactionModal.tsx AnnotationModal.tsx \
            SignDocumentModal.tsx SignatureWorkflowModal.tsx CourtBundleModal.tsx; do
  cp $FCOMP/$comp $DCOMP/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/pages/Documents.tsx \
        pangochain-frontend/src/pages/DataRooms.tsx \
        pangochain-frontend/src/pages/DistributeAccess.tsx \
        pangochain-frontend/src/components/DocumentUploadDropzone.tsx \
        pangochain-frontend/src/components/SecureDownloadModal.tsx \
        pangochain-frontend/src/components/VersionHistoryPanel.tsx \
        pangochain-frontend/src/components/TeamAccessPanel.tsx \
        pangochain-frontend/src/components/AccessControlPanel.tsx \
        pangochain-frontend/src/components/ChainOfCustodyModal.tsx \
        pangochain-frontend/src/components/DocumentEditorModal.tsx \
        pangochain-frontend/src/components/RedactionModal.tsx \
        pangochain-frontend/src/components/AnnotationModal.tsx \
        pangochain-frontend/src/components/SignDocumentModal.tsx \
        pangochain-frontend/src/components/SignatureWorkflowModal.tsx \
        pangochain-frontend/src/components/CourtBundleModal.tsx
git commit -m "feat(frontend): add document management pages and all document-related modal components"
```

---

## TASK 18 — Frontend communication pages (Commit 18)

```bash
FPAGES=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/pages
DPAGES=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/pages
FCOMP=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/components
DCOMP=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/components

for page in Chat.tsx Messages.tsx HearingManager.tsx; do
  cp $FPAGES/$page $DPAGES/
done

for comp in NotificationBell.tsx SettlementOffersPanel.tsx BillingPanel.tsx; do
  cp $FCOMP/$comp $DCOMP/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/pages/Chat.tsx \
        pangochain-frontend/src/pages/Messages.tsx \
        pangochain-frontend/src/pages/HearingManager.tsx \
        pangochain-frontend/src/components/NotificationBell.tsx \
        pangochain-frontend/src/components/SettlementOffersPanel.tsx \
        pangochain-frontend/src/components/BillingPanel.tsx
git commit -m "feat(frontend): add chat, messages, hearing manager, and communication components"
```

---

## TASK 19 — Frontend admin + monitoring pages (Commit 19)

```bash
FPAGES=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/pages
DPAGES=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/pages
FCOMP=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/components
DCOMP=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/components

for page in AdminPanel.tsx AuditTrail.tsx LedgerExplorer.tsx RegulatorView.tsx; do
  cp $FPAGES/$page $DPAGES/
done

for comp in SecurityAlertsPanel.tsx ComplianceReportsPanel.tsx DeletionRequestsAdminPanel.tsx; do
  cp $FCOMP/$comp $DCOMP/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/pages/AdminPanel.tsx \
        pangochain-frontend/src/pages/AuditTrail.tsx \
        pangochain-frontend/src/pages/LedgerExplorer.tsx \
        pangochain-frontend/src/pages/RegulatorView.tsx \
        pangochain-frontend/src/components/SecurityAlertsPanel.tsx \
        pangochain-frontend/src/components/ComplianceReportsPanel.tsx \
        pangochain-frontend/src/components/DeletionRequestsAdminPanel.tsx
git commit -m "feat(frontend): add admin panel, audit trail, blockchain ledger explorer, and regulator view"
```

---

## TASK 20 — Frontend client portal (Commit 20)

```bash
FSRC=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/pages/client
DDST=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/pages/client

mkdir -p $DDST
cp -r $FSRC/. $DDST/

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/pages/client/
git commit -m "feat(frontend): add client portal with document vault, case view, privacy rights, and AI assistant stub"
```

---

## TASK 21 — Frontend AI + remaining pages (Commit 21)

```bash
FPAGES=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/pages
DPAGES=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/pages

for page in AiAssistant.tsx VideoConsultations.tsx TemplateEngine.tsx Dashboard.tsx; do
  cp $FPAGES/$page $DPAGES/
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/pages/AiAssistant.tsx \
        pangochain-frontend/src/pages/VideoConsultations.tsx \
        pangochain-frontend/src/pages/TemplateEngine.tsx \
        pangochain-frontend/src/pages/Dashboard.tsx
git commit -m "feat(frontend): add AI assistant page, dashboard, template engine, and video consultations"
```

---

## TASK 22 — Frontend UI primitives + remaining components (Commit 22)

```bash
FCOMP=/home/angkon/Pangochain_AOOP/pangochain-frontend/src/components
DCOMP=/home/angkon/Fardeen_Codex_Dhaka_Meetup/pangochain-frontend/src/components

# UI primitives subfolder
mkdir -p $DCOMP/ui
cp -r $FCOMP/ui/. $DCOMP/ui/

# Remaining top-level components
for comp in ParticlesBackground.tsx FeatureScaffold.tsx; do
  cp $FCOMP/$comp $DCOMP/ 2>/dev/null || true
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add pangochain-frontend/src/components/ui/ \
        pangochain-frontend/src/components/ParticlesBackground.tsx \
        pangochain-frontend/src/components/FeatureScaffold.tsx
git commit -m "feat(frontend): add UI primitives, particles background, and feature scaffold"
```

---

## TASK 23 — Supporting documentation (Commit 23)

```bash
SRC=/home/angkon/Pangochain_AOOP
DST=/home/angkon/Fardeen_Codex_Dhaka_Meetup

for doc in CRYPTO.md API.md HANDOFF.md PangoChain_Feature_Proposal.md FEATURE_TESTS.md; do
  cp $SRC/$doc $DST/ 2>/dev/null || true
done

cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git add CRYPTO.md API.md HANDOFF.md PangoChain_Feature_Proposal.md FEATURE_TESTS.md 2>/dev/null
git commit -m "docs: add architecture, API, cryptography, and feature documentation"
```

---

## TASK 24 — Push to remote

```bash
cd /home/angkon/Fardeen_Codex_Dhaka_Meetup
git branch -M main
git push -u origin main
```

---

---

## DEV LAUNCHER SCRIPT — `scripts/dev.sh`

This script is already copied in **TASK 2** (as part of `scripts/`). It starts the entire stack with one command — Docker infra (PostgreSQL + IPFS), the Spring Boot backend, and the React frontend. Reference it whenever you need to run or verify the project.

### Usage

```bash
bash scripts/dev.sh           # start everything and follow logs
bash scripts/dev.sh stop      # stop backend + frontend (Docker infra stays up)
bash scripts/dev.sh restart   # stop then start
bash scripts/dev.sh status    # show running ports and PIDs
bash scripts/dev.sh logs      # re-attach to logs without restarting
```

Skip Hyperledger Fabric (faster startup for UI-only work):
```bash
PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh
```

### What it does, in order

1. `docker compose up postgres ipfs ipfs2 -d` — starts PostgreSQL 16 and both IPFS Kubo nodes
2. `cd pangochain-fabric && make up && make chaincode && make smoke` — starts Fabric network and deploys chaincode (skipped if `PANGOCHAIN_WITH_FABRIC=0`)
3. `./mvnw spring-boot:run` inside `pangochain-backend/` — starts Spring Boot on `:8080`, waits up to 120s for health
4. `npm run dev` inside `pangochain-frontend/` — starts Vite dev server on `:3000`, waits up to 60s

### Endpoints once running

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Backend health | http://localhost:8080/actuator/health |

### Full script source (for reference)

```bash
#!/usr/bin/env bash
# One-command local dev runner for PangoChain.
#
# Usage:
#   bash scripts/dev.sh           # start infra + backend + frontend, then follow logs
#   bash scripts/dev.sh start     # same as default
#   bash scripts/dev.sh stop      # stop backend/frontend started by this script
#   bash scripts/dev.sh restart   # stop then start
#   bash scripts/dev.sh status    # show ports/PIDs
#   bash scripts/dev.sh logs      # follow backend/frontend logs
#
# Optional:
#   PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh start
#     Skip Fabric startup and run backend with FABRIC_ENABLED=false.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.pango-dev"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
FRONTEND_PID_FILE="$STATE_DIR/frontend.pid"
BACKEND_LOG="${PANGOCHAIN_BACKEND_LOG:-/tmp/pangochain-backend.log}"
FRONTEND_LOG="${PANGOCHAIN_FRONTEND_LOG:-/tmp/pangochain-frontend.log}"
WITH_FABRIC="${PANGOCHAIN_WITH_FABRIC:-1}"
BACKEND_PORT="${PANGOCHAIN_BACKEND_PORT:-8080}"
FRONTEND_PORT="${PANGOCHAIN_FRONTEND_PORT:-3000}"

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
RED=$'\033[0;31m'
NC=$'\033[0m'

log()  { printf '%s[+]%s %s\n' "$GREEN"  "$NC" "$*"; }
warn() { printf '%s[!]%s %s\n' "$YELLOW" "$NC" "$*"; }
die()  { printf '%s[x]%s %s\n' "$RED"    "$NC" "$*" >&2; exit 1; }

mkdir -p "$STATE_DIR"

has_cmd() { command -v "$1" >/dev/null 2>&1; }

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif has_cmd docker-compose; then
    docker-compose "$@"
  else
    die "Docker Compose not found."
  fi
}

pid_alive()      { local pid="${1:-}"; [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; }
read_pid_file()  { local file="$1"; [[ -f "$file" ]] && tr -dc '0-9' < "$file" || true; }

cleanup_stale_pid_file() {
  local label="$1" file="$2"
  local pid; pid="$(read_pid_file "$file")"
  if [[ -n "$pid" ]] && ! pid_alive "$pid"; then
    warn "Removing stale $label PID file ($pid is not running)"
    rm -f "$file"
  fi
}

port_listener() {
  local port="$1"
  if has_cmd ss; then
    ss -ltnp "sport = :$port" 2>/dev/null | awk 'NR > 1 { print; found=1 } END { exit found ? 0 : 1 }'
  elif has_cmd lsof; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null
  else
    return 1
  fi
}

start_background() {
  local workdir="$1" pid_file="$2" log_file="$3" command="$4"
  ( cd "$workdir"
    if has_cmd setsid; then
      setsid bash -lc "$command" >> "$log_file" 2>&1 &
    else
      bash -lc "$command" >> "$log_file" 2>&1 &
    fi
    echo $! > "$pid_file" )
}

wait_for_http() {
  local name="$1" url="$2" seconds="$3"
  for ((i=1; i<=seconds; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then log "$name is ready: $url"; return 0; fi
    sleep 1
  done
  warn "$name did not become ready within ${seconds}s"
  return 1
}

start_docker_infra() {
  has_cmd docker || die "docker not found."
  log "Starting PostgreSQL + IPFS containers"
  (cd "$ROOT_DIR" && compose up postgres ipfs ipfs2 -d)
}

fabric_container_up() {
  docker ps --format '{{.Names}}' | grep -qx 'fabric-cli' &&
  docker ps --format '{{.Names}}' | grep -qx 'legalcc'
}

start_fabric_if_needed() {
  [[ "$WITH_FABRIC" != "1" ]] && { warn "Skipping Fabric (PANGOCHAIN_WITH_FABRIC=$WITH_FABRIC)"; return 0; }
  has_cmd docker || die "docker not found."
  fabric_container_up && { log "Fabric containers already up; reusing"; return 0; }
  warn "Starting Fabric network and deploying chaincode (first run takes a few minutes)"
  (cd "$ROOT_DIR/pangochain-fabric" && make up && make chaincode && make smoke)
}

start_backend() {
  cleanup_stale_pid_file "backend" "$BACKEND_PID_FILE"
  local pid; pid="$(read_pid_file "$BACKEND_PID_FILE")"
  pid_alive "$pid" && { log "Backend already started (PID $pid)"; return 0; }
  curl -fsS "http://localhost:$BACKEND_PORT/actuator/health" >/dev/null 2>&1 && {
    warn "Backend already healthy on :$BACKEND_PORT; reusing"; return 0; }
  port_listener "$BACKEND_PORT" >/dev/null && die "Port $BACKEND_PORT occupied. Run 'bash scripts/dev.sh stop' first."
  : > "$BACKEND_LOG"
  log "Starting backend on :$BACKEND_PORT (log: $BACKEND_LOG)"
  local fabric_flag="true"; [[ "$WITH_FABRIC" == "1" ]] || fabric_flag="false"
  start_background "$ROOT_DIR/pangochain-backend" "$BACKEND_PID_FILE" "$BACKEND_LOG" \
    "FABRIC_ENABLED=$fabric_flag ./mvnw spring-boot:run"
  log "Backend PID: $(read_pid_file "$BACKEND_PID_FILE")"
  wait_for_http "Backend" "http://localhost:$BACKEND_PORT/actuator/health" 120 || {
    warn "Last 80 backend log lines:"; tail -n 80 "$BACKEND_LOG" || true; return 1; }
}

start_frontend() {
  cleanup_stale_pid_file "frontend" "$FRONTEND_PID_FILE"
  local pid; pid="$(read_pid_file "$FRONTEND_PID_FILE")"
  pid_alive "$pid" && { log "Frontend already started (PID $pid)"; return 0; }
  curl -fsS "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1 && {
    warn "Frontend already up on :$FRONTEND_PORT; reusing"; return 0; }
  port_listener "$FRONTEND_PORT" >/dev/null && die "Port $FRONTEND_PORT occupied. Run 'bash scripts/dev.sh stop' first."
  [[ ! -d "$ROOT_DIR/pangochain-frontend/node_modules" ]] && {
    log "Installing frontend dependencies"; (cd "$ROOT_DIR/pangochain-frontend" && npm install); }
  : > "$FRONTEND_LOG"
  log "Starting frontend on :$FRONTEND_PORT (log: $FRONTEND_LOG)"
  start_background "$ROOT_DIR/pangochain-frontend" "$FRONTEND_PID_FILE" "$FRONTEND_LOG" \
    "npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT"
  log "Frontend PID: $(read_pid_file "$FRONTEND_PID_FILE")"
  wait_for_http "Frontend" "http://localhost:$FRONTEND_PORT" 60 || {
    warn "Last 80 frontend log lines:"; tail -n 80 "$FRONTEND_LOG" || true; return 1; }
}

stop_pid_file() {
  local label="$1" file="$2"
  local pid; pid="$(read_pid_file "$file")"
  [[ -z "$pid" ]] && { rm -f "$file"; warn "No $label PID file"; return 0; }
  ! pid_alive "$pid" && { warn "$label PID $pid not running; cleaning"; rm -f "$file"; return 0; }
  log "Stopping $label PID $pid"
  kill "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  sleep 2
  pid_alive "$pid" && { warn "Forcing $label"; kill -9 "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true; }
  rm -f "$file"
}

follow_logs() {
  touch "$BACKEND_LOG" "$FRONTEND_LOG"
  log "Following logs (Ctrl+C to detach — services keep running)"
  tail -n 40 -F "$BACKEND_LOG" "$FRONTEND_LOG"
}

cmd_start() {
  start_docker_infra
  start_fabric_if_needed
  start_backend
  start_frontend
  log "PangoChain is ready"
  log "Frontend: http://localhost:$FRONTEND_PORT"
  log "Backend:  http://localhost:$BACKEND_PORT"
  follow_logs
}

cmd_stop() {
  stop_pid_file "frontend" "$FRONTEND_PID_FILE"
  stop_pid_file "backend"  "$BACKEND_PID_FILE"
  log "Stopped. Docker infra left running. Use 'docker compose down' to tear it down."
}

cmd_status() {
  cleanup_stale_pid_file "backend"  "$BACKEND_PID_FILE"
  cleanup_stale_pid_file "frontend" "$FRONTEND_PID_FILE"
  log "Backend PID:  $(read_pid_file "$BACKEND_PID_FILE"  || echo none)"
  log "Frontend PID: $(read_pid_file "$FRONTEND_PID_FILE" || echo none)"
  log "Port $BACKEND_PORT:";  port_listener "$BACKEND_PORT"  || warn "No listener on :$BACKEND_PORT"
  log "Port $FRONTEND_PORT:"; port_listener "$FRONTEND_PORT" || warn "No listener on :$FRONTEND_PORT"
  log "Docker containers:"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' \
    | grep -E 'pangochain|orderer|peer0|fabric-cli|legalcc|couchdb|NAMES' || true
}

case "${1:-start}" in
  start)   cmd_start  ;;
  stop)    cmd_stop   ;;
  restart) cmd_stop; cmd_start ;;
  status)  cmd_status ;;
  logs)    follow_logs ;;
  *)
    echo "Usage: bash scripts/dev.sh [start|stop|restart|status|logs]"
    echo "Env: PANGOCHAIN_WITH_FABRIC=0 to skip Fabric"
    exit 2 ;;
esac
```

---

## Verification Checklist

After all tasks complete, verify:

1. `git log --oneline` shows 24 commits (Tasks 1–23 + any extras)
2. `ls pangochain-backend/src/main/java/com/pangochain/backend/` lists 30+ module folders
3. `ls pangochain-frontend/src/pages/` lists 20+ page files
4. `ls pangochain-chaincode/legalcc/` shows chaincode.go, types.go, main.go
5. `git log --all --full-history -- "*.csv"` returns empty (no CSV files committed)
6. GitHub repo shows all source code at `https://github.com/meteorboyF/Fardeen_Codex_Dhaka_Meetup_Hackathon`
