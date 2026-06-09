# PangoChain AOOP — Feature Test Suite

> **Purpose**: Manual end-to-end test cases verifying all implemented features work correctly after the frontend/backend integration. Run these against `localhost:5173` (frontend) + `localhost:8080` (backend).
>
> **Prerequisites**: Backend running (`mvn spring-boot:run`), frontend running (`npm run dev`), PostgreSQL up.

---

## Seeded Accounts

| Email | Password | Role | MFA Required |
|---|---|---|---|
| `admin@pangolawfirm.com` | `Admin123!` | MANAGING_PARTNER | Yes |
| `lawyer@pangolawfirm.com` | `Lawyer123!` | ASSOCIATE_SENIOR | No |
| `paralegal@pangolawfirm.com` | `Paralegal123!` | PARALEGAL | No |
| `client@demo.com` | `Client123!` | CLIENT_PRIMARY | No |
| `client2@demo.com` | `Client123!` | CLIENT_SECONDARY | No |
| `a@pangolawfirm.com` | `Assoc123!` | ASSOCIATE_JUNIOR | No |
| `b@pangolawfirm.com` | `Assoc123!` | ASSOCIATE_JUNIOR | No |
| `c@pangolawfirm.com` | `Assoc123!` | ASSOCIATE_JUNIOR | No |
| `d@pangolawfirm.com` | `Assoc123!` | ASSOCIATE_JUNIOR | No |

**Seeded Cases**: "Chen v. Meridian Holdings", "Delgado Estate", "In Re: Pinnacle Corp"

---

## 1. Authentication & Session

### TC-AUTH-01 — Standard login (non-MFA role)
**User**: `lawyer@pangolawfirm.com`
1. Navigate to `/`
2. Enter email and password, click **Sign In**
3. **Expected**: Redirected to `/dashboard` (lawyer role → legal dashboard)
4. **Expected**: Zustand auth store has `user.role = 'ASSOCIATE_SENIOR'`, `accessToken` present
5. **Expected**: Top-right shows user's name/avatar

### TC-AUTH-02 — MFA login flow (MANAGING_PARTNER)
**User**: `admin@pangolawfirm.com`
1. Navigate to `/`
2. Enter email and password, click **Sign In**
3. **Expected**: Stage switches to `mfa_code` — TOTP input shown
4. Enter the current TOTP code from authenticator app
5. **Expected**: Redirected to `/dashboard`
6. **Expected**: `user.role = 'MANAGING_PARTNER'`, full access

### TC-AUTH-03 — MFA recovery code login
**User**: `admin@pangolawfirm.com` (needs previously generated recovery codes)
1. At TOTP stage, click **Use Recovery Code**
2. Enter a valid recovery code
3. **Expected**: Login succeeds, redirected to `/dashboard`
4. **Expected**: Used recovery code is invalidated on backend (cannot be reused)

### TC-AUTH-04 — MFA setup required flow
**Precondition**: A MANAGING_PARTNER or IT_ADMIN account that hasn't configured MFA
1. Login with password
2. **Expected**: Stage shows `mfa_setup_required`
3. **Expected**: Navigate to `/profile/mfa` (not `/mfa/setup`)
4. Scan QR, enter first TOTP code
5. **Expected**: MFA activated, recovery codes displayed, login completes

### TC-AUTH-05 — Client login → client portal redirect
**User**: `client@demo.com`
1. Login with correct credentials
2. **Expected**: Redirected to `/client/portal` (not `/dashboard`)
3. **Expected**: Legal staff routes (`/dashboard`, `/cases`, etc.) are inaccessible — return 403 or redirect

### TC-AUTH-06 — JWT refresh on expiry
1. Login as `lawyer@pangolawfirm.com`
2. Wait for access token to expire (or manually expire by clearing only the access token)
3. Navigate to any protected page
4. **Expected**: App silently calls `POST /api/auth/refresh` and continues without logging out
5. **Expected**: New `accessToken` appears in Zustand store

### TC-AUTH-07 — Logout
1. Login as any user
2. Click **Logout** (top-right user menu or sidebar)
3. **Expected**: Redirected to `/`
4. **Expected**: Zustand store cleared (no accessToken, user null)
5. **Expected**: Navigating to `/dashboard` redirects back to `/`

### TC-AUTH-08 — Invalid credentials
1. Enter `lawyer@pangolawfirm.com` with password `WrongPassword`
2. **Expected**: Error message shown (not a crash), still on login page

