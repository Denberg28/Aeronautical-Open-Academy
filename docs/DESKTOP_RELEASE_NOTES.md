# Academy PC 0.9.0-rc.1 — scheduled publishing and completion dates

Use Schedule in an entry's action bar to set Draft / Publish now / Scheduled and an optional due date for materials, quizzes, activities and examinations. Philippine time (Asia/Manila) is explicit. Student access and release are enforced by server time, including grouped material/assessment visibility. Late work is accepted and marked late, with no automatic grade penalty; date edits preserve grades and learning revisions.

Organization mode uses the matching API advertising dates-v1. The Windows local demo upgrades from schema 11 to 12 after a consistent academy-before-pc-0.9.sqlite backup; it remains separate from the main schema-8 API. Keep the prior application and matching complete data backup for rollback; never downgrade in place. See SCHEDULING.md.

Extract the entire Windows x64 ZIP and run Academy.exe. Unsigned development candidate. Final CI must pass backend/migration, shared API, native UI/scheduling, packaging/startup/integrity, dependency audit and paired Android verification. Physical Windows/DPI/accessibility, live hosting/time synchronization and production restore remain unverified. No live database or signing identity changed.
