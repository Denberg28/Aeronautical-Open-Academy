# Aeronautical Academy Repository 0.11.0-rc.1 — Windows desktop application

Windows x64 test candidate / prerelease. Adds **instructor-guided fullscreen presentation mode** for quizzes, activities, and examinations — click **Play** on any assessment card to flash questions full screen with lettered options (`A`, `B`, `C`, ...) only (no answer selection or key during play), **Previous** / **Next** arrow buttons (`ArrowLeft`/`ArrowRight`), and an end-of-item **confirmation dialog** to reveal the class answer key (restricted to the authoring editor or administrator; hidden from students and read-only instructors). Also adds **admin hierarchical subject folders in the left navigation pane**: administrators can create folders and nested subfolders (up to 5 levels), drag and drop subjects into folders (or back to top level), and drag and drop folders to reorder siblings, nest inside other folders, or move back to root (with `Alt+Arrow` keyboard hierarchy shortcuts, inline rename, and safe delete that moves contents up one level without deleting subjects).

Includes all 0.10 features: **Aeronautical Academy Repository** branding (preserving `Academy.exe` and the `aeronautical-open-academy-desktop` Electron user-data folder for seamless local upgrade continuity), administrator per-subject instructor access control (**Active** / **Suspended**, **Read only** / **Editor**), **Student · Reader** default with no download capability (`View only · downloads disabled`), and hardened admin-only registration and first-login passphrase rotation workflows.

See `../docs/SHARED_ACCESS_SYNC.md` and `../docs/SCHEDULING.md` for compatibility, download limits, global sign-out, scheduling, and migration/rollback. Existing PC databases are backed up consistently as `academy-before-pc-0.11.sqlite` before schema 14 (which adds `subject_folders` and nullable `subjects.folder_id`); never copy a PC database to the main organization API. Close and restore the complete matching backup/backend before downgrading. Tokens stay in the main process in memory; no organization password/token is saved to disk.

Development: Node 24, `npm ci --prefix desktop`, `npm test --prefix server`, `npm test --prefix desktop`, `npm run test:ui --prefix desktop`, `npm run package:win --prefix desktop`. Postinstall prepares pinned PDF.js vendor assets; regenerate them with `node desktop/tools/prepare-pdf.mjs`, never edit copied files. Source builds and native Windows CI are separate from physical Windows accessibility, real provider sign-in, and live organization deployment testing. Prior feature history follows.

## Earlier milestones (0.1–0.7)

## Mobile feature adaptation (0.7)

The current subject title and student progress remain fixed above the independently scrolling center pane. Open About this subject for the description. Materials use **Read** to expand their text and authorized references. Body text uses 16 px Segoe UI, 1.4 line height and 12 px paragraph gaps, with emphasized lead-ins and hanging lists across reading and display text. The three-pane desktop layout, drag ordering, grading and Excel exports remain available.

The local default is now one complete **AE 101 — Foundations of Aeronautical Engineering** template: Prelim, Midterm, Semifinals and Finals; 8 lessons, 8 quizzes, 4 selection activities and 4 selection examinations (16 forms, 40 questions), plus the course guide. Choose Take quiz, Take activity or Take examination, answer every question and confirm submission. Correct/total and percentage appear immediately; submitted cards collapse to a read-only Review. These are in-app forms, with no assessment PDF/text downloads.

Instructors can add an activity inside a material or an examination at subject level, choose **Response type → Selection form**, enter the question count, choices and correct answers, then Done. Activities/examinations support 1–20 questions and a normalized score /100. Existing quizzes retain their 1–50 question limit and numeric correct-count exports. Written response remains available for manually graded work; existing written work is preserved. Questions/keys remain immutable after creation.

The PC backend advances from schema 9 to 10. Before an older local database is opened, a consistent SQLite snapshot is saved as **academy-before-pc-0.7.sqlite** beside academy.sqlite. Only an exact, untouched two-entry factory subject is replaced in place; its IDs/history remain stored as archived entries. Edited subjects stay intact and receive a separate new template. Template installation is idempotent; archived subjects are never resurrected. Accounts, customized passwords, old work and grades are not reset. Close the old app and keep the complete app/data backup before updating; rollback needs the prior app and its schema-9 snapshot.

The matching PC server advertises choice_forms; older clients receive an update-required error on selection activities/exams. No live organization service is migrated. PC schema numbers come from the desktop branch and **must not be confused with the independent Android server/database lineage**. Do not point an existing Android-backend database at the PC server; unsupported lineage is rejected. Local PC and phone test data do not synchronize. Shared organization use needs its own validated compatible deployment.

