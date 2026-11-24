# Aeronautical Academy Repository 0.12.0-rc.2 — Expandable left column, rich content editor, snip images, multi-level entries & sanitization hardening

24 November 2026 · Windows x64 test candidate / prerelease (`pc-v0.12.0-rc.2`; stable `pc-v0.11.0` remains `Latest`)

## What is included

- **Expand / collapse left column via arrow controls (pure CSS, CSP-safe):**
  - Added left (`←`) and right (`→`) arrow buttons at the top of the left navigation column (`data-action="sidebar-narrow"` and `data-action="sidebar-widen"`) plus `Alt+[` / `Alt+]` keyboard shortcuts.
  - Supports three overflow-free width states: **Standard** (`236px`), **Expanded** (`min(360px, 34vw)` so long subject titles and deep folder hierarchies display without truncation), and **Collapsed rail** (`58px` with a prominent `→` expand button to maximize center editor/reader space).
  - Toggling width updates `#app` classes in place without re-rendering `#center`, preserving unsaved drafts and scroll position, and resets cleanly on sign-out.
- **Sanitization & UI workflow hardening (recheck pass):**
  - Hardened [`sanitizeRichHtml`](../server/src/richtext.mjs) to strip null bytes (`\0`) and loop-strip nested/unclosed HTML comments before tokenization.
  - Refined clipboard paste handling in [`editor.js`](../desktop/ui/editor.js) so Word/Excel dual-payload copies (formatted HTML + plain text + auxiliary bitmap PNG) adopt formatted HTML instead of converting text into an image, while pure screenshot snips (`Win+Shift+S` / Copy Image) continue uploading and inserting inline figures.
  - Added `dragover`/`dragleave` drop-target handling and visual highlight (`.drop-file-over`) for dragging image files from Windows Explorer into `#rich-editor`.
  - Sanitized and re-hydrated `#rich-editor` HTML across composer type switches, disabled `Minimize all` while search is active (consistent with per-entry minimize), cleared `collapsedEntries` on subject archive/delete and when jumping to a minimized entry from **Tasks**, and reset sidebar/folder view state cleanly on `401`/logout.
- **Full 0.12.0-rc.1 & 0.6–0.11 feature set preserved:**
  - Rich subject content entry (`rich_content: "v1"`, schema v15) with pasted formatting adoption and dual client/server XSS sanitization.
  - Pasted screenshot snips (`Ctrl+V`), dropped/picked entry images (`entry_images: "v1"`, schema v15 `item_images`, magic-byte validated, <=5 MiB, <=20 per entry, student no-download enforcement).
  - Text indentation (`data-indent="1..6"`, toolbar + `Tab`/`Shift+Tab`) and per-entry paragraph spacing (`Compact 8px` / `Normal 12px` / `Relaxed 18px` / `Loose 24px`).
  - Entry-level Minimize / Expand and subject Minimize all / Expand all.
  - Drag entries across multiple levels (`multi_level_entries: "v1"`, up to 4 levels deep + `Alt+Arrow`).
  - Create account with password & update account passwords (Confirm password, Show/Hide, Strong passphrase generator, optional next-sign-in rotation, `Update my password` shortcut, and local demo alias password updates in Settings).
  - Instructor-guided fullscreen presenter (`Play`), admin hierarchical subject folders, per-subject instructor access control, **Student · Reader** no-download enforcement, scheduled publishing/deadlines, shared sync, AE 101 template, and dated quiz score Excel exports.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts remain `admin/admin`, `instructor/instructor`, and `student/student`.

Organization mode pairs with the matching Academy HTTPS API advertising `sync=refresh-v1`, `choice_forms`, `dates-v1`, `instructor_subject_access=v1`, `subject_folders=v1`, `rich_content=v1`, `entry_images=v1`, and `multi_level_entries=v1` (older compatible servers remain usable with plain text and single-level ordering when new capabilities are absent). Schema 15 is unchanged from `0.12.0-rc.1`; local databases upgrading from schema `< 15` automatically save a consistent `academy-before-pc-0.12.sqlite` backup first. Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback to `pc-v0.11.0` requires its matching schema-14 backup.

## Verification scope and limits

This is a **test candidate / prerelease** (`pc-v0.12.0-rc.2`); stable `pc-v0.11.0` remains `Latest`. Automated gates on the exact final source require all 60 backend/migration tests (including obfuscated comment/null-byte sanitizer tests and schema migrations through v15), 11 desktop bridge/forms/shared-API tests, all 11 native Windows Electron UI suites (including left-column expand/collapse arrow checks, Word/Excel dual-payload paste, snip PNG paste, indentation, spacing, entry minimize, multi-level drag, and password management in `rich-editor.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification, zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 clipboard/DPI/accessibility testing, real Word/Snipping Tool paste testing, real Google/external provider sign-in, live organization HTTPS deployment, and Authenticode code signing remain **NOT TESTED**; the executable is unsigned and stable production readiness is not claimed.
