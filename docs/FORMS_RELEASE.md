# 0.10.0 selection forms and layout

The current user request combines screenshot-based alignment/spacing fixes with Google Forms-style assessments: clickable selection, submission, immediate result, compact completed cards, and no assessment questions in downloadable text/PDFs.

The AE 101 template has 8 one-question quizzes, 4 four-question activities and 4 four-question examinations: 16 forms and 40 questions. It retains its course guide and 8 lessons. Lesson PDFs are still optional downloads. Public **Open assessments** leads to the authenticated local test workspace; no anonymous grade submission or organization access bypass is added.

## Interfaces and ownership

- `questions`: 1–20 objects, each with prompt, 2–8 distinct options and a creator-only zero-based correct index. Android/local and server validators bound prompt/choice sizes and reject invalid/ambiguous authoring data.
- `POST /v1/items/:id/answers`: authenticated enrolled active student, published current item, exact expected revision, full integer answer array and idempotency key. The trusted server/local workspace computes correct/total and score /100; client-supplied scores are ignored.
- Repeat of the same account/item/revision/answers/key returns the existing result. Changed answers/key reuse, second submissions and stale revisions fail without replacing work. Written/legacy quiz submission paths reject new forms; manual grading cannot overwrite automatic scores.
- New clients send `X-Academy-Features: choice-forms-v1`. An older client receives a clear update-required 409 before any form payload, preventing legacy option readers from crashing. Legacy content stays readable.
- Students receive prompts/options and their own submitted answers/results; answer keys stay in creator/admin responses. Reports distinguish form score maximum 100 from legacy quiz maximum 1. Reading completion is not achievement.
- Student answer drafts are device-local encrypted values keyed by account/item/revision, saved when leaving the form or pausing. They are cleared on successful submission or sign-out. Reopening/recreation fetches the current authorized item before showing a draft/result. Unsubmitted answers never count as work.
- Restored instructor editors are bound to the saved account ID, current creator role and current item ownership. Student/foreign-account restoration is discarded; authoritative write checks remain on the service.
- New authoring uses native question/choice fields and correct-answer radio controls. Existing question collections are immutable, matching the prior quiz-answer policy; create a new assessment to change questions/keys.

## Migration and rollback

Server schema v7 adds nullable `items.questions_json` transactionally and reuses submissions for scored form responses. Prior quiz attempts, written submissions, IDs, security limits, files and enrollment remain intact. Older servers reject v7. Deploy only after a consistent stopped-service backup and restore check; this development session does not migrate any live organization database. Downgrade requires the matching prior database backup/server.

Local schema v4 writes `workspace-before-forms.json` before migration. Only untouched published template entries are converted with new revisions. Historical results are retained; edited published assessments stay intact, with a new canonical form appended. Archived/unpublished entries are not resurrected. Reset remains explicit and removes local data and migration backups. Older APKs require the prior state/files snapshot and matching signing identity.

Catalog version 3 advances overview revision to 3 and period handouts to 2; generator output contains only course overview/lesson text, never form questions. Existing offline copies are not silently deleted. Canonical questions are original synthetic practice content; do not add real protected keys to public source.

## Verification

Baseline: e7abeb89735d81f45e3e0fe2da467f8dc98a80a1, verified v0.9.1 test.79. Host checks: backend suite including all 16 form types and trusted-score/permission/retry tests; JVM local suite including 40 correct selections, mixed score, invalid/stale/partial/cross-role submissions, report/grade isolation and v3 migration preservation; canonical template/PDF synchronization; existing source, catalog, security and workflow regressions. Android build/lint and final package gates run in CI; final run evidence is authoritative.

Phone acceptance remains required: at 320 dp, landscape, tablet and 100%/200% fonts, compare screenshots for start-aligned secondary actions, card/text edges, section spacing and Help numbered-step indentation. Verify native form selection, keyboard in the author editor, required-answer focus, Cancel/Review, confirmation, duplicate taps, slow/failed requests, result collapse, read-only review, rotation/background/relaunch drafts, revoked enrollment/session while open, and separate accounts. Explicitly rotate an instructor draft, expire its session, sign in as a student/another instructor, and verify the editor/key is not restored. Check legacy written work, long lessons/links, PDF appearance, template migration, sign-out draft clearing and compatible installation/upgrade. No frame-time, emulator or physical-device result is implied by source/build tests. Actuator HIL is N/A (education app).

Release tier: development test prerelease until device, deployment and signing gates pass. Keep the prior APK/source and consistent private backups for rollback; no signing identity is changed here.
