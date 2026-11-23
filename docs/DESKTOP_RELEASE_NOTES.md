# Aeronautical Academy Repository 0.11.0-rc.1 — Admin subject folders & left-pane hierarchy

23 November 2026 · Windows x64 test candidate / prerelease

## What is included

- **Admin hierarchical subject folders in the left pane (schema v14):**
  - New **+ New folder** control in the left navigation pane (admin-only, capability `subject_folders: "v1"`) supporting top-level folders and nested subfolders (up to 5 levels deep, up to 200 folders).
  - **Drag and drop subjects into folders:** Administrators can drag any subject in the left pane into any folder (or back onto **My subjects** / top-level drop zone). Folder badges also appear on cards in **My subjects**.
  - **Drag and drop folders to move hierarchy:** Administrators can drag a folder to reorder it before or after a sibling folder, nest it inside another folder, or drop it onto **My subjects** / top level. Keyboard shortcuts (`Alt+↑`, `Alt+↓`, `Alt+←`, `Alt+→`) also reorder, outdent, and indent focused folders.
  - **Inline rename & safe delete:** Hovering or focusing a folder reveals Rename and Delete controls. Deleting a folder safely moves its subjects and subfolders up one level; no subjects or student records are deleted. Cycle checks prevent moving a folder into itself or a descendant.
  - **Scoped visibility for non-admins:** Instructors and students see only folders containing (or ancestors of) subjects visible to them, with no empty private admin folders exposed and zero folder edit/drag controls.
- **Full 0.6–0.10 feature set preserved:** Aeronautical Academy Repository branding, admin per-subject instructor access control (Read only / Editor, Active / Suspended), Student · Reader default with no download capability, hardened registration and first-login passphrase rotation, standardized desktop typography/spacing, scheduled publishing/due dates (`dates-v1`), shared organization sync (`refresh-v1`), canonical AE 101 template, and dated quiz score Excel exports.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts remain `admin/admin`, `instructor/instructor`, and `student/student`.

Organization mode pairs with the matching Academy HTTPS API advertising `sync=refresh-v1`, `choice_forms`, `dates-v1`, `instructor_subject_access=v1`, and `subject_folders=v1` (older compatible servers remain usable with flat subject navigation when `subject_folders` is absent). Local demo databases upgrade to Windows schema 14 (`subject_folders` table and nullable `subjects.folder_id`), saving a consistent `academy-before-pc-0.11.sqlite` backup before upgrading from schema `< 14`. Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback requires the prior application (`pc-v0.10.0-rc.1` or `pc-v0.9.0`) and its matching pre-upgrade backup.

## Prerelease scope and verification

This is an unsigned Windows x64 test candidate / prerelease (`pc-v0.11.0-rc.1`). Automated gates on the exact final source require all 55 backend/migration tests (including `server/test/folders.test.mjs` and schema v13 → v14 migration), 10 desktop bridge/forms/shared-API tests, all 9 native Windows Electron UI suites (including `folders.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification, zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 accessibility/DPI scaling, real Google/external provider sign-in, live organization HTTPS deployment, and signed upgrades remain **NOT TESTED**; stable/production readiness is not claimed.
