# Focused edit guide

Edit authored sources by stable symbols, then run affected checks. Keep settings authoritative; do not edit generated APKs or build output.

| Desired result | File | Section / symbol | Edit, units and scope | Related check |
| --- | --- | --- | --- | --- |
| Change sign-in/registration budgets | server/src/server.mjs | throttle and route calls | 15-minute window (milliseconds), account default 10, peer 100, registration 30; persisted per scope | Backend abuse/restart tests; proxy load acceptance |
| Change identity validation | server/src/security.mjs | accountName/email | Single-line names 100 chars; email 254 chars, local part 64; ASCII email with Unicode names | API registration and duplicate tests |
| Change database upgrade | server/src/store.mjs | openDatabase | Add version migration inside shared transaction; preserve existing IDs and records | Migration/reopen/orphan/rollback tests |
| Change clickable destination policy | server/src/links.mjs and app/src/main/java/org/aeronautical/openacademy/core/KnowledgeLinks.java | externalUrl / require | Keep both initial URL policies aligned; no fetch/proxy | npm test; coreChecks; provider handoff |
| Change destination review hosts | app/src/main/java/org/aeronautical/openacademy/core/KnowledgeLinks.java | needsConfirmation | Exact HTTPS host list; all HTTP remains reviewed | Core classification; phone Cancel/Open/revocation |
| Change link dialog text | app/src/main/java/org/aeronautical/openacademy/WorkspaceActivity.java | openExternal / launchExternal | Full host and URL shown before current-reference authorization | Android lint/build; phone accessibility |
| Restore screen capture protection | app/build.gradle | SCREEN_CAPTURE_ALLOWED | Existing boolean build policy | Physical screenshot/recording and protected-view checks |
