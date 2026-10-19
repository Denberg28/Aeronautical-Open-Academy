# Verification — 0.3.0-alpha.1

Evidence must distinguish host checks, Android compilation/lint, local HTTP backend integration, mocked Drive adapter behavior, physical devices, and real organization access.

## Current matrix

| Check | Status | Evidence / limits |
| --- | --- | --- |
| Public source destination | PASS | User explicitly authorized public repository; no protected data included |
| Pure Java QR/URL/transfer core | PASS | 40 checks; docs/evidence/core-checks.txt |
| Catalog publishing validator | PASS | 8 tests; docs/evidence/python-tests.txt |
| XML/assets/wrapper/focused secret scan | PASS | docs/evidence/project-checks.txt |
| Backend HTTP/SQLite role/security flows | PASS | 13 real loopback API tests plus v1/v2 migration test; docs/evidence/backend-tests.txt |
| Drive adapter credential isolation / redirect tests | PASS | 2 mocked-upstream tests; not real Google access |
| Android build/JVM tests/lint for final source | NOT TESTED | At documentation authoring; per-commit CI artifact verification.json and Actions results supply actual build evidence |
| Physical device/runtime/camera/accessibility/lifecycle | NOT TESTED | No attached Android device/emulator |
| Live account backend | BLOCKED | No hosting destination/HTTPS deployment configured |
| Real organization Drive | BLOCKED | No organization service credential/folder/access evidence supplied |
| Retained release signing/install/upgrade | BLOCKED | No release keystore/secrets configured |
| Actuator/flight-control/motor HIL | N/A | Education app controls no equipment |
| Stable promotion | BLOCKED | Required deployment/device/signing/real Drive gates incomplete |

## Automated checks

```sh
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
