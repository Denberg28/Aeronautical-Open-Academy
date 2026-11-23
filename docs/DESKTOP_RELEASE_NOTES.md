# Academy PC 0.9.0 — Standardized desktop UI, scheduling and shared workspace

23 November 2026 · Owner-authorized stable Windows x64 release

## What is included

- **Standardized desktop typography, spacing and layout:** Consolidated all styling into one token-driven theme (`16 px` reading copy with `1.4` line height and `12 px` paragraph spacing; `14 px` controls/forms; `13 px` secondary labels; `12 px` minimum metadata; `1.2` heading line height; WCAG AA muted contrast). Fixed right-sidebar announcement heading/body hierarchy, collapsed review padding, link-field button alignment, action-bar `.push` spacing, compact topbar right alignment, and wrapped choice alignment.
- **Standardized features and workflows:** Added a Show/Hide password toggle on sign-in (auto-reset on sign-out), clear `Read PDF` button trigger and framed PDF reader toolbar, distinct blue `Scheduled` badges alongside green `Published` and gold `Draft`, accurate live-entry visibility for scheduled parents/children, clean session management separation in Settings, subject descriptions in Find a subject, empty state in Announcements, Cancel action on admin Create account, pinned-header hiding during subject edits, PDF reader cleanup on sign-out and password change, and learner-view preservation during Sync.
- **Full 0.6–0.9 feature set:** Compact top-bar entry controls, individual activity grading, dated quiz score Excel exports, canonical AE 101 four-period practice course (25 entries, 16 forms / 40 questions), pinned subject title and student progress, shared organization API sync (`refresh-v1`), Sign out all devices, internal PDF.js canvas reader without student export controls, and server-enforced Philippine-time scheduled publishing and completion due dates (`dates-v1`).

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts remain `admin/admin`, `instructor/instructor`, and `student/student`.

Organization mode pairs with the matching Academy HTTPS API advertising `sync=refresh-v1`, `choice_forms`, and `dates-v1`. Local demo databases use Windows schema 12 (with consistent `academy-before-pc-0.9.sqlite` backup before schema upgrades from `< 12`); never copy a Windows local database onto the main schema-8 API. Close and back up the `local-test-workspace` directory before upgrading; rollback requires the prior application and its matching pre-upgrade backup.

## Stable distribution scope and verification

This is an unsigned Windows x64 build published on GitHub's stable release channel at the repository owner's request on 23 November 2026. Automated gates on the exact final source require all 50 backend/migration tests, 10 desktop bridge/shared-API integration tests, all 7 native Windows Electron UI suites, native and packaged executable IPC smoke tests, package manifest/SHA-256 verification, zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 accessibility/DPI scaling, real Google/external provider sign-in, live organization HTTPS deployment, and signed upgrades remain **NOT TESTED**; institutional production readiness beyond the recorded automated gates is not claimed.
