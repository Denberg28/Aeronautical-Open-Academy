# Changelog

## PC 0.3.2-rc.1

- Add confirmed owner/admin subject deletion under Subject details, with retained learner records.
- Reject stale deletion snapshots and preserve drafts on cancellation/failure; update navigation after acknowledged deletion.


## PC 0.3.1-rc.1

- Remove subsection creation; retain Activity and Quiz inside materials.
- Promote saved subsections to regular materials without losing content or learner records.
- Move existing cards after acknowledged reorder, with stable drop markers, whole-group animation, precise before/after placement and bounded edge scrolling.


## PC 0.3.0-rc.1

- Preserve the subject viewport after reorder, save and refresh; smooth movement feedback honors reduced motion.
- Add optional collapsible material subsections with text/links, activities and quizzes.
- Migrate to schema 7 with recursive visibility, ordering and confirmed subtree archive, preserving learner records.


## PC desktop 0.1.0-alpha.1 — 24 October 2026

- Add a Windows desktop application with a spacious three-pane, single-page LMS workspace.
- Add inline text-plus-link materials, edit/publish/delete/reorder, quizzes and written work.
- Reuse the current backend for roles, eligibility, enrollment, results, grading, announcements and Excel reports.
- Include isolated local demonstration accounts and optional organization HTTPS sign-in, a reproducible Windows package and native desktop automation.
- Android app/version and backend behavior remain unchanged. See desktop/README.md for scope and verification limits.

## 0.8.1-alpha.1

- Temporarily allow screenshots/screen recording of account screens and the in-app PDF viewer for development feedback, as requested.
- Centralize the temporary policy in SCREEN_CAPTURE_ALLOWED so capture protection can be restored after feature refinement.

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

## PC 0.4.0-rc.1 — 2026-10-25

- Explicit correct-answer radio selection for automatically graded quizzes; choice edits clear selection and draft/type switching retains unchanged selections.
- Owner-authorized subject QR preview/SVG export in the Android-compatible format, with clear shared-server and eligibility requirements.
- Preserve activity grading position and prevent stale resubmission after an acknowledged save/failed refresh.
- Verify QR decode, non-first answer scoring, activity grading and Excel results in native Windows workflows.
