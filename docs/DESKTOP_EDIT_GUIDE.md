# Windows focused edit guide

| Desired result | File | Section/symbol | Edit and scope | Check |
| --- | --- | --- | --- | --- |
| Change body typography and paragraph spacing | desktop/ui/style.css | shared reading rhythm / --body-leading / --paragraph-gap | 16 px body, 1.4 line height, 12 px paragraph gap; controls keep their role sizing | Native reader screenshot and paragraph measurement |
| Change fixed subject/progress layout | desktop/ui/app.js and desktop/ui/style.css | renderSubject / #subject-context / .center-pane | Header outside #center; only #center scrolls; compact responsive pane rules | Fixed bounding-box checks, 1480/900 px layouts |
| Change text/list formatting | desktop/ui/app.js | readingText / bodyParts | Escape all author text; separate paragraphs, emphasize lead-ins and align wrapped list content | Reader/unsafe-reference tests; never insert raw HTML |
| Change the practice course | desktop/assets/subject-template.json | overview / periods[].entries | Canonical mobile-derived course: 25 entries, 16 forms / 40 questions; synthetic content only | Template/full submission tests; do not alter real student data |
| Change conservative template upgrade | desktop/template.mjs and desktop/bridge.mjs | installPracticeTemplate / startLocal | Exact factory fingerprint, transaction, marker and consistent pre-upgrade snapshot | Upgrade, edited work, archive/idempotence tests |
| Change selection scoring and limits | server/src/server.mjs and server/src/quizzes.mjs | answers route / validateQuestions / gradeAnswers | Server-authoritative correct/total and normalized activity score; current revision and idempotency | Permissions/key/retry/grade protection tests |
| Change question authoring | desktop/ui/app.js | renderComposer / renderQuizBuilder / response-mode | Existing quiz editor reused for selection activities/exams; written mode preserved | Native authoring and legacy grading tests |
