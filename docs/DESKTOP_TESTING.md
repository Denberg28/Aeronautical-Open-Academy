# Desktop verification — 0.4.0-rc.1

Baseline: Android/backend repository commit `62d81ae`. Scope: new Windows desktop client, test workspace bootstrap, isolated IPC bridge, three-pane single-page UI, packaging and CI. The server uses schema-8 material grouping and inherited publication checks; Android source is unchanged. The delivered package includes its exact `source-commit.txt`; this document is part of that source. Previous verified desktop baseline: `3991aa3` (0.2.0-rc.1). Date: 25 October 2026 (Asia/Manila).

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
| C — Shared backend regression | PASS | `npm test --prefix server`: 39 tests, including grouping, inherited visibility, structure moves, archive confirmation and schema migrations |
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

## Compact tree acceptance (0.3.1-rc.1)

- Minimize/expand material children for instructor and student; counts and aria-expanded remain accurate. Refresh/order retain the preference during the sign-in; search reveals matching children and clearing it restores collapse. Task links reveal the target.
- A nested editor cannot be minimized, and toggling an unrelated material preserves draft text. Student drafts stay in the DOM when minimized. Collapse does not call the backend or change publication.
- Only left-rail grips reorder; no bottom drag handle or arrow controls remain. Native pointer drag supports before/after placement and Alt+Up/Down provides keyboard ordering. Material moves preserve children; child moves stay among siblings.
- Compact cards and collapse controls remain within the center pane at normal/1060px layouts and 125/150/200% Chromium zoom.

## Subject tree acceptance (0.2)

- Subject + offers material/examination only. Material + offers activity/quiz only and remains after the final child; the inline editor follows its context. Examinations cannot be nested.
- Legacy standalone assessments remain visible and can be assigned through Edit → Material. Migration must preserve IDs, order, learner submissions and grades with parent IDs initially null. Reopen grouped schema-8 data without losing links.
- Root moves carry children; child moves remain among siblings. Cross-material placement requires explicit parent selection and current item/tree versions. Membership/order changes invalidate stale tree snapshots without incrementing learning revisions.
- Student lists, direct item/link/submission access, completion denominators, results and instructor reports all exclude children of a hidden parent. Group deletion requires explicit cascade confirmation and checks every child owner; archive retains historical work.
- Older organization backends must not silently create a supposed child as a root. The UI detects tree_version and hides nested creation until an upgraded service is present. Existing Android organization flows continue through the flattened API; Android local mode is unchanged.

Local evidence: 39 server tests and 4 desktop tests pass. Native Electron role/creation/recovery/zoom checks pass on Linux; the Windows CI JSON remains authoritative for native Windows and packaged EXE checks. Android compilation/lint must also pass on the final commit before candidate delivery. Physical device, provider sign-in and organization deployment remain NOT TESTED.

## Activity/Quiz-only materials and drag continuity (0.3.1-rc.1)

Baseline: 0.3.0-rc.1, source tree b961be2ba69880378c00fa71df9401cf473a16c9. Scope: remove subsection creation, safely upgrade existing subsection data and improve pointer/keyboard reorder.

- Material + offers Activity and Quiz only. Backend/SQL reject nested materials and examinations. Former subsections become regular root materials without changing their content IDs, learning revisions, links, child activities/quizzes, reading or grades. Hidden former subsections remain unpublished after promotion. Migration is transactional and idempotent on reopen. Back up first; restore a matched app/database pair for downgrade.
- Reorder saves the current complete-ID set and order revision before moving existing group nodes in place. No-op drops make no request. A stale/failed save leaves order, nodes and revision intact. Root moves carry children and child moves remain among siblings.
- `desktop/test/motion.mjs` uses a 24-material subject more than 1,000px down. Refresh and keyboard movement retain a visible header within 3px where document bounds permit. A native pointer drop places the moved header at the chosen insertion boundary (clamped to the viewport). Repeated before/after drops must match the backend sequence. Center, sidebar, material and child node identities survive reorder.
- The same insertion marker stays in place while the pointer crosses a target's text/buttons. Cancellation clears the marker, dimming and preview. Edge auto-scroll stays bounded to the center and stops on cancellation. Active drafts block pointer drag initiation. Reduced motion disables movement animation. Normal/1060px and 125/150/200% zoom must fit without horizontal overflow.
- Both native Windows UI suites, packaged EXE startup/IPC, package hash verification and dependency audit are required on the final source. Android build/lint/regression remains required. Physical Windows accessibility, real provider access and organization deployment remain NOT TESTED.