Windows CI must pass backend/bridge/migration tests, existing native workflows, the new native parity workflow (author activity/exam, take all three types, 75% mixed result, fixed title/progress and readable paragraphs), dependency audit, package integrity and packaged startup. The release remains an unsigned test candidate; real Windows accessibility/DPI/provider/upgrade validation is separate.

Windows 10/11 x64 desktop **release candidate**. One window, three panes: collapsible LMS navigation on the left, instructor subject editor or student viewer in the center, announcements and subject tasks on the right. Electron supplies a consistent desktop UI and bundles Node/Chromium; the existing Academy backend enforces accounts, subject ownership, enrollment, draft visibility, grading, and link authorization. There is no subscription or additional cloud dependency for the local test workspace.

## Open the Windows application

Extract the **entire ZIP** to a folder, then double-click **Academy.exe**. Keep all files beside it; the executable alone is not portable. No Python, Java or Node installation is needed. Windows 10/11 x64 is the intended target. Windows ARM/macOS/Linux distributions are not included. This release does not have an organization code-signing identity or automatic updates.

Choose **Local test workspace** and sign in:

| Role | Username | Password |
| --- | --- | --- |
| Admin | admin | admin |
| Instructor | instructor | instructor |
| Student | student | student |

These intentionally public credentials access synthetic data on this PC only. The app maps the short aliases locally; they are never accepted/mapped by an organization service. The public local defaults are only for synthetic testing; use an organization server with individually assigned accounts for shared real classes. New accounts created by an admin require a 15–128 character temporary passphrase and a password change on first sign-in. Local data is stored in Electron’s user-data directory under `local-test-workspace/academy.sqlite`; replacing/extracting app binaries does not erase it. Close the app before backing up that directory. Do not downgrade a database with a newer schema; retain its backup and use the matching application.

## Instructor workflow

1. Choose a subject from the left pane, or **My subjects → New subject**.
2. Select **+ Add material or examination** below its final entry.
3. Type a text line; its first line becomes the title.
4. Select **Attach link**, paste the material’s HTTP/HTTPS address, then **Done**. Select Attach link again for another reference; up to 12 attachments fit one entry, within the existing 12,000-character total. Remove an attachment before saving if it is no longer needed. Google Drive, Docs, Sheets, Slides, image links, PDF links, YouTube and websites remain at the original host. Each reference shows its service label and hostname. Sharing keys, queries and sheet/slide targets are preserved; there is no link conversion, preview download or permission change. Share the original with the intended students and test with a student browser account.
5. Use the entry controls to edit, publish/unpublish, delete, or move it. Drag the grip at the left of an entry to place it above or below another entry. For keyboard reordering, focus the grip and press **Alt+Up / Alt+Down**.

Use the chevron beside a material title to minimize or expand its activities and quizzes. The adjacent number counts its children. This viewing preference lasts for the current sign-in, survives refresh and reorder, and resets when signing out. Search temporarily reveals matching children; clear search to restore the minimized sections. A nested editor stays visible until saved or cancelled.

Each material has **+ Add activity or quiz** below its last child. This composer offers only Activity and Quiz. The subject-level composer offers only Material and Examination. Existing standalone activities/quizzes remain visible; use Edit → Material to assign them. A material and its children move together; child grips reorder within their material. Edit → Material moves a child across materials without resetting its work or grade. Unpublishing a material hides all its children from students; republishing restores each child’s own publish state. Deleting a nonempty material explicitly confirms the whole group and retains historical records. Written activities, examinations and multiple-question quizzes use the same inline composer. **Enrollment** lets the instructor allow all students or verified student IDs. **Students & progress** shows reading, submitted work and grading separately; view a learner’s written responses to assess them and export the current roster page to Excel. Changing material text creates a new revision and requires new completion; grading/answers and current revisions are enforced by the shared backend.

## Student workflow

Open an enrolled subject, open material links in the system browser, mark reading as complete, answer quizzes and submit written work. **Tasks** and **My results** combine the visible subjects. **Find a subject** supports eligible-subject discovery and instructor subject codes. Material host permissions and external sign-in still apply. Reading is self-reported, not a grade or proof of comprehension. Written work and quiz attempts can be submitted once per entry revision.

