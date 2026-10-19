# Known issues and verification limits — 0.8.0-alpha.1

No confirmed critical/high defect remains in the current self-review/host tests. Compilation, device, and deployment evidence must be read separately; test coverage is not proof of production security.

| Severity | Issue | Consequence / next action |
| --- | --- | --- |
| BLOCKER | Account backend is not deployed to a public HTTPS origin | Organization accounts need a configured service; local test accounts in the test APK work without it |
| OPTIONAL / UNVERIFIED | Private Drive upload credentials/folder are not configured | Not required for link-only mode; validate if enabling the optional stored-PDF adapter |
| BLOCKER | Persistent release signing key is not configured | CI debug APK is for testing; unsigned release cannot be installed |
| UNVERIFIED | Android CI for final published source | Check Actions results; earlier SDK setup/API-26 theme failures were diagnosed and corrected |
| UNVERIFIED | Physical-device camera, TalkBack/200% fonts, lifecycle, protected cache, signed upgrade, performance | Complete docs/TESTING.md procedures before stable |
| UNVERIFIED | External browser/app handoff, actual Google/YouTube/website sharing and availability | Test with intended student host accounts on real phones; host permissions are independent |
| LIMITATION | External copies, provider redirects, downloads, offline behavior and same-URL content changes are outside Academy control | Curate approved URLs and host sharing; app can revoke its reference, not already copied/opened content |
| LIMITATION | Links mode cannot serve previously uploaded private PDFs | Retain the original file adapter or replace those entries with hosted links |
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

### Local test workspace

Debug/test APK only; not an institutional deployment. Local accounts and files share one installation, persist across sign-out/relaunch, and are removed by reset, app-data clearing or uninstall. Do not put real learner data or protected material in the sandbox. Synthetic default credentials are public by design and grant no backend access. Local tests cover workflow/role behavior, not production authentication security or server synchronization. External host permissions and actual PDF rendering/file pickers/Excel apps still need physical-device checks. Test data JSON is bounded at 16 MB; each PDF at 50 MB. Reset is the recovery path for corrupted test state, with explicit confirmation. Existing debug installs may require uninstall if CI debug signing keys differ; export any wanted test PDFs/reports first.

### 0.7 entry editor/ordering compatibility

Organization sequencing requires the matching server with schema v5; the APK cannot upgrade a remotely hosted server. Back up before migration; old servers deliberately reject schema v5. Local workspace v2 preserves prior entries and migrates unchanged synthetic default passwords, retaining customized passwords. Old APKs cannot read local v2 without reverting/restoring/resetting test data. Deleted entries are archived: hidden from current views/denominators, with historical work retained. New failed PDF uploads remain unpublished drafts for retry; an upload and metadata publication are separate requests. Existing quiz choices/answers remain immutable; create a new quiz to change them. Physical-device drag/autoscroll, font scaling, file-picker rotation and editor recovery remain NOT TESTED.

### 0.8 subject board and visual verification

Subject order is a device-local view preference, isolated by account ID and organization origin; it does not change the server’s subject order, enrollment or content. No cross-device preference sync is implemented. Dragging, auto-scroll, wrapped rows, TalkBack move controls, 200% fonts and soft-keyboard/dropdown layouts need real-phone checks. RecyclerView 1.3.2 is the one added UI dependency; it supplies measured layout, stable-row drag support and auto-scrolling without a separate drag framework. Public sample subjects retain catalog order; the draggable board is the signed-in account subject list. Uninstall/data clearing removes personal order.
