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

Set NODE_ENV=production, MATERIAL_STORAGE=drive, GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_FOLDER_ID, a persistent ACADEMY_DATA_DIR, and HOST/PORT behind a configured HTTPS reverse proxy. The organization must provision service-account access to an approved Shared Drive folder. Credential contents stay in secret management, outside source and Android builds. drive.file scope is used for files this app creates; broader organization browsing is not implemented.

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
- POST /v1/items/{id}/complete with completed boolean (material/activity only).
- POST /v1/items/{id}/quiz with choice index and Idempotency-Key UUID. Grades are server-generated.

Roles are server-stored, never accepted from session/client metadata as authorization. Student subject access requires enrollment and published items. All sensitive admin actions enforce fresh sign-in and prevent removing the last active administrator. Sessions are revoked on account access changes; deleted account identity/learning data is removed while authored materials are retained for admin review.
