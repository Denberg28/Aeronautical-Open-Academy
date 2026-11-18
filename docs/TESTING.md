# Verification — 0.5.0-alpha.1

## Web session and sync safeguards — 18 November 2026 (Asia/Manila)

Baseline `af0188a`; branch `fix/web-session-sync`, version 0.11.1-alpha.1. Python 3.12.14, Streamlit 1.67.0, Node 24.22.1. No schema or live service mutation. Local host evidence: 14 web tests, 41 Node tests, 12 catalog/release/template tests, 93 core checks, Java syntax for 29 files, project checks, candidate gate and diff checks PASS. Android build/lint/JVM/emulator checks are required in CI; physical browser/phone, deployed API/Drive and signed upgrade remain NOT TESTED here. Actuator HIL is N/A for education content.

Web tests cover changed/unbound origins making zero credential-bearing requests, same-account progress across tabs, visible reading intention, stale reading rejection, retained material/subject drafts after sync and 409, explicit reload, updated assessment review, backend capability refusal, permission-controlled PDF download denial, and existing login/publishing/revocation/score/integrity flows. HTTP tests exercise stale/malformed revisions before any persisted progress/attempt/submission, successful current writes, duplicate-key replay and old-client omission. Android and signed candidate workflows run web tests before packaging/publication; the standalone web workflow still verifies the portal/API on relevant changes.

Before institutional use, repeat those workflows in real desktop/mobile browsers against the updated persistent HTTPS API. Keep two sessions open, update a lesson/assessment in the other, and verify draft preservation, explicit reload, no silent overwrite, correct completion and no duplicate final work. Change the operator API origin and verify sign-in is required with no prior credential sent to the new origin. Verify intended Android accounts see the same online progress, while synthetic local accounts remain separate. Check keyboard/focus, long-form input, PDF rendering and interrupted requests. Windows local databases remain on their independent desktop branch; no cross-lineage migration/sync is established by these tests.

## Streamlit web addition — 18 November 2026 (Asia/Manila)

Baseline `655847a`; branch `feat/streamlit-materials`; final implementation source is the PR commit. Local environment Python 3.12.14, Streamlit 1.67.0 + streamlit-pdf 2.1.0, Requests 2.32.5, Node 24.22.1. CI uses Node 24.19.0. No Android/backend source or schema changes.

| Gate | Status | Actual evidence |
| --- | --- | --- |
| A/B/D — Web source/behavior/integration | PASS, simulator tested | 8 unittest/AppTest tests against a real temporary loopback Node API/SQLite: sign-in/out/password cleanup, create/publish/read/revoke, draft isolation, PDF byte/hash round trip, stale upload, student/outsider denies, viewer component emission, incomplete-choice rejection and trusted score; transport origin/network/redirect/corrupt PDF checks |
| C — Existing API regression | PASS, host tested | 40 Node tests; 12 existing Python catalog/release/template tests; project configuration/content checks |
| E — Physical actuator HIL | N/A | Education portal controls no equipment |
| F — Live deployment / browser UI / real Drive | BLOCKED / NOT TESTED | Streamlit dashboard requires sign-in; persistent HTTPS API host/Drive configuration absent. No real-browser PDF pages/file-picker event or production restart/restore claims |
| Android compilation / physical phone | NOT TESTED locally | Android unchanged; existing CI and real-device gates still apply |

Run `python -m unittest discover -s web/tests -p 'test_*.py' -v` after installing root requirements; `npm test --prefix server` covers backend regressions. `.github/workflows/web.yml` repeats both. See STREAMLIT.md for acceptance, local setup, failure/recovery and operator verification. These checks do not establish stable production readiness.

Evidence must distinguish host checks, Android compilation/lint, local HTTP backend integration, mocked Drive adapter behavior, physical devices, and real organization access.

## Current matrix

| Check | Status | Evidence / limits |
| --- | --- | --- |
| Public source destination | PASS | User explicitly authorized public repository; no protected data included |
| Pure Java QR/URL/transfer/link core | PASS | 72 checks; docs/evidence/core-checks.txt |
| Catalog publishing validator | PASS | 10 tests including release gates; docs/evidence/python-tests.txt |
| XML/assets/wrapper/focused secret scan | PASS | docs/evidence/project-checks.txt |
| Backend HTTP/SQLite role/security flows | PASS | 21 HTTP/API tests, 3 migration tests, 2 link tests and 1 startup test; docs/evidence/backend-tests.txt |
| Drive adapter credential isolation / redirect tests | PASS | 2 mocked-upstream tests; not real Google access |
| Android build/JVM tests/lint for final source | NOT TESTED | At documentation authoring; per-commit CI artifact verification.json and Actions results supply actual build evidence |
| Physical device/runtime/camera/accessibility/lifecycle | NOT TESTED | No attached Android device/emulator |
| Live account backend | BLOCKED | No hosting destination/HTTPS deployment configured |
| Optional stored-PDF Drive adapter | NOT TESTED for real Drive | Credentials/real access absent; not needed in links-only mode; mocks are separate |
| Retained release signing/install/upgrade | BLOCKED | No release keystore/secrets configured |
| Actuator/flight-control/motor HIL | N/A | Education app controls no equipment |
| Stable promotion | BLOCKED | Required deployment/device/signing/real Drive gates incomplete |

