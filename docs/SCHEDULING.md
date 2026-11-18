# Scheduled publishing and completion deadlines

Instructors and administrators can set dates on every saved material, quiz, activity and examination. Create an entry as a draft when it should not be visible immediately, upload any protected PDF, then open **Publishing and due date** (Android entry menu / web entry) or **Schedule** (Windows entry actions).

Choose Draft, Publish now or Scheduled. All date pickers/displayed captions use Asia/Manila (PHT, UTC+8); the API stores UTC milliseconds. Enable a completion due date as needed, or clear it to remove the deadline. Saving dates checks the displayed edit version; if someone changed the entry, reload it before saving again. Date changes increment edit_version, not the content revision: prior submissions, scores and reading completion remain intact.

Scheduled entries are hidden until the exact server publish time, including direct item/file/link/submission access, learner totals, task lists and exports. Release is derived from persisted timestamps on each authorized request, so no browser tab, cron task or client clock is required. Students use Sync/refresh to receive newly available work. Windows child assessments remain hidden while their parent material is unavailable. PDF entries must have their file uploaded before scheduling.

Due dates are advisory. Unfinished work becomes Overdue strictly after the deadline; completion at the deadline counts on time. Work remains accepted afterward and is marked Completed late without an automatic grade penalty. Actual submission/reading timestamps determine status; repeated identical reading acknowledgements retain the original time. Instructors see overdue/late status in learner details and Due UTC / Deadline status in Excel exports. Due dates do not add retakes, notifications, grade penalties or automatic closure.

## Deployment and recovery

Deploy the matching API advertising scheduling=dates-v1 before the clients. Existing clients remain compatible but do not expose date controls. The main API migrates schema 7 to 8; the separate Windows local demo migrates schema 11 to 12. Nullable columns preserve existing immediate publication and no-deadline behavior. The Windows app takes a consistent academy-before-pc-0.9.sqlite backup before upgrading older local data. Never interchange the two database lineages.

No live database was opened or migrated during source development. Before updating a deployed API, stop writes, take and restore-test a consistent database/material backup, then deploy the matching server. Keep the previous application and matching backup; an older server refuses a newer schema. Rollback requires restoring that compatible pair, not downgrading the database in place.

## Verification

Host checks exercise all four entry types before/at/after release and deadlines; unauthorized/stale/malformed dates and failed audits; late work retention, on-time repeated reading, preserved grades/revisions, grouped visibility and exports; nullable migration/reopen persistence. Web AppTest exercises real API scheduling, Philippine-time conversion and student deadline isolation. Windows native tests exercise all four schedule forms, hidden future entries and overdue captions. Android test-workspace tests cover schedule persistence/visibility and all four types. CI must pass final Android build/lint/JVM/emulator and Windows native/package/audit gates before candidate publication. Physical devices, live deployment, clock synchronization and production restore remain unverified.

| Desired result | File | Section / symbol | Check |
| --- | --- | --- | --- |
| Change visibility / due policy | server/src/schedule.mjs | released, timing, scheduleFields | Exact boundary and HTTP authorization tests |
| Change date controls on Android | EntrySchedule.java | show, picker, caption | JVM/local-workspace and real device checks |
| Change web controls | web/schedule.py | schedule_controls, timing_caption | AppTest with API and PHT conversion |
| Change Windows controls | desktop/ui/schedule.js | show, caption | Native scheduling suite; packaged asset check |
