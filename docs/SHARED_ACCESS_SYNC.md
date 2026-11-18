# Shared accounts, protected reading and sync — 0.12 development candidate

## Contract and scope

APK, Windows organization mode and Streamlit must point to the **same Academy HTTPS API**. The server owns accounts, enrollment, publication, content revisions, submissions, grading and reading progress. Sync revalidates the current account and reloads that authorized data; successful online writes are already saved on the server. Sync never imports local demo accounts, edits, learner records or answer keys into an organization. This is manual refresh, not an offline write queue or a merge of independent SQLite databases. Unsaved forms must be completed or closed before native/desktop sync; Streamlit retains widget values until successful saves.

| Component | Delivery source / protocol | Local data and compatibility |
| --- | --- | --- |
| Android 0.12.0-alpha.1 | `main`; `/v1/me`, `/v1/sync`, existing subject/item APIs | Existing device-local demo remains separate; current protected PDFs use temporary private storage |
| Streamlit | `main`; same API, `ACADEMY_API_URL` in private Secrets | No organization database in Community Cloud; PDF rasterization is server-side |
| Windows 0.8.0-rc.1 | Windows branch; same organization API | Local demo uses PC schema 11 and a consistent backup before upgrade; never copy its DB onto the main API |
| Main organization API | `main`, schema 7 unchanged | No live migration in this task; older API needs the source update for sync/global logout/download policy |
| Bundled Windows demo API | Windows branch, schema 11 | Grouping/desktop forms preserved; API responses advertise additional capabilities. It is not the main schema-7 database |

Windows negotiates main API choice forms (up to 20 questions) versus its local 50-question quiz extension, preserves flat/grouped layouts, and submits a quiz through the route advertised by that API. The two database schemas remain deliberately distinct. Always retain a consistent matching backup/server before changing a live API.

## User flow

1. Administrator provisions instructor/student accounts with temporary 15–128 character passphrases. Accounts must change them on first sign-in. No public registration or production default password is added.
2. Instructor uploads a PDF draft using APK, web, or Windows when the server advertises upload storage; review and publish. Text/link materials still work with link-only storage.
3. Enrolled students read in the application. Explicit protected-file download requests are denied even when an old record contains `offline_allowed=1`. New requests cannot grant that flag. Item responses advertise false, preserving the old response field for client compatibility.
4. Students submit work/answers and mark reading online. Another signed-in device taps **Sync** to receive the current published content, grades and progress. A revoked/suspended account fails authorization rather than retaining access through sync.
5. **Sign out all devices** deletes every session for the current authenticated account in the same transaction as its audit record. A failed transaction preserves sessions and reports failure; successful revocation also applies to other devices at their next request. A copied/offline screen is not remotely erased.

## Reading and download limits

The web reader rasterizes one authorized PDF page into a PNG with pypdfium2/PDFium. Original PDF bytes stay on the Streamlit server and are not passed to `st.pdf` or a browser PDF URL. Raster dimensions are capped at 1400×2000 and documents at 2000 pages. No PDF download, print or external-reader action is offered.

Android retains the private native page reader and creator-only external export control; student protected-file export stays hidden. Windows uses an internal PDF.js canvas reader, rechecks access/revision on each page turn and blocks native download events, save/print shortcuts, external windows and packaged developer tools. PDF bytes remain in process memory, are not written as student-owned files, and are discarded on close. Instructor upload uses a native PDF picker and backend ownership/version checks. The web/Windows image/canvas reader cannot provide a PDF text layer to assistive technology; provide an accessible text lesson alongside the PDF.

These controls block ordinary **protected course-file export**, not every form of copying. Screenshots, copied text, browser inspection and an authorized user's custom client cannot be eliminated by client UI controls. External Google Drive/Docs/YouTube links retain their provider's sharing/download settings; Academy cannot change those policies. Use protected uploads for in-app reading restrictions. Public bundled samples and source/release files are public resources, not private institutional content.

## Authentication and recovery

Existing main-API safeguards remain: scrypt password hashes, hashed opaque sessions, durable per-account/peer budgets, admin-only registration, temporary-password rotation, revocation on access/password changes, and HTTPS/no-redirect clients. Windows now carries the same strict identity parser and durable hashed login budgets for its demo backend (schema 11), atomic sign-in/password/global-sign-out writes, private database creation and integrity checks. Its tokens stay in the main process in memory and never reach the renderer or disk. Requests have bounded response bytes and reject results from a changed session.

Sync is disabled/refused when the backend does not advertise `sync=refresh-v1`. Errors preserve recoverable forms instead of reporting success; permission/session failures clear private views. Offline global sign-out cannot be confirmed and must not be reported as account-wide revocation. Browser sessions with unsent forms remain transient; there is no new autosave/offline queue. No credentials, real learner data, provider access permissions or signing keys are created or changed in source.

## Acceptance and evidence

New HTTP tests cover receipt identity, no returned secret, temporary-password sync denial, shared progress, legacy offline-grant denial, denied unsigned sync, atomic failed global logout and successful two-device revocation. Web AppTest covers another-device progress followed by Sync/global logout, in-page PNG output without a PDF component, malformed PDF rejection and existing author/student assessment workflows. Windows bridge tests run against the actual main API in local integration, including upload, digest-checked reading, progress, choice-form routing, global logout, response bounds and stale-session rejection. The native Windows suite additionally exercises the actual canvas reader and page-turn revocation; CI is authoritative for that gate.

Local verification: main API 42 HTTP/storage tests; web 16 tests; 12 catalog/release tests; 93 pure Java core checks; Java syntax parsing. Windows backend 45 tests, desktop bridge/forms 10 tests, npm audit reports no vulnerabilities. Android compilation/lint/emulator, native Windows package/full-suite checks require their CI results; the added native reader test passed locally on headless Electron. Physical phone, actual deployed HTTPS/Drive, real-user sign-in, restart/restore and cross-device field use remain **NOT TESTED** until observed. No stable readiness is claimed.

Deploy the updated API first, then clients. Streamlit source can redeploy from main, but its `ACADEMY_API_URL` must resolve to that updated persistent service. A Streamlit deployment alone does not host Node/SQLite. No live database was opened or migrated here. Keep the current Android signing identity. Windows local upgrade saves `academy-before-pc-0.8.sqlite`; downgrade requires restoring that complete compatible database/backend snapshot.

## Manual edit map

| Desired result | File | Symbol/section | Scope and check |
| --- | --- | --- | --- |
| Change sync receipt | `server/src/access.mjs` | `syncReceipt` | Authenticated identity only; keep both branches' protocol equal |
| Change protected export rules | `server/src/server.mjs` | `/content`, `presentItem`, item creation | Ignore legacy offline grants; HTTP deny/regression checks |
| Change web page bounds | `web/reader.py` | `page_image` | Pixel/page caps; malformed-document and PNG tests |
| Change web sync/logout UI | `web/portal.py` | `workspace` | No shared caches; AppTest revocation/progress tests |
| Change APK sync actions | `WorkspaceActivity.java` | `load(boolean)`, `signOutAll`, header | Save/close forms; Android compile and device workflow |
| Change PC PDF packaging/reader | Windows `desktop/tools/prepare-pdf.mjs`, `ui/reader.js` | Pinned assets, page authorization | Reproduce vendor assets from npm; native reader/package CI |
