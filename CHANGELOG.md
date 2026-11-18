# Changelog

## 0.13.0-alpha.1

- Add server-enforced scheduled publishing for every entry type and optional completion deadlines with overdue/late reporting.
- Add Philippine-time instructor controls and student captions; date edits preserve grades/revisions. Schema 8 adds nullable dates; Windows demo schema 12 stays separate.

## 0.12.0-alpha.1

- Add explicit account-revalidated Sync and Sign out all devices across the shared API, APK and web client.
- Deny student protected-file download grants, including legacy offline flags; display web PDFs as bounded page images without original-file export.
- Pair Windows organization mode through the same contract; preserve separate desktop grouping/demo data and signing identities. See docs/SHARED_ACCESS_SYNC.md.

- Bind Streamlit sessions to the issuing API origin; clear unbound/reconfigured sessions before requests.
- Add explicit online sync, retained subject/material edit snapshots, reload controls, changed-assessment review and visible-intent reading actions across tabs.
- Reject supplied stale revisions for reading, legacy quizzes and written submissions without changing SQLite schema or older Android clients. Require the advertised backend capability in the updated student portal.
- Gate Android test publication and signed candidates on web regression tests. Live hosting, browser/device and signing acceptance remain separate gates.


## Unreleased — Streamlit materials portal

- Add a Python 3.12 Streamlit client for shared Academy accounts, subjects, material drafts, private PDF uploads/replacements, publication, student reading/progress, enrollment eligibility and existing inline assessments.
- Reuse the existing API/storage/authorization without database or Android changes. Keep subject/progress above a scrolling content area; use the white/navy/gold theme.
- Add bounded transport, per-session state cleanup, PDF integrity checks, web integration CI and deployment documentation. Live Streamlit/API/Drive setup and real-browser checks remain operator gates.

## 0.11.0-alpha.1

- Pin the current subject title and student progress outside the scrolling content; keep public subject context fixed too. Move the description to Subject details and retain the fixed navigation/Results destination.
- Standardize text across screens, readers, choices, editors and native dialogs: start alignment, medium headings, 1.4 body line height, 1.2 heading line height, and 12 dp paragraph spacing without altering original text or links.
- Use 16 sp lesson text, consistent card headings/insets, paragraph lead-in emphasis and hanging lists. Preserve existing blank lines and avoid compounding spacing on refresh.
- Add native rendered paragraph/link checks and scroll-position assertions for the fixed subject/progress; release includes reader and pinned-header screenshots.

## 0.10.1-alpha.1

- Fix the public header's full-width Sign in button collapsing the brand into an oversized blank block; constrain brand labels to single lines.
- Show all 25 practice entries with Read, Take quiz, Take activity and Take examination actions instead of the five PDF handout cards. Keep existing saved files intact.
- Preserve the selected assessment through local sign-in and rotation, then authorize and open that exact form. Keep account lesson text behind Read; retain compact result/review cards.
- Gate test publication on Android emulator checks for the header at 200% fonts and the public Read → quiz → sign-in → submit → result flow.

## 0.10.0-alpha.1

- Add native selection forms for quizzes, activities and examinations, bounded question authoring, server/local trusted scoring, private answer drafts, idempotent submissions and compact result/review cards.
- Convert the AE 101 template to 16 forms / 40 questions while retaining old revisions and edited work; generated PDFs now contain lessons only.
- Add schema v7 server storage and v4 local backup/migration; preserve legacy written and single-question quiz workflows.
- Align secondary actions and card text; normalize padding/title spacing, hanging list indentation, and sectioned Help with separate build details.

## 0.9.1-alpha.1

- Replace factory examples with one AE 101 subject: four periods, eight lessons, eight quizzes, four activities and four four-question written examinations, plus a course guide.
- Import local practice content and generate public catalog/PDF handouts from a single original subject-template asset; remove B/C from the bundled catalog/assets.
- Upgrade unchanged legacy factory content in place with stable IDs and new revisions; back up local v1/v2 state before atomic v3 migration, retain historical records and preserve edited/instructor work.
- Verify full-course submissions/grading, answer isolation, template counts, migration preservation/rollback and deterministic handout/hash generation. Add subject build and focused-edit guidance.

## 0.9.0-alpha.1