### TC-AUTH-09 — Unauthenticated access to protected routes
1. Without logging in, navigate directly to `http://localhost:5173/dashboard`
2. **Expected**: Redirected to `/` (login page)

---

## 2. Role-Based Access Control

### TC-RBAC-01 — MANAGING_PARTNER has full dashboard
**User**: `admin@pangolawfirm.com`
1. Login (with MFA)
2. **Expected**: Dashboard shows firm-wide stats (`activeCasesCount`, all documents, audit log)
3. **Expected**: Can navigate to `/cases`, `/documents`, `/hearings`, `/audit`, `/settings`, `/admin`

### TC-RBAC-02 — ASSOCIATE_SENIOR restricted from admin
**User**: `lawyer@pangolawfirm.com`
1. Login
2. Try navigating to `/admin`
3. **Expected**: 403 or redirect; admin panel not accessible
4. **Expected**: Dashboard shows personal stats (own documents count, messages)

### TC-RBAC-03 — PARALEGAL restricted from hearing creation
**User**: `paralegal@pangolawfirm.com`
1. Login, navigate to any case detail
2. **Expected**: **Add Hearing** / **Schedule Hearing** button is hidden
3. Verify: POST `/api/hearings` with PARALEGAL JWT returns 403

### TC-RBAC-04 — CLIENT_SECONDARY cannot see legal dashboard
**User**: `client2@demo.com`
1. Login
2. **Expected**: Only client portal routes visible: `/client/portal`, `/client/documents`, `/client/case`, `/client/privacy`
3. **Expected**: `/dashboard` and `/cases` redirect to `/client/portal`

### TC-RBAC-05 — ASSOCIATE_JUNIOR can create hearings
**User**: `a@pangolawfirm.com`
1. Login, navigate to a case detail
2. **Expected**: **Schedule Hearing** button is visible
3. Fill form and submit
4. **Expected**: Hearing created successfully (200 response)

---

## 3. Case Management

### TC-CASE-01 — List cases (legal staff)
**User**: `lawyer@pangolawfirm.com`
1. Navigate to `/cases`
2. **Expected**: Shows seeded cases: "Chen v. Meridian Holdings", "Delgado Estate", "In Re: Pinnacle Corp"
3. **Expected**: Each card shows case number, status, responsible attorney

### TC-CASE-02 — Case detail page
**User**: `lawyer@pangolawfirm.com`
1. Click on "Chen v. Meridian Holdings"
2. **Expected**: URL changes to `/cases/{uuid}`
3. **Expected**: Shows tabs: Overview, Documents, Hearings, Timeline, Milestones, Team
4. **Expected**: Team members section shows real names from DB (not hardcoded "Sarah Sterling" / "Marcus Vance")

### TC-CASE-03 — Case member avatars are dynamic
**User**: `admin@pangolawfirm.com`
1. Open "Chen v. Meridian Holdings" case detail
2. **Expected**: Team member initials/names pulled from `GET /api/cases/{id}/members`
3. **Expected**: If more than 5 members, shows "+N" overflow count

### TC-CASE-04 — Client can see their own cases
**User**: `client@demo.com`
1. Login → `/client/portal` or `/client/case`
2. **Expected**: Shows cases where client is a CaseMember
3. **Expected**: Only their cases visible (not all firm cases)

### TC-CASE-05 — Create new case (MANAGING_PARTNER only)
**User**: `admin@pangolawfirm.com`
1. Navigate to `/cases`, click **New Case** (if button visible)
2. Fill case details, submit
3. **Expected**: New case appears in list with ACTIVE status
4. **Expected**: Audit log records `CASE_CREATED` event

---

## 4. Document Management (E2E Encrypted)

### TC-DOC-01 — Document list view
**User**: `lawyer@pangolawfirm.com`
1. Navigate to `/documents`
2. **Expected**: Paginated list of documents with search and category filter
3. **Expected**: Category sidebar renders (Evidence, Pleadings, Contracts, etc.)
4. Search for a document name
5. **Expected**: List filters in real-time

### TC-DOC-02 — Document upload (E2E encryption)
**User**: `lawyer@pangolawfirm.com`
1. Navigate to `/documents`, click **Ingest File**
2. Select a test file (any .pdf or .txt)
3. Enter the account password when prompted (needed for key derivation)
4. **Expected**: Progress indicator shows: Encrypting → Wrapping Key → Uploading
5. **Expected**: Document appears in list after upload
6. **Expected**: Backend stored ciphertext (not plaintext) on IPFS
7. **Expected**: `POST /api/documents/upload` → 201 with `{documentId, ipfsCid, documentHash}`
8. **Expected**: Audit log records `DOCUMENT_UPLOADED`

