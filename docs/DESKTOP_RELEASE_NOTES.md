# Aeronautical Academy Repository 0.13.0-rc.3 — Minimal login, saved workspace state, minimizable right pane & workflow polish

24 November 2026 · Windows x64 test candidate / prerelease (`pc-v0.13.0-rc.3`; stable `pc-v0.11.0` remains `Latest`)

## What is included

- **Minimal, professional login window (`desktop/ui/index.html`, `desktop/ui/style.css`):**
  - Removed all instructional paragraphs, eyebrow slogans, and hint walls (`#org-hint`, subtitle, test-account prose) for a clean, focused enterprise sign-in dialog.
  - Clicking **Admin** or **Instructor** quick-fill in Local mode immediately focuses the **Sign in** button so pressing `Enter` signs in with zero extra clicks.
- **Persistent workspace state across logout & login (per account & workspace):**
  - Automatically saves and restores minimized/expanded entry cards (`collapsedEntries`), collapsed material child sections (`collapsedMaterials`), collapsed subject folders (`collapsedFolders`), left column width (`sidebarState`), right pane minimized state (`rightbarCollapsed`), and last active subject (`activeSubjectId`) across logout/login and app restarts.
  - Stored per `mode + origin + account.id` in Electron's isolated `userData` storage with strict UUID validation and bounded caps (max 500 IDs per set); zero tokens, passwords, or content are stored, and separate accounts remain fully isolated.
  - Scoped **Minimize all / Expand all** strictly to the active subject's items so expanding one subject never wipes minimized items in another subject.
- **Minimizable right pane (`Alt+\`, pure CSS, CSP-safe):**
  - Added a right-pane minimize/expand toggle in the topbar (`panelRight` icon) and right-pane rail header (`→` / `←` arrow button) plus keyboard shortcut `Alt+\`.
  - Collapses the right pane cleanly to a slim `44px` rail, adding `+256px` of center workspace width without re-rendering `#center` or disturbing active drafts, across all left-column width states (`58px` / `236px` / `360px`) and responsive breakpoints.
- **Frictionless keyboard workflow:**
  - `Ctrl+K` or `/` focuses the subject search box immediately; `Escape` clears search and restores minimized entries cleanly.
  - `Alt+[` / `Alt+]` adjusts the left column and `Alt+\` toggles the right pane with immediate state persistence.
- **Full `0.13.0-rc.1`–`0.13.0-rc.2` Admin & Instructor feature set preserved:**
  - Portable Subject & Repository Export/Import (`aoa-export-v1`) with creation date-time filenames (`YYYY-MM-DD_HH-mm-ss.aoa.json`) and SHA-256 verification, professional typography/spacing standardization (`16px / 1.4` WYSIWYG reading & editor), rich content paste/snip images, multi-level entry drag-and-drop, fullscreen presenter (`Play`), admin hierarchical folders, per-subject instructor access control, scheduled dates, protected PDFs, and account password management.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts are `admin/admin` and `instructor/instructor`.

SQLite schema 15 and the shared backend (`server/**`) remain unchanged; existing PC databases upgrading from schema `< 15` automatically save a consistent `academy-before-pc-0.12.sqlite` backup first. Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback to `pc-v0.13.0-rc.2`, `pc-v0.13.0-rc.1`, or `pc-v0.12.0-rc.2` requires no schema downgrade, while rollback to `pc-v0.11.0` requires its matching schema-14 backup.

## Verification scope and limits

This is a **test candidate / prerelease** (`pc-v0.13.0-rc.3`); stable `pc-v0.11.0` remains `Latest`. Automated gates on the exact final source require all 60 backend/migration tests, 12 desktop unit/bridge/forms/shared-API/transfer tests, all 11 native Windows Electron UI suites (`ui.mjs`, `motion.mjs`, `subject-delete.mjs`, `parity.mjs`, `reader.mjs`, `schedule.mjs`, `access-control.mjs`, `folders.mjs`, `presenter.mjs`, `rich-editor.mjs`, `transfer.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification, zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 save/open dialogs, clipboard/DPI/accessibility testing, live organization HTTPS deployment, real external provider sign-in, and Authenticode code signing remain **NOT TESTED**; the executable is unsigned and stable production readiness is not claimed.
