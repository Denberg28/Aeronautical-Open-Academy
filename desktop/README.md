# Aeronautical Open Academy for PC — 0.3.1-rc.1

Windows 10/11 x64 desktop **release candidate**. One window, three panes: collapsible LMS navigation on the left, instructor subject editor or student viewer in the center, announcements and subject tasks on the right. Electron supplies a consistent desktop UI and bundles Node/Chromium; the existing Academy backend enforces accounts, subject ownership, enrollment, draft visibility, grading, and link authorization. There is no subscription or additional cloud dependency for the local test workspace.

## Open the Windows application

Extract the **entire ZIP** to a folder, then double-click **Academy.exe**. Keep all files beside it; the executable alone is not portable. No Python, Java or Node installation is needed. Windows 10/11 x64 is the intended target. Windows ARM/macOS/Linux distributions are not included. This candidate does not have an organization code-signing identity or automatic updates.

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

Each material has **+ Add activity or quiz** below its last child. This composer offers only Activity and Quiz. The subject-level composer offers only Material and Examination. Existing standalone activities/quizzes remain visible; use Edit → Material to assign them. A material and its children move together; child grips reorder within their material. Edit → Material moves a child across materials without resetting its work or grade. Unpublishing a material hides all its children from students; republishing restores each child’s own publish state. Deleting a nonempty material explicitly confirms the whole group and retains historical records. Written activities, examinations and one-question quizzes use the same inline composer. **Enrollment** lets the instructor allow all students or verified student IDs. **Students & progress** shows reading, submitted work and grading separately; view a learner’s written responses to assess them and export the current roster page to Excel. Changing material text creates a new revision and requires new completion; grading/answers and current revisions are enforced by the shared backend.

## Student workflow

Open an enrolled subject, open material links in the system browser, mark reading as complete, answer quizzes and submit written work. **Tasks** and **My results** combine the visible subjects. **Find a subject** supports eligible-subject discovery and instructor subject codes. Material host permissions and external sign-in still apply. Reading is self-reported, not a grade or proof of comprehension. Written work and quiz attempts can be submitted once per entry revision.

Admins create accounts, suspend/reactivate access and publish/delete announcements. The center changes content in place; there are no extra application windows for routine LMS functions. Small confirmations protect deletion, final submission and unsaved work. Cancelling a window close keeps the local service running. If a session expires, signing back into the same account and workspace restores the in-memory unsaved form. Switching accounts/workspaces clears it; drafts are not crash recovery. If saving succeeds but refreshing fails, the saved form closes to prevent resubmission; select Refresh to reload the subject. A timeout during the write itself has an unknown outcome: refresh and check before creating a replacement. No automatic write retry is performed.

## Organization use and compatibility

Select **Organization server**, enter the HTTPS origin of an existing Academy backend and use that service’s credentials. The desktop uses the existing `/v1` API and database schema v6, using the updated backend. Older organization servers remain usable for flat content, but nested creation is disabled until the server is upgraded. It stores authentication tokens in main-process memory only, does not follow API redirects, and reauthorizes material links against their current revision before opening the browser. Organization services need valid HTTPS and the existing links-capable Academy backend. No live organization host has been deployed or verified by this change.

The local PC workspace **does not sync** with another PC or the Android test workspace. For shared classes, deploy the updated schema-8 organization backend and connect clients to it. A local demonstration is not a multi-user deployment.

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

Packaging downloads the official Electron Windows x64 archive with checksum validation, copies only the desktop runtime files and existing server source, and emits `out/Academy-PC-0.3.1-rc.1-win32-x64/`. It does not include databases, student records, `.env` files or organization keys. ZIP that directory for delivery. `node desktop/tools/verify-package.mjs` verifies the packaged Windows target and required resources. The Windows workflow performs native Electron UI tests, the packaged executable IPC smoke test, dependency audit and package hash verification as well as backend and renderer tests before uploading its artifact.

## Verification and limits

See `docs/DESKTOP_TESTING.md` for current evidence and release gates. This is the first link-focused Windows release candidate, not a stable release. The Windows CI workflow tests both the native editor/viewer and the packaged executable. The delivered CI archive includes windows-verification.json identifying its exact commit and checks; physical-device accessibility and real provider sign-in still require acceptance. Android binaries are unaffected and not rebuilt for this desktop-only change.

The focused PC workflow does not yet include camera QR scanning, protected uploaded-PDF viewing/upload, account deletion/ID correction/password reset screens, administrator enrollment overrides, audit browsing, per-user subject-list dragging, or file attachments to submissions. Those existing Android/backend capabilities are preserved. Links are the desktop material path; no hosted content is copied into the app. Image references open at the original host in the browser, without an in-app gallery. Tasks derive from incomplete entries/drafts and have no due dates, notifications or calendar integration. Subject/item lists retain existing backend limits (200); discovery, rosters and admin accounts page in groups of 100. Remote providers, real Windows accessibility/font scaling, institution sign-in and real upgrade/rollback need device validation.

## Schema 6 and upgrades

Back up the closed local workspace or stopped organization backend before first launch/upgrade. This candidate adds nullable item parent IDs with validation and migration from schema 5 to 6. Existing IDs, ordering, links, learner work and grades are preserved; old standalone assessments are not automatically assigned to a material. The local demonstration on a fresh installation starts with a material and a child activity.

An organization service must run this updated server to enable grouping. Android’s existing organization client can still read the canonical flattened order and perform its legacy flows; the Android UI and its independent local test workspace remain flat. Children hidden by their parent are denied by the server on every client, including direct link/submission routes. Reverting to schema-5 software requires restoring its matching database backup; do not open the upgraded database with the old server.

Materials include one **+ Add activity or quiz** control. Drag the left grip to move a material with its children, or move an activity/quiz among its siblings. The insertion marker shows the destination and the existing cards move together after the save succeeds. Saved subsections from 0.3.0 become regular materials with content and learner work retained. Back up the workspace before schema-8 migration; rollback requires the prior app and matching database backup.
