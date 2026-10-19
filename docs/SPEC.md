# 0.2.0-alpha.1 scope and roles

The user authorized public repository delivery on 19 October 2026 and replaced the earlier anonymous-library-only MVP with account-based learning. Preserve public samples A/B/C and add a separate protected learning workspace. The earlier local source commit is 6a0813a; the public repository was initialized separately and its commit chain is authoritative for published builds.

| Capability | Admin | Instructor | Student |
| --- | --- | --- | --- |
| Register, reset password, change role, suspend/reactivate/delete accounts | All, with last-admin/self-lockout safeguards | No | No |
| Manage enrollment | All subjects | No in this first version | No self-enrollment |
| Create/edit subjects | All; API supports assigning active instructor owner | Own | Read enrolled subjects |
| Upload/edit/archive/download materials | All | Creator-owned only | View published enrolled content |
| Create activities/quizzes | All | Own subjects/items | No |
| Global announcements | Publish/archive | Read | Read |
| Activity completion | View/manage content | View/manage content | Self-mark/unmark own progress |
| Quiz answers/grades | Content oversight | Own quiz keys | Submit own answer; server scores |

UI keeps Subjects and News primary; account administration appears only to admins. Draft → upload/review → publish is the instructor default. Destructive actions require explicit confirmation. Account deletion anonymizes the account, removes student enrollment/progress/attempts, revokes sessions, and retains authored content for administrator review.

Quiz MVP: one multiple-choice question per quiz item (2–6 API options, two in the first authoring form), one submission per item revision, request-id deduplication, immutable server scoring. Submitted/completed is distinct from passed. Formal gradebooks, retakes/deadlines, essay grading, multi-question exams, messaging, payments, and cross-device offline synchronization are future work.

## Acceptance gates

1. Student cannot invoke admin routes, choose a role, read another course, edit ownership, or obtain answer keys.
2. Instructor A cannot view/manage instructor B's subject, nor edit/download a different creator's protected item.
3. An unenrolled/suspended/deleted user is denied even with an old token; role changes/reset/logout revoke sessions.
4. Last active admin cannot be removed/demoted; current admin cannot lock themselves out.
5. Private file download/view rechecks active account and enrollment; upload rechecks authority after async transfer.
6. Student activity completion affects only their own current revision. Manual quiz completion is rejected.
7. Quiz scoring ignores client-supplied score/key; same-key retries do not create attempts; changed-answer replay is rejected.
8. Draft items and private file references are omitted from student responses.
9. Subject QR opens the subject after login if enrolled; QR never enrolls or grants file access.
10. Sample codes A/B/C and their completed public PDFs remain available offline. Failed updates preserve the prior catalog/copy.
11. Android build/JVM tests/lint and backend tests pass on the published source; secret/configuration checks pass.
12. Physical-device camera/permissions/200% fonts/TalkBack/rotation/process recreation and signed install/upgrade pass before stable.
13. Real organization Drive upload/view/replace/access revocation passes before claiming production integration.

Performance budgets: interactive public startup ≤2 s (4/5 physical-device cold runs), QR resolution ≤100 ms after decode, account API response ≤2 s excluding password hashing/file transfer on reference deployment, ≤50 MiB/PDF, ≤1 MiB public catalog, ≤64 KiB API request JSON, protected viewer bitmap ≤1600×2400. These are targets; physical/deployed measurements are pending.

No control equipment is commanded. Actuator HIL is N/A; Android hardware/OS behavior remains a mandatory device gate.
