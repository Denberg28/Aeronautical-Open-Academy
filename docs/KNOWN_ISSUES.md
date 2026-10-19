# Known issues and verification limits

No confirmed critical/high defect was found during source self-review and host checks. This is not proof that none exists: Android compilation and runtime gates remain incomplete. Publication workflows block when a CRITICAL/HIGH row is added below.

| Severity | Issue | Consequence / next action |
| --- | --- | --- |
| BLOCKER | Named repository is public, requested delivery private | Resolve visibility before any external write |
| BLOCKER | No available Android SDK and Gradle download fails | Build/lint/Android unit tests on private GitHub runner or an SDK-equipped machine |
| BLOCKER | No persistent release signing key configured | Establish owner-controlled key/secrets before distributing release APK |
| BLOCKER | Organization Drive policy/catalog/PDF not supplied | Validate actual student access; bundled samples do not establish real integration |
| UNVERIFIED | Camera, TalkBack/200% fonts, target-35 insets, lifecycle, storage faults | Complete documented physical-device checks |
| LIMITATION | Authenticated in-app Drive access not implemented | Restricted materials open in browser; do not change sharing merely to bypass this boundary |
| LIMITATION | Partial downloads restart from zero | Bounded retry preserves completed copy; HTTP range resumption is future work |
| LIMITATION | One remote catalog source per installation | Initial configuration can move from sample to approved source; changing a connected source needs a future administrator migration flow |
| LIMITATION | PDF renderer displays page images, without semantic text extraction or pinch zoom | Use cached text companion, rotation, or explicit external accessible PDF reader |
| LIMITATION | Catalog authorship is established by instructor distribution, not cryptographic signatures | Verify organization source; keep edit rights restricted |
| LIMITATION | Only PDF files support in-app offline download | Other allowed online resources open externally |
| LIMITATION | No global student distribution/install landing page | Private GitHub releases are developer access only |
| LIMITATION | Download-index crash/corruption recovery has no administrative UI | Unindexed/corrupt copies are not shown as complete; user can retry; see architecture |
| UNVERIFIED | Transitive dependency locks and full dependency audit | Resolve, review, and lock on first successful Android build |

Never describe this source package as stable or as an installable Android candidate. Record newly reproduced defects here with severity and evidence before release.