### TC-DOC-03 — Document secure download (E2E decryption)
**User**: `lawyer@pangolawfirm.com` (same user who uploaded)
1. Click download/decrypt on a previously uploaded document
2. **Expected**: SecureDownloadModal opens
3. Enter account password
4. **Expected**: Pipeline runs: Fetch ciphertext → ECIES unwrap key → AES-GCM decrypt → SHA-256 verify
5. **Expected**: Decrypted file saves to disk (browser download)
6. **Expected**: Verification status shows ✓ (hash matches)

### TC-DOC-04 — Document access denied for unauthorized user
**User**: `client2@demo.com`
1. Try to access a document not shared with them
2. **Expected**: Download fails with 403 or document not visible

### TC-DOC-05 — Document upload in case context
**User**: `lawyer@pangolawfirm.com`
1. Open a case detail, navigate to Documents tab
2. Upload a document with `caseId` pre-filled
3. **Expected**: Document appears in that case's document list
4. **Expected**: Document is tagged to correct case in DB

### TC-DOC-06 — Demo mode upload (demo-user-001)
**Precondition**: Using the demo shortcut (creates demo-user-001 session)
1. Attempt to upload a document
2. **Expected**: Upload uses demo mock path (no real IPFS/Fabric calls)

---

## 5. Hearings

### TC-HEAR-01 — Schedule a hearing (attorney role)
**User**: `lawyer@pangolawfirm.com`
1. Open "Chen v. Meridian Holdings" case detail → Hearings tab
2. Click **Schedule Hearing** (should be visible for ASSOCIATE_SENIOR)
3. Fill: title, date, location, court name, type
4. Submit
5. **Expected**: Hearing appears in the list
6. **Expected**: `POST /api/hearings` returns 200 with hearing DTO
7. **Expected**: Audit log records `HEARING_SCHEDULED`

### TC-HEAR-02 — Upcoming hearings — lawyer
**User**: `lawyer@pangolawfirm.com`
1. Navigate to `/hearings` or check dashboard
2. **Expected**: `GET /api/hearings/upcoming` returns hearings for the lawyer's firm
3. **Expected**: Sorted by date ascending

### TC-HEAR-03 — Upcoming hearings — client
**User**: `client@demo.com`
1. Login → dashboard or `/client/portal`
2. **Expected**: `GET /api/hearings/upcoming` returns hearings for cases where client is a member (via CaseMember join)
3. **Expected**: NOT an empty list (bug was fixed; client users now use `findUpcomingForClient`)

### TC-HEAR-04 — Hearing form hidden from PARALEGAL
**User**: `paralegal@pangolawfirm.com`
1. Open any case detail → Hearings tab
2. **Expected**: **Schedule Hearing** button is NOT rendered
3. Verify `canScheduleHearings` evaluates to `false` for PARALEGAL role

### TC-HEAR-05 — Update hearing
**User**: `lawyer@pangolawfirm.com`
1. Click edit on an existing hearing
2. Modify date/location
3. **Expected**: `PUT /api/hearings/{id}` returns updated hearing
4. **Expected**: Audit log records `HEARING_UPDATED`

### TC-HEAR-06 — Delete hearing
**User**: `admin@pangolawfirm.com`
1. Delete a hearing
2. **Expected**: `DELETE /api/hearings/{id}` returns 204
3. **Expected**: Hearing removed from list

---

## 6. Dashboard

### TC-DASH-01 — Lawyer dashboard stats
**User**: `lawyer@pangolawfirm.com`
1. Navigate to `/dashboard`
2. **Expected**: `GET /api/dashboard/lawyer` returns:
   - `activeCasesCount` (number)
   - `totalDocuments` (number)
   - `unreadMessages` (number)
   - `nextHearing` (hearing object or null)
   - `upcomingDeadlines` (array, up to 5)
   - `recentAuditEvents` (array, up to 5)

### TC-DASH-02 — Dashboard deadlines are live (not hardcoded)
**User**: `lawyer@pangolawfirm.com`
1. Open dashboard, check the deadlines timeline section
2. **Expected**: Deadlines come from `lawyerQuery.data?.upcomingDeadlines` (not a static array)
3. If no deadlines: shows "Awaiting deadline data…" placeholder
4. Add a new deadline to a case via the case detail
5. Refresh dashboard
6. **Expected**: New deadline appears in the timeline

