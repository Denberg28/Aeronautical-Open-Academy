# 0.3.0-alpha.1 scope and acceptance

Public source and development APK delivery to `Denberg28/Aeronautical-Open-Academy` is authorized. Baseline: published main commit `4cd1fbc95753ff0d16cc4c2a58190e7a220912ed`, test APK 0.2.0-alpha.1-test.6. Preserve package identity, public Subject A/B/C catalog, private file authorization, existing accounts and records. No production backend, signing key or organization Drive access is assumed.

| Capability | Admin | Instructor | Student |
| --- | --- | --- | --- |
| Account registration, roles, suspension, deletion, reset | All with self/last-admin safeguards | No | No |
| Subject enrollment | Enroll/remove/restore any student | Open/close self-enrollment for own subject | Join open subjects as self |
| Subject and learning content | All | Own subject; creator-owned material edits/downloads | Enrolled, published items only |
| Reading progress | Oversight | Own roster | Self-report read/unread |
| Written activity/examination | Oversight | Publish, inspect outputs, grade 0–100 and give feedback | Submit own written output once per revision |
| Quiz | Oversight | Author; inspect submitted choice/result | One server-scored answer per revision |
| Results/compliance/Excel | All subjects | Own subject roster and per-student work | Own results only; no roster/export |
| Announcements | Publish/archive | Read | Read |

## Minimal flows

Student: sign in → enrolled subjects with progress bars → learning items → read / submit output or quiz → My results and feedback. Left Menu → Enroll subjects lists only opt-in subjects not already joined. A subject QR identifies a subject; it never grants enrollment. Administrator removal blocks self-rejoining until explicit administrative restoration.

Instructor: create subject → add draft PDF, written activity, quiz or written examination → review/publish → open enrollment if intended → Students & compliance → review a student's output → score and feedback → export this roster page to Excel. Closed enrollment is the safe default. No other instructor's roster or protected material becomes visible.

Admin: register accounts and assign ownership → manage enrollment/access → oversee learning and announcements. Account deletion removes learning records, including written outputs; authored material is retained for review.

## Measures and interfaces

Only current published, nonarchived item revisions count. `read_percent` = self-reported read materials / materials. `compliance_percent` = submitted written activities, examinations and quizzes / published assessments. `completion_percent` = read materials + submitted assessments / published items. Empty denominator gives 0%, with counts shown. Submitted is distinct from graded; zero is a valid recorded score. These measures do not imply mastery, a passing grade, a qualification or overdue status.

Written work is plain text, at most 12,000 characters, one final submission per revision. Examinations are instructor-graded written responses. Quiz items remain one multiple-choice question each (two Android authoring choices, 2–6 API choices). No file attachments, timed/proctored exams, retakes, deadlines, weighted course grade, certificates, public registration, private offline synchronization, or multi-question quiz editor in this increment.

JSON APIs add discover/enrol, subject learners/detail/export, item submission and submission grade endpoints. SQLite v1 → v2 is additive and transactional; reopening v2 does not rerun migration. Existing public/Android package identities and material-store interfaces remain. Deploy the matching 0.3 backend and Android client together; the older client's activity checkmark is rejected by the new submission rule.

Excel export is an actual OOXML `.xlsx` file with Summary, Assessments and Report notes sheets. Exports cover up to 100 roster students per file and all current published items (maximum 200 per subject); metadata states total, offset and next offset. Instructor can advance through roster pages. Values are literal strings or numbers, never generated formulas, external links or macros. Export contains confidential identity/results/feedback, not answer keys or full written outputs. It is saved explicitly to the user's selected Android document destination.

## Failure and recovery

