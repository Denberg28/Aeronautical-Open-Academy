# 0.9.1-alpha.1 — one complete subject build template

Open **AE 101 - Foundations of Aeronautical Engineering** using the existing local instructor/student accounts. The student is enrolled automatically in the practice template. The public library uses code A and provides an overview plus Prelim, Midterm, Semifinals and Finals handouts.

Each period contains two lessons, two quizzes, one activity and one examination: eight lessons, eight quizzes, four activities and four exams in total, plus a course guide. Activities include explicit outputs and rubrics; examinations each have four questions. Each quiz uses the current single-question format. Written work is instructor-rated /100; suggested category weights are planning guidance, not automatic course grading. All examples are original fictional classroom exercises, not an approved syllabus.

The old B/C public entries and bundled handouts are removed. Unchanged local factory content upgrades in place, preserving its subject/item IDs and historical results with new content revisions. Edited or extended subjects remain as instructor work, with the new template added once. Existing offline copies stay in Downloads until removed. Reset is optional and deletes local test work.

Local workspace schema v3 saves an app-private workspace-before-template.json backup before migration. Downgrade requires the matching prior state/files backup and APK/signing identity; older APKs reject v3. See docs/SUBJECT_TEMPLATE.md for structure, authoring, scoring and rollback. Existing backend/security behavior remains included; no organization database is changed.

Development test prerelease. Required CI verifies template/PDF/catalog synchronization, full-course submissions and assessment, migration preservation/failed-upgrade recovery, existing core/backend regressions, Android build and lint. Check the final run and verification.json. Phone PDF appearance, keyboard, scroll, accessibility, installation/upgrade and live organization services remain NOT TESTED/BLOCKED; this is not a validated stable release.

Rollback source: e20031b26ec9bf40a45d140b1af8e9642ca845fd, v0.9.0-alpha.1-test.73. Signing identity is not changed by this work; debug CI certificates can differ across builds.
