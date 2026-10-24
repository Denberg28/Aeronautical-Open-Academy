# Aeronautical Open Academy for PC — 0.1.0-alpha.1

Windows 10/11 x64 desktop **development preview**. One window, three panes: collapsible LMS navigation on the left, instructor subject editor or student viewer in the center, announcements and subject tasks on the right. Electron supplies a consistent desktop UI and bundles Node/Chromium; the existing Academy backend enforces accounts, subject ownership, enrollment, draft visibility, grading, and link authorization. There is no subscription or additional cloud dependency for the local test workspace.

## Open the Windows application

Extract the **entire ZIP** to a folder, then double-click **Academy.exe**. Keep all files beside it; the executable alone is not portable. No Python, Java or Node installation is needed. Windows 10/11 x64 is the intended target. Windows ARM/macOS/Linux distributions are not included. This preview does not have an organization code-signing identity or automatic updates.

Choose **Local test workspace** and sign in:

| Role | Username | Password |
| --- | --- | --- |
| Admin | admin | admin |
| Instructor | instructor | instructor |
| Student | student | student |

These intentionally public credentials access synthetic data on this PC only. The app maps the short aliases locally; they are never accepted/mapped by an organization service. New accounts created by an admin require a 15–128 character temporary passphrase and a password change on first sign-in. Local data is stored in Electron’s user-data directory under `local-test-workspace/academy.sqlite`; replacing/extracting app binaries does not erase it. Close the app before backing up that directory. Do not downgrade a database with a newer schema; retain its backup and use the matching application.

## Instructor workflow

1. Choose a subject from the left pane, or **My subjects → New subject**.
2. Select **+ Add material or activity** below its final entry.
3. Type a text line; its first line becomes the title.
4. Select **Attach link**, paste the material’s HTTP/HTTPS address, then **Done**. Google Docs/Slides/Drive, PDF links, spreadsheets, YouTube and websites remain at the original host.
5. Use the entry controls to edit, publish/unpublish, delete, or move it. Drag the handle to place it before another entry; up/down arrows provide a keyboard-accessible alternative.

Written activities, examinations and one-question quizzes use the same inline composer. **Enrollment** lets the instructor allow all students or verified student IDs. **Students & progress** shows reading, submitted work and grading separately; view a learner’s written responses to assess them and export the current roster page to Excel. Changing material text creates a new revision and requires new completion; grading/answers and current revisions are enforced by the shared backend.

## Student workflow

Open an enrolled subject, open material links in the system browser, mark reading as complete, answer quizzes and submit written work. **Tasks** and **My results** combine the visible subjects. **Find a subject** supports eligible-subject discovery and instructor subject codes. Material host permissions and external sign-in still apply. Reading is self-reported, not a grade or proof of comprehension. Written work and quiz attempts can be submitted once per entry revision.

Admins create accounts, suspend/reactivate access and publish/delete announcements. The center changes content in place; there are no extra application windows for routine LMS functions. Small confirmations protect deletion, final submission and unsaved work.

## Organization use and compatibility

Select **Organization server**, enter the HTTPS origin of an existing Academy backend and use that service’s credentials. The desktop uses the existing `/v1` API and database schema v5, without changing the Android client or backend. It stores authentication tokens in main-process memory only, does not follow API redirects, and reauthorizes material links against their current revision before opening the browser. Organization services need valid HTTPS and the existing links-capable Academy backend. No live organization host has been deployed or verified by this change.

The local PC workspace **does not sync** with another PC or the Android test workspace. For shared classes, deploy the existing organization backend and connect clients to it. A local demonstration is not a multi-user deployment.

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

Packaging downloads the official Electron Windows x64 archive with checksum validation, copies only the desktop runtime files and existing server source, and emits `out/Academy-PC-0.1.0-alpha.1-win32-x64/`. It does not include databases, student records, `.env` files or organization keys. ZIP that directory for delivery. `node desktop/tools/verify-package.mjs` verifies the packaged Windows target and required resources. The Windows workflow performs the native Electron IPC smoke test as well as backend and renderer tests before uploading its artifact.

## Verification and limits

See `docs/DESKTOP_TESTING.md` for current evidence and release gates. This is a desktop preview, not a stable release. Native Electron UI automation on Linux is distinct from a Windows installation/launch test. Android binaries are unaffected and not rebuilt for this desktop-only change.

The focused PC workflow does not yet include camera QR scanning, protected uploaded-PDF viewing/upload, account deletion/ID correction/password reset screens, administrator enrollment overrides, audit browsing, per-user subject-list dragging, or file attachments to submissions. Those existing Android/backend capabilities are preserved. Links are the desktop material path; no hosted content is copied into the app. Tasks derive from incomplete entries/drafts and have no due dates, notifications or calendar integration. Subject/item lists retain existing backend limits (200); discovery, rosters and admin accounts page in groups of 100. Remote providers, real Windows accessibility/font scaling, institution sign-in and real upgrade/rollback need device validation.
