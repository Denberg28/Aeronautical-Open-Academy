# Current development checkpoint

Goal: pin subject/progress while content scrolls and standardize professional paragraph/text formatting app-wide, from the user's test.95 screenshots. Repository Denberg28/Aeronautical-Open-Academy. Baseline d352516 / v0.10.1-alpha.1-test.95. Branch ui/pinned-subject-typography. Standing PR/source/prerelease delivery is authorized; no signing or live database changes.

Implemented: shared mounted SubjectHeader for account/public subjects, student progress outside the content viewport, full title/description under Info, shared AcademyTypography for native UI/dialogs, 1.4 body / 1.2 heading line height, 16 sp readers, 12 dp paragraph gaps and lead-in emphasis preserving words/link spans. No data/schema changes. Version 0.11.0-alpha.1.

Verification: local diff/content/XML/secret checks pass. Android build/lint/JVM and emulator checks are pending CI. Added rendered paragraph/link/idempotence regression and scroll assertions for fixed title/progress. Existing assessment/account checks remain required. Physical-phone, landscape/large-font, TalkBack, performance and signed-upgrade acceptance remain NOT TESTED.

Next: review final diff, push through PR, inspect CI, fix any failures, merge and verify main publication and six screenshots. Emulator setup retains the prior Pixel Launcher isolation. Final PR/workflow/release records hold delivery status and source SHA. No stable promotion without device gates.