## Automated checks

```sh
python3 tools/release_gate.py --test-build
sh tools/core_checks.sh
python3 tools/project_checks.py
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm test --prefix server
java tools/ParseJava.java $(find app/src -name '*.java')
./gradlew --no-daemon :app:coreChecks :app:testDebugUnitTest :app:lintDebug :app:lintRelease :app:assembleDebug :app:assembleRelease
```

Source parsing is not Android compilation. Backend tests start actual HTTP servers and SQLite databases; scrypt fixture cost is deliberately lower than production. Drive tests mock Google endpoints and generate a test-only RSA key, so no organization credential is used. Android JVM catalog tests exercise the real parser with test-only org.json; platform integration remains a device check.

## Runnable Android/role validation

1. Build debug APK, `adb install -r app/build/outputs/apk/debug/app-debug.apk`, then launch `org.aeronautical.openacademy.test/org.aeronautical.openacademy.MainActivity`. Record commit/APK SHA-256/certificate, phone model/OS/RAM, connection, backend version, and Drive setup.
2. Public samples: only A/B/C; scan aoa://subject/a or enter A; deny camera permission and use manual entry; save a sample PDF, force-stop/relaunch, and read in airplane mode. Invalid/unrelated QR must not open arbitrary sites.
3. Start the local backend from server/README.md; use debug emulator origin http://10.0.2.2:8787. For a physical device use the approved HTTPS origin; do not enable broad release cleartext access. Bootstrap admin privately.
4. Admin registers two instructors and two students. Each changes temporary password. Admin creates/enrolls access, publishes an announcement, and tests role change/reset/suspend/reactivate/delete. Old tokens must fail. Confirm self/last-admin safeguards. Deletion removes personal learning data, not authored materials.
5. Instructor A creates a subject, draft PDF/activity/quiz; uploads a PDF; verifies accessible text and publishes. Instructor B cannot read/manage A's subject or mutate material IDs through API calls. Unknown owner/role/score fields must never elevate authority.
6. Student A is enrolled and Student B is not. A sees only published items and no correct answer/file reference; B gets denied even with a valid account/QR. Reading protected PDF requires online permission; student private offline download is not offered.
7. Student A marks/unmarks material read and submits a written activity/examination; Student B's data stays separate. Manual quiz completion is rejected. Submit an incorrect answer with a forged score field: server still scores it incorrect and marks submitted, not passed. Replay the same request key: no duplicate attempt; new/change-answer replay is rejected.
8. Replace/upload a PDF during connection loss, suspension, or unenrollment. An interrupted or revoked upload must not publish a new file reference. Online viewing must fail after suspension/unenrollment on a new request. Current rendered/exported bytes are not promised instant remote revocation.
9. Test Android document pickers, rotation while selecting/uploading/exporting, background/resume/process death, 200% font size, TalkBack, RTL/landscape, rapid taps, 20 repeated request/view cycles, and a 30-page/10-minute PDF session. No credential in logs/backups/screenshots/private file shares. Verify secure cache cleanup and access recheck behavior on actual OS versions.
10. Test the organization Shared Drive adapter with intended membership/access levels: private create/upload/view/replace, denied permission, missing file, invalid PDF/size, rate/timeout faults. Confirm no sharing-permission mutation or direct private URL/key reaches the app. Mocks do not count for this gate.
11. Build two increasing versions with the same retained release key. Verify signature fingerprints, same-package upgrade, preserved public downloads, account sign-out/revalidation, and rollback limitations. Debug keys are not release identity.

## Evidence and promotion

For each acceptance criterion record source SHA, environment, procedure, expected/actual result, PASS/FAIL/NOT TESTED/BLOCKED, and evidence location. Use N/A only with a reason. Required failures block promotion; do not disable lint/tests to publish.

A test APK can be offered after candidate automated/build/packaging gates pass and no known critical/high defects remain, with unverified deployment/device scope explicit. Stable requires actual device, organization access, signing continuity, security/backup/hosting, and performance gates on final source/artifact. Never describe a debug APK as an institutional production release.

## 0.3 enrollment, gradebook, export and recovery procedure

