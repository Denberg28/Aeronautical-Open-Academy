# Aeronautical Open Academy for Windows — 0.5.0-rc.1

25 October 2026 · Multiple-question quizzes

Instructors can now create one quiz containing 1–50 multiple-choice questions. Set the question count and select Apply, type each question, enter 2–6 options, and click the circle beside its correct answer. Each question card can be minimized or expanded. Editing choices clears that question’s answer selection. Reducing the question count asks before removing populated questions. Changing entry types preserves the question draft. Quizzes are immutable after creation; create a replacement to change questions or keys.

Students select Start quiz, confirm readiness, and answer every question. Minimizing and expanding preserves answers in the current view. Final submission confirms the one allowed attempt and grades all questions on the server. The quiz then collapses, shows Done, and displays correct answers / total items, for example 8 / 10 correct. Expand the submitted quiz to review its questions without changing the submission. Results, instructor work views and Excel use the same score and maximum. Answer keys are never included in student question data.

Existing one-question quizzes remain supported. QR enrollment, activity grading, material collapse, left-grip dragging, ordering and subject deletion are retained.

## Installation and compatibility

Extract the entire ZIP and launch Academy.exe. Default synthetic local accounts remain admin/admin, instructor/instructor and student/student. This version upgrades the workspace database from schema 8 to 9 and preserves existing IDs and learner records. Close and back up the local-test-workspace folder before the first launch. Rollback requires the previous app and its matching pre-upgrade backup; do not open a schema-9 database with the old version.

Organization servers must be upgraded separately. An older server limits the editor to one question. The existing Android companion does not attempt multiple-question quizzes; updated Android source shows the PC requirement and reads the correct score total. No APK is included in this Windows delivery.

This is an unsigned Windows x64 release candidate. Native Windows workflows, scoring/privacy/replay tests, legacy-data migrations, Excel totals, packaged startup and hashes are the automated delivery gates; exact results are in the packaged windows-verification.json. Physical Windows accessibility, real organization deployment and cross-device use remain unverified. There is no timer, proctoring, retake policy or weighted course grade; in-memory draft answers do not survive a crash or app exit.
