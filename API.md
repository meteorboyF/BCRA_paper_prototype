# PangoChain REST API Reference

Base URL: `http://localhost:8080`  
All protected endpoints require `Authorization: Bearer <access-token>`.  
JWT is verified on every request; expired tokens return `401 Unauthorized`.

---

## Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new user; returns JWT pair |
| POST | `/api/auth/login` | Public | Credential login; returns JWT pair or MFA challenge token |
| POST | `/api/auth/refresh` | Public | Exchange refresh token for new access/refresh pair |
| POST | `/api/auth/logout` | Authenticated | Invalidate session (client-side token discard) |
| GET | `/api/auth/me` | Authenticated | Return current user profile |

### MFA (`/api/auth/mfa`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/mfa/setup` | MFA-setup token | Generate TOTP secret; return QR code URI |
| POST | `/api/auth/mfa/verify` | MFA-setup token | Verify first TOTP code to activate MFA |
| POST | `/api/auth/mfa/challenge` | MFA-challenge token | Submit TOTP code; receive full JWT pair |

---

## Documents (`/api/documents`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/documents/upload` | Authenticated | Register encrypted document; body includes IPFS CID, wrapped key token, hash, metadata |
| GET | `/api/documents` | Authenticated | List documents accessible to caller |
| GET | `/api/documents/by-case/{caseId}` | Authenticated | List documents for a case |
| GET | `/api/documents/{id}/ciphertext` | Authenticated + ACL | Stream encrypted ciphertext from IPFS (Two-layer ACL: JWT + Fabric CheckAccess) |
| GET | `/api/documents/{id}/wrapped-key` | Authenticated + ACL | Return ECIES-wrapped AES key for caller |
| GET | `/api/documents/{id}/history` | Authenticated | Fabric key-history for the document asset |
| PUT | `/api/documents/{id}/metadata` | Authenticated | Update title, category, confidential flag |
| POST | `/api/documents/{id}/key-rotation-complete` | Authenticated | Mark key rotation complete after re-wrap |

**Two-layer ACL on ciphertext/wrapped-key**: Layer 1 = JWT role check. Layer 2 = `CheckAccess` chaincode. If Fabric unreachable, fallback to PostgreSQL ACL (logged as `ACL_FABRIC_FALLBACK`).

---

## Cases (`/api/cases`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/cases` | Legal professional | Create case; anchored to Fabric via `RegisterCase` |
| GET | `/api/cases` | Authenticated | List cases for caller's firm (with optional `search` query param) |
| GET | `/api/cases/{id}` | Authenticated | Case detail |
| POST | `/api/cases/{id}/close` | MANAGING_PARTNER, PARTNER_SENIOR | Close case; Fabric `CloseCase` called |
| POST | `/api/cases/{id}/clients` | Legal professional | Associate client users with this case |
| GET | `/api/cases/my-cases` | Authenticated | Cases associated with the caller (client-facing) |
| GET | `/api/cases/{id}/timeline` | Authenticated | Ordered list of case events |

---

## Hearings (`/api/hearings`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/hearings` | Legal professional | Create hearing; audited as `HEARING_SCHEDULED` |
| GET | `/api/hearings/upcoming` | Authenticated | Upcoming hearings for caller's firm |
| GET | `/api/hearings/by-case/{caseId}` | Authenticated | All hearings for a case |
| PUT | `/api/hearings/{id}` | Legal professional | Update hearing details |
| DELETE | `/api/hearings/{id}` | Legal professional | Delete hearing |
| POST | `/api/hearings/{id}/remind` | Legal professional | Trigger reminder audit (`HEARING_REMINDER_SENT`, priority HIGH) |

---

## Messages (`/api/messages`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/messages` | Authenticated | Send encrypted message (`encryptedPayload` + `wrappedKeyToken`) |
| GET | `/api/messages` | Authenticated | List all messages involving caller |
| GET | `/api/messages/conversations` | Authenticated | Summarised conversation list (one row per peer) |
| GET | `/api/messages/unread-count` | Authenticated | Count of messages with `readAt IS NULL` |
| POST | `/api/messages/mark-read` | Authenticated | Mark one or more messages as read |

---

