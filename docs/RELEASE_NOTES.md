# 0.6.0-alpha.1 — local account workflow test APK

This development build adds default admin, instructor and student accounts that work on a single phone without a deployed server. In Account workspace, select Local test accounts → choose role → Fill test account → Sign in. All three use `AcademyTest2026!` with `admin@academy.test`, `instructor@academy.test`, or `student@academy.test`; student ID `TEST-001`.

Admin can register more accounts and manage access/enrollment. Instructor can create/edit/publish/archive links, text, PDF uploads, written activities, quizzes and examinations, manage eligibility, assess work and export an Excel report. Student can read materials/PDFs, mark reading done/undo, enroll in eligible subjects, submit work and quizzes, and view results/feedback. A seeded practice subject is ready to use. Sign out to change roles; local work persists. Reset local test data confirms deletion before restoring defaults.

Test mode is isolated from organization accounts, has no network listener and is disabled in release builds. Production backend credentials and setup are unchanged. Synthetic data only; test work does not sync to another phone or server. External links need internet and provider permissions. Automated workflow checks and Android build results are recorded in CI; physical-phone UI, file pickers, PDF rendering, provider handoff and upgrade validation remain NOT TESTED. This is a development test APK, not a stable release. CI debug certificates can differ from an existing install; uninstall may be needed, which clears that installation’s test data.

Rollback: retain the preceding test APK. Organization backend/schema is unchanged. Uninstall/data clearing deletes the local sandbox; exported files remain at the chosen destinations.