- Network failure never fabricates enrollment, submission, score or completion. Refresh retries reads. Exact submission retries reuse a deterministic key; changed content with the same key is rejected.
- Written drafts are encrypted with the device Keystore and saved on dialog close/rotation; reopening the same item revision restores them. Sign-out/session invalidation clears drafts. A device storage/key failure is reported; offline final submission is unavailable.
- Submissions are immutable. Editing instructions increments revision and requires new reading/submission; prior records remain in the database for retention review, but the UI/export displays current revisions only.
- Grade saves include the last grading timestamp. A competing edit returns 409; refresh before editing again. Grade changes are audited.
- Removed/suspended/deleted access fails on subsequent server requests. No promise of instant recall of previously displayed/exported bytes.
- Interrupted Excel download is not written as a successful report. Destination write failures are reported; the user may need to remove the incomplete destination file and retry.
- Stop service and take a consistent database/material backup before upgrade. Older server refuses schema v2; restore the matching backup/server pair for rollback. Never silently downgrade data.

## Measurable acceptance gates

1. Closed subjects cannot be discovered or self-joined; opening shows only title/description/ID to active students. Join is idempotent and uses authenticated identity. Administrator removal blocks rejoining.
2. Student home shows only enrolled subjects with progress bars. Left dropdown includes enrollment, own results, announcements and account actions. Signed-in relaunch opens workspace; public samples remain accessible.
3. One read material plus submitted activity/exam/quiz yields 100% participation completion while awaiting instructor grading remains visible. An incorrect quiz and a zero written grade never become a pass or disappear as ungraded.
4. Activity/exam checkmark shortcuts are rejected. Submission retries do not duplicate work; changed replay or second submission fails. Student cannot forge score, grade another student's work, or read another student's results.
5. Instructor can review enrolled students' current outputs/choices, grade written work and return feedback. Another instructor/student cannot access roster/detail/export. Revoked enrollment removes roster detail access.
6. Report is a valid ZIP/OOXML workbook with correctly typed numeric scores, escaped literal formula-like names, no formula elements and explicit roster metadata; export is audited and no-store.
7. v1 migration preserves account/subject/item IDs, enrollment, file references, progress and attempts; v2 reopens safely. Newer incompatible schemas are refused.
8. Public QR/catalog/PDF checks, backend integration, Android build/lint/JVM tests and focused secret checks pass on published source. No critical/high known defect is accepted for test publication.
9. Physical-device camera, TalkBack/200% fonts, menu/draft/document-picker rotation and process recovery, install/upgrade, HTTPS/backend load/restore and real organization Drive gates pass before stable. No control hardware is driven; actuator HIL is N/A.

Performance targets remain public startup ≤2 s (4/5 device runs), QR routing ≤100 ms, account API ≤2 s excluding hashing/file transfer on the reference deployment, PDF ≤50 MiB, API write body ≤64 KiB, Android JSON response ≤8 MiB and Excel transfer ≤16 MiB. These are targets; device/deployment measurements are pending.

## 0.4 enrollment and design revision (supersedes 0.3 open-subject rules)

Baseline is public `6786eb73c87161d8843227b473cde5d711df2678` / `0.3.0-alpha.1-test.7`. The user now requests instructor ID eligibility or All students, QR-triggered enrollment, spacious white/navy/gold UI, full code review and a new authorized test release. Package identity, catalog IDs, approved baseline data and signing configuration are preserved.

Admin registers each student with a verified unique student_number or assigns it to an existing account. IDs normalize to uppercase, preserve leading zeros, and accept 3–32 ASCII letters/digits/hyphens. Students cannot write that field. Instructor subject → Enrollment eligibility → IDs or All students → Save. Up to 1,000 IDs; unknown IDs may be pre-authorized for later registration. Empty list plus unchecked All is closed. All includes active registered student accounts, including migrated accounts awaiting ID assignment.

Student → left Menu → Scan subject QR / Enter subject code → sign in/change temporary password if needed → server checks eligibility/block → idempotent enrollment → subject and progress. Signed-out/401 paths keep the pending QR target for retry after sign-in; saved instance state preserves it across recreation. Network errors never fabricate enrollment. An ineligible scan shows a concise recovery instruction. QR never supplies organization origin, account number, role, token or material URL.

