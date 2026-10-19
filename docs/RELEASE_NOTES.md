# Aeronautical Open Academy 0.4.0-alpha.1 — development test build

Instructor enrollment eligibility now accepts a list of verified student ID numbers or an All students checkbox. Eligible signed-in students enroll when scanning the subject QR, including after sign-in/required password change. Repeated scans are idempotent. Students can scan or enter a subject code directly from the left menu.

Administrators assign/correct unique account student IDs; students cannot claim IDs. Leading zeros are preserved. All students means active registered student accounts, not anonymous access. Empty ID list with All unchecked closes automatic enrollment. Removing eligibility revokes new QR/self enrollments while retaining their work. Administrator enrollments and migrated pre-v3 enrollments remain explicit/legacy overrides; administrator removal blocks rejoining. Review legacy access before adopting a stricter institution policy.

UI refreshed with white surfaces, navy text/actions, restrained golden-yellow progress/navigation highlights, larger spacing and 56dp actions. Enrolled subjects, completion, reading percentage, results, instructor compliance and confidential Excel exports remain; Excel now also includes the institutional student ID as text.

Reliability review fixes atomic material/audit writes and account changes, stale item/upload/eligibility overwrites, instructor assessment of administrator-authored work, scanner/refresh ordering, failed PDF authorization display, token-save error handling and registration recovery. See docs/CODE_REVIEW.md for coverage, evidence and limits.

Deploy matching 0.4 Android/server versions. Stop and back up the backend first: SQLite v1/v2 upgrades additively to v3, retaining accounts, enrollments, files and results. Existing students have no invented ID; admins assign verified numbers. Older servers refuse v3. For rollback restore the complete matching pre-upgrade database/material backup and older server. Prefer forward app fixes with the same retained certificate; uninstall/clear storage destroys local downloads/drafts.

Android 8.0/API 26+, SDK 35, JDK 17; Node 24.19.0 backend. This .test package is a development-signed test APK, not a stable institutional release. CI debug certificates may differ between runs; installation may require uninstalling the old test app. Unsigned release APK is build evidence only.

Backend hosting, organization Drive credentials, retained production signing and physical-phone camera/accessibility/lifecycle/install/upgrade tests remain unconfigured or unverified. Account workflows require a running backend; no default credentials are included. Reading is self-reported; completion is participation, not passing. Written text activities/exams and one-question quizzes remain the current scope; private offline sync and timed/proctored/multi-question exam tooling are not implemented. Exported learner files cannot be remotely revoked.
