# Academy account API

Node 24.19.0 + built-in SQLite/crypto/HTTP, no third-party runtime packages. Node's built-in SQLite API is version-sensitive; use the pinned runtime. This is a tested single-instance starter backend, not a managed/clustered institutional LMS deployment.

## Local setup

1. Copy .env.example to .env in this directory.
2. Privately set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (15–128 characters). First bootstrap applies only to an empty account database. No password is embedded in source.
3. `node --env-file=.env src/main.mjs`.
4. Sign in from the debug Android emulator at http://10.0.2.2:8787. Release Android requires an HTTPS origin. Development binds only to loopback.
5. Register instructor/student accounts in the admin workspace. Deliver temporary passwords through an approved private channel. Users must change the temporary password on first sign-in.

Run `npm test`; the suite starts real loopback HTTP services with isolated temporary SQLite databases/private files. It exercises permission denials, enrollment/creator ownership, answer-key isolation, immutable grading/idempotency, suspension/deletion/logout/expiry, material access, and announcements. Test accounts/passwords are fixtures and are never production defaults.

## Production configuration (not deployed here)

For link-only production set NODE_ENV=production, MATERIAL_STORAGE=links, a persistent ACADEMY_DATA_DIR, and HOST/PORT behind a configured HTTPS reverse proxy. No Google service account or file store is needed. Optional private PDF upload deployments use MATERIAL_STORAGE=drive with GOOGLE_SERVICE_ACCOUNT_JSON and DRIVE_FOLDER_ID. The organization must provision service-account access to an approved Shared Drive folder. Credential contents stay in secret management, outside source and Android builds. drive.file scope is used for files this app creates; broader organization browsing is not implemented.

Only one server instance may use the SQLite file. Use a local persistent volume and restrict its permissions. Size the host for scrypt memory (up to two concurrent 128 MiB derivations), uploads (at most two, capped at 50 MiB each), API/viewer load, and backup needs; measure the actual deployment. Proxy/body/connection/rate controls, security updates, admin MFA, health monitoring, backup/restore, and retention policies require operator setup/validation. The Dockerfile is source preparation, not evidence of a deployed server.

Stop the service before manual filesystem backups or use a consistent SQLite backup method; preserve WAL state. Never expose the data folder through a web server. Do not log request bodies, Authorization headers, private keys, or learner answers. No existing cloud project is reused by this implementation.

## API outline

Authenticated routes require `Authorization: Bearer <opaque-session-token>`. JSON write bodies use application/json, ≤64 KiB. PDF uploads use application/pdf, ≤50 MiB. No redirect is followed for protected file/auth traffic.

- POST /v1/auth/login; POST /v1/auth/password; POST /v1/auth/logout; GET /v1/me.
- GET/POST /v1/admin/accounts; POST/PATCH /v1/admin/accounts/{id}; POST /v1/admin/accounts/{id}/password; GET /v1/admin/audit.
- POST /v1/admin/enrolments with subject_id, student_id, enrolled.
- GET/POST /v1/announcements; DELETE /v1/announcements/{id}.
- GET/POST /v1/subjects; GET/POST/PATCH /v1/subjects/{id}; POST /v1/subjects/{id}/items.
- GET/POST/PATCH /v1/items/{id}; POST /v1/items/{id}/file; GET /v1/items/{id}/content.
- POST /v1/items/{id}/complete with completed boolean (material reading only).
- POST /v1/items/{id}/quiz with choice index and Idempotency-Key UUID. Grades are server-generated.

Roles are server-stored, never accepted from session/client metadata as authorization. Student subject access requires enrollment and published items. All sensitive admin actions enforce fresh sign-in and prevent removing the last active administrator. Sessions are revoked on account access changes; deleted account identity/learning data is removed while authored materials are retained for admin review.

## Enrollment, assessment and Excel (0.3)

- GET /v1/subjects/discover?offset=0: student-only, title/description/ID of open subjects not already joined or blocked. POST /v1/subjects/{id}/enrol: authenticated student only; idempotent. POST /v1/subjects/{id} with self_enrol boolean: subject owner/admin. Default closed. Administrative removal creates a rejoining block; administrative enrollment removes it.
- POST /v1/subjects/{id}/items additionally accepts kind examination, stored as a written activity with assessment_type examination. Maximum 200 nonarchived items/subject. Existing kinds remain valid.
- POST /v1/items/{id}/submission with output (1–12,000 characters) and Idempotency-Key UUID. One immutable written activity/exam submission per student/current revision. Never accept a student-supplied grade. Material /complete is read/unread only.
- GET /v1/subjects/{id}/learners?offset=0: owner/admin, up to 100 students, summary measures, total and next_offset. GET /v1/subjects/{id}/learners/{student_id}: current published outputs/choices/results, feedback and graded_at. Student subject/list responses include only their own progress/results.
- POST /v1/submissions/{id}/grade: authorized subject owner/admin, score numeric 0–100, feedback ≤1,000 characters (empty permitted), expected_graded_at null for first assessment or last returned timestamp. Stale edits return 409. Subject owner can assess learners but cannot edit another creator's content.
- GET /v1/subjects/{id}/export?offset=0: owner/admin, no-store authenticated genuine XLSX, up to 100 students/file. Summary/Assessments/Report notes include scope, total and next offset. Current published revisions only. No answer keys or full written output in export. Audit event records export; confidential file leaves application control when saved.

