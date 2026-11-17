# 0.10.0-alpha.1 — native assessment forms and cleaner formatting

Quizzes, activities and examinations open inside the app with clickable choices, review, one confirmed submission and an immediate correct/total + percentage result. Completed cards collapse to a compact score with Review. AE 101 has 16 forms / 40 questions. Instructors can add questions/choices and mark the correct answer; the trusted server/local workspace calculates scores. Answer drafts are encrypted and scoped to account/item/revision.

Assessment questions are excluded from downloadable text/PDF handouts. The public subject has Open assessments, leading to the authenticated local practice subject. Lesson reading/PDF downloads remain available. Existing written/custom work, old quiz attempts, historical scores and permissions remain compatible.

Text and secondary actions use consistent start alignment; card padding, title/section spacing and footer gaps are balanced. Help has short sections and hanging numbered steps; long build diagnostics are separate. Wrapped numbered content keeps its indentation and links.

Server schema v7 adds optional questions and requires the matching backend for organization forms. Local v4 backs up before converting untouched template entries; edited published work is kept with new forms added alongside it. Archived/unpublished entries are not resurrected. See FORMS_RELEASE.md for validation, installation, backup and rollback. No live service database or signing identity was changed.

Development test prerelease. Automated gates cover scoring, permissions, retry/idempotence, migration/preservation, content generation, legacy regressions, Android build/lint and package evidence. Consult the final Actions run and verification.json. Physical phone layout, keyboard/TalkBack, editor/answer rotation and signed installation remain NOT TESTED. Rollback to v0.9.1-alpha.1-test.79 requires its matching private pre-upgrade snapshots and signing identity; older APKs/servers reject the new data versions.
