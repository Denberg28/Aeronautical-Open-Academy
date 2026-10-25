# Aeronautical Open Academy for Windows — 0.3.0-rc.1

25 October 2026 · Smooth subject updates and optional subsections

Dragging, saving and refreshing retain the center pane and a visible entry anchor. The sidebar stays mounted. A short movement animation and saved-entry highlight provide feedback; reduced-motion preferences disable animation. Keyboard focus returns to the grip without scrolling the view to the top.

Each material includes **+ Subsection**, alongside **+ Add activity or quiz**. Subsections support text, multiple original sharing links, activities and quizzes. Their title chevron minimizes the body and nested work. Search temporarily reveals matching descendants; clearing search restores the minimized state. No empty subsection is created automatically. Examinations remain at subject level.

Root materials move with their entire subtree. Activities and quizzes can be assigned to a material or subsection with Edit → Material, retaining submissions and grades. Hiding a material hides every descendant from student access; removing a whole material confirms and archives all descendants atomically.

## Compatibility and upgrade

The bundled local backend migrates schema 6 to 7 without changing existing IDs, content, grouping, submissions or grades. **Close Academy and back up the local workspace before upgrading.** Older app/backend versions cannot reopen schema-7 data; rollback requires the previous app and its matching database backup. Organization subsections require deploying this updated server (tree capability 2); older backends retain their supported controls. Android organization clients consume the flattened item list; the Android local test workspace is separate.

## Verification and installation

The Windows CI archive includes windows-verification.json, package-manifest.json and source-commit.txt. Required gates cover backend migration/permissions, desktop bridge and native UI workflows, long-subject scroll retention, subsection editing/collapse/search, native dragging, reduced motion, dependency audit, package integrity and packaged executable launch. Android compatibility must pass for this source. Consult per-commit evidence; source review alone is not a native Windows test.

Extract the entire ZIP and open Academy.exe. Test accounts: admin/admin, instructor/instructor and student/student. Local test data stays on each PC.

Unsigned release candidate. Physical Windows accessibility, real Google sharing/sign-in, organization deployment and signed upgrades remain unverified.