Admins create accounts, suspend/reactivate access and publish/delete announcements. The center changes content in place; there are no extra application windows for routine LMS functions. Small confirmations protect deletion, final submission and unsaved work. Cancelling a window close keeps the local service running. If a session expires, signing back into the same account and workspace restores the in-memory unsaved form. Switching accounts/workspaces clears it; drafts are not crash recovery. If saving succeeds but refreshing fails, the saved form closes to prevent resubmission; select Refresh to reload the subject. A timeout during the write itself has an unknown outcome: refresh and check before creating a replacement. No automatic write retry is performed.

## Organization use and compatibility

Select **Organization server**, enter the HTTPS origin of an existing Academy backend and use that service’s credentials. The desktop uses the existing `/v1` API and database schema v10, using the updated backend. Older organization servers remain usable for flat content, but nested creation is disabled until the server is upgraded. It stores authentication tokens in main-process memory only, does not follow API redirects, and reauthorizes material links against their current revision before opening the browser. Organization services need valid HTTPS and the existing links-capable Academy backend. No live organization host has been deployed or verified by this change.

The local PC workspace **does not sync** with another PC or the Android test workspace. For shared classes, deploy a validated compatible schema-10 PC organization backend and connect clients to it. A local demonstration is not a multi-user deployment.

## Development

Node 24.x. `package-lock.json` pins dependencies. Electron 45.0.0 is a supported stable runtime at implementation time. Electron adds a larger download than a browser page but provides a self-contained Windows application, an isolated renderer and a main-process boundary without requiring users to install a runtime.

From the repository root:

```sh
npm ci --prefix desktop
npm start --prefix desktop
npm test --prefix server
npm test --prefix desktop
npm run test:ui --prefix desktop
npm run package:win --prefix desktop
```

Packaging downloads the official Electron Windows x64 archive with checksum validation, copies only the desktop runtime files and existing server source, and emits `out/Academy-PC-0.7.0-rc.1-win32-x64/`. It does not include databases, student records, `.env` files or organization keys. ZIP that directory for delivery. `node desktop/tools/verify-package.mjs` verifies the packaged Windows target and required resources. The Windows workflow performs native Electron UI tests, the packaged executable IPC smoke test, dependency audit and package hash verification as well as backend and renderer tests before uploading its artifact.

## Verification and limits

See `docs/DESKTOP_TESTING.md` for current evidence and release gates. This is an unsigned Windows release candidate. The Windows CI workflow tests both the native editor/viewer and the packaged executable. The delivered CI archive includes windows-verification.json identifying its exact commit and checks; physical-device accessibility and real provider sign-in still require acceptance. Android application source is unchanged; a paired Android regression build must pass before Windows candidate publication.

The focused PC workflow does not yet include camera QR scanning, protected uploaded-PDF viewing/upload, account deletion/ID correction/password reset screens, administrator enrollment overrides, audit browsing, per-user subject-list dragging, or file attachments to submissions. Those existing Android/backend capabilities are preserved. Links are the desktop material path; no hosted content is copied into the app. Image references open at the original host in the browser, without an in-app gallery. Tasks derive from incomplete entries/drafts and have no due dates, notifications or calendar integration. Subject/item lists retain existing backend limits (200); discovery, rosters and admin accounts page in groups of 100. Remote providers, real Windows accessibility/font scaling, institution sign-in and real upgrade/rollback need device validation.

## Schema 9 and upgrades

Back up the closed local workspace or stopped organization backend before first launch/upgrade. The bundled backend uses schema 9, with validated material grouping and migrations from earlier schemas. Existing IDs, ordering, links, learner work and grades are preserved; old standalone assessments are not automatically assigned to a material. The local demonstration on a fresh installation starts with a material and a child activity.

An organization service must run this updated server to enable grouping. Android’s existing organization client can still read the canonical flattened order and perform its legacy flows; the Android UI and its independent local test workspace remain flat. Children hidden by their parent are denied by the server on every client, including direct link/submission routes. Reverting to schema-5 software requires restoring its matching database backup; do not open the upgraded database with the old server.

Materials include one **+ Add activity or quiz** control. Drag the left grip to move a material with its children, or move an activity/quiz among its siblings. The insertion marker shows the destination and the existing cards move together after the save succeeds. Saved subsections from 0.3.0 become regular materials with content and learner work retained. Back up the workspace before schema-8 migration; rollback requires the prior app and matching database backup.

To delete a subject you created, open it, select the three-dot **Subject details** control, then **Delete subject** and confirm. Administrators can manage any subject. Deletion removes active access and retains saved learner work/grades. Cancelling or a failed request keeps unsaved form text. The updated organization backend is required for deletion; the bundled local backend already supports it.

