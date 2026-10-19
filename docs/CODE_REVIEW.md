# Workflow and reliability review — 0.4.0-alpha.1

Baseline: public main `6786eb73c87161d8843227b473cde5d711df2678`, verified APK `0.3.0-alpha.1-test.7`. Review type: author self-review of the production source and related tests/build configuration, not an independent security assessment. Source review and host integration results do not imply device or production validation.

## Scope reviewed

| Surface | Review focus | Evidence / limit |
| --- | --- | --- |
| All 13 production Java classes and JVM catalog tests | QR validation, account/role UI, navigation, lifecycle state, transfers, private PDF rendering, encryption, public catalog/offline index/download worker | Syntax/core/catalog checks; Android build/lint/JVM CI; physical runtime NOT TESTED |
| All six Node modules and SQL schema/migrations | Authentication, session freshness, ownership, input bounds, enrollment/eligibility, submissions/grades/reports, storage/Drive, atomic updates, shutdown/configuration | Real loopback HTTP/SQLite regression/fault tests; mocked Drive tests |
| Android manifest, debug policy, FileProvider, themes/icons, Gradle/wrapper | Exported surface, cleartext exceptions, private paths, API 26 compatibility, identity/version/signing, requested palette | XML/config/wrapper/secret checks; CI build/lint; signing continuity BLOCKED |
| CI/candidate workflows, release gate, catalog validator/sample generator and tests | Required failure gates, artifact/source/checksum relation, sample integrity, publication scope, rollback | Automated checks and per-commit CI artifact evidence |
| Operational documents and limits | Matching app/server upgrade, v1/v2 → v3 migration, explicit admin overrides, confidential IDs/Excel, deployment/device/retention limits | Reviewed; live host, backup restore, actual Drive and physical phone BLOCKED/NOT TESTED |

## Findings resolved

| ID | Finding | Change | Verification |
| --- | --- | --- | --- |
| R01 | PDF metadata could commit before an audit failure, then cleanup could delete the referenced new file | Metadata and audit now commit together; failure preserves previous reference/content | PASS: injected audit failure retains original readable PDF |
| R02 | An old upload or edit could replace newer content | Independent edit_version guards Android edits/uploads; upload rechecks after async storage | PASS: concurrent edit/upload conflict rejects stale save and removes unpromoted file |
| R03 | Multi-step account/access changes could partially commit after a database error | Account identity/status/record cleanup/session changes and enrollment/block changes are transactional | PASS: injected account-write failure preserves identity and valid session |
| R04 | Subject owner could inspect but could not grade administrator-authored work | Subject owner/admin may assess course learners; creator-only content edits remain enforced | PASS: owner grades exam, content edit still denied |
| R05 | A failed PDF reauthorization left the previous bitmap visible | Clear private image during recheck/on error, disable failed navigation, recheck on resume | Reviewed; Android build/lint gate; actual lifecycle/revocation display NOT TESTED |
| R06 | Scanner return could overlap resume refresh and delay enrollment; QR intent could be lost at login/password change | Dedicated scan state suppresses competing refresh; pending QR subject survives saved state and required sign-in flow | Reviewed; API enrollment/auth regression PASS; camera/rotation/process runtime NOT TESTED |
| R07 | Eligibility edits could silently overwrite another editor's rule | Expected policy revision; atomic save and removal of no-longer-eligible automatic enrollments | PASS: stale policy 409, revoked student denied |
| R08 | Student identity could not support safe instructor ID allowlists | Admin-only normalized unique student_number; enrollment ignores student-supplied IDs; correction/deletion removes old grants and ends sessions | PASS: spoofing/duplicate/correction/deletion tests |
| R09 | Token persistence failure was ignored; session/draft clearing used separate commits | Fail sign-in visibly when persistence fails; clear token/drafts in one preference commit | Reviewed; Android storage/Keystore fault validation NOT TESTED |
| R10 | Test APK publication did not run the known critical/high defect gate | Verification now invokes release_gate --test-build before publishing | PASS: gate rejects critical/high fixtures, wrong/stable candidate tags; normal prerelease passes |
| R11 | Account registration discarded entered fields on validation/network errors | Keep registration dialog and fields until successful creation; validate verified student ID before request | Reviewed; runtime interaction NOT TESTED |

## Feature acceptance and remaining boundaries

Eligibility is a list of up to 1,000 institution-issued IDs or All students, meaning active registered student accounts. Empty list plus unchecked All closes automatic enrollment. Student IDs are strings with leading zeros preserved, normalized to uppercase, 3–32 ASCII letters/digits/hyphens. Unknown IDs may be pre-authorized before account registration; only an administrator can bind an ID to an account.

QR data identifies a subject and is never a credential. The configured organization server checks active role/session, mandatory password change, eligibility and administrative blocks. Repeated scans cannot duplicate enrollment. The list is never exposed to students; discovery returns only eligible subject ID/title/description. Instructor B cannot inspect or modify instructor A's rule.

New QR/self enrollments are removed when no longer eligible; learning records remain for later authorized restoration. Explicit administrator enrollments and migrated pre-v3 enrollments remain authorized overrides. Administrative removal blocks rejoining even under All students. Migration cannot reconstruct which pre-v3 enrollments were administrative, so it labels them legacy and preserves them; administrators must review/revoke them when applying a stricter institution policy.

The white/navy/gold UI uses navy text and primary actions, gold progress/selected navigation highlights, generous padding and ≥56dp action targets. Color is accompanied by text/counts; it does not imply passing. Screen-reader, 200% fonts, narrow/landscape layouts and actual contrast/rendering remain device acceptance gates.

No new dependency/service was introduced. Existing direct versions/toolchain remain pinned. No blanket CVE-free or production-security claim is made: transitive advisory audit, institution MFA/host hardening/load/backup restoration, real organization Drive and production signing remain open deployment gates. Current self-review has no unresolved confirmed critical/high defect; use the per-commit build result and KNOWN_ISSUES for promotion, not this prose alone.
