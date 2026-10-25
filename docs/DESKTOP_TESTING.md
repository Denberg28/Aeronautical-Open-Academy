# Desktop verification — 0.2.0-rc.1

Baseline: Android/backend repository commit `62d81ae`. Scope: new Windows desktop client, test workspace bootstrap, isolated IPC bridge, three-pane single-page UI, packaging and CI. The server adds schema-6 grouping and inherited publication checks; Android source is unchanged. The delivered package includes its exact `source-commit.txt`; this document is part of that source. Previous verified desktop baseline: `cbd9286`. Date: 25 October 2026 (Asia/Manila).

## Acceptance criteria

- One main window with collapsible LMS navigation, central role-specific subjects and editing, and a persistent announcements/tasks pane. No horizontal overflow at a 1060 × 720 content area; inspect normal 1480 × 960 layout.
- Instructor can create/edit a subject and add text plus a link in place; Attach link never submits. Done saves, publish state is respected, edit/delete/reorder work through ownership/version checks. Invalid input retains the current text.
- Student cannot create/edit content or see drafts/answer keys, can mark reading and submit quiz/written work once per revision, and can inspect tasks/results. Instructor can assess written work and export Excel.
- Enrollment uses verified IDs/all-students eligibility and subject discovery/codes. Admin can create accounts, suspend/reactivate access and manage announcements.
- Unsaved work triggers a discard confirmation on navigation; cancel keeps the text. Network/API failures report errors without clearing the current form. No silent cross-PC sync is claimed.
- UI text is escaped, renderer has no Node access, tokens stay in the main process, and links are freshly authorized by revision before opening externally. Local test aliases never map into organization credentials.
- A Windows x64 package contains a PE executable, all desktop/backend resources and documentation, and no database, environment file, private key or real learner information.

## Recorded checks

| Gate / check | Status | Evidence / scope |
| --- | --- | --- |
| A — JS parse, locked dependencies, package source | PASS | `node --check desktop/main.mjs`, `node --check desktop/ui/app.js`; committed package lock; `git diff --check` |
| A — Windows package structure | PASS | `node desktop/tools/verify-package.mjs`: PE machine x64, runtime renderer/preload/backend/schema, README, no data/key files |
| B — Desktop bridge integration | PASS | `npm test --prefix desktop`: 4 tests covering role boundaries, persisted reading/submission across restart, report ZIP, revision/link authorization, local API header, organization-origin/credential isolation |
| B — Native desktop workflows | PASS | Playwright drives the actual Electron 45 window on Linux/Xvfb: instructor add/attach/save/edit/order/quiz/draft; student reading/submission/quiz/results/tasks; grading/export; admin announcements/accounts; escaped HTML; responsive width; Google link metadata; same-account session recovery; post-save refresh failure; simulated cancelled quit |
| C — Shared backend regression | PASS | `npm test --prefix server`: 34 tests, including grouping, inherited visibility, structure moves, archive confirmation and schema migrations |
| C — Existing project integrity | PASS | `python tools/project_checks.py`: catalog/assets/XML/wrapper/network/focused secret checks |
| C — Android build compatibility | CI REQUIRED | Server changed; the existing Android build/lint/regression workflow must pass for this exact source. Physical Android behavior remains NOT TESTED. |
| D — Native startup/IPC | PASS | Actual Electron Linux startup, custom scheme, sandboxed preload and instructor login via `--smoke-test` |
| D — Organization service / host material access | NOT TESTED | HTTPS-origin/credential separation tested with a synthetic transport; no real organization deployment, Google sign-in or provider sharing test |
| E — Hardware control | N/A | Education app does not command physical equipment |
| F — Windows automation | CI REQUIRED | Windows workflow must pass native UI, packaged EXE login/IPC, dependency audit and full package hash verification. The CI archive includes `windows-verification.json`; it is the authoritative per-commit result. |
| F — Physical Windows accessibility/provider use | NOT TESTED | Windows 10/11 physical device, assistive technology, real Google/YouTube access, native browser and save dialogs still require acceptance. Chromium zoom layout tests are not OS DPI/accessibility validation. |
| F — Stable promotion | BLOCKED | Physical Windows acceptance, signing/upgrade and institution deployment are not proven |

