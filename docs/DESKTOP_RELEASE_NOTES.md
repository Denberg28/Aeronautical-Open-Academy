# Aeronautical Open Academy for Windows — 0.4.0-rc.1

25 October 2026 · Quiz answer selection and enrollment QR

Create a quiz inside a material, enter 2–6 choices and select the correct answer directly beside its text. No answer is selected by default. Editing the choices clears the selection so the instructor must confirm it again. Switching entry types preserves the draft and an unchanged selection. The existing server grades student answers automatically; answer keys remain restricted to the instructor/administrator. Existing quiz answers remain immutable to preserve recorded results.

Enrollment now offers Generate QR code and Save QR image (SVG). Codes use the existing Android `aoa://subject/<UUID>` format. Generation and saving reauthorize the subject and instructor, and no account data, credentials or answer keys enter the image. The desktop also accepts a pasted Academy QR value. Mobile enrollment requires both clients to use the same organization server and still checks sign-in and student eligibility. PC-local demonstration subjects do not synchronize to a phone.

In Students & progress, View work allows activity/examination rating out of 100 and feedback. Saving a grade retains the visible item position. An acknowledged grade whose refresh fails cannot be accidentally resubmitted from the stale form. Export Excel includes current quiz and activity results for the current roster page (up to 100 students). The existing service defines one question per quiz and no weighted course grade.

Material grouping/collapse, left-grip dragging, keyboard ordering, subject deletion, IDs, learner records and schema 8 are retained. No database migration is introduced.

## Install and verify

Extract the entire ZIP, then open Academy.exe. Default local accounts are admin/admin, instructor/instructor, student/student. Close the previous app before upgrading; back up its local-test-workspace folder first. Local data remains in the existing user-data directory. The previous 0.3.2 candidate uses the same schema; retain its package and a matching backup for rollback.

This is an unsigned Windows x64 release candidate. Exact automated Windows UI/startup/package results are in windows-verification.json inside the verified CI archive. Physical Windows accessibility/scaling, real provider access, organization deployment, cross-device enrollment and signed upgrades remain unverified. Android source and binary behavior are unchanged; Android build/lint remains a compatibility gate.
