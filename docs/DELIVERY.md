# Delivery, signing, and rollback

## Current deliverable

Versioned source package only: v0.1.0-alpha.1. Local Git commit records the exact source. No remote commit, GitHub release, signed APK, install, or device validation is claimed. The initial remote was empty/public; pushing is held because requested delivery is private.

## Build automation

After destination visibility is verified private, push the source branch and run `Android verification`. It runs source/content checks, catalog tests, core checks, debug/release lint, a debug APK, and an unsigned release APK. Failed checks block artifacts. Unsigned release files are build evidence only, not installable deliverables.

Debug artifacts use a `.test` application ID and runner-generated debug keys. Different CI runs may not share a debug certificate. Use Android Studio/local stable debug keystore for iterative local upgrades, or uninstall a prior development package after backing up anything needed. Do not confuse that with release signing continuity.

## Establish organization-owned signing

No signing key is committed or generated silently. The owner should create/retain the first release key outside the repository, back it up securely, and control recovery. Preserve the same key/application ID for future release upgrades.

Repository Actions secrets required by `Signed private candidate`:

- `AOA_KEYSTORE_BASE64`: base64 of the retained release keystore.
- `AOA_STORE_PASSWORD`.
- `AOA_KEY_ALIAS`.
- `AOA_KEY_PASSWORD`.

For a local signed build set the corresponding passwords/alias plus `AOA_KEYSTORE_PATH` to the external key path. Keep the keystore out of Git. The candidate workflow decodes it only into runner temporary storage, verifies the signed APK, and removes the runner copy even after failures. It does not create a replacement key if secrets are missing.

## Private candidate release

1. Confirm repository private visibility and source review. Resolve every known critical/high defect.
2. Update `versionCode`, `versionName`, changelog, release notes, testing evidence, and known issues. Never reuse published version/tag values.
3. Run the candidate workflow with a matching unique `vX.Y.Z-alpha.N`, `beta.N`, or `rc.N` tag. The workflow rechecks real repository visibility before publication, requires the retained key, runs required checks, and publishes only a prerelease.
4. Record APK version/package, source SHA, SHA-256, certificate SHA-256 fingerprint, build tools, compatibility, and actual check results. The published APK is the verified artifact; do not replace it silently.
5. Complete device/organization tests using that artifact. Prepare a new version for corrections. Stable promotion requires all documented gates; it is intentionally not automated here.

The source workflow uses versioned Actions refs. Before production promotion, review/pin Actions to approved commit SHAs and generate dependency locks from successful resolution; these are not fabricated in an environment without those build results.

## Student installation

Private GitHub artifacts/releases require appropriate repository access. Do not make the repository public to distribute the app without authorization. Choose an organization-approved student distribution channel separately. Once an APK is available, record its checksum and minimum Android version, install with Android's explicit per-source installation permission, and retain the verified file for rollback/testing.

## Upgrade and rollback

Keep release application ID `org.aeronautical.openacademy` and the established certificate. Increase `versionCode` each release. In-app catalog updates do not require reinstalling the app. Completed downloads are intended to survive same-identity upgrades; device testing must verify that claim before stable promotion.

Android normally rejects lower-version APK installation. Preferred rollback is a forward-version correction signed with the same key. Do not recommend uninstalling as a harmless rollback: uninstall/Clear storage deletes app-private offline copies. A previous release APK does not guarantee data/schema downgrade compatibility.

For content mistakes, publish corrected content/catalog with greater versions/revisions and preserve stable IDs. An offline phone may retain older copies until its next connection/update; remote revocation is not guaranteed.