## Instructor subject deletion (0.4.0-rc.1)

Baseline: 0.3.1-rc.1 source tree 67d239e9d4d1a3768843b5764c10c33159d580a0. Schema 8 is unchanged.

- Only the instructor owner or an administrator may archive a subject. Confirmation and matching title/description, order/eligibility revision and complete current item/edit-version set are required. Foreign instructors/students cannot delete. Changed content/structure rejects the stale snapshot. Audit failure rolls the archive back; an authorized repeated confirmed deletion succeeds once without duplicate audit.
- Deleted subjects disappear from lists and direct item/subject/report/enrollment access fails. Materials, student outputs, scores and feedback remain stored. No external host operation occurs.
- `desktop/test/subject-delete.mjs` checks confirmation cancellation with unsaved text, a failed deletion preserving the form, successful navigation/list cleanup, deleting the final subject, creating a fresh subject afterwards, restart persistence and absent student controls.
- The Windows UI command now runs LMS, motion and deletion suites. Windows CI must pass them and packaged startup/hash/audit gates on the final source. Android build/lint/regression remains required. Physical Windows/provider/organization acceptance remains NOT TESTED.

## 0.4.0-rc.1 acceptance and evidence

Baseline: desktop `5b59057` / 0.3.2-rc.1. Changes are desktop-only; schema 8 and Android sources are unchanged. Acceptance: a non-first correct answer is explicitly selected, changing choices invalidates it, unchanged draft/type switching preserves it, a student receives the expected server score, and student payloads exclude answer keys. QR generation/saving is owner/admin-only and uses the Android subject identifier, not an authorization token. An independent jsQR decoder must recover the exact payload from the displayed SVG image. The saved file must be present. The native suite also grades an activity and checks numeric grade and quiz rows in the exported workbook, alongside existing drag/delete/role regressions. No data migration is expected.

Local source checks and bridge regression run under Node 24.22.1. Windows CI is the required native UI, QR decoding, packaged startup, dependency audit, package integrity and export gate for this exact source. Earlier PASS rows describe established baseline coverage; use the delivered per-commit windows-verification.json for final evidence. Android CI must pass the same commit before delivery. Physical Windows, organization deployment, real host access and mobile cross-device enrollment remain NOT TESTED; stable promotion remains BLOCKED.

## 0.5.0-rc.1 acceptance

Baseline: verified 0.4.0-rc.1 source ea8da43. Schema 9 adds questions and rebuilds attempts transactionally to support correct-answer counts and stored maxima. Required checks: legacy IDs/keys/attempts survive migration/reopen; multi-question creation validates count, prompt, choices, explicit key and bounded size; student payloads exclude keys; submission requires every answer and the current revision; the server ignores supplied scores; replay of identical answers is idempotent while changed/duplicate attempts are rejected; audit failure rolls back the whole attempt.

Native Windows tests create a three-question quiz, change/type-switch its draft, select non-first keys, cancel/accept readiness, minimize/expand without losing answers, submit two correct answers, verify Done and collapsed read-only review, and inspect the 2/3 result in the exported Excel assessment row. Existing enrollment QR, grading, drag/motion, deletion, role and layout suites remain required. All checks run on the final commit before candidate delivery. Android build/lint and regression remain required for its compatibility notice/denominator update. Physical Windows, live organization access, and Android device behavior remain NOT TESTED; stable promotion remains BLOCKED.
