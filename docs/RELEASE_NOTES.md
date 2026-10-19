# Aeronautical Open Academy 0.3.0-alpha.1 — development test build

Adds student self-enrollment into instructor-opened subjects, an enrolled-subject home with progress bars, reading percentage, participation completion, own results and feedback. A compact left dropdown provides navigation. Existing signed-in users relaunch into the workspace.

Instructors can publish written activities/examinations, review per-student outputs and quiz choices/results, grade written work 0–100 with feedback, and see submission compliance/awaiting-assessment counts. Genuine Excel workbooks export up to 100 roster students per page with summary, item status/results and report notes. Reading is self-reported; completion/submission is distinct from grades or passing.

Self-enrollment defaults closed. Administrator removal prevents self-rejoining. Written submissions are immutable/idempotent per revision; grade edits detect stale writes. Student drafts are encrypted locally and cleared on sign-out. Excel export is restricted to the subject owner/admin, uses literal strings, and requires choosing a destination. Keep exported student records in approved organization storage.

Upgrade both app and backend. SQLite v1 automatically migrates to v2 while preserving existing identities, enrollments, material references and results. Stop the backend and back up database/materials first. Old activity self-checkmarks no longer complete written work. Current UI/reports show current published revisions; prior records remain in the database. One-question quizzes and written examinations are supported; attachments, timed/proctored exams, weighted course grades and private offline sync are outside this build.

Compatibility: Android 8.0/API 26+, SDK 35, JDK 17; backend Node 24.19.0. Debug package ends in .test and uses a development signing key; it is not a stable institutional release. CI debug keys may differ between builds, requiring uninstall before installation (local data is lost). Unsigned release APKs are build evidence only.

The backend is not deployed; organization Drive credentials, retained production signing and physical-device accessibility/lifecycle/install/upgrade validation remain blocked or not tested. No default credentials are included. See server/README.md for private setup. Public Subject A/B/C samples work separately without accounts.

Rollback: prefer a forward-version correction signed with the same retained certificate. For server rollback restore the complete pre-upgrade database/material backup with its matching server; older code refuses schema v2. Do not silently downgrade the live database. Already exported files cannot be remotely revoked.