1. With two instructors and two students, create a closed Subject A. It must not appear in student Menu → Enroll subjects; joining by UUID must fail. Owner opens enrollment; only title/description/ID appear in discovery. Student joins twice; one enrollment exists and student home shows only enrolled subjects with a progress bar. Admin removes student; rejoining is denied until admin restores enrollment.
2. Publish one material, activity, examination and quiz; keep another draft. Read material and submit all three assessments. Student summary must show 4/4 complete, read 100%, submitted 3/3, one auto-graded quiz and two awaiting assessment. Incorrect quiz is 0/1, not a pass. Manual activity/exam completion must fail.
3. Enter written work, save draft, reopen, rotate, background and recreate process. Draft must recover for the same account/item/revision while signed in. Sign-out or expired session must clear it. Test insufficient storage/Keystore error without falsely confirming a saved draft. Disconnect during submission, reconnect and retry exact text; no duplicate. Changed text with reused key is rejected.
4. Instructor opens Students & compliance, sees read/submission/graded counts, reviews output and selected quiz answer, saves zero grade with feedback. Student sees 0/100 plus feedback; awaiting-assessment decreases. Two clients edit a grade: second stale write must return 409; refresh to edit again. Other instructor and all students must be denied roster/detail/export/grade APIs.
5. Export a page to Android document storage. Open in actual Excel or LibreOffice: Summary, Assessments, Report notes; frozen header, numeric scores, literal formula-like names, valid Unicode, no repair prompt. Confirm total/offset/next offset and current-revision scope, no answer keys/full outputs. With 101 students export pages 1 and 2 and check no overlap/omission on unchanged roster. Document-provider cancellation, disk-full, rotation, network loss and session suspension must not show successful save for a failed export. Delete test reports after testing.
6. Edit instructions to increment revision. Prior output remains stored but current participation requires resubmission. Archive/unpublish removes item from denominator. Remove enrollment/suspend/delete and retry all endpoints; old access fails. Deletion removes written records and enrollment blocks. Retained backups need organization retention policy.
7. Back up a v1 database/material folder, start v0.3, verify schema v2 and preserved identities/files/attempts, restart again, and verify data unchanged. Older server must refuse v2. Practice restoring the complete backup with its matching server; do not downgrade in place. Measure API latency under intended enrollment/item volume before stable.

Host automated evidence: 16 Node tests (13 HTTP role/workflow tests, 2 mocked Drive tests, 1 migration test), including independent Python ZIP/OOXML parsing and formula-like string safety. Android compilation/lint/JVM results are supplied per source commit by Actions. Actual Excel UI, Android runtime/document providers, physical accessibility/rotation and deployment performance are NOT TESTED here; real backend/Drive/signing gates remain BLOCKED.


## 0.4 QR eligibility / UI / review verification

Additional host evidence: 23 Node tests (19 HTTP/security/workflow/fault-injection tests, 2 mocked Drive tests, 2 schema migration tests); 10 Python catalog/publication-gate tests; 40 pure Java routing/transfer checks. All production source reviewed as documented in CODE_REVIEW.md. Required build/lint/JVM packaging evidence is tied to the actual source commit in CI, not inferred from syntax checks.

| Acceptance | Procedure and expected result | Evidence status |
| --- | --- | --- |
| Verified ID identity | Admin assigns 0001-ab → stored 0001-AB; leading zeros kept; duplicate/invalid ID and non-admin identity write denied; enrollment body cannot claim someone else's ID | PASS, HTTP tests |
| ID-list / All rule | Owner saves list or All, other instructor/student denied policy; invalid/mixed/stale policy rejected; discover reveals only eligible subject ID/title/description | PASS, HTTP tests |
| QR join / retry authority | Repeated source=qr calls create one enrollment; noneligible/blocked/suspended/nonstudent denied; legacy/admin authority overrides preserved | PASS, HTTP tests; camera-to-login UI NOT TESTED |
| Policy revocation | Narrow All to ID list; nonmatching qr/self enrollments removed, subsequent access denied; retained work can reappear after authorized restoration | PASS, HTTP tests |
| Identity change / failure | Correct ID clears old grants/auto access and sessions but keeps work; delete removes ID/grants/work; injected database error rolls account edit back | PASS, HTTP tests |
| Storage/update conflict | Edit during upload and stale item write return 409; injected material-audit failure preserves original PDF/reference | PASS, HTTP tests |
| Upgrade persistence | Bootstrap published v1/v2 schemas; upgrade/reopen v3 preserves IDs, enrollment, files, zero score and feedback; unknown newer schema refused | PASS, migration tests |
| Publication gate | Normal test prerelease passes; HIGH/CRITICAL fixtures and stable/mismatched signed-candidate tags fail | PASS, Python tests |
| Requested colors/spacing | Inspect white surface, navy text/actions, gold progress/selection; verify text/counters accompany colors, 56dp targets, 200% fonts/TalkBack/narrow/landscape | Source reviewed; Android build/lint per CI; physical UI NOT TESTED |

Run this real-device path before stable:

1. Deploy matching 0.4 server privately over verified HTTPS; back up/migrate v2 to v3. Admin assigns two distinct verified student IDs. Create two instructor accounts. Record server/app source version, device/OS, APK hash/certificate and clock.
2. Instructor A → Subject A → Enrollment eligibility → enter only student 1's ID → Save. Instructor B cannot fetch/edit policy. Keep All unchecked. List is private.
3. Student 1 signed out → scan subject QR → sign in with temporary password → change it → sign in again. Pending QR must remain and enroll once, then open subject with progress. Repeat scan/relaunch/rotate/process recreation. Student 2 must be denied until added or All is checked. Account server origin must never change based on QR data.
4. Test camera denied/no camera/manual UUID/aoa code, malformed/foreign QR, offline sign-in/enrollment, server timeout, scan cancellation, rapid repeated scans, and scanner return during resume. No duplicate enrollment or misleading success. Network retry must use the same subject and current identity.
5. Open All, let student 2 join, then remove them by narrowing rule. Student 2 disappears from automatic roster/access while their work remains stored. Add/scan again to restore retained work. Admin promotion to explicit enrollment survives closure; admin removal blocks rejoin under All. Review migrated legacy overrides explicitly.
6. Correct a student ID through admin, confirm session termination and old allowlist/auto enrollment removal, then authorize/re-scan corrected ID. Delete account and confirm its ID/learning data is removed. Do not use real learner IDs in public screenshots/issues.
7. Open private PDF, suspend/remove access in another session, background/resume and turn page: old image must clear during failed check and controls disable. Already exported/currently visible bytes are not guaranteed instant remote recall. Reopen encrypted draft, rotate, test disk/key failure, and verify sign-out clears draft/token together.
8. On two instructor clients open the same item/eligibility. Save one, then save the stale other: 409 and refresh instruction. Start upload, edit item on other client: old upload must not replace newer content. Account registration validation/network failure must retain fields until successful save or user cancellation.
9. Check white/navy/gold screens at 200% font, TalkBack, RTL/landscape and small width, keyboard/document/scanner dialogs, student-home enrolled-only view, progress numbers, scores including zero, and Excel institutional IDs with leading zeros. Save report with Android document provider and open actual Excel/LibreOffice without repair prompt.

Camera/Android lifecycle/accessibility/document providers, native storage-failure behavior, actual Excel UI, live HTTPS/Drive, load/restore and retained production signing remain NOT TESTED or BLOCKED. Actuator HIL is N/A: no equipment is commanded. These limits permit a labeled development test release after automated packaging gates, not stable promotion.


## 0.5 inline links / intermediary acceptance

Final host suite: 29 Node tests (21 HTTP/API, 3 migration, 2 link policy/extraction, 2 mocked Drive, 1 real child-process production startup); 72 core Java checks and 10 Python checks. Automated acceptance uses generic fixture references, never contacts external hosts, and is not evidence of Google/YouTube availability or permission.

| Check | Result / evidence |
| --- | --- |
| Public HTTP/HTTPS Docs/Slides/Sheets/Drive/PDF/Excel/video/site references and punctuation | PASS: core/backend parser checks, including balanced parentheses and query/fragments |
| Unsafe schemes, credentials, literal IP/local names, custom ports and malformed URLs | PASS: core/backend rejection checks; invalid text noninteractive |
| Text material create/publish/edit, private access and exact-current reference | PASS: discovery does not expose subject links before enrollment; HTTP tests; URL injection/stale revision/draft/other instructor/unenrolled/suspended denied |
| Reading participation | PASS: open-link leaves reading unchanged; explicit /complete records reading; body/link edit resets current revision reading |
| Links-only production startup without Drive secret/file folder | PASS: real child process bootstraps privately on loopback, health/auth/capabilities verified; no material folder |
| v1/v2/v3 migration to v4 | PASS: accounts, IDs, enrollment sources, eligibility, original file refs, revisions/grades preserved; existing items default file |
| Native automatic hyperlink display and external launch | Source reviewed; Android build/lint/JVM evidence per CI; actual phone NOT TESTED |
| Real external service sharing/sign-in/availability/downloads | NOT TESTED: validate intended student provider accounts before institutional use |

Real-device procedure (required before stable):

