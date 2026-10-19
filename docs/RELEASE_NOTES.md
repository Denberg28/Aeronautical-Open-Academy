# Aeronautical Open Academy 0.2.0-alpha.1 — test build

Adds generic Subject A/B/C samples and a separate role-based account workspace: administrator registration/status/role/password/enrollment/announcements, creator-owned instructor materials/activities/quizzes, and enrolled student viewing/completion/server-scored submissions.

Includes a portable Node/SQLite backend, organization Shared Drive adapter, Android Keystore session storage, bounded private material viewing, and role/integration tests. The backend is not deployed; organization Drive and physical-device behavior remain unverified. Public sample library works separately from accounts.

Configured compatibility: Android 8.0/API 26+, SDK 35, JDK 17; backend Node 24.19.0. Debug package ends in .test. A debug build uses a development key and is not an institutional stable release. Unsigned release APKs are build evidence only. Candidate workflow requires organization-owned signing secrets.

No default login or administrator password is included. See server/README.md to start a private local backend and bootstrap its first administrator. Use the organization's verified HTTPS origin for device access. Production deployment, signing, real Drive, camera/permission/lifecycle/accessibility/load/install/upgrade checks remain required.

Rollback: prefer a forward-version correction with the same certificate. Uninstall/Clear storage deletes local data. Stop the backend and retain a consistent database/material backup before changes. Exported files cannot be remotely revoked.
