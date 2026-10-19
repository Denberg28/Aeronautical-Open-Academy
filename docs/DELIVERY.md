# Delivery and rollback

The user explicitly authorized public source delivery to Denberg28/Aeronautical-Open-Academy on 19 October 2026. Never put protected material, credentials, learner databases, actual quiz keys, or signing material in the public repository/artifacts. Generic test fixtures/sample answers are not institutional content.

Android verification runs host/core/backend tests, Android JVM catalog tests, debug/release lint, and debug plus unsigned release assembly. Artifacts are uploaded only after checks pass. After green checks, main-branch CI publishes a uniquely tagged development test prerelease with the verified debug APK, checksum, certificate, package metadata, and source SHA. The debug APK is installable for controlled testing but its .test package/key is separate from the release identity. CI test version names/codes increase by run number. CI debug keys may vary between runs; this is not release upgrade continuity.

Signed candidate workflow accepts only unique version-matching prerelease tags and requires repository secrets AOA_KEYSTORE_BASE64, AOA_STORE_PASSWORD, AOA_KEY_ALIAS, AOA_KEY_PASSWORD. Retain the organization-owned key outside Git and back it up securely. No replacement key is generated silently. The workflow verifies the APK signature and packages commit/version/checksum/fingerprint/limitations. It does not automatically promote stable.

Current account backend is source/local-test verified, not deployed. A hosting destination, HTTPS configuration, organization Shared Drive credentials/folder, first administrator, and production security/backup review are still required. No unrelated cloud project was modified. No default credentials are shipped.

Keep the release application ID org.aeronautical.openacademy and certificate for upgrades. Increase versionCode. Android normally rejects downgrades; use a forward-version correction when possible. Uninstall/Clear storage deletes app data. Keep the last verified APK and backend database/material backup. Stop the single-instance backend before manual filesystem backups, or use an approved consistent SQLite backup procedure. Never copy only a live SQLite main file while ignoring its WAL.

For content corrections, retain stable subject IDs and publish a new item revision. Subject QR codes still identify the same subject; they do not override enrollment. Replaced Drive files remain private pending organization retention review. Existing exports cannot be remotely recalled.

## 0.3 database/client compatibility

Deploy the 0.3 server alongside the 0.3 Android app. Take a consistent stopped-service backup before the automatic v1 → v2 migration. Accounts, material references, enrollments and attempts are retained; prior self-completed activities now require actual written outputs. The old server refuses v2. Rollback requires the matching whole pre-upgrade backup and older server; never discard current submissions by downgrading in place. See SPEC.md for current-revision and 100-student Excel export scope. Reports contain confidential learner data and must not enter public deliverables.