1. Start matching 0.5 backend with MATERIAL_STORAGE=links behind approved HTTPS. No Drive credential is needed. Admin/instructor/student sign in; configure normal eligibility/QR enrollment.
2. Instructor subject text: paste Docs URL and ordinary HTTP/HTTPS website addresses. Edit via left Menu → Edit subject text. Verify short underlined clickable labels and ↗, explicit HTTP marker, no raw long query clutter or per-link button. Invalid/local/script text must stay plain. Check small width, 200% fonts, TalkBack link activation, RTL and landscape.
3. Add Material text / links using one text field. First line is the title; include Docs, Slides, Sheets, Drive-hosted PDF, direct PDF/Excel, YouTube and website links on separate lines. Save draft, review, publish, edit and archive. Text entry must retain fields on validation/network failure. Existing quiz/activity titles/actions must remain visible.
4. Student taps each link: fresh app authorization/reference check → browser/host app. No extra Open-material button or type/URL form. Test browser absent, host app installed/uninstalled, wrong provider account, private file permission denied, host deletion, redirects, broken link, HTTP, offline request and back-to-Academy resume. Host sign-in and sharing are independent; do not expose Academy tokens/headers to external apps.
5. Opening must not change read percentage. Return and mark material read manually. Edit its link/instructions; current revision reading resets. Provider content edited at the same URL is not detected; update the app entry deliberately when resetting a requirement.
6. Leave a subject/item view open, then unpublish, replace the link, remove enrollment, suspend or expire the account in another session. Old link activation must fail/refresh rather than opening stale or unauthorized references. The host may still permit a URL already copied/opened; app revocation does not recall it.
7. Keep a v3 backup containing uploaded PDFs/IDs/grades, migrate to v4, verify all retained. With original file adapter configured, prior PDF viewing still works. With links-only mode, legacy uploaded PDFs show a file-service guidance message, not misleading read/upload actions. Public sample downloads remain available independently. Test restore using the complete compatible backup/server pair.

Optional Drive-adapter validation is N/A for a deployment that exclusively enables links mode, with its file feature explicitly disabled. Real host reference/access testing remains mandatory. Stable is still BLOCKED by unconfigured deployment, signing and real-device/provider gates. Actuator HIL is N/A because no equipment is commanded.

## 0.6.0 local test accounts acceptance criteria

Baseline: source `f6fd5d0`, published test.9. Scope: debug-only local workspace and sign-in routing; no production schema/backend changes. Acceptance: three defaults sign in without a server; admin creates instructor/student accounts; only creators/admin edit; students see only enrolled published work; PDF staging is bounded/validated; reading can be undone; quizzes/submissions are idempotent and revision-scoped; instructor grades are visible on student login; suspended/reset/deleted accounts lose sessions; data persists and reset restores defaults. All JSON changes atomically replace the prior state file; failed routes are not saved. A 16 MB JSON cap and 50 MB per-PDF cap bound individual data operations.

`app:testDebugUnitTest` runs `TestWorkspaceTest`: default credentials and password hashing, restart persistence, role/draft/answer isolation, account creation and mandatory password changes, read/undo, quiz scores and retry rejection, written submission/grading/revision recovery, ID/All-students enrollment and admin blocks, session revocation, PDF upload/read/export ownership, invalid upload/link checks, XLSX packaging, reset, archive/stale writes, corruption recovery and deletion. Existing core/catalog/backend regressions remain required. Gate A: Android debug/release build, JVM tests and lint; B/C: these automated workflow regressions; D: simulated same-installation role switching. E: actuator HIL N/A (education app). F: CI version/package/signature evidence; physical upgrade NOT TESTED.

Device checks before stable: install the new test APK; open Account workspace with airplane mode enabled; fill/sign in each default role; check top LOCAL TEST indicator. Admin registers instructor and student (unique ID); verify first-login password change and new credentials. Instructor creates subject and materials/link, uploads a real multi-page PDF, publishes it, sets eligible IDs. Student uses Enter subject code or QR to enroll; verify other subject denial, read/undo, quiz once, written submission and saved results. Sign out/relaunch between roles; instructor reviews and grades, student sees feedback. Export XLSX and open in intended spreadsheet app. Rotate/background the app and file pickers; test 200% fonts/TalkBack. Reset on sign-in and verify confirmation, default recovery and removal of local files/results. Disable Local test accounts and verify the prior organization sign-in route; confirm no demo token is sent over HTTP. Release builds must offer no local mode. Real host/organization sign-in and phone checks remain NOT TESTED until observed.

## 0.7 minimal editor and ordering gates

Baseline: `37ac662`, v0.6.0-alpha.1-test.10. Acceptance: default short local logins work; v1 local data migrates without losing subjects/work or changing customized passwords. + follows the last entry; one composer handles material links, quizzes, written work/exams and PDFs; Done publishes and returns to the bottom. Cancel does not create an entry. Invalid fields keep the editor open. New PDFs publish after successful upload, with a recoverable unpublished draft on failure. Native handle drag/drop and Menu move commands submit the same sequence; deletion confirms and hides the entry. Ownership/status checks, complete-set validation and optimistic order revisions reject stale/foreign/duplicate/missing IDs. Reorder must not change learning revisions/results; new entries append. Backend migration v1–v4 → v5 preserves existing identities/content/order/results and reopens safely. Local state v1 → v2 preserves array order and learner records.

