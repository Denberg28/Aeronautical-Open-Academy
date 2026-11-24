# Aeronautical Academy Repository 0.12.0-rc.1 — Rich subject content editor, snip images, multi-level entry hierarchy & password management

24 November 2026 · Windows x64 test candidate / prerelease (`pc-v0.12.0-rc.1`; stable `pc-v0.11.0` remains `Latest`)

## What is included

- **Upgraded rich subject content entry (`rich_content: "v1"`, schema v15):**
  - Separate **Title** field + formatting toolbar + rich content editor (`desktop/ui/editor.js`, `#rich-editor`) that **adopts pasted formatting** from Word, Google Docs, and web pages (headings, bold, italic, underline, ordered/unordered lists, blockquotes, tables, and left indentation).
  - Dual client-side (`sanitizeHtmlFragment`) and zero-dependency server-side (`server/src/richtext.mjs` `sanitizeRichHtml`) allow-list sanitization strips scripts, event handlers, inline CSS injection, unsafe links, and external images while preserving plain-text fallback (`body`).
- **Paste screenshot snips (`Ctrl+V`), drop, or pick images (`entry_images: "v1"`, schema v15):**
  - Paste snipped screenshots directly from the Windows clipboard (`Ctrl+V`), drag and drop image files into the editor, or click **Image** in the toolbar to insert PNG, JPEG, WebP, or GIF diagrams (magic-byte validated on both bridge and server, up to 5 MiB per image, up to 20 images per entry).
  - Stored in schema v15 `item_images` and served inline only via authenticated `/v1/subjects/:id/images/:imageId` and `/v1/items/:id/images/:imageId` routes with `X-Content-Type-Options: nosniff` and `Content-Disposition: inline`. Rendered via isolated IPC with `draggable="false"` and student no-download enforcement; orphaned draft images are pruned automatically.
- **Text indentation & per-entry paragraph spacing:**
  - Toolbar **Indent →** / **← Indent** buttons and `Tab` / `Shift+Tab` keyboard shortcuts indent paragraphs, headings, and blockquotes up to 6 levels (`data-indent="1..6"`), and pasted Word/Docs `margin-left`/`padding-left` indentation is mapped automatically.
  - Per-entry **Paragraph spacing** selector (`Compact 8px`, `Normal 12px`, `Relaxed 18px`, `Loose 24px`) persisted in `items.paragraph_spacing` and reflected immediately in both the editor and student/instructor reading views.
- **Entry-level minimize / expand & bulk toggle:**
  - Every entry card includes a **Minimize / Expand** button (`data-action="toggle-entry"`) in its heading bar (preserving student `.entry-actions` isolation and existing material child-section minimize), plus a **Minimize all / Expand all** button in the subject utility bar (`data-action="toggle-all-entries"`).
- **Drag entries across multiple levels (`multi_level_entries: "v1"`, schema v15):**
  - Drag any entry before, after, or **inside** any non-descendant material — or out to top level — up to **4 levels deep** (with hierarchical numbering such as `01`, `01.1`, `01.1.1` and cycle/max-depth enforcement on the server and SQL triggers).
  - Keyboard shortcuts (`Alt+↑`, `Alt+↓`, `Alt+←`, `Alt+→`) also reorder, outdent, and indent entries across levels.
- **Create account with password & update account passwords:**
  - **Create account** (`#new-account`), admin **Update password** (`#reset-password-form`), and Settings **Update password** (`#password`) include **Confirm password**, **Show / Hide** toggles, and a strong passphrase **Generate** button.
  - Admin **Update password** adds an optional **Require password change at next sign-in** checkbox (checked by default; unchecking lets an administrator set a ready-to-use password directly) and an **Update my password** shortcut on the administrator's own row in Accounts.
  - Fixed a local-demo-mode bug in `desktop/bridge.mjs` where built-in local aliases (`admin`, `instructor`, `student`) could not update their own password in Settings using their sign-in alias.
- **Full 0.6–0.11 feature set preserved:** Instructor-guided fullscreen presenter (`Play`), admin hierarchical subject folders, per-subject instructor access control, **Student · Reader** no-download enforcement, scheduled publishing/deadlines, shared sync, AE 101 template, and dated quiz score Excel exports.

## Installation, compatibility and rollback

Extract the entire Windows x64 ZIP and run `Academy.exe`. Keep all files beside the executable. Local synthetic test accounts remain `admin/admin`, `instructor/instructor`, and `student/student`.

Organization mode pairs with the matching Academy HTTPS API advertising `sync=refresh-v1`, `choice_forms`, `dates-v1`, `instructor_subject_access=v1`, `subject_folders=v1`, `rich_content=v1`, `entry_images=v1`, and `multi_level_entries=v1` (older compatible servers remain usable with plain text and single-level ordering when new capabilities are absent). Local demo databases upgrade to Windows schema 15 (`items.body_html`, `items.paragraph_spacing`, `item_images`, and multi-level `items_tree_*` triggers), saving a consistent `academy-before-pc-0.12.sqlite` backup before upgrading from schema `< 15`. Never copy a Windows local database onto the main schema-8 API. Close and back up `local-test-workspace` before upgrading; rollback requires the prior application (`pc-v0.11.0`) and its matching pre-upgrade backup.

## Verification scope and limits

This is a **test candidate / prerelease** (`pc-v0.12.0-rc.1`); stable `pc-v0.11.0` remains `Latest`. Automated gates on the exact final source require all 60 backend/migration tests (including `server/test/rich-content.test.mjs` and schema migrations through v15), 11 desktop bridge/forms/shared-API tests, all 11 native Windows Electron UI suites (including `rich-editor.mjs`), native and packaged executable IPC smoke tests, package manifest/SHA-256 verification (including `editor.js` and `richtext.mjs`), zero high-severity dependency audit issues, and paired Android verification. Exact automated results are supplied in `windows-verification.json` and `release-verification.json`. Physical Windows 10/11 clipboard/DPI/accessibility testing, real Word/Snipping Tool paste testing, real Google/external provider sign-in, live organization HTTPS deployment, and Authenticode code signing remain **NOT TESTED**; the executable is unsigned and stable production readiness is not claimed.