## Quiz answers, QR codes and results (0.4)

When creating a Quiz, enter 2–6 choices, then select the correct answer next to its text. Changing the choices clears the answer selection; choose it again before Done. The server scores submissions automatically. Existing quiz answers cannot be edited; create a replacement quiz if the key must change.

Open Enrollment → Generate QR code → Save QR image (SVG) to display or save a printable subject QR. It contains only `aoa://subject/<subject UUID>`, matching the existing Android scanner. Students can also paste that value in Find a subject. Both clients must use the same organization backend; PC and Android local test workspaces do not sync. A QR identifies the subject and never bypasses account eligibility.

Open Students & progress → View work to rate submitted activities/examinations out of 100 and add feedback. Save assessment retains the visible location. Export Excel includes quiz/activity scores for the current roster page (up to 100 students); advance to export additional pages. The app does not calculate a weighted course grade.

QR generation uses the MIT-licensed qrcode-generator 2.0.4, vendored byte-for-byte from the pinned development dependency. It runs offline without a QR web service; its license is included in the package. jsQR 1.4.0 is test-only and independently decodes the displayed QR during native UI verification.

## Multiple-question quizzes (0.5)

Select Quiz inside a material. Enter the Number of questions (1–50), then Apply. Each expandable question card contains question text, 2–6 editable choices, and a radio circle to select the correct answer. Editing choices clears only that question’s key. Reducing the count confirms removal of populated questions. Set all questions before Done; quizzes are immutable after creation so recorded scores cannot be silently changed. Create a replacement quiz when changing its questions or key.

Students select Start quiz and confirm readiness. Every question requires one answer. Minimize/expand preserves the current answers; final submission confirms once and sends the entire quiz for server-side scoring. The completed quiz collapses, is marked Done, and shows correct answers / total items. Expanding it after submission is read-only. Results and Excel use the same numerator and denominator. This does not add a timer, proctoring, retakes or a weighted course grade. Draft answers are held in memory, not crash recovery.

Schema 9 preserves existing one-question quizzes, IDs, attempts, links, grades and ordering. Back up the closed workspace before upgrading. Organization servers need this backend for multiple-question authoring; older servers remain limited to one question. Older mobile clients cannot submit multi-question quizzes; this Android source displays a use-PC notice and correct denominators against an updated organization service. No Android APK is delivered by this Windows change. Rollback requires the old app and its matching pre-upgrade database backup.

## Stable distribution scope (0.5.0)

Version 0.5.0 is published on GitHub’s stable release channel at the owner’s request. It promotes the verified 0.5.0-rc.1 feature set without behavior or schema changes. The stable-channel label identifies the distributed version; it does not turn unperformed physical-device, accessibility, provider, organization deployment or signed-upgrade checks into passes. The portable executable remains unsigned. Use the local synthetic workspace for evaluation; real organization deployment requires its own validated service and individually assigned accounts. All automated Windows/Android, startup, package integrity, security-audit and regression gates remain required on the exact final source.


## Compact controls, grading and score exports (0.6.0-rc.1)

Materials, examinations, quizzes and activities place Edit, Publish/Unpublish and Delete in their top bar. Controls wrap within narrow panes. The subject header has a labeled Edit button for title/description changes and confirmed deletion.

In Students & progress → View work, read the response and expandable instructions, enter a score out of 100 and optional feedback, then Save grade. Only that form updates; other unsaved grades and the scroll position remain. Saved timestamps support conflict checks when regrading. A rejected write retains inputs. If an older server acknowledges a save but cannot refresh its saved timestamp, that form stays saved and cannot resubmit until reopened. Grades and audit records commit together on the updated backend.

Export Excel opens with Quiz scores: one row per student and one column per published quiz. Headers use the quiz creation date (YYYY-MM-DD) in this PC’s time zone and the quiz title. Same-date duplicate titles receive a numbered suffix. Cells contain numeric correct-answer counts only; zero is an actual score and blank means not submitted for the current revision. Summary, Assessments (including totals, submitted times and activity grades), and Report notes follow. Exports cover the current roster page, up to 100 students. The backend must be updated for this workbook layout; older servers keep their previous export format.

This candidate builds on stable pc-v0.5.0; schema 9 and existing records are unchanged. The earlier stable distribution decision applies to 0.5.0 only. Candidate automation does not claim physical Windows accessibility or live organization acceptance. Close and back up the workspace before replacing the app; keep a matching app/database backup for rollback.
