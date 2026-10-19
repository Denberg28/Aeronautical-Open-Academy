# QA gates and current evidence

Version: 0.1.0-alpha.1. Evidence tier: **host checks and self-review**. Android compilation, simulator/device execution, Drive integration, and APK packaging are not yet verified. Source package is not an installable candidate.

## Current result matrix

| Gate/check | Status | Evidence / limit |
| --- | --- | --- |
| Baseline/repository identity | PASS | GitHub metadata: exact named repo, empty, main; visibility public contradicts requested private destination |
| Pure Java routing/destination/transfer checks | PASS | `docs/evidence/core-checks.txt`: 34 checks on OpenJDK 17.0.20 |
| Catalog publishing validator tests | PASS | `docs/evidence/python-tests.txt`: 8 tests |
| Bundled catalog/PDF hashes and XML | PASS | `docs/evidence/project-checks.txt` |
| Focused source secret/configuration scan | PASS | Same source check; not a complete dependency security audit |
| Java syntax | PASS | `docs/evidence/java-syntax.txt`; parsing only, not Android type-checking |
| Sample handouts | PASS | Four single-page PDFs text-extracted and visually reviewed; text companions included |
| Android build + lint + Android JVM unit tests | BLOCKED | Gradle distribution cannot be downloaded; no Android SDK installed. See build log |
| Dependency resolution/security audit | BLOCKED | Maven/Google build artifacts unavailable in this environment |
| Camera/UI/lifecycle/download integration | NOT TESTED | No emulator or physical Android device attached |
| Organization Drive access and instructor update flow | BLOCKED | No approved real catalog/PDF or verified access policy supplied |
| Signed APK / install / upgrade | BLOCKED | Android build unavailable and persistent release identity not configured |
| GitHub push / private release | BLOCKED | Remote reports public; private delivery requested |
| Actuator, flight-control, motor HIL | N/A | This app does not command physical equipment |
| Stable promotion | BLOCKED | Required build/device/integration/delivery gates incomplete |

## Automated commands

```sh
sh tools/core_checks.sh
python3 tools/project_checks.py
python3 -m unittest discover -s tests -p 'test_*.py' -v
java tools/ParseJava.java $(find app/src -name '*.java')
./gradlew --no-daemon :app:coreChecks :app:testDebugUnitTest :app:lintDebug :app:lintRelease :app:assembleDebug :app:assembleRelease
```

The first three commands do not require the Android SDK. Java syntax parsing requires a full JDK compiler module. Gradle's JVM catalog tests use the real Catalog class with test-only org.json; Android's platform JSON behavior still needs integration verification. Do not replace failed build checks with source parsing.

## Runnable Android device procedure

Prerequisites: build a debug APK on an SDK-equipped machine; enable USB debugging; install Android platform tools; keep an approved test catalog and known small PDF ready. Record commit, APK SHA-256, device model/OS/RAM, connectivity, catalog version, and resource revisions. Debug package is `org.aeronautical.openacademy.test`.

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.aeronautical.openacademy.test/org.aeronautical.openacademy.MainActivity
adb shell am start -W -n org.aeronautical.openacademy.test/org.aeronautical.openacademy.MainActivity
adb logcat -d -s AndroidRuntime
```

1. **Startup/layout:** launch five cold starts and time to interactive catalog. Browse all four sample subjects, search by code/title/resource title, rotate, change font size to 200%, enable TalkBack, and inspect portrait/landscape on Android 8–10 and a modern physical phone. Expected: controls readable, reachable, and labeled; timing meets SPEC budgets.
2. **QR/permissions:** print/display a QR with `aoa://subject/ae-413`; scan it and enter `AE-413`. Deny camera permission, reopen scanning, and use manual entry. Scan unrelated HTTPS, unknown subject, traversal, and malformed text. Expected: correct local subject or clear error; no arbitrary link opens.
3. **Offline baseline:** with internet disabled, open bundled catalog/text companions. Save one sample PDF; wait for completion. Force-stop/relaunch and read the PDF in airplane mode. Try page navigation, rotation, and an installed external PDF reader. Expected: completed content remains available; internal reader reports missing/corrupt files clearly.
4. **Remote content:** connect an approved Drive JSON download URL and fetch its PDF with the intended student privileges. Test a normal Drive view page, sign-in-required file, missing file, download-disabled file, and HTML confirmation response. Expected: valid data works; failures explain the access/format problem and keep the old catalog/copy. Browser access remains explicit.
5. **Catalog update:** preserve the subject ID, replace the PDF, increase resource revision and catalog version, update hash, publish and refresh. Scan the original QR. Expected: subject remains reachable; old PDF remains readable before replacement completion; new revision replaces it only after verification. Try malformed JSON, duplicate IDs, unsupported schema, catalog downgrade, and revision/hash changes without revision bump. Expected: old valid catalog retained.
6. **Download faults:** on a larger approved test PDF, interrupt Wi-Fi, background the app, kill the process, relaunch, cancel, repeat Save rapidly, and reboot. Repeat with insufficient free storage and responses with missing/incorrect lengths and >50 MiB content. Expected: at most one active resource job; partials never appear completed; retry/restart/cancel is bounded and previous valid copies survive. Android force-stop suppresses background scheduling until the app is reopened.
7. **Lifecycle/endurance:** rotate and background/resume during refresh, scanning, download, and PDF reading. Repeat 20 navigation/download/cancel cycles and read a 30-page PDF for 10 minutes while observing memory/ANRs. Expected: no crash, leaked camera, duplicate operation, missing saved copy, or unusable navigation; verify SPEC budgets.
8. **Delete:** explicitly remove one completed PDF; cancel removal of another. Expected: only the confirmed local copy is removed; the instructor source remains unaffected.
9. **Install/upgrade/signing:** build two increasing signed release versions with the same organization-owned key. Install the first, save a PDF, then `adb install -r` the second. Check certificate fingerprints, app version, retained downloads, and startup. Expected: same identity upgrades and saved files survive. Debug `.test` and release packages are separate.

Use Android Settings for airplane mode, font/TalkBack changes, and storage simulation where shell automation is unavailable. Do not use `pm clear` for routine recovery: it deletes app data. Logs should not include private content or credentials.

## Evidence record format

For every device check record: criterion ID, source commit, APK/hash/certificate, environment, steps, expected result, observed result, PASS/FAIL/NOT TESTED/BLOCKED, and evidence location. User-run checks count when their configuration and actual observations are supplied. Screenshots and host checks do not establish a successful install or camera operation.

## Release gates

Candidate: Android build/lint/unit/source/content/signature/packaging checks pass; no known critical/high defects; missing device/Drive checks clearly stated. Debug CI artifacts are development smoke builds, not enduring signed distribution.

Stable: every applicable required criterion passes on final source and signed artifact, including organization access, physical-device faults/accessibility, install/upgrade, and supported performance. Current source is ineligible for either APK tier until compilation/packaging pass.
