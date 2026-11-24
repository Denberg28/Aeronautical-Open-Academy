# Aeronautical Academy Repository 0.13.0-rc.2 — Export & Import with creation date-time filenames, typography & spacing standardization

24 November 2026 · Windows x64 test candidate / prerelease (`pc-v0.13.0-rc.2`; stable `pc-v0.11.0` remains `Latest`)

## What is included

- **Portable Subject & Repository Export / Import (`aoa-export-v1`):**
  - **Export subject** (from any editable subject header) and **Export all** / **Import** (from **My subjects** and **Settings → Export & Import**).
  - Suggested filenames automatically include the Windows-safe subject or repository name plus the exact local date and time of creation: `<Subject-Name>_YYYY-MM-DD_HH-mm-ss.aoa.json` or `Aeronautical-Academy-Repository_YYYY-MM-DD_HH-mm-ss.aoa.json`.
  - Preserves multi-level entry hierarchy (up to 4 levels), rich HTML formatting, paragraph spacing (`compact`/`normal`/`relaxed`/`loose`), embedded pasted/uploaded images (`item_images` with magic-byte + per-image SHA-256 verification and automatic UUID remapping), web links, quizzes/activities/examinations, schedules, and Admin folder paths (up to 5 levels).
  - Security & integrity controls: atomic temp-file write + rename on export, SHA-256 canonical payload checksum verified before import, bounded package limits (`<= 50 MB`, `<= 50` subjects, `<= 200` entries/subject, `<= 20` images/entry, `<= 5 MB`/image), two-step confirmation preview showing filename, creation date/time, and item/image counts, non-destructive import (creates new subjects without overwriting existing work), and strict read-only instructor export blocking (`403`) so answer keys cannot be extracted.
  - Works in both **Local test workspace** and **Organization server** modes using existing authenticated APIs; Settings also documents the default Windows local save path (`%APPDATA%\aeronautical-open-academy-desktop\local-test-workspace\academy.sqlite`).
- **Professional text formatting, sizing & spacing standardization:**
  - Fixed CSS specificity cascade on `.reading-copy p` so per-entry paragraph spacing (`Compact 8px`, `Normal 12px`, `Relaxed 18px`, `Loose 24px`) renders faithfully on `<p>` paragraphs as well as headings, lists, and blocks while preserving the default `16px / 1.4 / 12px` reading standard.
  - Matched `.rich-editor` sizing (`16px` / `1.4` line-height) 1:1 with rendered `.reading-copy` for true WYSIWYG authoring.
  - Standardized rich-content editorial hierarchy (`h2`–`h4` sizing, leading, and top rhythm when preceded by content; inline `code`, `pre`, `blockquote`, `hr`, `a`, list item spacing, and table cell padding).
  - Standardized `.page-header` / `.header-actions`, `.hero-actions`, `.course-card` tags & footers, and tabular numerals (`font-variant-numeric: tabular-nums`) on entry numbers, counters, and stats; removed dead `progress` rules and fixed the undefined `var(--red)` hover bug on `.figure-remove:hover` (`var(--danger)`).
- **Full Admin & Instructor-only feature set preserved (`0.13.0-rc.1`):**
  - Strictly Administrator & Instructor desktop workflows (student features removed; `student` logins & routes blocked `403` at `desktop/bridge.mjs`), expandable/collapsible left column, rich content editor & snip image paste, multi-level entry drag-and-drop, fullscreen presenter (`Play`), admin hierarchical folders, per-subject instructor access control, scheduled dates, protected PDFs, and account password management.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts are `admin/admin` and `instructor/instructor`.

SQLite schema 15 and the shared backend (`server/**`) remain unchanged; existing PC databases upgrading from schema `< 15` automatically save a consistent `academy-before-pc-0.12.sqlite` backup first. Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback to `pc-v0.13.0-rc.1` or `pc-v0.12.0-rc.2` requires no schema downgrade, while rollback to `pc-v0.11.0` requires its matching schema-14 backup.

## Verification scope and limits

This is a **test candidate / prerelease** (`pc-v0.13.0-rc.2`); stable `pc-v0.11.0` remains `Latest`. Automated gates on the exact final source require all 60 backend/migration tests, 12 desktop unit/bridge/forms/shared-API/transfer tests, all 11 native Windows Electron UI suites (`ui.mjs`, `motion.mjs`, `subject-delete.mjs`, `parity.mjs`, `reader.mjs`, `schedule.mjs`, `access-control.mjs`, `folders.mjs`, `presenter.mjs`, `rich-editor.mjs`, `transfer.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification (including `desktop/transfer.mjs`), zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 save/open dialog, clipboard/DPI/accessibility testing, live organization HTTPS deployment, real external provider sign-in, and Authenticode code signing remain **NOT TESTED**; the executable is unsigned and stable production readiness is not claimed.