Automated: TestWorkspaceTest (17 tests, including ordering and login migration), backend API ordering test, existing migration/regression tests, core/Python/source checks, Android JVM/debug/release/lint gates. Tests are host/simulated workflows; no physical-phone claims. Device gate before stable: sign in each short default; create every entry type and cancel once; after Done confirm bottom + position; long-press handles to reorder first/middle/last entries across scroll bounds; confirm Move up/down with TalkBack; delete one entry then refresh/relaunch/student login; verify progress is preserved across reorder and omitted archived entries leave the denominator. Rotate midway through text/quiz editing and PDF selection; validate resume/cancel/error recovery and duplicate-tap prevention. Test organization pairing against updated server and restore backups before server downgrade. Physical device checks remain NOT TESTED.

## 0.8 subject board / UI gates

Baseline `c5b39db`, v0.7.0-alpha.1-test.11. Scope: account subject board, personal order preferences and UI styling; no server/database changes. Acceptance: ≡ long-press starts dragging only on the handle; measured-height rows follow the finger and swap live; release/cancel/pause/recreation retain saved unique subject order. Origin/account IDs namespace preferences, removed IDs are excluded, and new subjects append. Accessible Move up/down uses the same sequence. Subject taps navigate without triggering drag. A transparent + follows the final subject/entry. Font/form/card spacing and dropdown targets are consistent; long text wraps; panes center up to 760 dp; page transition is short and refresh does not crossfade.

Automated: CoreChecks adds six order-policy checks for merge, stale IDs, new subjects, empty accounts, moves/bounds and source immutability (78 core checks total). Existing local workspace (17), backend, Python/catalog regressions run in CI with Android JVM tests, lint and debug/release builds. Self-review checks lifecycle flush/disposal, adapter stable IDs/header-footer exclusions, order namespace, revoked-subject filtering and unchanged authorization routes. RecyclerView handles measured geometry, neighbor move animation and edge scrolling; this is source/build evidence, not an observed phone gesture.

Required device procedure before stable: create 8+ subjects of mixed one/multiline titles/descriptions; drag first→last, last→first, middle across visible bounds and release/cancel; rotate and leave/resume mid-drag. Reopen after sign-out and app restart. Switch admin/instructor/student accounts and organization origins: each retains its own order. Add/remove access and verify new IDs append/revoked IDs disappear. Use TalkBack ⋮ Move up/down. Open a subject and return to the same list position. Verify transparent +, editor/keyboard/dropdown spacing at 100%/200% fonts in portrait/landscape/tablet widths; disable Android animations and verify navigation. These physical-device checks remain NOT TESTED.

## 0.8.1 capture feedback check

Baseline: `443d215`, v0.8.0-alpha.1-test.13. User authorizes temporarily disabling screenshot/recording protection until features are streamlined. Both account and protected PDF FLAG_SECURE guards now depend on the common SCREEN_CAPTURE_ALLOWED build flag, currently true. No backend/data migration or permission changes. Required automated gate: source/configuration checks plus Android debug/release compile/lint and existing regressions. No redundant test is added for the direct boolean guards. Device check: take a screenshot and start the phone’s screen recorder in admin/instructor/student views, open an in-app PDF and capture its page, then rotate/background/resume and repeat. Expected: the app does not block capture. Physical OS/device behavior remains NOT TESTED. Restore SCREEN_CAPTURE_ALLOWED=false when capture protection is reintroduced.

## 0.8.2 navigation and form acceptance

Baseline: ff937326b56fd973db1e1842d41455c0eb076917, published v0.8.1-alpha.1-test.62; its Android verification run 41068276900 passed. Target: Android main branch UI. Scope: MainActivity and WorkspaceActivity only, version/documentation updates. No service, schema, identity, subject-order or dependency changes.

| Criterion | Check / expected behavior | Evidence tier |
| --- | --- | --- |
| Persistent navigation | Scroll long subjects and all account pages. Header/Menu and role destinations remain visible; only content scrolls. Subject board occupies the remaining height between header and navigation. | Device required |
| Role routes | Student: Subjects/News/Results. Instructor: Subjects/News. Admin: Subjects/News/Accounts. Menu retains all prior actions. Subject return and Android Back reach the expected page. No extra destinations during mandatory password change. | Source review + device required |
| Form labels and focus | Filled, empty and multiline fields keep labels above text. Local sign-in hides server and its label; username/email labels change together. Focus outlines are visible. | Source review + device required |
| Sign-in recovery | Empty username/password shows inline error and focuses the field. Show password toggles masking without losing text/cursor. Keyboard Done signs in once. Failed sign-in keeps text; success clears password. | Device required |
| Busy state | With delayed/failed requests, activity bar and polite status are shown, action buttons disable and recover, subject dragging stays disabled while busy. A failed request still exposes its error. | Source review + device required |
| Discovery and downloads | Search counts agree with visible subjects. No matches offers Clear search; clearing restores catalog. Active PDF transfer has determinate progress when provided, otherwise indeterminate. Cancel/read/update still work. | Device required |
| Empty news | Zero announcements shows an explicit empty state; admin can still publish. | Source review + device required |
| Regression | Existing source/core/catalog/Python/backend/JVM tests and debug/release build/lint pass on the final commit. | CI required |

