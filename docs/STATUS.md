# Current development checkpoint

Goal: improve alignment and spacing from screenshots and deliver native selection forms for quizzes, activities and examinations, with automatic scores and compact completed cards. Assessment questions are excluded from downloadable text/PDFs.

Repository: Denberg28/Aeronautical-Open-Academy. Baseline e7abeb89735d81f45e3e0fe2da467f8dc98a80a1 (0.9.1 test.79). Branch feature/assessment-forms-0.10.0, PR #7. Standing source/PR/prerelease publication is authorized; no signing-identity or live database changes are authorized.

Implemented: bounded choice-question model and scoring, server schema v7 and answer route, local schema v4 migration preserving edits/history, native reader/editor, encrypted account-bound drafts, template v2 with 16 forms / 40 questions, lesson-only handouts, and alignment/Help cleanup. Existing written and legacy quiz workflows remain compatible. Organization forms require the matching server capability; no live server was deployed.

Verification: host backend 40, JVM 34, Python 12 and core 93 checks passed. Android builds, lint, unit tests, content/backend checks and packaging passed on source commit 35c1dd1136868a36c648fc56e5a2d77355210b4c in both push run 44021584602 and PR run 44021591780. This includes final account/role/ownership protections for restored instructor drafts. Physical phone layout, keyboard/TalkBack, lifecycle and signed upgrade are NOT TESTED.

Next executable step: merge PR #7 after the documentation checkpoint checks pass; verify the main workflow and its versioned 0.10.0-alpha.1 test release. Keep the release a prerelease pending the device procedures in docs/FORMS_RELEASE.md. Release publication status belongs to the PR/workflow/release records, so this checkpoint does not claim publication in advance.

Local CLI push lacks credentials; the connected GitHub API preserves the remote parent and uploads the matching local source tree. Do not overwrite unrelated changes. See docs/FORMS_RELEASE.md for compatibility and rollback; schema downgrade needs the preserved backup.
