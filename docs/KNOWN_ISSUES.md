# Known issues and verification limits — 0.4.0-alpha.1

No confirmed critical/high defect remains in the current self-review/host tests. Compilation, device, and deployment evidence must be read separately; test coverage is not proof of production security.

| Severity | Issue | Consequence / next action |
| --- | --- | --- |
| BLOCKER | Account backend is not deployed to a public HTTPS origin | Account screens need a configured running service |
| BLOCKER | Organization Drive credentials/folder are not configured | Actual private uploads/downloads/replacements and permissions are unverified |
| BLOCKER | Persistent release signing key is not configured | CI debug APK is for testing; unsigned release cannot be installed |
| UNVERIFIED | Android CI for final published source | Check Actions results; earlier SDK setup/API-26 theme failures were diagnosed and corrected |
| UNVERIFIED | Physical-device camera, TalkBack/200% fonts, lifecycle, protected cache, signed upgrade, performance | Complete docs/TESTING.md procedures before stable |
| LIMITATION | Pre-v3 enrollments are migrated as legacy authorization overrides | Admin must review/remove legacy access before enforcing a stricter ID policy |
| LIMITATION | Student IDs require administrator verification; no SIS identity verification service is connected | Never allow self-declared IDs; assign/correct using official records |
| LIMITATION | Student private offline downloads/sync are not implemented | Online authorization required for protected materials; public samples remain offline-capable |
| LIMITATION | One-question quiz items and untimed written examinations; no attachment upload, retakes, deadlines or weighted course grade | Use written text outputs and per-item results; no proctoring or automatic qualification claim |
| LIMITATION | Admin enrollment picker lists the first 100 accounts; student open-subject discovery and instructor rosters are paginated | Use self-enrollment where intended; searchable administrative enrollment remains future work |
| LIMITATION | Excel exports cover up to 100 students per roster page and current published revisions only | Advance roster pages and export each; full written outputs and historical revisions are excluded |
| LIMITATION | Reading percentage is self-reported and compliance has no due-date policy | Participation completion is not mastery or a passing grade |
| LIMITATION | Written drafts are device-local and cleared when session ends | No private offline final submission/sync; device key/storage/lifecycle still needs validation |
| LIMITATION | PDF signature/end checks are not antivirus or full structural validation | Organization must curate approved PDFs and validate scanning policy |
| LIMITATION | Admin MFA and distributed rate limiting are not implemented | Require deployment security review before real institutional use |
| LIMITATION | Node/SQLite backend is single-instance, with operator-managed backup/retention | Deployment/load/restore validation required; do not run replicas against the same file |
| LIMITATION | Already exported bytes/screenshots cannot be revoked | Authorization is access control, not DRM |
| UNVERIFIED | Transitive dependency locks/audit and production host hardening | Complete during release/deployment review |

Public source delivery is authorized. No public repository visibility change is needed. Protected materials, passwords, service-account keys, learner data, and real answer keys remain excluded.