- Reinforce admin-led registration with bounded attempts, validated identities and explicit allowed fields; require an actually different temporary-password replacement.
- Persist separate normalized-account and TCP-peer authentication budgets across restarts; make account/credential/session/audit writes atomic.
- Upgrade SQLite to v6 with private creation, one pending-migration transaction and fail-closed integrity checks; retain all existing domain records.
- Reject deceptive/encoded-control links in backend and Android policies; review unfamiliar hosts and HTTP destinations before fresh authorized handoff.
- Adopt shared AGENTS v1.4, Constitution v3.2 and kickoff v1.3 while retaining Academy-specific rules; add focused edit and security acceptance guides.
- Add abuse, restart, migration rollback, audit-failure and URL regression coverage. Physical-device/deployment/signing gates remain explicit.

## 0.8.3-alpha.1

- Keep workspace/public headers and tab controls mounted instead of resetting the activity view on each tab change.
- Remove the workspace vertical slide and restore content positions before drawing; retain tab/page offsets through rotation and subject-list placement through its existing layout state.
- Reserve the loading indicator height and delay display by 150 ms; remove expanding status text and skip repeated taps on the active public tab.
- Move account identity into Menu, shorten routine copy/actions and progress summaries, and remove duplicated field hints while keeping persistent labels.
- Keep meaningful error notices, course content, scores, accessible progress details and submission/destructive confirmations. No data schema or dependency changes.

## 0.8.2-alpha.1

- Keep the workspace header and role-aware bottom navigation visible while learning content scrolls; add a direct return to My subjects.
- Refine white cards on a pale background, active navigation, focus outlines, ripple feedback, quiz answer targets and accessible headings.
- Add persistent form labels, password visibility, keyboard sign-in, required-field errors and password retention after failed sign-in.
- Show request progress and disabled action states; simplify public-library copy, add search counts/clear-search recovery and inline PDF download progress.
- Add an empty announcement state and document device acceptance checks. No data migration or new dependencies.

## 0.8.1-alpha.1

- Temporarily allow screenshots/screen recording of account screens and the in-app PDF viewer for development feedback, as requested.
- Centralize the temporary policy in SCREEN_CAPTURE_ALLOWED so capture protection can be restored after feature refinement.

## 0.8.0-alpha.1

- Add HARU-style handle-only subject dragging with live swaps, measured row heights, stable IDs, edge scrolling and saved per-account/per-origin personal order.
- Add accessible move commands and tappable subject cards; keep new subjects at the end and remove revoked IDs from the view.
- Make subject/entry + backgrounds transparent; refine font hierarchy, text boxes/dropdowns, form/card padding, centered panes and navigation transitions.

## 0.7.0-alpha.1

- Replace multiple material forms with bottom + → type/text → Done, a compact entry menu, drag sequencing and accessible move commands.
- Save ordering without invalidating learner work; retain history when entries are deleted.
- Change local defaults to admin/admin, instructor/instructor and student/student; migrate unchanged defaults and retain custom passwords/data.
- Add transactionally migrated backend ordering and conflict checks, local migration/ordering tests and lifecycle draft restoration.

## 0.6.0-alpha.1

- Add device-local default admin/instructor/student test accounts and role picker in debug APK.
- Persist shared test subjects, material links/PDF uploads, enrollment, reading/completion, submissions, assessment and XLSX reports across role switches.
- Add synthetic practice subject, admin-managed account creation/reset, confirmed local reset, and workflow/permission regression tests.
- Keep organization backend authentication and release builds free of active default accounts.

## 0.2.0-alpha.1 — 2026-10-19

- Authorized public source delivery; replaced sample subjects with generic A/B/C.
- Added admin/instructor/student workspace, account registration/access/reset/enrollment, and global announcements.
- Added draft/publish/creator-owned materials, activities, server-scored quiz submission, and per-student completion.
- Added a portable account backend, organization Shared Drive adapter, Keystore session storage, and protected viewer handling.
- Added actual HTTP/SQLite authorization/integration tests and corrected CI SDK/theme compatibility failures.
- Live backend/Drive credentials, persistent signing, and physical-device validation remain outstanding.


## 0.1.0-alpha.1 — 2026-10-19 — source implementation

- Added subject catalog, resource search, QR/manual subject entry, and three-destination native Android UI.
- Added original sample materials/text companions for AE 413, AE 417, AMT 212, and AMT 412.
- Added validated catalog updates with last-valid cache and stable IDs/revisions.
- Added persistent, unique background PDF downloads, cancellation, size/hash/readability checks, and offline reading/removal.
- Added source/core/catalog tests, Android build configuration, private-only CI/candidate release automation, and operational documentation.
- Android build/release/device/organization validation blocked or pending; no APK/stable readiness claimed.
