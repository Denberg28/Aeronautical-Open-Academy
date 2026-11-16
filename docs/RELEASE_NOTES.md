# 0.8.2-alpha.1 — clearer navigation and forms

The Android workspace keeps its header and bottom navigation visible while the center content scrolls. Subjects and News are directly available; students also get Results and administrators get Accounts. Subject pages have a visible return to My subjects. The existing menu retains QR enrollment, reports and account actions.

White cards sit on a pale background, active destinations use a soft gold highlight, buttons have ripple feedback, and forms keep their labels above entered text. Sign-in adds Show password, keyboard submission and inline required-field messages; failed requests retain the password for correction. Requests display an activity bar and disable action buttons until completion. Quiz choices have a 48 dp minimum height.

The public library has shorter headings, a result count, clear-search recovery, a loading indicator and PDF transfer progress. Empty announcements have an explicit message. Transparent + controls, personal subject ordering and the temporary screenshot policy remain available.

Development source candidate. Existing GitHub Actions runs source/core/catalog/backend checks, JVM tests, Android debug/release builds and lint. See the current run before claiming build verification. Phone layout, TalkBack, keyboard and gesture acceptance remain NOT TESTED; see docs/TESTING.md. No backend, data schema, signing or dependency changes. Rollback to source ff937326b56fd973db1e1842d41455c0eb076917; retain the prior APK and its matching signing identity.
