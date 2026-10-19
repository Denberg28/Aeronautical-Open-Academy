# Verification — 0.5.0-alpha.1

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
