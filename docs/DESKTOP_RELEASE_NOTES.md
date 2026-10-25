# Aeronautical Open Academy for Windows — 0.3.1-rc.1

25 October 2026 · Simple material contents and smoother dragging

Materials have one **+ Add activity or quiz** control. Subsection creation is removed. Subject-level creation remains Material or Examination; the chevron still minimizes a material's activities and quizzes.

Drag a left-side grip. One stable insertion line shows before/after placement without flickering as the pointer crosses text, links or buttons. Material groups move with their children. Only siblings can be reordered; Edit → Material remains the explicit way to assign an activity/quiz to another material.

After the server confirms the order, existing cards move in place rather than rebuilding the subject. A short animation moves whole groups, respecting reduced motion. Drops keep the moved header near the chosen destination. Keyboard focus returns without scrolling to the top. Failed/stale saves leave the prior view intact; no-op drops make no request. Bounded edge scrolling stops when the drag ends or is cancelled. Save or cancel a draft before pointer dragging.

## Existing data and upgrade

Schema 8 converts saved subsections from 0.3.0 into regular materials, preserving IDs, text/links, activities/quizzes, reading records, submitted work and grades. A subsection hidden by its parent remains unpublished after conversion. Existing regular materials and assessments keep their grouping. No content is deleted.

**Close Academy and back up the workspace before upgrading.** Earlier applications cannot reopen schema-8 data. Rollback needs the prior app and matching database backup. Organization deployments must update the backend. The Android local test workspace is separate.

## Verification and installation

The CI-built ZIP includes source-commit.txt, windows-verification.json and package-manifest.json. Required checks cover 37 backend tests, four desktop bridge/link tests, native LMS and dragging suites, migration/reopen, failed saves, exact order persistence, marker cleanup, reduced motion, enlarged layouts, dependency audit, package hashes and packaged EXE startup. Android compatibility must pass on the same source tree. Per-commit CI evidence records the actual result.

Extract the entire ZIP and open Academy.exe. Test logins: admin/admin, instructor/instructor, student/student. Local data stays on this PC.

Unsigned release candidate. Physical Windows accessibility, real Google/provider sign-in/sharing, organization deployment and signed upgrades remain unverified.
