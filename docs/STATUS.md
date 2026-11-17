# Current development checkpoint

Goal: improve alignment/spacing from screenshots and deliver native selection forms for quizzes, activities and exams, with automatic scores and compact completed cards. Assessment questions must not be distributed as downloadable text/PDFs.

Repository: Denberg28/Aeronautical-Open-Academy. Baseline e7abeb89735d81f45e3e0fe2da467f8dc98a80a1 (verified 0.9.1 test.79). Branch feature/assessment-forms-0.10.0. Standing source/PR/prerelease publication authorized; no signing-identity or live database changes authorized.

Implementation in progress: bounded choice-question model/scoring, optional server questions column and submission route, local schema v4 migration preserving edits/history, native reader/editor, template conversion, lesson-only handouts, text layout cleanup. Existing written/legacy quiz workflows remain compatible. New choice forms require the matching server capability.

Checks pending: local backend/content tests, Android JVM/build/lint, complete form permissions/retry/scoring/migration regressions, final CI and release. Physical phone layout and installation remain unverified. Continue from the local working tree; do not regenerate or overwrite unrelated source.

Implementation checkpoint: forms engine/server/local routes, template v2 conversion, native reader/editor and alignment/Help changes are in the working tree. Host backend 40, JVM 34 and Python 12 checks passed. Android SDK/wrapper download is unavailable locally; next commit/push the reviewed branch and inspect Android CI before PR merge and prerelease. No physical-device validation is claimed.
