# 0.9.0-alpha.1 — account, database and link security

Account creation remains administrator-only. Registration validates names/emails and rejects injected access fields. Recipients must choose a different passphrase from the temporary one. Separate login budgets cover normalized account identity and TCP peer; limits survive backend restarts. Password-change and registration paths are bounded. Account creation and password/session/audit changes commit together.

Database schema v6 preserves existing account, subject, enrollment and learning records. Pending migrations share one transaction; failed integrity checks block startup. Database files are created with private permissions. Back up the stopped service consistently before deploying the matching backend. Older servers reject v6; rollback requires the matching pre-upgrade backup and old backend.

Backend and Android reject invisible/encoded-control and deceptive-authority links. Unfamiliar hosts and HTTP links show the full destination before Open performs a fresh access/reference check. Familiar exact HTTPS Google Docs/Drive and YouTube hosts keep direct handoff. Provider sharing, DNS/redirects and later content are outside this initial URL policy.

Shared development instructions updated to AGENTS v1.4, Constitution v3.2 and kickoff v1.3. Focused code edit and acceptance/rollback guides are included in source.

Development test prerelease. Check the linked Actions run and verification.json for automated evidence. Physical-phone installation, destination dialogs, lifecycle, accessibility, provider handoff and signed upgrade remain unverified. Organization backend hosting, private backup restore and persistent organization signing remain blocked. The APK uses the existing debug/test identity; CI debug certificates may differ, requiring careful data export before any reinstall. This is not a validated stable release.

Previous APK/source baseline: v0.8.3-alpha.1-test.70 at 3e1c1d513099d2943a942be8c9fd7807e09657c0. No live organization database was changed. Install the matching backend separately to apply server protections; installing only the APK does not upgrade a hosted server.
