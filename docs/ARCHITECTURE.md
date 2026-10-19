# Architecture

## Android

Native Java/framework views, AppCompat, WorkManager, and ZXing Embedded. MainActivity offers the public sample catalog, QR/manual entry, and public Downloads. WorkspaceActivity provides the signed-in role workflow. AccountVault encrypts an opaque session token with Android Keystore AES-GCM; passwords are never retained. The same device key encrypts written drafts, cleared with the session. A left PopupMenu groups navigation; signed-in relaunch enters enrolled subjects with revision-aware progress bars. LearningApi uses an explicitly configured HTTPS origin, fixed API routes, bounded transfers, and no redirects. Debug-only cleartext exceptions are limited to emulator/loopback hosts.

QrRouter resolves A/B/C locally. UUID subject QR values route to the workspace and remain subject to backend enrollment. PdfActivity reauthorizes protected PDF access on open/page change, uses a temporary app-private file, blocks ordinary screenshots, and removes that temporary file on close. Public sample downloads retain the existing atomic completion/index behavior. Protected student offline downloads are intentionally not offered yet; source samples are not real course records.

## Backend

A separate Node 24.19.0/SQLite service enforces roles, ownership, publication, enrollment, account status, and completion/scoring. Built-in modules avoid external runtime dependencies. A dedicated Supabase deployment was considered, but the only connected project belongs to another application; it was not reused or changed. No new cloud organization/project was provisioned.

- Prepared statements and explicit field selection; no client-authoritative roles/owner IDs/grades.
- Accounts store salted scrypt hashes; opaque bearer tokens are random and only their SHA-256 hashes are stored.
- Each API call resolves current account/session state. Eight-hour maximum session, 30-minute inactivity timeout, and 15-minute fresh sign-in for sensitive account operations.
- Mandatory first-use password change. Registration/reset/change-role/suspension/deletion are admin-only, audited, and revoke affected sessions.
- File upload staged with a 50 MiB cap, PDF signature/end marker check, and before/after storage authorization. File bytes are private; metadata responses omit underlying file references.
- Quiz keys stay in server storage; student responses exclude them. One immutable attempt per student/item revision and an idempotency key protect retries.
- Limit two concurrent password derivations, two uploads, 64 connections, bounded bodies/timeouts, and login attempt buckets. A deployment reverse proxy must add HTTPS and organization-level rate/size controls.

SQLite WAL is a single-instance starting point. Do not run replicas against the same database or put it on an unsupported network filesystem. Backups, recovery, load budgets, MFA, and production operations need validation. Node's built-in SQLite API is version-sensitive, so Node is pinned; do not assume API parity with a different major version.

## Material store

LocalMaterials stores private files only for development/integration tests. DriveMaterials uses an organization service-account credential on the server with a Shared Drive folder. OAuth JWT signing, upload-session creation, bounded streaming, and authorized proxy reads occur server-side. Students receive no credential or direct private Drive URL. Replaced Drive objects remain private for the organization's retention review. Actual Shared Drive permissions, storage quotas, and API behavior are unverified until credentials/files are supplied.

Public Drive link catalogs are a separate optional public-content feature. They must never be used to weaken access controls on restricted material. Public GitHub source stores only generic samples and test fixtures.

## References

- https://nodejs.org/docs/latest-v24.x/api/sqlite.html
- https://nodejs.org/docs/latest-v24.x/api/crypto.html
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/workspace/drive/api/guides/manage-downloads
- https://developer.android.com/build/releases/agp-8-9-0-release-notes
- https://github.com/journeyapps/zxing-android-embedded
- https://gradle.org/release-checksums/

The Gradle wrapper/distribution checksums remain checked by tools/project_checks.py. Direct dependencies/toolchain are pinned; transitive lock review remains a release follow-up.

## Progress and assessment increment

SQLite v2 adds opt-in self-enrollment, administrative rejoining blocks, an examination subtype and immutable written submissions with score/feedback/grader timestamps. Migration is additive and transactional; prior quiz/material/account identities survive. Published current revisions determine reading, submission compliance and participation completion; grades remain separate. Editing a content revision invalidates current completion without deleting historical records.

Instructor roster pages have 100 students, with separate student-detail responses for written outputs and selected quiz choices. Written assessment writes enforce ownership and last grading timestamp. XLSX export uses a small built-in-zlib OOXML writer with literal strings/numbers and no external relationships; report metadata describes pagination/current-revision scope. Reports stream to the selected Android document destination after a bounded authenticated transfer; no report is cached to public storage by default.
