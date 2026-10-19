# Aeronautical Open Academy

Android education library: scan an instructor QR, choose a subject, and keep eligible PDFs for offline study.

**Status: v0.1.0-alpha.1 source implementation. No Android APK has been built or published.** Host checks pass; Android build, real-device behavior, organization Drive access, and signing remain unverified. See [testing](docs/TESTING.md) and [known issues](docs/KNOWN_ISSUES.md).

## First version

- Subjects, Scan QR, and Downloads navigation with search and manual subject codes.
- Four clearly marked demonstration subjects: AE 413, AE 417, AMT 212, AMT 412.
- Original sample handouts, matching text versions, and a bundled catalog usable at first launch.
- Instructor catalog refresh with validation and preservation of the last valid copy.
- WorkManager downloads, cancellation, bounded transfers, integrity checks, and safe file promotion.
- Offline PDF reader; external-reader access for zoom/accessibility tools.
- HTTPS destination restrictions and explicit confirmation before opening online materials.
- No ads, analytics, app accounts, or privileged Drive credentials.

Content, scanner, catalog, storage, and UI are separate components. Initial remote content support is for organization-approved resources readable without app authentication. Restricted files may be opened in a browser with the student's existing account; authenticated in-app downloads are not implemented.

## Build

Requirements: JDK 17, Python 3.10+, Android SDK platform 35 and build tools 35.0.0, internet access for Gradle/Maven/Google artifacts. Android Studio is optional.

```sh
sdkmanager 'platforms;android-35' 'build-tools;35.0.0'
sh tools/core_checks.sh
python3 tools/project_checks.py
python3 -m unittest discover -s tests -p 'test_*.py' -v
./gradlew --no-daemon :app:coreChecks :app:testDebugUnitTest :app:lintDebug :app:lintRelease :app:assembleDebug :app:assembleRelease
```

On Windows, use `gradlew.bat` for Gradle commands and set `ANDROID_HOME`/`JAVA_HOME`, or open this directory in Android Studio. The standalone shell check can be replaced with `gradlew.bat :app:coreChecks` after dependencies resolve.

Debug APK output: `app/build/outputs/apk/debug/app-debug.apk`. Its application ID ends in `.test` and it is a development artifact. The release application ID is `org.aeronautical.openacademy`, minimum Android 8.0/API 26. Compilation against API 35 is configured, not yet verified.

Without signing environment variables, the release build is unsigned and cannot be installed. Never distribute that file as an installable APK. Configure organization-controlled signing before the first signed release; see [delivery](docs/DELIVERY.md).

## Content and QR codes

See [content maintenance](docs/CONTENT_GUIDE.md). The QR payload `aoa://subject/ae-413` resolves locally through the catalog. `AE-413` works as manual input. Custom scheme links are navigation conveniences, not authenticated or verified web links. QR scanning occurs inside the installed app. This version does not provide an install landing page or verified HTTPS App Links.

Students can start with the bundled samples without a connection, save a sample PDF, turn on airplane mode, and use Downloads. Sample material is for workflow demonstration and is not an approved syllabus or aircraft maintenance reference.

To use real content, validate the catalog, host it as an approved readable JSON file in organization Drive, and enter its content/download URL in Help → Catalog setup. A normal Drive viewing webpage is not a JSON/PDF download endpoint. No sharing setting is changed by the app.

## Verification and distribution

GitHub reported the named repository as empty and **public** on 19 October 2026, despite private delivery being requested. No source or release was uploaded. Both workflows refuse to run their build/publication jobs in a public repository. Resolve visibility before pushing.

`Android verification` builds debug and unsigned release artifacts after checks. `Signed private candidate` requires persistent signing secrets and publishes a prerelease only after its gates pass. Neither workflow promotes stable automatically. Private GitHub releases are developer distribution; student distribution remains a separate choice.

The local environment could not resolve/download Gradle and lacked an Android SDK. Accordingly, host validation is not presented as an Android build. See `docs/evidence/` for the actual outputs.

## Documentation

- [Specification and acceptance criteria](docs/SPEC.md)
- [Architecture and failure behavior](docs/ARCHITECTURE.md)
- [Content maintenance](docs/CONTENT_GUIDE.md)
- [Testing and device procedures](docs/TESTING.md)
- [Delivery, signing, and rollback](docs/DELIVERY.md)
- [Known issues](docs/KNOWN_ISSUES.md)
- [Changelog](CHANGELOG.md)

Source is not licensed for redistribution by default; see LICENSE. Original bundled sample educational content is offered under CC BY 4.0. Third-party components retain their own licenses.
