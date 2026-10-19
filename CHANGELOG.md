# Changelog

## 0.8.0-alpha.1

- Add HARU-style handle-only subject dragging with live swaps, measured row heights, stable IDs, edge scrolling and saved per-account/per-origin personal order.
- Add accessible move commands and tappable subject cards; keep new subjects at the end and remove revoked IDs from the view.
- Make subject/entry + backgrounds transparent; refine font hierarchy, text boxes/dropdowns, form/card padding, centered panes and navigation transitions.

## 0.7.0-alpha.1

- Replace multiple material forms with bottom + → type/text → Done, a compact entry menu, drag sequencing and accessible move commands.
- Save ordering without invalidating learner work; retain history when entries are deleted.
- Change local defaults to admin/admin, instructor/instructor and student/student; migrate unchanged defaults and retain custom passwords/data.
- Add transactionally migrated backend ordering and conflict checks, local migration/ordering tests and lifecycle draft restoration.

## 0.6.0-alpha.1

- Add device-local default admin/instructor/student test accounts and role picker in debug APK.
- Persist shared test subjects, material links/PDF uploads, enrollment, reading/completion, submissions, assessment and XLSX reports across role switches.
- Add synthetic practice subject, admin-managed account creation/reset, confirmed local reset, and workflow/permission regression tests.
- Keep organization backend authentication and release builds free of active default accounts.

## 0.2.0-alpha.1 — 2026-10-19

- Authorized public source delivery; replaced sample subjects with generic A/B/C.
- Added admin/instructor/student workspace, account registration/access/reset/enrollment, and global announcements.
- Added draft/publish/creator-owned materials, activities, server-scored quiz submission, and per-student completion.
- Added a portable account backend, organization Shared Drive adapter, Keystore session storage, and protected viewer handling.
- Added actual HTTP/SQLite authorization/integration tests and corrected CI SDK/theme compatibility failures.
- Live backend/Drive credentials, persistent signing, and physical-device validation remain outstanding.


## 0.1.0-alpha.1 — 2026-10-19 — source implementation

- Added subject catalog, resource search, QR/manual subject entry, and three-destination native Android UI.
- Added original sample materials/text companions for AE 413, AE 417, AMT 212, and AMT 412.
- Added validated catalog updates with last-valid cache and stable IDs/revisions.
- Added persistent, unique background PDF downloads, cancellation, size/hash/readability checks, and offline reading/removal.
- Added source/core/catalog tests, Android build configuration, private-only CI/candidate release automation, and operational documentation.
- Android build/release/device/organization validation blocked or pending; no APK/stable readiness claimed.
