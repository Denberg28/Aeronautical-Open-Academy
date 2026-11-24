# Aeronautical Academy Repository 0.13.0-rc.1 — Admin & Instructor-only furnishing, standardization & code sanitization

24 November 2026 · Windows x64 test candidate / prerelease (`pc-v0.13.0-rc.1`; stable `pc-v0.11.0` remains `Latest`)

## What is included

- **Administrator & Instructor-only Windows desktop focus:**
  - Removed all student-facing and student-management features from the Windows desktop UI, IPC, and bridge: student sign-in/demo button, reading completion, student quiz/written submission forms, **My results**, **Find a subject** / join codes, **Enrollment** & QR code generation, **Students & progress** grading, and Excel roster exports.
  - Enforced Administrator/Instructor-only sign-in at [`desktop/bridge.mjs`](../desktop/bridge.mjs): attempting to sign in with a `student` account (local or organization server) is rejected with HTTP `403`, performs best-effort server `/v1/auth/logout`, and clears local tokens. Student-only API routes (`/v1/subjects/discover`, `/enrol`, `/eligibility`, `/learners`, `/complete`, `/submission`, `/answers`, `/quiz`, `/grade`, `/v1/admin/enrolments`, `/v1/submissions/*`, `/export`) are blocked at the desktop bridge boundary.
  - Local synthetic workspace seeds only `admin` / `admin` and `instructor` / `instructor` accounts.
- **UI furnishing & standardization:**
  - Standardized sign-in dialog, sidebar navigation (**Subjects**, **Drafts**, **Announcements**, **Accounts**, **Settings**, **Help**), right context pane (**Drafts**, **Announcements**), subject hero (with folder badge), composer labels (`Published`), Accounts management (filters to Administrator & Instructor accounts; `#new-account` offers only **Instructor** and **Administrator** roles with no Student ID field), and Subject Access controls.
  - Standardized Help & Settings copy for Administrator and Instructor workflows.
- **Code & dependency sanitization:**
  - Removed unused IPC channels (`academy:subject-qr`, `academy:export`) and tightened `academy:pick-image` to require Administrator/Instructor roles in [`desktop/main.mjs`](../desktop/main.mjs) and [`desktop/preload.cjs`](../desktop/preload.cjs).
  - Removed unused QR generator/decoder modules and packages (`desktop/enrollment.mjs`, `desktop/vendor/qrcode.mjs`, `desktop/vendor/LICENSE-qrcode.txt`, `desktop/test/grading.mjs`, and `jsqr` / `qrcode-generator` from `desktop/package.json` & `desktop/package-lock.json`) and updated `desktop/tools/package-win.mjs` and `desktop/tools/verify-package.mjs`.
  - Removed dead student UI renderers, event handlers, icons, state fields, and CSS blocks from `desktop/ui/app.js`, `desktop/ui/index.html`, and `desktop/ui/style.css` while maintaining strict CSP (`style-src 'self'`).
- **Full Administrator & Instructor authoring & presentation workflow preserved:**
  - Expandable/collapsible left navigation column (`←` / `→` arrows, `Alt+[` / `Alt+]`), rich content editor with Word/Docs/web paste adoption and hardened dual client/server XSS sanitization, pasted screenshot snips (`Ctrl+V`) and entry images (`item_images`), text indentation (`Tab`/`Shift+Tab`, up to 6 levels), per-entry paragraph spacing, entry-level Minimize/Expand and subject Minimize all/Expand all, multi-level entry drag-and-drop (up to 4 levels), instructor-guided fullscreen presenter (`Play`) with letter-only options and Cancel-default answer-key confirmation, admin hierarchical subject folders, per-subject instructor access control (**Active**/**Suspended**, **Read only**/**Editor**), scheduled release dates, protected PDF uploads/viewer, and account password creation/updates.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts are `admin/admin` and `instructor/instructor`.

SQLite schema 15 and the shared backend (`server/**`) remain unchanged for backward compatibility with existing PC local databases and organization APIs; existing PC databases upgrading from schema `< 15` automatically save a consistent `academy-before-pc-0.12.sqlite` backup first. Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback to `pc-v0.12.0-rc.2` requires no schema downgrade, while rollback to `pc-v0.11.0` requires its matching schema-14 backup.

## Verification scope and limits

This is a **test candidate / prerelease** (`pc-v0.13.0-rc.1`); stable `pc-v0.11.0` remains `Latest`. Automated gates on the exact final source require all 60 backend/migration tests, 10 desktop bridge/forms/shared-API tests (including student-login `403` and student-route `403` enforcement), all 10 native Windows Electron UI suites (`ui.mjs`, `motion.mjs`, `subject-delete.mjs`, `parity.mjs`, `reader.mjs`, `schedule.mjs`, `access-control.mjs`, `folders.mjs`, `presenter.mjs`, `rich-editor.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification, zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 clipboard/DPI/accessibility testing, real Word/Snipping Tool paste testing, real Google/external provider sign-in, live organization HTTPS deployment, and Authenticode code signing remain **NOT TESTED**; the executable is unsigned and stable production readiness is not claimed.
