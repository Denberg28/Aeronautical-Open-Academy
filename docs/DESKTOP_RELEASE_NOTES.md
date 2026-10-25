# Aeronautical Open Academy for Windows — 0.2.0-rc.2

25 October 2026 · Compact subject tree and collapsible materials

Material titles now have a chevron and child count to minimize or expand their activities and quizzes. Collapsed sections survive refresh/reorder for the current sign-in; search reveals matching children and clearing search restores the preference. Opening a task reveals its parent. A nested editor keeps its section open.

Drag grips now sit in the left rail beside the content. Drop in the upper or lower half of a sibling to place an entry before or after it. Focus the grip and use Alt+Up / Alt+Down for keyboard reordering. The bottom drag handle and arrows are removed, with reduced card padding and spacing.

Materials now contain their own activities and quizzes. Examinations stay at the subject level, alongside materials. Both instructor editing and student viewing show the same grouping.

| Location | Creation control | Choices |
| --- | --- | --- |
| After the subject’s final group | + Add material or examination | Material / links; Examination |
| Inside a material, after its final child | + Add activity or quiz | Activity; Quiz |

The editor opens in place. Done saves the entry and restores the + at that same level. Editing appears next to the selected entry. Existing standalone activities and quizzes retain their IDs and learning history; choose Edit → Material to assign them explicitly.

Moving a material carries its children. Child grips move within their own material; Edit → Material changes the parent. Structure changes preserve content revisions, submitted work and grades. Search keeps a matching child’s material context visible.

Unpublishing a material hides its children from student lists, tasks, results, reports and direct read/link/submission routes. Republishing restores their individual publication states. Removing a nonempty material confirms removal of the whole group with a current tree revision; archived learning records remain retained.

## Compatibility and data

Backend schema 6 adds validated parent IDs. The additive migration preserves existing IDs, links, order, submissions and grades without guessing where standalone assessments belong. Back up the closed local workspace or stopped backend before upgrading. Old schema-5 software refuses the newer database; rollback requires the matching prior database backup and app/server.

The updated backend is bundled for the local PC workspace. Organization grouping requires deploying this updated server; older servers show guidance and disable nested creation. Android’s existing organization client remains compatible with the canonical flattened item list and server authorization; its UI and separate local test workspace do not gain this desktop tree.

## Verification and installation

The CI-delivered archive includes windows-verification.json, package-manifest.json and the exact source commit. Automated coverage includes 34 backend tests (migration, grouping, authorization, retained work and archive behavior), 4 desktop bridge/link tests, native editor/student workflows, contextual + choices, legacy grouping, material moves, search, session recovery and zoom layout. Inspect the per-commit CI result before claiming Windows/Android build validation.

Extract the entire ZIP and open Academy.exe. Windows 10/11 x64 is the intended target; native automated checks use Windows Server 2025. No Node, Python or Java installation is required. Test local roles: admin/admin, instructor/instructor, student/student. Local workspaces remain per-PC and do not synchronize.

This is an unsigned release candidate. Physical Windows accessibility, real Google/provider permissions, organization deployment and signed upgrades still require acceptance; stable promotion remains blocked. Google Drive/Docs/Sheets/Slides, YouTube, image and other references retain the existing link-focused behavior and original host permissions.