Internal QA images are generated under ignored `out/desktop-qa/`; they contain synthetic data only. Native UI tests suppress opening external programs and save reports into a temporary test directory, so they validate authorization/IPC/report data without claiming a real browser or OS save-dialog interaction. These test hooks are disabled in packaged builds. The smoke test uses a unique temporary demonstration workspace. Tests do not modify organization data.

## Reproduce

```sh
npm ci --prefix desktop
npm test --prefix desktop
npm test --prefix server
npm run test:ui --prefix desktop
npm run package:win --prefix desktop
node desktop/tools/verify-package.mjs
```

On headless Linux, run the UI test under Xvfb. On Windows, the `Desktop preview verification` workflow installs Electron through `npm ci`, drives its actual window, performs an IPC smoke test, packages the preview, and uploads a commit-named artifact including the versioned ZIP, hash and Windows verification JSON. No stable release is automatically published. Packaging produces a versioned portable Windows ZIP and SHA-256 package manifest; it never embeds user data. Desktop tests use a fresh temporary database; server tests use their existing isolated fixtures.

## Windows acceptance before promotion

Extract the entire package and launch Academy.exe on Windows 10/11 x64. Test default local account sign-in, create text/link materials, reopen after shutdown, student enrollment and submissions, announcements, role switching, browser host sign-in and Excel save/cancel. Check 100%, 125%, 150% and 200% display scaling with keyboard/screen reader. Test unsaved work on navigation and window close, failed service requests and session expiry. Connect the intended organization HTTPS backend to verify shared subjects on a second client. Back up the closed local-test-workspace directory before an upgrade; retain the prior compatible app/data pair for rollback. Missing real-device checks remain explicit and block stable promotion.

## Link-focused candidate acceptance

- Attach, remove and edit several links; render Drive/Docs/Sheets/Slides/YouTube/image labels. Preserve resource keys and sheet/slide fragments exactly. Existing inline and URL-only entries stay clickable, including URLs surrounded by punctuation. Labels describe the address rather than asserting MIME/content or availability.
- Canonical backend parsing supplies the rendered references. Unsafe schemes, credentials and local destinations remain text; authorization and exact current revision checks still run when opening any link. No remote previews or permission changes occur.
- Change the composer type and return without losing attachments or quiz answers. Validation failures retain input. Same-account reauthentication preserves the current form only in memory; another account/workspace starts clean.
- Saving followed by a simulated refresh failure closes the saved form; a manual refresh shows exactly one entry. This is distinct from an ambiguous write timeout, which is not automatically retried.
- Simulate a cancelled close with dirty text, then verify the local API still responds. Check 100%, 125%, 150%, 200% Chromium zoom for horizontal overflow.

Security audit: the unmaintained `extract-zip` packaging dependency was removed in favor of Electron's existing `@electron-internal/extract-zip` package, pinned at 1.0.6. No new runtime dependency is shipped. Run the current locked dependency audit again in Windows CI.

API errors now cross the isolated desktop bridge as explicit data envelopes, preserving HTTP status. The renderer reconstructs errors locally, so a 401 reliably opens sign-in and same-account drafts can resume. The native UI test invalidates its underlying session and verifies this behavior.

## Subject tree acceptance (0.2)

- Subject + offers material/examination only. Material + offers activity/quiz only and remains after the final child; the inline editor follows its context. Examinations cannot be nested.
- Legacy standalone assessments remain visible and can be assigned through Edit → Material. Migration must preserve IDs, order, learner submissions and grades with parent IDs initially null. Reopen grouped schema-6 data without losing links.
- Root moves carry children; child moves remain among siblings. Cross-material placement requires explicit parent selection and current item/tree versions. Membership/order changes invalidate stale tree snapshots without incrementing learning revisions.
- Student lists, direct item/link/submission access, completion denominators, results and instructor reports all exclude children of a hidden parent. Group deletion requires explicit cascade confirmation and checks every child owner; archive retains historical work.
- Older organization backends must not silently create a supposed child as a root. The UI detects tree_version and hides nested creation until an upgraded service is present. Existing Android organization flows continue through the flattened API; Android local mode is unchanged.

Local evidence: 34 server tests and 4 desktop tests pass. Native Electron role/creation/recovery/zoom checks pass on Linux; the Windows CI JSON remains authoritative for native Windows and packaged EXE checks. Android compilation/lint must also pass on the final commit before candidate delivery. Physical device, provider sign-in and organization deployment remain NOT TESTED.
