# Aeronautical Academy Repository 0.11.0 — Instructor-guided fullscreen presenter, admin subject folders & instructor access control

23 November 2026 · Owner-authorized Windows x64 stable distribution (`pc-v0.11.0`)

## What is included

- **Instructor-guided fullscreen presentation for quizzes, activities, and examinations:**
  - New **Play** button on every Quiz, Activity, and Examination card for instructors and administrators (hidden from students).
  - Launches full screen (`#presenter-dialog` + Fullscreen API) flashing one question at a time in high-contrast classroom typography with **lettered options (`A`, `B`, `C`, ...) only** — no answer selection controls and no answer key exposed during play.
  - **Previous** (`←`) and **Next** (`→`) arrow buttons (plus `ArrowLeft` / `ArrowRight` and `Escape` keyboard support) navigate smoothly across questions.
  - At the end of the item, clicking **Finish →** opens an in-fullscreen **confirmation dialog (`Show answer key?`)** (defaulting focus to **Cancel** to prevent accidental reveal from rapid keypresses) before revealing the numbered class answer key (letter badge + answer text) for class checking. Read-only instructors without key access can still project slides while answer keys remain strictly restricted to the authoring editor or administrator. Closing, signing out, or session expiry clears presenter DOM immediately.
- **Admin hierarchical subject folders in the left pane (schema v14):**
  - New **+ New folder** control in the left navigation pane (admin-only, capability `subject_folders: "v1"`) supporting top-level folders and nested subfolders (up to 5 levels deep, up to 200 folders).
  - **Drag and drop subjects into folders:** Administrators can drag any subject in the left pane into any folder (or back onto **My subjects** / top-level drop zone). Folder badges also appear on cards in **My subjects**.
  - **Drag and drop folders to move hierarchy:** Administrators can drag a folder to reorder it before or after a sibling folder, nest it inside another folder, or drop it onto **My subjects** / top level. Keyboard shortcuts (`Alt+↑`, `Alt+↓`, `Alt+←`, `Alt+→`) also reorder, outdent, and indent focused folders.
  - **Inline rename & safe delete:** Hovering or focusing a folder reveals Rename and Delete controls. Deleting a folder safely moves its subjects and subfolders up one level; no subjects or student records are deleted. Cycle checks prevent moving a folder into itself or a descendant.
  - **Scoped visibility for non-admins:** Instructors and students see only folders containing (or ancestors of) subjects visible to them, with no empty private admin folders exposed and zero folder edit/drag controls.
- **Admin instructor access control, student reader enforcement & application rename (promoted from 0.10.0-rc.1):**
  - Renamed visible application branding to **Aeronautical Academy Repository** while preserving `Academy.exe` and Electron `userData` directory continuity for seamless local upgrades.
  - Per-subject instructor access grants (**Active** / **Suspended**, **Read only** / **Editor**, schema v13) with strict server-side and IPC enforcement.
  - Reinforced **Student · Reader** default with no download capability (`View only · downloads disabled`) across headers, main process, bridge, and in-app PDF.js viewer.
  - Hardened login, instructor, and student registration workflows with allow-listed payloads, atomic audited account creation and password reset, account creation rate limiting, Show/Hide passphrase toggles, and locked first-login passphrase rotation.
- **Full 0.6–0.9 feature set preserved:** Standardized desktop typography/spacing, scheduled publishing/due dates (`dates-v1`), shared organization sync (`refresh-v1`), canonical AE 101 template, and dated quiz score Excel exports.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts remain `admin/admin`, `instructor/instructor`, and `student/student`.

Organization mode pairs with the matching Academy HTTPS API advertising `sync=refresh-v1`, `choice_forms`, `dates-v1`, `instructor_subject_access=v1`, and `subject_folders=v1` (older compatible servers remain usable with flat subject navigation when `subject_folders` is absent). Local demo databases upgrade to Windows schema 14 (`subject_folders` table and nullable `subjects.folder_id`), saving a consistent `academy-before-pc-0.11.sqlite` backup before upgrading from schema `< 14` (and `academy-before-pc-0.10.sqlite` before schema 13). Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback requires the prior application (`pc-v0.11.0-rc.1`, `pc-v0.10.0-rc.1`, or `pc-v0.9.0`) and its matching pre-upgrade backup.

## Stable distribution scope and verification

Version `0.11.0` (`pc-v0.11.0`) is published on GitHub's stable release channel at the repository owner's explicit request on 23 November 2026, promoting the verified `0.10.0-rc.1` and `0.11.0-rc.1` feature sets with final security hardening (safe Cancel focus on the answer-key confirmation dialog and early read-only guard on the PDF upload picker). Automated gates on the exact final source require all 55 backend/migration tests (including `server/test/folders.test.mjs`, `server/test/instructor-access.test.mjs`, and schema migrations through v14), 10 desktop bridge/forms/shared-API tests, all 10 native Windows Electron UI suites (including `access-control.mjs`, `folders.mjs`, and `presenter.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification, zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 accessibility/DPI scaling, real Google/external provider sign-in, live organization HTTPS deployment, and Authenticode code signing remain **NOT TESTED**; the executable is unsigned and institutional production readiness beyond the recorded automated gates is not claimed.