### TC-DASH-03 — Managing Partner sees firm-wide stats
**User**: `admin@pangolawfirm.com`
1. Navigate to `/dashboard`
2. **Expected**: `totalDocuments` shows ALL firm documents (not just owned)
3. **Expected**: `activeCasesCount` shows all firm-active cases

### TC-DASH-04 — Client dashboard
**User**: `client@demo.com`
1. Navigate to `/client/portal`
2. **Expected**: `GET /api/dashboard/client` returns:
   - `documentsCount`
   - `messagesCount`
   - `remindersCount`
   - `nextHearing`
   - `encryptionStatus` (algorithm info)

### TC-DASH-05 — Dashboard stats update on new data
1. As `lawyer`, create a new hearing
2. Navigate back to dashboard
3. **Expected**: `nextHearing` reflects the newly created hearing (if it's the soonest)

---

## 7. Messaging (Real-Time)

### TC-MSG-01 — Send message
**User A**: `lawyer@pangolawfirm.com`, **User B**: `admin@pangolawfirm.com`
1. Both users login in separate browser windows
2. User A opens messaging, selects User B
3. User A sends a message
4. **Expected**: User B receives message in real-time via STOMP/WebSocket (`/ws`)
5. **Expected**: No page refresh needed

### TC-MSG-02 — Unread message count
1. User A sends a message to User B without User B reading it
2. User B checks dashboard
3. **Expected**: `unreadMessages` stat shows the count
4. User B reads the message
5. **Expected**: Count decrements (mark-as-read endpoint called)

### TC-MSG-03 — Message history persists
1. Send 10 messages between two users
2. Logout and log back in
3. Navigate to the conversation
4. **Expected**: All 10 messages still visible (stored in PostgreSQL, not just in-memory)

---

## 8. Audit Log

### TC-AUDIT-01 — Audit log page loads
**User**: `admin@pangolawfirm.com`
1. Navigate to `/audit`
2. **Expected**: Shows recent audit events (dual-logged: PostgreSQL + Fabric)
3. **Expected**: Events have `actionType`, `entityType`, `entityId`, `actorId`, `timestamp`

### TC-AUDIT-02 — Document upload creates audit event
1. Upload a document as `lawyer@pangolawfirm.com`
2. Check `/audit` as admin
3. **Expected**: `DOCUMENT_UPLOADED` event visible with correct user, document ID

### TC-AUDIT-03 — Hearing actions create audit events
1. Schedule a hearing as `lawyer@pangolawfirm.com`
2. Check audit log
3. **Expected**: `HEARING_SCHEDULED` event with `caseId` and `date` in JSON payload

### TC-AUDIT-04 — Audit events restricted by role
**User**: `client@demo.com`
1. Try to access `/audit`
2. **Expected**: 403 or redirect to client portal

---

## 9. Client Portal

### TC-CLIENT-01 — Client portal home
**User**: `client@demo.com`
1. Login → redirected to `/client/portal`
2. **Expected**: Portal shows case summaries, next hearing, document count
3. **Expected**: No legal-staff UI elements (no global case manager, no admin links)

### TC-CLIENT-02 — Client document view
**User**: `client@demo.com`
1. Navigate to `/client/documents`
2. **Expected**: Only documents accessible to this client are shown
3. **Expected**: Secure download works (same E2E decrypt pipeline)

### TC-CLIENT-03 — Client case view
**User**: `client@demo.com`
1. Navigate to `/client/case`
2. **Expected**: Case summary for their case(s) — seeded "Chen v. Meridian Holdings" has client members
3. **Expected**: Milestones, settlement offers, hearing schedule visible (read-only)

### TC-CLIENT-04 — CLIENT_SECONDARY restricted from CLIENT_PRIMARY actions
**User**: `client2@demo.com` vs `client@demo.com`
1. Login as `client2@demo.com`
2. **Expected**: Cannot access corp admin functions if `client@demo.com` is primary on the case
3. **Expected**: Read-only on case data

### TC-CLIENT-05 — Privacy settings
**User**: `client@demo.com`
1. Navigate to `/client/privacy`
2. **Expected**: Page loads with privacy preferences
3. Save a change
4. **Expected**: Preference persisted (reappears after refresh)

---

## 10. User Profile & Settings

### TC-PROFILE-01 — View profile
1. Login as any user
2. Navigate to `/profile`
3. **Expected**: Name, email, role displayed correctly from JWT/DB

### TC-PROFILE-02 — MFA setup page
**User**: Any IT_ADMIN or MANAGING_PARTNER who hasn't set up MFA
1. Navigate to `/profile/mfa`
2. **Expected**: QR code displayed for TOTP scanner
3. Enter first 6-digit code
4. **Expected**: MFA activated, recovery codes shown

### TC-PROFILE-03 — MFA route is correct
1. After forced MFA setup during login, the app navigates to `/profile/mfa`
2. **Expected**: Route resolves (not 404)
3. **Bug was**: app was navigating to `/mfa/setup` which didn't exist

---

## 11. Security & Crypto

### TC-SEC-01 — AES-256-GCM encryption round-trip
1. Upload a document
2. Inspect the stored IPFS data (or use backend debug endpoint if available)
3. **Expected**: Raw stored bytes are ciphertext (not readable plaintext)
4. Download and decrypt
5. **Expected**: Decrypted content matches original

### TC-SEC-02 — ECIES key wrapping
1. Upload as `lawyer@pangolawfirm.com`
2. Download as same user
3. **Expected**: Private key derived from password via PBKDF2-SHA256 (600k iterations)
4. **Expected**: Wrapped AES key stored alongside ciphertext, only unwrappable with correct password

### TC-SEC-03 — Wrong password on decrypt fails gracefully
1. Upload a document
2. Attempt to download with incorrect password
3. **Expected**: Decryption fails with user-visible error (not a silent empty download)

### TC-SEC-04 — Recovery endpoint is publicly accessible
1. Without any Authorization header, POST to `/api/auth/mfa/recovery` with a valid challenge token and recovery code
2. **Expected**: Returns 200 (not 401)
3. **Bug was**: endpoint required a full JWT; challenge token was not sufficient

### TC-SEC-05 — SHA-256 hash verification on download
1. Download a document that was uploaded with a known hash
2. **Expected**: SecureDownloadModal shows verification status: ✓ Verified
3. Tamper with the ciphertext on the backend (if test environment allows)
4. **Expected**: Verification fails with user-visible integrity error

---

## 12. Multi-User Interaction Scenarios

### TC-MULTI-01 — Lawyer uploads → client downloads
**Setup**: `client@demo.com` is a member of "Chen v. Meridian Holdings"
1. Login as `lawyer@pangolawfirm.com`, upload a document to "Chen v. Meridian Holdings"
2. Share document access with `client@demo.com` via document access control
3. Login as `client@demo.com`
4. **Expected**: Document appears in `/client/documents`
5. Download with client's password
6. **Expected**: Decryption succeeds

### TC-MULTI-02 — Admin schedules hearing → client sees it
1. Login as `admin@pangolawfirm.com`, schedule hearing for "Chen v. Meridian Holdings"
2. Login as `client@demo.com`
3. **Expected**: Hearing appears in client portal upcoming hearings
4. **Expected**: `GET /api/hearings/upcoming` for client returns this hearing

### TC-MULTI-03 — Concurrent sessions (two browsers)
1. Login as `lawyer@pangolawfirm.com` in Browser A
2. Login as `admin@pangolawfirm.com` in Browser B
3. Admin sends a message to the lawyer
4. **Expected**: Lawyer sees real-time notification via WebSocket without refresh

### TC-MULTI-04 — Associate adds note → paralegal sees it
**User A**: `a@pangolawfirm.com`, **User B**: `paralegal@pangolawfirm.com`
1. Associate creates a case note or milestone
2. Paralegal opens the same case
3. **Expected**: Note/milestone visible (both are firm members)

### TC-MULTI-05 — Session isolation (sessionStorage)
1. Login as `lawyer@pangolawfirm.com` in Tab 1
2. Open new Tab 2 (same browser, new tab)
3. **Expected**: Tab 2 is NOT auto-logged in (sessionStorage is tab-scoped, not shared across tabs)

---

## 13. Navigation & Routing

### TC-NAV-01 — Client routes are blocked for legal staff
**User**: `lawyer@pangolawfirm.com`
1. Navigate to `/client/portal`
2. **Expected**: Redirected to `/dashboard` (not 404 or blank)

### TC-NAV-02 — Legal routes are blocked for clients
**User**: `client@demo.com`
1. Navigate to `/cases`
2. **Expected**: Redirected to `/client/portal`

### TC-NAV-03 — Deep link after login
1. Navigate directly to `http://localhost:5173/cases` without being logged in
2. Login
3. **Expected**: After login, redirected to `/cases` (not `/dashboard`)
   *(If return-URL functionality is implemented)*

### TC-NAV-04 — 404 page
1. Navigate to `/nonexistent-route`
2. **Expected**: Custom 404 or redirect to home; no blank page

### TC-NAV-05 — Browser back/forward after login
1. Login, navigate through several pages
2. Use browser back button
3. **Expected**: Pages load correctly; no auth errors from stale React Query cache

---

## 14. Data Persistence & Integrity

### TC-DATA-01 — Data survives backend restart
1. Upload a document, create a hearing, send a message
2. Restart the backend (`Ctrl+C` and re-run)
3. **Expected**: All data still present (stored in PostgreSQL, not in-memory)

### TC-DATA-02 — Blockchain audit immutability
1. Record 3 audit events (upload doc, schedule hearing, login)
2. `GET /api/audit` to verify events
3. Manually try to delete an audit record from PostgreSQL
4. **Expected**: Fabric chaincode copy still holds the event (dual-log)

### TC-DATA-03 — IPFS document persistence
1. Upload a document, note the `ipfsCid`
2. Restart backend
3. Download the document
4. **Expected**: Ciphertext fetched from IPFS using the stored CID

### TC-DATA-04 — Paginated document list
1. Upload 15+ documents
2. Navigate to `/documents`
3. **Expected**: Pagination controls visible
4. Click next page
5. **Expected**: Next page of documents loads without errors

---

## 15. Edge Cases & Error Handling

### TC-EDGE-01 — Upload empty file
1. Attempt to upload a 0-byte file
2. **Expected**: Validation error shown, not a server 500

### TC-EDGE-02 — Hearing date in the past
1. Attempt to schedule a hearing with a past date
2. **Expected**: Frontend or backend validation rejects it with a clear message

### TC-EDGE-03 — Duplicate case member
1. Attempt to add the same user to a case twice
2. **Expected**: Error shown, no duplicate entry

### TC-EDGE-04 — Token expiry during active session
1. Login, then let the access token expire but keep the page open
2. Perform an action (click something that triggers an API call)
3. **Expected**: App transparently refreshes token and completes the action

### TC-EDGE-05 — Large file upload
1. Upload a 50MB+ file
2. **Expected**: Upload completes (may take time); no timeout crash
3. **Expected**: Progress indicator reflects actual upload progress

### TC-EDGE-06 — Network error during decrypt
1. Start a decrypt in SecureDownloadModal
2. Kill the backend mid-request
3. **Expected**: Error state shown, not a frozen/broken UI

---

## Quick Smoke Test (5-minute check)

Run this after any deployment to verify nothing is catastrophically broken:

| # | Action | Expected |
|---|---|---|
| 1 | `client@demo.com` login | Redirect to `/client/portal` |
| 2 | `lawyer@pangolawfirm.com` login | Redirect to `/dashboard` |
| 3 | Dashboard loads lawyer stats | `activeCasesCount`, `nextHearing` present |
| 4 | Navigate to `/cases` | Seeded 3 cases visible |
| 5 | Open "Chen v. Meridian Holdings" | Case detail loads, real team members shown |
| 6 | Hearings tab | Hearings list renders (no empty array bug) |
| 7 | Client upcoming hearings | `GET /hearings/upcoming` returns non-empty for client |
| 8 | Dashboard deadlines | Shows live deadlines from DB (not hardcoded) |
| 9 | `admin@pangolawfirm.com` login | MFA code prompt appears |
| 10 | PARALEGAL — case detail | No **Schedule Hearing** button visible |

---

## Known Non-Critical Notes

- **TC-DOC-03 hash fallback**: `GET /api/documents/{id}` (single document) used as hash fallback in `SecureDownloadModal` may return 404 if not implemented. Hash verification silently skips without erroring — document still decrypts. Low priority.
- **TC-MULTI-05 sessionStorage tab isolation**: Tabs in the same browser window share `sessionStorage` only if opened via `window.open` with same origin. Normal new tabs are isolated.
- **TC-SEC-02 demo mode**: `demo-user-001` bypasses real crypto — expected behavior in demo mode only.
