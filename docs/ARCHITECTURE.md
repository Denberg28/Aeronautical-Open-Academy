# Architecture

## Android

Native Java/framework views, AppCompat, WorkManager, and ZXing Embedded. MainActivity offers the public sample catalog, QR/manual entry, and public Downloads. WorkspaceActivity provides the signed-in role workflow. AccountVault encrypts an opaque session token with Android Keystore AES-GCM; passwords are never retained. The same device key encrypts written drafts, cleared with the session. A left PopupMenu groups navigation; signed-in relaunch enters enrolled subjects with revision-aware progress bars. LearningApi uses an explicitly configured HTTPS origin, fixed API routes, bounded transfers, and no redirects. Debug-only cleartext exceptions are limited to emulator/loopback hosts.

QrRouter resolves A/B/C locally. UUID subject QR values route to the workspace and remain subject to backend enrollment. PdfActivity reauthorizes protected PDF access on open/page change, uses a temporary app-private file, uses the build capture policy (temporarily allows screenshots for development feedback), and removes that temporary file on close. Public sample downloads retain the existing atomic completion/index behavior. Protected student offline downloads are intentionally not offered yet; source samples are not real course records.

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


## 0.4 verified identity and QR enrollment

Schema v3 adds unique administrator-managed student_number, eligible_students keyed by subject/number, eligibility_all/revision, enrollment source, and edit_version independent of assessment revision. Both manual and QR joins use one server eligibility rule; QR source is audit metadata, never authorization. Policy save atomically replaces its list and removes no-longer-eligible qr/self enrollments; admin/legacy enrollment overrides remain. Narrowing never erases retained learning records. ID correction clears old grants and automatic enrollments atomically with identity/session changes.

Android retains pending QR target across sign-in/password change/saved state, suppresses competing resume refresh while scanning, and uses the same protected origin. Eligibility and item edits use optimistic version checks. A private upload revalidates current item edit_version after asynchronous storage and commits metadata/audit together. The private viewer clears an old image during authorization and on denial; resume checks permission again. Actual lifecycle/rendering remains a device gate.


## 0.5 text references and link-only storage

KnowledgeLinks (pure Java) extracts safe inline HTTP/HTTPS URLs and human labels. WorkspaceActivity builds clickable text spans with external arrows and no per-link button. First-line material titles are derived automatically. Server links.mjs independently canonicalizes and checks exact URL membership in current authorized body/description; open-link JSON returns to native ACTION_VIEW. Nothing fetches, caches, embeds or proxies external content; the user's browser/host app uses its own identity.

The account API still controls app metadata and learning records. MATERIAL_STORAGE=links creates no binary store/Drive adapter; capability discovery hides file-upload UI, while existing file entries show guidance if their adapter is disabled. Schema v4 adds material_mode, preserving old items as file. Body link edits use existing item revision/edit_version; subject editing checks expected prior title/description. External provider content at an unchanged URL is outside revision tracking.

## Debug local workflow sandbox (0.6.0)

`LearningApi` selects `TestWorkspace` only for `BuildConfig.DEBUG` and the explicit `local-test` base marker. Normal HTTPS origin validation never accepts that marker. The local adapter exposes the existing role-screen JSON contract without binding any network port. Demo tokens are rejected by the network transport. The workspace lives under `getNoBackupFilesDir()/local-test`; organization session/base settings remain in AccountVault, with base changes clearing tokens and drafts. Role switching uses sign-out/sign-in and rechecks the stored role/status for every action; no UI-supplied role grants access. Synthetic account password hashes use salted PBKDF2-HMAC-SHA256; opaque local session tokens expire after eight hours and are revoked by password/access changes. This is a workflow sandbox, not a replacement security boundary for real school data.

Process-wide locking serializes store operations across workspace and PDF-viewer activity instances. Every action loads current state; POST/DELETE changes atomically replace a synced temporary JSON file only on success. PDF uploads stage and validate before copying to a unique persistent private file, then save the reference; prior files survive metadata save failure. Completion and assessed work bind to item revisions; quiz/answer changes require a new item. File/cache access rechecks local account/enrollment/ownership. Default seeding occurs only when the local state file is absent; corruption reports an actionable reset message rather than silently discarding work. Reset is a separate confirmed sign-in action and never touches the organization service.

