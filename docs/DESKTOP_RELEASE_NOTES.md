# Aeronautical Open Academy for Windows — 0.6.0-rc.1

26 October 2026 · Compact controls and grading workflow

- Move Edit, Publish/Unpublish and Delete into the top bar for every material, examination, quiz and activity. Controls wrap within narrow panes.
- Replace the subject’s three-dot control with Edit for changing its title/description or confirming deletion.
- Save each activity grade in place. Other unsaved grades and the page position remain. Display instructions, submission time and saved status; keep failed drafts; use the saved version for regrades. Grade and audit writes are transactional.
- Begin Excel exports with a Quiz scores sheet. Each column header has the quiz creation date in the PC’s time zone and its title. Cells contain only the numeric correct-answer count. Zero stays zero; missing/current-revision-unsubmitted scores stay blank. Hidden quizzes are excluded. Summary, detailed Assessments and Report notes remain available. Exports cover up to 100 students on the current roster page.

## Install and compatibility

Extract the entire Windows x64 ZIP and launch Academy.exe. All companion files are required. Local synthetic accounts remain admin/admin, instructor/instructor and student/student. Close and back up local-test-workspace before upgrading. Schema 9 is unchanged from 0.5.0; keep a matching app/data backup for rollback. Upgrades from older schemas retain the existing migration requirements.

Organization servers must be updated separately for the new export format and atomic grade audit. Older servers retain their original workbook layout; acknowledged grade saves use a readback compatibility path. No Android APK is part of this Windows package.

This is an unsigned release candidate. Read the attached windows-verification.json and release-verification.json for exact automated evidence and source commit. Physical Windows accessibility, real provider access, organization deployment and cross-device behavior remain NOT TESTED. Unsaved drafts remain in memory and do not survive an app exit or crash. Stable 0.5.0 is retained.
