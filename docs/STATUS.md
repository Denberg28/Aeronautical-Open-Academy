# Current development checkpoint

Current task: Streamlit portal for uploading/accessing Academy materials. Baseline `655847a`, branch `feat/streamlit-materials`; standing source/PR delivery authorized. Implemented the Python web client and configuration, reusing existing API accounts/subjects/storage/assessments; no backend schema, Android or signing changes. Eight real loopback API/Streamlit integration/transport tests, 40 Node regressions, 12 existing Python tests and project checks pass locally. Details and deployment instructions: STREAMLIT.md; CI workflow: web.yml.

Live deployment blocked: Streamlit Community Cloud dashboard is signed out, no persistent public HTTPS API origin is recorded, and actual Shared Drive credentials/folder are not configured. Text/link mode needs no Drive credentials; binary PDF upload needs the existing Drive adapter on the API host. No paid service or live database is created/migrated. Next: merge verified PR, sign in to Streamlit, provision/select persistent API host, configure private secrets and validate real browser/Drive/restart/restore. The previous Android checkpoint below remains historical.

Goal: pin subject/progress while content scrolls and standardize professional paragraph/text formatting app-wide, from the user's test.95 screenshots. Repository Denberg28/Aeronautical-Open-Academy. Baseline d352516 / v0.10.1-alpha.1-test.95. Branch ui/pinned-subject-typography. Standing PR/source/prerelease delivery is authorized; no signing or live database changes.

Implemented: shared mounted SubjectHeader for account/public subjects, student progress outside the content viewport, full title/description under Info, shared AcademyTypography for native UI/dialogs, 1.4 body / 1.2 heading line height, 16 sp readers, 12 dp paragraph gaps and lead-in emphasis preserving words/link spans. No data/schema changes. Version 0.11.0-alpha.1.

Verification: local diff/content/XML/secret checks pass. Android build/lint/JVM and emulator checks are pending CI. Added rendered paragraph/link/idempotence regression and scroll assertions for fixed title/progress. Existing assessment/account checks remain required. Physical-phone, landscape/large-font, TalkBack, performance and signed-upgrade acceptance remain NOT TESTED.

Next: review final diff, push through PR, inspect CI, fix any failures, merge and verify main publication and six screenshots. Emulator setup retains the prior Pixel Launcher isolation. Final PR/workflow/release records hold delivery status and source SHA. No stable promotion without device gates.