Run the existing README commands in CI; no tests that merely restate cosmetic implementation are added. Gate A uses source/build/lint; B/C use existing workflow regressions plus the device procedures above; D uses local role switching and intended organization service/provider checks; E actuator HIL is N/A (education app); F requires signed installation/upgrade evidence before stable promotion. Local shell/build execution is unavailable in this editing session; use the linked GitHub run for automated evidence.

Phone procedure before stable: test all three local roles, an 8+ subject list and a long course. Repeat at 320 dp width, landscape, tablet width, 100%/200% fonts and TalkBack. Check bottom labels wrap without overlap, header does not scroll away, content remains reachable with the keyboard visible, and switching tabs/returning from course retains subject arrangement. Reorder via handle and accessible menu, refresh, sign out/in and restart. Try rejected credentials, invalid server, no network, delayed response, retry, password reveal and keyboard Done. Open every editor including multiline work/PDF pickers; rotate/background/resume. Disable Android animations and verify navigation. These physical checks are NOT TESTED until observed.

## 0.8.3 tab jitter regression and decluttering

Baseline: v0.8.2-alpha.1-test.66, source 6934711930553ecdc89c343c977c7f2017f74f31, verified by Actions run 43964364738. User reports jitter during tab transitions. Source diagnosis: each render resets the entire activity view and reapplies insets; busy status/progress switches GONE/VISIBLE, changing header height; a vertical slide overlaps posted scroll restoration. Actual frame timing on the reported device is NOT TESTED.

Fix scope: retain activity shell/header/navigation instances; replace only workspace center content and reuse the public viewport; remove page translation/crossfade; restore saved offsets in a pre-draw callback. Reserve a 3 dp progress strip and delay display 150 ms. Page offset history is capped at 32 entries and stored in instance state. Identity moves into Menu; ordinary copy is reduced without editing user content, scores, permissions or confirmation dialogs. No schema/service/dependency change.

| Check | Pass condition | Evidence |
| --- | --- | --- |
| Source review | One initial setContentView per activity instance; header/nav survive same-role tab changes; no page translation/alpha or posted scroll restore; progress uses INVISIBLE to reserve height. | Self-review |
| Delayed requests | Header and bottom tab bounds stay identical before/during/after 0, 100, 500 and 2000 ms requests, success and failure. Under 150 ms shows no loading flash; longer requests show progress without shifting content. | Device/emulator required |
| Repeated navigation | Cycle Subjects → News → Results (student) or Accounts (admin) 20 times. No vertical bounce, blank/top flash, lost tab selection, duplicate requests from active-tab taps or stale page overwrite. | Device required |
| Position regression | Scroll news, account/result lists and a long subject. Switch away/back, refresh, rotate and return from PDF/QR/file picker. Restore the correct page offset and subject-board state; a new page begins at top. Done still reaches the final entry. | Device required |
| Reading/editor flows | Subject handles and accessible Move up/down work, results/grade and learner routes remain intact, quiz choice and submit confirmations work, all text/PDF editors retain labels and validation recovery. | Existing regressions + device required |
| Decluttering | No repeated welcome/account lines, duplicate label/hint pairs, Working text or routine sync paragraphs. Menu exposes account identity; Help exposes catalog status; failures and required confirmations remain visible. | Self-review + device required |
| Accessibility/layout | 320 dp portrait, landscape, tablet, 100%/200% fonts, TalkBack and disabled animations. No clipped tabs, unexpected keyboard or unreachable controls. | Device required |

Required automated commands are unchanged in README: source/core/Python/catalog/backend checks, Android JVM tests, debug/release lint and both builds. This change has no new pure business logic to unit test; avoid source-string assertions that merely mirror implementation. Gate A is automated build/lint; B/C/D need the UI procedures above as well as existing workflow regressions. Physical validation is NOT TESTED; source/build checks do not measure smoothness or frame rate. Actuator HIL is N/A (education app). Stable signing, deployment and real-device gates remain outstanding. The local execution environment is unavailable; CI provides automated evidence.

## 0.9.1 complete subject template

Baseline: e20031b26ec9bf40a45d140b1af8e9642ca845fd, published v0.9.0-alpha.1-test.73, Actions 43973265123 PASS. Scope: canonical synthetic course content, local seed/migration, public catalog/handouts, related tests and guidance. No organization schema, deployment, signing or authorization change.

Acceptance: one factory subject; course overview + eight lessons + eight single-question quizzes + four written activities + four written examinations = 25 ordered entries. Every period contains two lessons/two quizzes/one activity/one exam. All entries are published and student-visible; only instructor/admin views expose synthetic quiz correct indices. Each written exam contains four prompts and is graded as one /100 submission. Generated PDFs/catalog match canonical content and hashes; old B/C bundled assets are absent.

