# Academy PC 0.8.0-rc.1 — shared access and sync

Add Sync in the upper toolbar, account-wide sign-out, capability negotiation with the main organization API, instructor PDF upload via a native picker and protected canvas page reading. Student download/print/external-reader controls are absent; native download events and save/print shortcuts are blocked. Each page turn rechecks current access/revision. The service denies legacy offline download grants.

The PC demo backend uses durable hashed authentication budgets (schema 11), strict identity parsing, private DB creation and atomic session/password writes. It backs up existing local data to academy-before-pc-0.8.sqlite before upgrade. Demo data stays local. Organization mode must use the same updated HTTPS API as APK and Streamlit. No live database or signing identity is changed.

See SHARED_ACCESS_SYNC.md for the exact contract, copying limits and tests. CI must pass Windows native UI (including actual PDF rendering/revocation), packaged startup, backend regressions, audit and packaging checks. Real institutional hosting, Drive access, physical Windows accessibility and deployment backup/restore remain unverified. This is an unsigned development candidate; retain the prior ZIP and matching database backup for rollback.

Previous release notes follow for history.

# Academy PC 0.7.0-rc.1 — mobile features on Windows

The subject title and student progress stay fixed while center content scrolls. The three-pane Windows layout retains its editor, drag ordering, tasks, grading and Excel exports. Read expands lesson text and references; shared 16 px text, 1.4 line height, 12 px paragraph gaps, lead-in emphasis and hanging lists improve readability.

Local practice now uses one full AE 101 subject with four periods, eight lessons, eight quizzes, four selection activities and four selection examinations: 16 forms and 40 questions. Take an assessment, select one answer per question and submit to see correct/total and percentage. Completed cards collapse to read-only Review. Instructors can create automatically scored selection activities/exams using Response type; legacy written work and manual grading remain supported. No assessment PDF/text download is added.

Schema 10 preserves existing accounts, IDs, grouping, attempts, written work and grades. A consistent local schema-9 snapshot is saved before upgrade. Only exact untouched factory content is replaced; old entries/history are archived, edited subjects are retained, and template installation is idempotent. Close the previous app before extracting/running this version. Keep the prior app and the complete private data backup; rollback requires its matching snapshot. Never interchange PC and Android-backend database lineages. No live organization database was deployed or migrated.

Extract the entire Windows x64 ZIP and run Academy.exe. Default local accounts: admin/admin, instructor/instructor, student/student. Local PC and phone workspaces are independent. Organization use requires a validated compatible backend; older clients cannot open new selection activities/exams. No signing identity or auto-updater is introduced.

Development prerelease. CI evidence must identify the exact source and passed Windows native/packaged, backend, migration, audit and package gates plus the paired Android regression build. Consult windows-verification.json and release-verification.json. Physical Windows accessibility/DPI, real provider access, production deployment and signed upgrade remain NOT TESTED.