New automatic enrollments are removed by a narrower eligibility rule; progress/results are retained for authorized later restoration. Explicit administrator and migrated legacy enrollments are retained overrides. Administrative removal blocks any QR/self rejoin until admin restoration. ID correction/deletion removes old-number allowlist entries, revokes new automatic enrollments, increments affected policy revisions and ends target sessions; correction preserves work, deletion removes learning records. Changing IDs is therefore a consequential administrator operation described in the UI.

New API: GET/POST /v1/subjects/{id}/eligibility with all_students, student_numbers and expected_revision; creator/admin only. /enrol uses current database identity, ignores client ID claims and optionally records source=qr. Legacy authorized instructor self_enrol edits map to All/closed. SQLite v3 adds student numbers, eligibility tables/revisions, enrollment source and item edit_version. Stale item/eligibility edits and overlapping material upload completion return 409. Subject owner/admin may grade enrolled active learners without acquiring permission to edit another creator's materials.

Additional acceptance: ID spoof/duplicate/invalid formats denied; instructor cross-subject policy denied; eligible QR joins once and ineligible QR is denied; All honors active student role and admin blocks; list removal revokes auto access; explicit/legacy admin overrides survive; v1/v2 → v3 keeps existing files/results; audit-write failure keeps prior PDF; concurrent upload/edit does not overwrite newer data; builds/linters/tests and known-defect publication gate pass. Actual camera, scan-before-login, required-password flow, denial/retry, rotation/process recreation, document-picker state, TalkBack/200% fonts and private-view reauthorization must pass on a real phone before stable.


## 0.5 simplified link-to-knowledge increment

Baseline public commit aa932b8b200e749c5e015bfcf84aa28ba68a20c9 / APK 0.4.0-alpha.1-test.8. The user requests Google Docs/Slides/PDF/Excel/YouTube/site references and automatic HTTP/HTTPS hyperlinks in subject text with minimal entries/buttons. Preserve eligibility, roles, grades, public sample IDs, stored files and package/signing configuration.

Instructor uses one material text field plus publish control; the first line is its title. Web references in subject descriptions and item text render as short underlined provider/host labels with ↗, HTTP identified explicitly. No separate URL/type form or per-link Open button. Subject text can be edited from the left menu. Students intentionally tap a reference; current server authorization and exact-reference/version checks precede external ACTION_VIEW handoff. Opening does not mark reading. Only creator/admin edits materials; subject owner/admin edits subject text.

A new core helper parses public HTTP/HTTPS text and compact labels. Server validates references independently, returns canonical URL JSON only, never fetches or redirects to supplied sites. No embedded webview, file proxy, permission mutation or Academy credential forwarded. Unsafe schemes, credential URLs, literal IP/local hosts and custom ports stay noninteractive/are rejected. Provider redirects and sign-in/sharing/downloads remain outside app control.

SQLite v4 adds text versus file material mode, defaulting existing items to file. Text links stay in existing body/description storage. Existing files/data/IDs/source authority survive v1/v2/v3 migration and v4 reopen. Link-only backend mode initializes no Drive/file adapter and is supported in production, still behind HTTPS with persistent private account/database storage. Optional PDF adapters remain for legacy uploads; absent adapter yields guidance. No cloud deployment or real provider permission is assumed.

Acceptance: one-field creation/edit/publish/archive succeeds; multiple links and punctuation render correctly; docs/slides/sheets/Drive/PDF/Excel/video/sites and HTTP are supported; no duplicate open buttons/title; unsafe addresses are nonclickable; enrolled published access only; other instructor writes, injected/stale URL, draft, suspension and revoked enrollment fail; opening is not reading; link edits reset current reading; same-URL host changes remain external. Links-only production startup works without Drive secrets or file folder, and existing PDF flows remain tested with adapters. Build/lint/core/security/migration checks gate the authorized development release. Actual browser/provider permissions, accessibility and return/resume remain required device tests before stable.
