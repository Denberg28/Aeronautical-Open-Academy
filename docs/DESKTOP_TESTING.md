# Desktop verification — 0.1.0-alpha.1

Baseline: Android/backend repository commit `62d81ae`. Scope: new Windows desktop client, test workspace bootstrap, isolated IPC bridge, three-pane single-page UI, packaging and CI. The shared server and Android source are unchanged. The delivered package includes its exact `source-commit.txt`; this document is part of that source. Date: 24 October 2026.

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
| B — Desktop bridge integration | PASS | `npm test --prefix desktop`: 2 tests covering role boundaries, persisted reading/submission across restart, report ZIP, revision/link authorization, local API header, organization-origin/credential isolation |
| B — Native desktop workflows | PASS | Playwright drives the actual Electron 45 window on Linux/Xvfb: instructor add/attach/save/edit/order/quiz/draft; student reading/submission/quiz/results/tasks; grading/export; admin announcements/accounts; escaped HTML; responsive width |
| C — Shared backend regression | PASS | `npm test --prefix server`: 31 tests; no server behavior changes |
| C — Existing project integrity | PASS | `python tools/project_checks.py`: catalog/assets/XML/wrapper/network/focused secret checks |
| C — Android build/device | N/A | No Android app or server source change; this artifact is a separate Windows preview, not an Android candidate |
| D — Native startup/IPC | PASS | Actual Electron Linux startup, custom scheme, sandboxed preload and instructor login via `--smoke-test` |
| D — Organization service / host material access | NOT TESTED | HTTPS-origin/credential separation tested with a synthetic transport; no real organization deployment, Google sign-in or provider sharing test |
| E — Hardware control | N/A | Education app does not command physical equipment |
| F — Windows installation/launch/accessibility | NOT TESTED locally | Linux host builds Windows resources; real Windows launch, scaling, assistive technology, native browser handoff and save dialog require Windows validation. The Windows CI workflow automates startup and core flows; inspect its results separately |
| F — Stable promotion | BLOCKED | This is an alpha desktop preview; Windows acceptance, signing/upgrade and institution deployment are not proven |

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

On headless Linux, run the UI test under Xvfb. On Windows, the `Desktop preview verification` workflow installs Electron through `npm ci`, drives its actual window, performs an IPC smoke test, packages the preview, and uploads a commit-named artifact. No stable release is automatically published. Desktop tests use a fresh temporary database; server tests use their existing isolated fixtures.

## Windows acceptance before promotion

Extract the entire package and launch Academy.exe on Windows 10/11 x64. Test default local account sign-in, create text/link materials, reopen after shutdown, student enrollment and submissions, announcements, role switching, browser host sign-in and Excel save/cancel. Check 100%, 125%, 150% and 200% display scaling with keyboard/screen reader. Test unsaved work on navigation and window close, failed service requests and session expiry. Connect the intended organization HTTPS backend to verify shared subjects on a second client. Back up the closed local-test-workspace directory before an upgrade; retain the prior compatible app/data pair for rollback. Missing real-device checks remain explicit and block stable promotion.