## Access Control (`/api/access`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/access/grant` | Legal professional | Grant document access; wraps AES key with recipient's ECIES public key; calls `GrantAccess` chaincode |
| DELETE | `/api/access/{docId}/user/{userId}` | Legal professional | Revoke access; calls `RevokeAccess` chaincode |
| GET | `/api/access/{docId}` | Authenticated | List current grants for a document |

---

## E-Signatures (`/api/signatures`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/signatures/{docId}/sign` | Authenticated | Submit ECDSA P-256 signature over document SHA-256 hash; verified server-side with signer's public JWK; anchored to Fabric |
| GET | `/api/signatures/{docId}` | Authenticated | List verified signatures for a document |

---

## Admin (`/api/admin`)

Requires `MANAGING_PARTNER` or `IT_ADMIN` role on all endpoints.

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | Paginated user list (default page=0, size=20, sorted by `createdAt` desc) |
| POST | `/api/admin/users/{id}/activate` | Set account status to ACTIVE; audited |
| POST | `/api/admin/users/{id}/suspend` | Set account status to SUSPENDED; audited |
| GET | `/api/admin/users/{id}/key-status` | Return ECIES/ECDSA key presence + SHA-256 fingerprints |

---

## Audit Log (`/api/audit`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/audit` | MANAGING_PARTNER, IT_ADMIN, REGULATOR | Paginated audit log with optional `eventType`/`resourceId` filters |
| GET | `/api/audit/regulator` | REGULATOR only | Cross-firm audit view |

---

## Ledger (`/api/ledger`)

Requires `MANAGING_PARTNER`, `IT_ADMIN`, or `REGULATOR`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/ledger/events` | Recent chaincode events from Fabric |
| GET | `/api/ledger/tx/{txId}` | Lookup a specific Fabric transaction |

---

## Reminders (`/api/reminders`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/reminders` | Authenticated | List reminders for caller |
| GET | `/api/reminders/unread-count` | Authenticated | Count unread reminders |
| POST | `/api/reminders` | Authenticated | Create reminder (sent to a client by a lawyer) |
| PATCH | `/api/reminders/{id}/read` | Authenticated | Mark reminder as read |

---

## Users (`/api/users`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users/{id}/public-key` | Authenticated | Return a user's ECIES public key (JWK) — used to wrap document keys for sharing |
| GET | `/api/users/by-email` | Authenticated | Look up user by email for message addressing |

---

## Dashboard (`/api/dashboard`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats` | Legal professional | Aggregate stats: active cases, total documents, next hearing, unread count |
| GET | `/api/dashboard/lawyer` | Legal professional | Lawyer-specific dashboard data |
| GET | `/api/dashboard/client` | Client roles | Client-specific dashboard data |

---

## Case Events (`/api/case-events`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/case-events/by-case/{caseId}` | Authenticated | Timeline events for a case |
| POST | `/api/case-events` | Authenticated | Create a timeline event |

---

## Health (`/api/health`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Returns `{"status":"UP"}` |

---

## Error Responses

| Status | Condition |
|---|---|
| 400 | Validation error or bad request body |
| 401 | Missing, expired, or invalid JWT |
| 403 | Authenticated but insufficient role (`@PreAuthorize` failed) |
| 404 | Resource not found |
| 409 | Conflict (e.g. email already registered) |
| 500 | Unexpected server error |

---

## JWT Token Types

All tokens are HMAC-SHA256 signed JWTs with claims `sub` (userId), `email`, `role`, `type`, `iat`, `exp`.

| Type | Claim `type` | Expiry | Usage |
|---|---|---|---|
| Access token | `access` | 1 h | Bearer on all protected endpoints |
| Refresh token | `refresh` | 24 h | `POST /api/auth/refresh` only |
| MFA setup token | `mfa_setup` | 10 min | `POST /api/auth/mfa/setup` and `/verify` |
| MFA challenge token | `mfa_challenge` | 5 min | `POST /api/auth/mfa/challenge` |

Authority prefix: Spring Security authorities are stored as `ROLE_<ROLE_NAME>` (e.g. `ROLE_MANAGING_PARTNER`). `@PreAuthorize` uses `hasAnyRole()` which strips the prefix automatically.