Schema v1 → v2 migrates transactionally at startup. Back up the stopped service's database/WAL/materials before upgrading. Reopening v2 preserves data; versions newer than supported are refused. Roll back by restoring the complete matching backup/server, never by running the old server on v2. Upgrade app/backend together: previous activity self-completion is replaced by written submission. Historical attempts/submissions stay stored until deletion/retention review; current UI/report excludes prior revisions. Single-instance capacity and ≤2 s API target need deployment measurement.

The OOXML writer uses built-in zlib, literal inline string cells, numeric result cells, ZIP CRC and fixed workbook relationships. No formulas, macros or external links are generated. Tests independently parse ZIP/XML with Python standard libraries; real Excel/Android document-provider checks remain a device/operator gate.


## 0.4 ID eligibility and concurrency

Admin create/update accounts supports student_number (student accounts only, unique, uppercase 3–32 ASCII letters/digits/hyphens, leading zeros preserved). Existing accounts may remain unassigned until admin verification. Correction/deletion clears old eligibility grants and automatic enrollment, revokes sessions, and increments affected rule revisions; correction retains work. Deleted accounts have their number removed. Account/access changes are atomic.

GET /v1/subjects/{id}/eligibility returns all_students, student_numbers and revision for the owner/admin. POST requires all_students boolean, student_numbers array ≤1,000 and expected_revision. All=true requires an empty list; All=false with empty list closes automatic joins. Stale edits return 409. Current ID lists are never returned to students. All means all active registered student accounts, including existing accounts awaiting ID assignment.

POST /v1/subjects/{id}/enrol accepts optional source=qr. It uses database identity/role/status and admin blocks; client IDs are ignored. Existing authorized enrollment is idempotent even if automatic joins are closed. New enrollment requires eligibility. Narrowing removes qr/self source enrollments only, retaining records; administrator and migrated legacy enrollments remain overrides. Admin removal always blocks rejoin until admin restoration. Legacy authorized instructor self_enrol writes remain supported as All/closed controls; upgrade instructors together so they use the new list UI.

GET item includes edit_version. Android mutations include expected_edit_version; PDF upload includes X-Item-Version. Conflict returns 409; refresh and review before retry. Every upload, including older clients, compares the item version after async storage and commits metadata/audit atomically. Subject owner/admin may assess current enrolled active learners; this does not grant another creator's content-edit permission.

SQLite v3 upgrades from v1/v2; older servers refuse it. Stop and take a complete consistent backup first. See docs/CODE_REVIEW.md and TESTING.md for failure injection, migration, pending QR/lifecycle and remaining deployment gates.


## 0.5 text-first knowledge links

Text is the interface: material kind material with material_mode text, title, body and published. Android derives the title from the first text line; no separate URL or type field is stored. Body ≤12,000 characters and subject description ≤1,000. Paste HTTP/HTTPS addresses directly into either. Google Docs/presentations/spreadsheets, Drive PDFs, Excel links, YouTube and websites become compact clickable references. The server never fetches or previews them.

GET /v1/me returns capabilities.external_links and capabilities.material_upload. MATERIAL_STORAGE=links initializes no material adapter or directory and needs no Drive credential. This is the example configuration and default production mode if the variable is absent. local remains development-only; drive remains an explicit optional adapter. Keep the original adapter when serving legacy file materials; link-only mode cannot serve previously uploaded file bytes. A metadata/account backend and HTTPS deployment are still needed.

POST /v1/items/{id}/open-link with url and expected_revision checks current active role/enrollment/publication and exact URL membership in current item body. POST /v1/subjects/{id}/open-link with url and expected_description checks the current accessible subject text. They return canonical url/host JSON, never a redirect, bearer token or file. Unsupported/local/IP/credential/custom-port addresses are not clickable. A stale or injected reference returns 409; unavailable/revoked access returns 404/401. These endpoints do not mark reading or track the external page. Native app external launch has no extra confirmation/button after the intentional link tap.

Material body/subject-description changes use existing optimistic guards; subject UI includes expected_description/expected_title when saving. Link replacement changes item revision and requires new self-reported reading. Provider edits at the same URL are outside app revision tracking. Text material cannot accept uploaded files or an app-controlled offline_allowed grant; external offline/download permission belongs to the host. Existing file mode remains compatible.

Schema v4 adds material_mode default file for existing items. New Android material entries explicitly use text. Old v1/v2/v3 databases migrate additively; older code refuses v4. Back up the stopped database/material store first; rollback restores the complete matching backup/server. External links and actual host permissions/browser handoff need operator/real-device validation; the server suite does not contact Google/YouTube or third-party websites.
