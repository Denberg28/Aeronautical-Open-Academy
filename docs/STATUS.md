# Current development checkpoint

Current scope: complete shared access/sync and protected reading for APK, Streamlit and Windows. Main baseline `af0188a`; branch `feat/unified-access-sync` combines recovered commits `a1ed9d0` and `e5df603`. Windows baseline `713e75e`, branch `feat/desktop-shared-sync`, remains separate because its demo schema 11 cannot replace the main schema 7. Public source/PR/development prerelease delivery is authorized. No live database, signing identity or provider permissions changed.

Implemented: shared sync receipts/global session revocation, protected student export denial including legacy flags, bounded web page-image reader, API-origin-bound sessions, retained stale editor snapshots, changed-assessment review, displayed-intent reading actions and optional revision-aware legacy writes. Integration removes duplicate web sync controls. Windows uses the matching API contract and internal PDF canvas reader; its checks and delivery status are recorded in DESKTOP_STATUS.md on its branch.

Local Node 24.22.1/Python 3.12.14 verification: 42 main backend tests, 16 web transport/AppTest integration tests, 12 catalog/release tests, 93 Java core checks, syntax for 29 Java files, source/configuration/content and candidate checks pass. Android build/lint/JVM/emulator and final publication require exact-source CI results. Next: push reviewed source through PR, inspect gates, merge verified source and verify the main development prerelease; no stable promotion. GitHub PR/workflow/release records hold final source/result evidence.

The user reports Streamlit setup complete; no production API URL or credentials are recorded here. Deploy the matching API advertising sync and `revision_writes` before the portal using consistent backup/restart/restore checks. Live HTTPS/Drive, real cross-device login, physical-phone/Windows accessibility and signed upgrade acceptance remain unverified. Earlier checkpoint below is historical.

Goal: pin subject/progress while content scrolls and standardize professional paragraph/text formatting app-wide, from the user's test.95 screenshots. Repository Denberg28/Aeronautical-Open-Academy. Baseline d352516 / v0.10.1-alpha.1-test.95. Branch ui/pinned-subject-typography. Standing PR/source/prerelease delivery is authorized; no signing or live database changes.

Implemented: shared mounted SubjectHeader for account/public subjects, student progress outside the content viewport, full title/description under Info, shared AcademyTypography for native UI/dialogs, 1.4 body / 1.2 heading line height, 16 sp readers, 12 dp paragraph gaps and lead-in emphasis preserving words/link spans. No data/schema changes. Version 0.11.0-alpha.1.

Verification: local diff/content/XML/secret checks pass. Android build/lint/JVM and emulator checks are pending CI. Added rendered paragraph/link/idempotence regression and scroll assertions for fixed title/progress. Existing assessment/account checks remain required. Physical-phone, landscape/large-font, TalkBack, performance and signed-upgrade acceptance remain NOT TESTED.

Next: review final diff, push through PR, inspect CI, fix any failures, merge and verify main publication and six screenshots. Emulator setup retains the prior Pixel Launcher isolation. Final PR/workflow/release records hold delivery status and source SHA. No stable promotion without device gates.