## 0.7 entry ordering and simplified composer

Subject editors render native drag handles and compact overflow controls, with one + action after active entries. One Done composer produces the existing material/assessment model and publishes it; new PDFs remain drafts until validated upload and publication finish. Saved editor state includes entry type/text/choices/selected PDF so configuration recreation can reopen it. Subject list scroll position survives refresh and Done returns to the final entry. Reorder uses `POST /v1/subjects/:id/order` with `{item_ids,expected_revision}`; only the subject owner/admin can write. The full unique set of active item IDs is required. Every create/archive/reorder increments the subject order revision; text/content revision is unaffected by moves. Active item and learner/report queries sort by sort_order,created_at,id. Delete is a confirmed archive, preserving submitted records.

Backend v5 adds ordering columns/index transactionally, deriving historical positions from created_at,id. Local v2 derives positions from saved array order and migrates only unchanged legacy default credentials to username-matching passwords; custom passwords and account status/role remain intact. Username aliases map to the three synthetic local emails only in TestWorkspace. Production credential validation is unchanged.

## 0.8 personal subject board

`SubjectBoard` uses one RecyclerView with non-draggable header/footer and stable-ID subject rows. ItemTouchHelper initiates only from a handle long-press, uses a 0.22 move threshold and measured bounds, animates neighbor swaps and supplies edge scrolling. It saves dirty order on clear/cancel and lifecycle flush; Move up/down invokes the same ordering policy. Header/account controls and the trailing transparent + scroll with the board, preserving usable space on small/landscape screens.

Only the account’s currently authorized subject response is arranged. `SubjectOrder.merge` intersects saved IDs with current IDs and appends newly available IDs, without carrying stale/revoked content into the list. Private SharedPreferences namespace is a name UUID of organization origin + account ID. Preferences contain only IDs, with no tokens/material text. `apply()` updates memory immediately and queues durable writing through Android’s preference lifecycle handling. Subject IDs/material order/enrollment/grades remain unchanged and no backend API is added. The board saves layout state across navigation/configuration changes; existing content views remain centered and page animation runs only on navigation when Android animators are enabled.

## Desktop subject tree and schema 6

Items add nullable parent_id referencing a material in the same subject. SQL triggers reject nested materials/examinations, cross-subject parents and non-material parents. Legacy root activity/quiz items remain valid for older Android clients. New desktop creation uses only material/examination roots and activity/quiz children.

Canonical reads flatten each material followed by its children, preserving their independent sort positions. Reorder still accepts the complete active-ID set with order_revision; grouping never derives from proximity. Explicit parent changes require current edit_version and order_revision, append within the new group, and preserve content revision/learner work.

Students must satisfy publication of both child and parent, and an active parent, on list/read/link/file/assessment routes. Published-item progress/report denominators use the same effective visibility. Removing a group archives all active children in one transaction only after explicit confirmation, matching order revision and authority over every child. Existing records are retained.

Subject responses advertise tree_version:1; /v1/me adds capabilities.subject_tree:1. Older desktop/Android organization clients can consume the flattened compatible item shape, while current desktop disables nested controls against an older service. Schema 5 → 6 migration leaves old parents null; operator backup is mandatory before upgrading and old software must not silently downgrade the data.


## Desktop subsections and schema 7

Schema 7 replaces the parent constraints to permit a material subsection directly under a root material, with activities/quizzes under either level. Examinations stay at the root. Parent ownership and same-subject checks remain enforced; SQL rejects self-parenting and excess material depth. Material parent reassignment is not exposed by the API. Recursive canonical reads, publication checks and confirmed archive cover every descendant. Moving an assessment preserves revisions and learner records. Responses advertise tree_version/capabilities.subject_tree 2; capability-1 backends retain the former controls.

The renderer keeps its scroll containers mounted on data refresh and restores the first surviving visible entry's offset (prefer the moved entry or drop target). Missing/deleted anchors fall back to another visible entry or a clamped scroll offset. Short FLIP motion uses current viewport geometry and honors reduced motion. Scroll restoration is immediate; intentional composer/new-entry reveal scrolls only as far as needed. No animation changes persisted data.
