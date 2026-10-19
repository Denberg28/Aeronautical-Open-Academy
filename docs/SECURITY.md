# Material and account access review

## Enforced in code

- Default-deny authenticated account API. No public registration, client-selected roles/grades, direct file paths or unauthenticated protected-material routes. Student automatic enrollment is allowed only for an instructor-approved account student ID or All students; administrative removal blocks rejoining until restored.
- Current account status/role, session expiry/idle timeout, creator ownership, enrollment, and published state are checked on the server. Old opaque tokens do not retain authority after suspension, deletion, reset, role change, or successful logout.
- Passwords use salted asynchronous scrypt (production N=131072, r=8, p=1) with bounded concurrent derivations. Tests explicitly use a lower-cost fixture to keep the suite quick. Client stores only a Keystore-encrypted session token.
- Admin-only account operations require a sign-in within 15 minutes. First-use temporary password change is required. Last-admin/self-lockout protection prevents accidental administrator removal.
- Prepared SQL statements; explicit write fields; server-assigned item owner/score. Student metadata responses omit quiz keys and underlying private file references.
- Upload/JSON size limits, bounded retries/timeouts/connections, no content redirects, token hashes at rest, no credential request logs, and no-store protected responses.
- Quiz idempotency and one attempt/revision; students cannot self-award scores or bypass submission by setting completion.
- Drive service-account secrets stay on the private server. Android uses an authenticated proxy; no file is made publicly readable by the app.
- Android private screens use screenshot protection and temporary cache. Protected viewer rechecks API permission on open/page change. Public samples are intentionally separate and downloadable.

## Practical boundaries

Access control cannot stop a legitimate reader from photographing or otherwise copying visible content. Already exported offline bytes cannot be immediately revoked. An in-progress authorized response/current rendered page is not guaranteed to disappear instantly after suspension. Protected student offline storage is disabled rather than claiming revocable offline DRM.

Material read/unread is self-reported, not a grade. Activities and written examinations require an immutable output; quizzes require an actual attempt. Submitted/completed and graded/passed are separate; no pass/fail is inferred. Grading uses an optimistic timestamp to prevent stale overwrites. Account deletion anonymizes account identity and removes that student's enrollment/blocks/progress/attempts/written submissions; authored content remains for administrator review. Organization retention/backup policy must be established before real data is introduced.

## Required before institutional use

Verify HTTPS host/reverse proxy, DNS, organization identity/Drive membership, scoped secret handling/rotation, password delivery/recovery, administrator MFA/organization access safeguards, backup restoration, monitoring/rate limits, approved PDF scanning/accessibility, intended load, Android runtime/permissions/caching, signing continuity, and adversarial access tests against the actual deployed service. There is no blanket claim of production readiness from unit tests.

The local development store is not a public download directory. Production startup requires Drive configuration. Backend data directories, environment/keystore/service-account files, and private key material are excluded from Git. Do not deploy test-mode fixtures or default credentials.

## Learner privacy and exports

Roster/detail/Excel routes require the subject owner or administrator; grading requires subject owner/admin while creator-only material edits remain protected. Students receive only their own outputs/results. Discover exposes only eligible subject title/description/ID. Export uses explicit fields and literal inline string cells, so formula-like names/feedback are not formulas. It includes account identity and results; it never includes keys, direct file references or full written answers. Exports are audited, authenticated and no-store, saved only after explicit user destination selection. Exported data cannot be revoked. Do not attach real learner spreadsheets to public issues/releases.

Android written drafts are AES-GCM encrypted with the device Keystore, scoped by account/item/revision, and removed on sign-out or session invalidation. Completed final submissions clear the local draft. Server submissions remain authoritative. Offline final submit and private course/result caching are not offered. Device lifecycle/storage-failure validation is still required.


## Student ID and rule integrity (0.4)

Only administrators bind/correct a unique student ID to an account. Enrollment takes identity from the current database, ignoring client number/account claims. Eligibility endpoints are subject-owner/admin only, accept bounded lists, and compare a policy revision before replacing it. Students cannot enumerate allowlists. All students still requires an active registered student account and mandatory password change; admin blocks override it. ID correction/deletion removes old allowlist grants, increments affected rule revisions and revokes automatic enrollment/sessions, preventing stale ID grants being inherited by a replacement account.

Pre-v3 enrollment provenance cannot be reconstructed: those records migrate as legacy overrides and must be reviewed by administrators under a stricter policy. New qr/self sources are revoked when no longer eligible; explicit admin enrollment overrides eligibility. This is intentional control hierarchy, not a QR bypass. Eligibility, account/access edits and material metadata/audit updates are transactional. Stale item/upload/eligibility edits are rejected. Test publication now enforces the critical/high known-defect gate. See CODE_REVIEW.md for self-review scope and device/deployment limits.
