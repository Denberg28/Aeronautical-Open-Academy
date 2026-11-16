# 0.8.3-alpha.1 — steady tabs and less text

Tab navigation keeps the header, menu, bottom tabs and system insets in place. Only the center content changes. The workspace page slide is removed; scroll positions restore before drawing rather than in a later posted frame. Public tabs share their scroll viewport and tapping the active public tab does nothing. Page offsets survive rotation; the existing subject-list layout state still preserves its position.

The workspace loading bar reserves a fixed 3 dp strip and appears only when a request lasts at least 150 ms. Routine Working text no longer expands/collapses the header. Busy actions remain disabled and error dialogs remain available.

Account name/role/student ID move into Menu. Repeated introductions, public-library sync chatter and duplicated form hints are removed; forms retain visible labels. Action labels and progress summaries are shorter. Student work, linked content, grades, access errors, failed download/catalog notices and submission/deletion confirmations remain available. Detailed progress stays in accessibility descriptions; catalog status is also in Help.

Development test release. Automated checks use the existing GitHub workflow; consult the run tied to the APK before claiming build verification. Visual smoothness/frame timing, keyboard, TalkBack, landscape and upgrade behavior require physical-phone testing and are NOT TESTED here. No dependencies, schema or signing changes. Rollback baseline: v0.8.2-alpha.1-test.66 at 6934711930553ecdc89c343c977c7f2017f74f31; retain its APK and matching signing identity.
