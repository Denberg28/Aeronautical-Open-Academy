# Security release — 0.9.0-alpha.1

Updated: 17 November 2026 (Asia/Manila). Repository: Denberg28/Aeronautical-Open-Academy.

## Scope and baseline

Strengthen existing administrator-led account registration, authentication, SQLite persistence and external reference handoff. Preserve subject IDs, enrollment, learning records, UI layout, provider-owned material storage and package identities. No public self-signup, new hosting, identity provider, live database changes, new signing key or paid service.

Baseline: commit 3e1c1d513099d2943a942be8c9fd7807e09657c0; published development APK v0.8.3-alpha.1-test.70; Android verification run 43969280880 succeeded. This is build evidence, not physical-device or deployed-service acceptance.

User flow: admin signs in recently -> registers a validated account -> privately delivers its temporary passphrase -> recipient signs in -> sets a different passphrase -> signs in again -> accesses only permitted subjects. Familiar HTTPS providers retain direct handoff. Other hosts and HTTP links show the full destination; Open reauthorizes the current reference before browser launch.

## Acceptance and verification

| Outcome | Controlling code | Expected check |
| --- | --- | --- |
| Preserve admin-only registration and reject access-field injection / malformed identities | server/src/server.mjs createAccount/admin route; security.mjs accountName/email | API invalid registration leaves no account; valid Unicode names and normalized email work; existing role/duplicate tests pass |
| Temporary passphrases cannot be retained | server.mjs auth/password | Reuse returns 400, remains restricted; different password revokes old sessions |
| Credential/session/audit writes fail together | server.mjs transaction/createAccount/password routes | Injected audit failure leaves old password/session/restriction intact |
| Rotating email does not bypass peer budget; normalized account budget survives restart | server.mjs throttle; store.mjs security_limits | 10 account attempts and 100 peer attempts per 15 min; HTTP restart stays 429; expiry recovers |
| Migrations preserve data or roll back fully | store.mjs openDatabase | v1-v5 -> v6; reopening preserves IDs/results/order; orphan rejects startup and retains old schema/version |
| Private database creation | store.mjs openDatabase | POSIX mode 0600; symlink database path rejected on CI Linux |
| Unsafe/deceptive links stay noninteractive | links.mjs; KnowledgeLinks.require | Both suites reject escaped authority/control/bidi/local arpa examples; normal provider URLs still work |
| Destination is visible for unfamiliar/HTTP links | WorkspaceActivity.openExternal; KnowledgeLinks.needsConfirmation | Core classification passes; physical-device Cancel/Open/revocation acceptance remains required |

Authentication budgets count attempts, including successful attempts. They store SHA-256 bucket keys, hits and expiry, not raw email/IP, passwords or tokens. These hashes are not anonymization against guessing. Maximum 5,000 active buckets; exhausted capacity fails closed with 429. Expired rows are removed on the next budgeted request. Registration is limited to 30 attempts per recently signed-in administrator per 15 minutes; password changes to 10 per account. Invalid login email still consumes the peer budget.

Peer identity is the TCP remote address. Forwarded headers are ignored. Behind a reverse proxy the shared backend peer budget applies to all users; configure perimeter rate limits and verify expected institutional load. Budgets are for this single database/service, not distributed protection or MFA. No account is permanently locked or deleted by throttling.

## Database and rollback

Schema v6 adds durable security_limits and an expiry index for sessions; domain records are unchanged. Pending version migrations run in one transaction. SQLite quick_check and foreign_key_check must pass before commit/service startup. Errors close the connection; failed pending migrations roll back. File permissions and integrity checks do not encrypt records.

Before deployment, stop the old service, take a consistent complete database/material backup, and test restoration privately. Restrict the data directory and backup permissions to the service operator. Start the matching backend and verify account/subject/results against the backup. Older servers reject v6; rollback requires stopping the new backend and restoring the matching old backup/server. Never lower user_version manually. No live organization database was accessed or migrated during this change.

## Delivery and remaining gates

Use GitHub Actions on the final commit for source/core/Python/backend tests, Android unit tests/lint/debug/unsigned-release build, APK signature/package evidence and checksums. This document is a specification and self-review record, not a claim that those commands ran locally. The editing session has no local execution host.

Publish only after required automated checks pass. Development test APK uses the existing debug/test packaging; persistent organization release signing remains unconfigured. Debug rebuild certificates may differ, so in-place upgrade is not guaranteed. Do not uninstall an installation holding wanted local data without exporting it.

Physical-device dialog layout/Cancel/Open, revoked enrollment during confirmation, provider app handoff, install/upgrade, protected cache and accessibility remain NOT TESTED. Public HTTPS backend deployment, proxy/load behavior and private backup restoration remain BLOCKED. Stable promotion is blocked. Known external DNS resolution, redirects, same-URL content changes and provider sharing remain outside initial-URL validation. Host confirmation is not a malware/phishing scan.

Canonical development guidance adopted: AGENTS v1.4 (blob b4bfa100b7810659f5b9415514efa560a7f6b0af), Constitution v3.2 (4904242233a9ac4dc997e5a1525d4a2ed6f0ad49), kickoff v1.3 (b06c5f7d2a77ad4ebf3712ccbcd461298cc2e448). Preserve Academy-specific security/build/device gates. No additional agents were used.
