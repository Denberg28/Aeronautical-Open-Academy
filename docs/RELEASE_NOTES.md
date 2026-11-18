# 0.13.0-alpha.1 — scheduled publishing and completion dates

Instructors can set Draft / Publish now / Scheduled and an optional completion due date for every material, quiz, activity and examination. Android entry menu and Streamlit expose Publishing and due date. Pickers and captions use Philippine time (Asia/Manila); the server owns release time and hidden-entry authorization. Create a draft first when scheduling later.

Students see due dates and overdue/late labels. Late work remains accepted without automatic grade penalties. Date edits preserve grades and content revisions; stale edits are rejected. Excel learner reports include due dates and deadline status. Deploy the matching schema-8 API first with a consistent tested backup. No live database or signing identity changed here. See SCHEDULING.md for procedures, compatibility and rollback.

Development test release. Automated build/regression/emulator evidence is tied to the exact release commit. Physical-phone date pickers, accessibility/rotation, live hosting/clock synchronization and production backup/restore remain NOT TESTED. Public bundled practice samples remain independent from organization scheduling.
