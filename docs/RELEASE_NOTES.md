# 0.7.0-alpha.1 — simpler entry editor and sequencing

Local test login defaults: `admin` / `admin`, `instructor` / `instructor`, `student` / `student`. Open Sign in with Local test accounts checked. Unchanged old defaults migrate without deleting work; changed passwords remain unchanged. Reset local test data restores defaults after confirmation. These accounts are local to the test APK, with no server required.

In a subject, admin/instructor taps + below the entries, chooses material/links, quiz, written activity, examination or PDF, enters content and presses Done. Done saves and publishes. PDFs are selected before Done and publish after successful upload; a failed new upload leaves a recoverable draft. Hold the entry handle to drag and drop into sequence. The ⋮ menu provides Edit, Move up/down (accessible alternative) and Delete with confirmation. + stays below the current final entry; save scrolls there. Subject management/QR/report controls move to Menu.

Sequence changes persist and appear in student view, results and reports. Reordering preserves item IDs, content revisions and completed/submitted work. Deletion hides entries while retaining historical records. Stale/incomplete/duplicate/foreign order requests are rejected.

Backend upgrade: this source adds SQLite schema v5 (item sort_order and subject order_revision) transactionally, retaining prior order and records. Organization deployments must upgrade the server before using sequencing. Back up the database first; old servers reject v5. Local workspace v1 upgrades to v2. Local data does not sync to production or another phone. Release builds have no local test login.

Development test APK: automated workflow/build/lint results in CI; physical-phone drag/drop, editor rotation/file picking, actual PDF viewing/provider handoff and signed upgrade remain NOT TESTED. Not a stable release. Existing debug installs may have a different CI debug certificate and require uninstall (which clears local data).

Rollback: retain prior APK. Restore a compatible database backup before reverting the backend; do not run an older server against schema v5. The prior APK cannot open local workspace v2; retain/export test data before uninstall/reset.