Automated checks: TestWorkspaceTest verifies exact counts and period balance; full course reading, 16 submissions, 8 immediate quiz scores, 8 instructor-graded written outputs including four examinations; student answer-key isolation; restart/idempotence; v1/v2 upgrade with unchanged factory IDs/revisions and historical records; edited/independent instructor content and notices retained; failed migration leaves previous bytes usable and backup matches the prior state. Existing account/permissions/ordering/enrollment/PDF/report regressions remain. Python content tests validate question options/keys/period composition and regenerate the five PDF/catalog artifacts in --check mode. Catalog tests retain duplicate-ID/source/checksum/revision rejection using the single-subject fixture. Run the unchanged README/CI build, lint, core and backend gates.

Migration: before any local v1/v2 mutation, copy the bounded state file to app-private local-test/workspace-before-template.json. Promote v3 only after content import succeeds and save remains atomic. Reset explicitly removes the migration backup with other test data. No live organization database is touched. Migration failure must not publish a partially imported subject. An edited legacy example is preserved as user work, so a customized installation can correctly show more than one subject.

Phone acceptance before stable: install over the compatible prior test APK; without Reset verify instructor/student views show four periods and 25 entries (or retained customized subjects plus the template). Reopen/rotate and verify no duplicate template. Read text/save/open all five PDFs; check page breaks, symbols and readable text. Confirm old A revision offers Update; old saved B/C copies remain removable in Downloads. Submit a quiz, an activity and a four-part examination as student; assess the two written outputs as instructor and view results/feedback. Repeat with custom old work; confirm preservation and grade revisions. Check 200% text/TalkBack, long-course scrolling, error/cancel and a consistent backup restore with matching APK/signing identity. Physical rendering/upgrade and live service checks are NOT TESTED here. Actuator HIL is N/A (education app).

## 0.10.0 native forms and screenshot formatting

Scope, accepted behavior, protocols, source symbols and migration/rollback are recorded in [FORMS_RELEASE.md](FORMS_RELEASE.md). The new host tests cover all 16 template assessments, 40 answers, automatic grade isolation, rejected partial/stale/cross-role submissions, key replay/conflicts, edited-work migration and legacy workflows. Python generator tests prove the downloadable catalog/PDF text excludes question prompts. Screenshot inspection identifies the prior centered secondary actions, footer crowding and unindented Help wraps; new geometry is reviewed in source, not claimed phone-validated.

Host evidence: Node 24.22.1 backend tests PASS (40), Java 21 host compiler using source/target 17 with JVM tests PASS (34), Python checks PASS (12), XML/catalog/assets/secret checks PASS. The local Gradle wrapper cannot resolve services.gradle.org and no Android SDK is installed; Android toolchain-17 build/lint/package gates therefore run in CI. Physical-device tests remain NOT TESTED. Core checks and final CI results must be read for the final commit, not inferred from these host results.

### Header and subject action regression (0.10.1)

Run `sh tools/device_smoke.sh` on an Android 35 emulator (requires adb/SDK and hardware acceleration). CI runs this as a required `device-smoke` job before publishing. `SubjectFlowSmokeTest` checks the public header has visible brand width and stays above the content at 200% fonts; opens a public Read action without PDF controls; selects Take quiz; signs in as local student; selects/submits an answer and verifies correct/total and Review. Screenshots, crash output and instrumentation reports are retained as build evidence. `PracticeTemplateTest` verifies all 25 public entries, exact action counts and exclusion of assessment body text. Test data is synthetic and reset only in the isolated emulator. Physical-device layout, 320 dp/landscape, TalkBack, camera, rotation/revocation and signed upgrade remain separately required.

### Fixed subject context and paragraph formatting (0.11.0)

Required Android smoke checks compare the pinned title/progress bounds before and after a real course scroll, and check the public title remains fixed when navigating to an assessment. Open Lesson 2 and capture reader-paragraphs.png; capture pinned-subject.png after scrolling. TypographyLayoutTest measures a wrapped paragraph versus the next paragraph, verifies an added gap and checks that a second formatting pass preserves spacing, original wording and a clickable span. Existing sign-in/Read/quiz/result/activity/examination tests remain required.

Review the six release screenshots after CI. On a phone, also test 320 dp, landscape and 200% fonts: the header must leave usable content height, title truncation must expose the full title via Subject details, both public/account back actions and bottom Results must work, reader buttons must remain accessible at the bottom, and progress must update after marking a lesson or submitting a form. Check numbered text, long links, native dialogs, editor rotation, role/account changes and permission revocation. Emulator results do not establish phone performance or signed upgrade.

## Scheduled publishing and deadlines

See SCHEDULING.md for the contract and acceptance matrix. Required gates add server/test/schedule.test.mjs and API boundary/permission/audit tests, web scheduling AppTest, Android local-workspace scheduling and native Windows schedule.mjs; candidate artifacts still require exact-source platform CI. Live API migration/restore and physical date-picker/accessibility checks remain NOT TESTED.
