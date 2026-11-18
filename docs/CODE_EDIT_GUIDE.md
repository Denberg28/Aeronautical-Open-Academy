# Focused edit guide

| Desired result | File | Section/symbol/property | Edit and units/scope | Related settings and check |
| --- | --- | --- | --- | --- |
| Change online sync and draft reload | `web/portal.py` | `workspace` / `subject_controls` / `edit_material` / `assessment` | Explicit read refresh; one displayed edit snapshot per kind; revision-specific assessment inputs | Multi-session AppTest; stale saves must never overwrite newer work |
| Change API session binding | `web/portal.py` | `sign_in` / `main` / `session_origin` | Exact configured issuer origin; clear token and drafts before switching | Changed/unbound origin test must make zero authenticated requests |
| Change legacy revision compatibility | `server/src/server.mjs` | `currentRevision` / `/v1/me` `revision_writes` | Optional for older clients; supplied revision must equal current integer revision | HTTP stale/malformed/replay tests and backend capability negotiation |
| Change web colors | `.streamlit/config.toml` | `[theme]` | Hex colors; Streamlit portal | Contrast, keyboard focus and mobile browser |
| Change web paragraph spacing and scroll area | `web/portal.py` | `STYLE` / `workspace` | CSS rem spacing; 480 px content region and 400 px PDF viewer | AppTest plus actual mobile scrolling/zoom |
| Change web API destination | Private Streamlit Secrets | `ACADEMY_API_URL` | HTTPS origin only; operator setting | `/v1/me` capability and sign-in; never commit real secrets |
| Change web PDF limits/timeouts | `web/api.py` | `MAX_PDF_BYTES` / `AcademyAPI.request` | Bytes and seconds | Keep server 50 MiB and Streamlit maxUploadSize aligned; checksum/conflict tests |
| Change web draft/upload/publish workflow | `web/portal.py` | `add_material` / `edit_material` | Existing item edit-version guards; API-owned records | `web/tests/test_portal.py`; real file picker/Drive checks |

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

| Change subject lessons, periods or assessment prompts | app/src/main/assets/subject-template.json | overview / periods[].entries | One guide; each period has 2 materials, 2 quizzes, 1 activity, 1 examination; quiz indices zero-based | Template acceptance, full-course submission tests; regenerate handouts |
| Regenerate public handouts/catalog | tools/generate_samples.py | outputs / pdf | PDF points: width 595, height 842, 46-point left margin, 10-point text; preserve resource IDs and increase revision on byte changes | --check, PDF/hash/catalog checks and phone rendering |
| Change factory template upgrade | app/src/main/java/org/aeronautical/openacademy/testing/TestWorkspace.java | untouchedLegacy / installTemplate / importTemplateEntry | Exact fingerprint only; preserve IDs/history and back up before schema v3 | Upgrade, edited-work preservation, failure rollback and idempotence tests |

| Change form limits and scoring | app/src/main/java/org/aeronautical/openacademy/ChoiceAssessment.java and server/src/assessments.mjs | validate/questions; score/scoreAnswers | 1–20 questions, 2–8 choices, prompt 2000 chars, choice 300 chars; normalized /100 | JVM and backend invalid/retry/score tests; keep both policies aligned |
| Change question authoring layout | app/src/main/java/org/aeronautical/openacademy/ChoiceFormEditor.java | QuestionRow / field / action | Native input sizes in sp; inset/gaps in dp; correct answer selection | Android lint/build; rotation/editor validation |
| Change student forms/results | app/src/main/java/org/aeronautical/openacademy/WorkspaceActivity.java | openChoiceForm / showChoiceForm / formResult | Compact card → authorized modal → submit/result/review; encrypted account/item/revision draft | Complete workflow, stale/duplicate/permission checks; phone lifecycle |
| Change shared card inset | app/src/main/res/values/dimens.xml | academy_card_padding | 18 dp padding inside cards in both activities | 320 dp/large-font visual check |
| Change text/list alignment | app/src/main/java/org/aeronautical/openacademy/ReadingText.java | apply / MARKER | Start alignment and measured hanging indentation; preserve link spans | Long numbered lines, links, TalkBack |
| Change Help spacing/actions | app/src/main/java/org/aeronautical/openacademy/MainActivity.java | showHelp / helpStep / button / navButton | 24 dp sections, 12 dp paragraph gaps; start secondary actions, centered primary/nav | Screenshot comparison and 200% fonts |

| Keep the public header compact | app/src/main/java/org/aeronautical/openacademy/MainActivity.java | ensureShell / header actions | Sign in uses wrap-content width; brand labels single-line with ellipsis; card buttons retain full width | Android 200% font header smoke + phone check |
| Change public course actions | app/src/main/java/org/aeronautical/openacademy/PracticeTemplate.java and MainActivity.java | action / practiceSubject | Canonical entry metadata; Read for materials, distinct Take actions for assessments | 25-entry JVM check and Android sign-in/result flow |
| Change assessment handoff or reading | app/src/main/java/org/aeronautical/openacademy/WorkspaceActivity.java | openPendingPractice / pendingPracticeEntry / openReading | Carry exact template entry through local sign-in; authorize current content before opening | Android flow; rotation/foreign-account phone check |

| Change app-wide line height and dialog text | app/src/main/java/org/aeronautical/openacademy/AcademyTypography.java | style / BODY_LINE_HEIGHT / HEADING_LINE_HEIGHT / dialog | 1.4 body and 1.2 heading multipliers; size in sp, medium headings; attach styling preserves form listeners | Rendered paragraph/link test, native forms and large-font checks |
| Change paragraph gaps and emphasis | app/src/main/java/org/aeronautical/openacademy/ReadingText.java and app/src/main/res/values/dimens.xml | ParagraphGap / PREFIX / academy_paragraph_gap | 12 dp after a paragraph, beyond normal wrapped-line spacing; skip extra gap before existing blank lines; preserve original text/spans | TypographyLayoutTest and reader screenshot |
| Change fixed subject context | app/src/main/java/org/aeronautical/openacademy/SubjectHeader.java | bind / title / progress | Mounted above scroll; title up to 3 lines portrait, 1 landscape; full title/description via information action; student progress only | Compare title/bar bounds after scrolling; large-font/landscape phone checks |
| Change screen spacing | app/src/main/res/values/dimens.xml | academy_screen_inset / academy_content_gap / academy_card_padding | 20 dp horizontal viewport, 16 dp content gap, 18 dp inside cards | Screenshot review; keep layout touch targets at least 48 dp |

Scheduling controls, UTC/PHT conversion, access timing and deadline reporting: see [SCHEDULING.md](SCHEDULING.md).
