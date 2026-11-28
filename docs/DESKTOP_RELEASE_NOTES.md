# Aeronautical Academy Repository 0.13.0-rc.4 — Streamlined subject toolbar, instant filters, keyboard authoring & presenter upgrade

27 November 2026 · Windows x64 test candidate / prerelease (`pc-v0.13.0-rc.4`; stable `pc-v0.11.0` remains `Latest`)

## What is included

- **Streamlined subject toolbar with instant filter pills & quick `+ Add` (`desktop/ui/app.js`, `desktop/ui/style.css`):**
  - Replaced redundant subject filler heading (`Subject content / Create. Arrange across levels. Present.`) with instant **All / Materials / Assessments / Drafts** filter pills (`Drafts` shown for editable subjects) that narrow visible entries cleanly while preserving nested assessment visibility and automatically resetting when switching subjects or creating a new entry.
  - Placed a 1-click **`+ Add`** primary button directly inside the top subject toolbar (for editable subjects only) so authors working on long 20+ entry subjects never have to scroll to the bottom to add an entry.
- **Instant `My subjects` catalog search (`desktop/ui/app.js`):**
  - Added a live **`#subject-search`** bar on `My subjects` (shown when 2+ subjects exist) filtering by subject title, description, and folder path, wired directly to `Ctrl+K` / `/` focus and `Escape` clear.
- **Faster keyboard authoring flow (`desktop/ui/app.js`):**
  - **`Ctrl+Enter` / `Cmd+Enter`** saves the active form (`#composer`, `#subject-form`, `#announcement`, `#new-account`, `#reset-password-form`, `#folder-form`) without reaching for the mouse.
  - **`Escape`** inside `#composer` safely cancels (with unsaved-draft protection) when no modal dialog is open.
- **Upgraded fullscreen classroom presenter (`desktop/ui/presenter.js`, `desktop/ui/style.css`):**
  - Written activities and written examinations now render sanitized rich formatting (`body_html`, headings, lists, indentation, paragraph spacing) and hydrate embedded `data-img` figures cleanly on the classroom stage.
  - Added presenter remote & classroom keyboard shortcuts: **`Space`** / **`PageDown`** (next), **`PageUp`** (previous), and **`F`** (toggle full screen).
- **Visual calm & compact-width polish (`desktop/ui/style.css`):**
  - Added `pointer-events: none` on `#toast` so 6-second notifications never block clicks on buttons underneath.
  - Shortened sidebar workspace indicator (`LOCAL WORKSPACE` / `ORGANIZATION`) with clean ellipsis to eliminate clipping on narrow screens (`<= 1000px`).
  - Gently softened resting secondary entry actions (`opacity: 0.82` → `1` on card hover/focus) while keeping `Play` prominent and all controls visible and keyboard-accessible.
- **Full `0.13.0-rc.1`–`0.13.0-rc.3` Admin & Instructor feature set preserved:**
  - Minimal login window, per-account workspace state persistence across logout/login, minimizable right pane (`Alt+\`), portable `.aoa.json` Subject & Repository Export/Import with creation date-time filenames & SHA-256 verification, standardized `16px / 1.4` typography, rich content paste/snip images, multi-level entry drag-and-drop, admin hierarchical folders, per-subject instructor access control, scheduled dates, protected PDFs, and account password management.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts are `admin/admin` and `instructor/instructor`.

SQLite schema 15 and the shared backend (`server/**`) remain unchanged; existing PC databases upgrading from schema `< 15` automatically save a consistent `academy-before-pc-0.12.sqlite` backup first. Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback to `pc-v0.13.0-rc.3`, `pc-v0.13.0-rc.2`, `pc-v0.13.0-rc.1`, or `pc-v0.12.0-rc.2` requires no schema downgrade, while rollback to `pc-v0.11.0` requires its matching schema-14 backup.

## Verification scope and limits

This is a **test candidate / prerelease** (`pc-v0.13.0-rc.4`); stable `pc-v0.11.0` remains `Latest`. Automated gates on the exact final source require all 60 backend/migration tests, 12 desktop unit/bridge/forms/shared-API/transfer tests, all 11 native Windows Electron UI suites (`ui.mjs`, `motion.mjs`, `subject-delete.mjs`, `parity.mjs`, `reader.mjs`, `schedule.mjs`, `access-control.mjs`, `folders.mjs`, `presenter.mjs`, `rich-editor.mjs`, `transfer.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification, zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 save/open dialogs, clipboard/DPI/accessibility testing, live organization HTTPS deployment, real external provider sign-in, and Authenticode code signing remain **NOT TESTED**; the executable is unsigned and stable production readiness is not claimed.
