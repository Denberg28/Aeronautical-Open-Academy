# Aeronautical Open Academy for Windows — 0.3.2-rc.1

25 October 2026 · Instructor subject deletion

Instructors can delete subjects they created through **Subject details → Delete subject**. Administrators can manage any subject. The confirmation identifies the subject and warns when unsaved changes will be discarded. Cancelling or a failed request keeps the editor and its text intact.

Deletion removes the subject, its contents and related tasks from active instructor/student workspaces. Saved materials, links, student submissions and grades are retained internally. Direct item, enrollment, reporting and content access through the deleted subject is denied. No Google Drive or other host file is deleted.

The server requires confirmation and a current subject/content snapshot, rejecting changes made since the subject was loaded. Archiving and its audit record commit atomically; retries after an acknowledged deletion are idempotent. Navigation updates immediately after acknowledgement without depending on another fetch. Deleting the final subject leaves an empty workspace with New subject available. Previously improved material/Activity/Quiz creation and dragging remain included.

## Compatibility and installation

No database schema change is introduced; the application continues using schema 8. Back up the closed workspace before upgrading. Organization deletion requires the matching updated backend. The Android local test workspace remains separate.

Extract the entire ZIP and open Academy.exe. Default local accounts: admin/admin, instructor/instructor, student/student. Local workspaces stay on each PC.

Required verification covers 39 backend and four desktop tests, native LMS/drag/deletion workflows, cancellation/failure/restart behavior, packaged Windows startup and hashes, dependency audit and Android build/lint compatibility. The ZIP includes its exact source commit and per-commit verification evidence.

Unsigned release candidate. Physical Windows accessibility, real Google/provider sharing/sign-in, organization deployment and signed upgrades remain unverified.
