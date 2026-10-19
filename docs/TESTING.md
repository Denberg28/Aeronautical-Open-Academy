# Verification — 0.2.0-alpha.1

Evidence must distinguish host checks, Android compilation/lint, local HTTP backend integration, mocked Drive adapter behavior, physical devices, and real organization access.

## Current matrix

| Check | Status | Evidence / limits |
| --- | --- | --- |
| Public source destination | PASS | User explicitly authorized public repository; no protected data included |
| Pure Java QR/URL/transfer core | PASS | 40 checks; docs/evidence/core-checks.txt |
| Catalog publishing validator | PASS | 8 tests; docs/evidence/python-tests.txt |
| XML/assets/wrapper/focused secret scan | PASS | docs/evidence/project-checks.txt |
| Backend HTTP/SQLite role/security flows | PASS | 9 real loopback API tests; docs/evidence/backend-tests.txt |
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
7. Student A marks/unmarks activity done; Student B's data stays separate. Manual quiz completion is rejected. Submit an incorrect answer with a forged score field: server still scores it incorrect and marks submitted, not passed. Replay the same request key: no duplicate attempt; new/change-answer replay is rejected.
8. Replace/upload a PDF during connection loss, suspension, or unenrollment. An interrupted or revoked upload must not publish a new file reference. Online viewing must fail after suspension/unenrollment on a new request. Current rendered/exported bytes are not promised instant remote revocation.
9. Test Android document pickers, rotation while selecting/uploading/exporting, background/resume/process death, 200% font size, TalkBack, RTL/landscape, rapid taps, 20 repeated request/view cycles, and a 30-page/10-minute PDF session. No credential in logs/backups/screenshots/private file shares. Verify secure cache cleanup and access recheck behavior on actual OS versions.
10. Test the organization Shared Drive adapter with intended membership/access levels: private create/upload/view/replace, denied permission, missing file, invalid PDF/size, rate/timeout faults. Confirm no sharing-permission mutation or direct private URL/key reaches the app. Mocks do not count for this gate.
11. Build two increasing versions with the same retained release key. Verify signature fingerprints, same-package upgrade, preserved public downloads, account sign-out/revalidation, and rollback limitations. Debug keys are not release identity.

## Evidence and promotion

For each acceptance criterion record source SHA, environment, procedure, expected/actual result, PASS/FAIL/NOT TESTED/BLOCKED, and evidence location. Use N/A only with a reason. Required failures block promotion; do not disable lint/tests to publish.

A test APK can be offered after candidate automated/build/packaging gates pass and no known critical/high defects remain, with unverified deployment/device scope explicit. Stable requires actual device, organization access, signing continuity, security/backup/hosting, and performance gates on final source/artifact. Never describe a debug APK as an institutional production release.
