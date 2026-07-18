# UI screenshot retake (2026-07-19)

Captured from the genuinely running prototype (3-org Fabric network at
BatchTimeout=2s, backend + frontend live, real seeded flows) via
headless Chromium at 2x device pixel ratio, cropped to the content pane
only. No image editing beyond cropping; no mock data — every hash,
transaction ID, block number, and chain height in the pixels came from
the running system (block numbers and height live via qscc).

- ui_ledger_explorer.png — block-grouped view: channel legal-channel,
  live chain height, blocks with real transactions under formal
  identities (A. Rahman / S. Chowdhury / M. Karim), submitted via the
  server-managed gateway identity (displayed LawFirmAMSP).
- ui_audit_log.png — event table with one row expanded (actor,
  resource, full Fabric transaction ID, timestamp) over the seeded
  event mix: USER REGISTERED/LOGIN, CASE REGISTERED, DOC REGISTERED x4,
  ACCESS GRANTED x2, DOC VIEWED, ACCESS REVOKED.

Frontend/backend code changes and the seeding + capture scripts are on
branch ui-retake (see repo-root ui_retake_seed/).
