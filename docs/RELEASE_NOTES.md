# 0.11.0-alpha.1 — fixed subject context and readable text

The subject title and student progress are pinned above the scrolling lesson/assessment cards. The back arrow returns to subjects; the information icon opens the full title and description. Results stay in bottom navigation. Public subjects have the same fixed title without account progress.

Shared professional formatting applies across screens, lessons, assessments, editors, dialogs and PDF viewer controls: start alignment, medium-weight headings, 1.4 body line height, 1.2 heading line height, 16 sp reading text, consistent insets and a 12 dp paragraph gap. Existing blank lines, words, clickable links and hanging list indentation are preserved. Formatting can be reapplied without accumulating gaps. PDF page contents and stored course text are unchanged.

Required CI includes Android build/lint/JVM/backend/content checks, rendered paragraph/link-preservation checks and Android 35 UI smoke tests. The scroll test checks that subject title and progress bounds stay fixed while content moves; release screenshots include the pinned subject and lesson paragraphs. Final workflow results are authoritative. Physical-phone, 320 dp/landscape, TalkBack, performance and signed-upgrade acceptance remain pending; this is a development prerelease. No schema, signing identity or live backend change.
