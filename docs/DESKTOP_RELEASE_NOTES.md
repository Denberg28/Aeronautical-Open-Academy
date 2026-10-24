# Aeronautical Open Academy for Windows — 0.1.0-rc.1

25 October 2026 · First link-focused Windows x64 release candidate

## What changed

- Minimal three-pane learning workspace: left LMS navigation, central instructor subject editor/student viewer, right announcements and tasks.
- Add a text line and attach up to 12 web references to one material. Recognize Google Drive, Docs, Sheets, Slides, YouTube, image URLs, PDFs and common office-file URLs by address. Inline links still work. Original sharing links, resource keys, queries and sheet/slide targets are preserved.
- Edit, publish/unpublish, delete and reorder materials; create quizzes/written work; enrollment, progress, grading, Excel exports, announcements and account administration use the existing backend.
- Canonical link parsing matches the backend authorization check. Invalid/local/credentialed links do not become browser launch targets. No previews, third-party fetches, Google API keys or permission changes.
- Preserve attachments and quiz answers when changing composer type. Show validation at the form. Same-account/workspace reauthentication restores unsaved forms in memory.
- Close a successfully saved form before refreshing, preventing accidental duplicate submission when refresh fails. Add explicit Refresh. Cancelled shutdown keeps the local service alive. Clear stale content when switching accounts.
- Adapt layout at enlarged Chromium zoom. Remove a flagged packaging dependency; pin Electron's existing extractor instead. Verify all packaged files with a SHA-256 manifest and test the packaged EXE in Windows CI.

## Start

Extract the entire ZIP and open `Academy.exe` inside the Academy-PC folder. Keep all its companion files. Windows 10/11 x64 is the intended target; the automated runner is Windows Server 2025. No Java, Python or Node installation is required for users. This is a portable ZIP rather than an installer.

Select **Local test workspace** and use `admin/admin`, `instructor/instructor` or `student/student` with synthetic data. To share real classes across devices, connect to the existing organization HTTPS backend with its assigned accounts. Local PC and Android test data do not synchronize.

## Linked material workflow

Choose subject → **+ Add material or activity** → type a title/notes → **Attach link** → paste the sharing URL → **Done**. Attach again for more references, or remove an unused field. Share the original Google file with the intended students. Students open references in their system browser and sign in at the original host as needed. Image links open externally; no uploaded image storage/gallery is included.

## Verification and limits

The CI archive's `windows-verification.json` records the exact source commit and completed native Windows/UI/package checks. `package-manifest.json` covers every packaged file. See `VERIFICATION.md` for scope. Host-unit and synthetic workflow tests do not prove a real Google account can open a protected file.

This is an unsigned release candidate. Real Windows 10/11 accessibility, actual browser/save-dialog handoff, provider permissions, organization deployment and signed upgrade behavior still require acceptance. Stable promotion remains blocked pending those checks. No auto-updater or institution hosting is configured.

No automatic write retries occur. If a write itself times out, refresh and check whether it saved before creating a replacement. Drafts recover from same-account session expiry while the app remains open, but do not survive an exit/crash.

## Upgrade and rollback

Close Academy and back up the `local-test-workspace` directory under its Electron user-data location before replacing binaries. Extract into a new folder; user data remains outside the app folder. The backend/schema and Android source are unchanged from the previous desktop preview. Keep the old app and matching database backup together; never downgrade a database created by a newer schema.

API errors now cross the isolated desktop bridge as explicit data envelopes, preserving HTTP status. The renderer reconstructs errors locally, so a 401 reliably opens sign-in and same-account drafts can resume. The native UI test invalidates its underlying session and verifies this behavior.
