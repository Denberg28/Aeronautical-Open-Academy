# Subject build practice template

**AE 101 - Foundations of Aeronautical Engineering** is original synthetic classroom content. It demonstrates a complete subject in the current Android workflow. Replace and approve it against your institutional syllabus before real teaching. No aircraft operation, maintenance release, certification or board-exam claim is made.

## Structure and alignment

| Period / weeks | Focus | Outcomes | Ordered assessment entries |
| --- | --- | --- | --- |
| Prelim / 1-4 | Requirements, evidence, units and calculation records | O1-O2 | Quiz 1, Quiz 2, Activity 1, Examination 1 |
| Midterm / 5-8 | Forces, motion, assumptions and model limits | O1-O3 | Quiz 3, Quiz 4, Activity 2, Examination 2 |
| Semifinals / 9-12 | Materials, resource constraints and trade-offs | O1, O2, O4 | Quiz 5, Quiz 6, Activity 3, Examination 3 |
| Finals / 13-16 | Integrated brief, validation and technical reporting | O1-O5 | Quiz 7, Quiz 8, Activity 4, Examination 4 |

O1: define requirements/evidence. O2: trace calculations and units. O3: interpret force models. O4: compare resources/materials. O5: communicate defensible recommendations and uncertainty.

There are **25 app entries**: one course guide; two lessons, two quizzes, one activity and one examination per period. Period names prefix entry titles so the current flat course list remains understandable without a new hierarchy/schema. Every lesson has an outcome, explanation, supplied example and practice task. Activities and examinations each contain four selection questions; quizzes each contain one. All are scored automatically after submission.

## Build and review workflow

1. Review the course guide and institutional outcomes. Confirm study weeks, prerequisites, learning resources and assessment policy.
2. Sequence a lesson, its quiz, a second lesson, its quiz, the applied activity and the period examination. Keep period names in titles.
3. State measurable outcomes and provide sufficient supplied data. Clearly separate assumptions, calculations and unverified behavior.
4. Write original questions and plausible distractors. Review the correct choice privately as instructor; test the student view for answer-key isolation.
5. Give written activities/exams explicit deliverables, word guidance, point allocations and feedback criteria. Use accessible numbered text or approved external links.
6. Publish and set eligible IDs. Test enrolled/ineligible student access, each submission and instructor assessment. Verify exported results before institutional use.
7. Review feedback before advancing to the next period. Revision changes affect which work counts as current; do not silently replace assessed tasks.

## In-app scoring

All sixteen assessments are native choice forms: eight one-question quizzes, four four-question activities and four four-question exams (40 questions). Students select answers, review and submit once per revision. Results show correct/total and percentage, then cards collapse to a compact score with Review. New authoring supports 1–20 questions and 2–8 choices per question. Answer keys are creator/admin-only; calculations happen on the trusted server/local workspace.

The course guide suggests category weights for instructor planning only; no timer, weighted course grade or passing-readiness claim is introduced. Existing written submissions remain supported for older or custom items.

## Authoring and generated handouts

The single content source is [subject-template.json](../app/src/main/assets/subject-template.json). Keep JSON keys unique and preserve the six-entry pattern in each period. Synthetic quiz correct indices are authoring data; do not insert real protected assessment keys into public source. Student responses and credentials never belong in this asset.

Run `python3 tools/generate_samples.py` after changing the template. It regenerates the catalog plus five deterministic, original PDF handouts (overview and four periods) using the standard library. Run `python3 tools/generate_samples.py --check` to verify synchronization. Public PDFs contain only course overview and lessons. Assessment prompts/choices and their old written equivalents are excluded from catalog text and PDFs; sign in to open the forms. Keep resource IDs stable and increment revisions/catalog version when published PDF bytes change; constants controlling the original revisions are in `outputs()`. The A guide is revision 3; the four period guides are revision 2, with catalog version 3. B/C catalog entries and bundled handouts are removed.

The instructor/local test workspace imports the same asset through `TestWorkspace.installTemplate`; it uses the ordinary role, content-validation, enrollment, submission and assessment paths. Public handouts are read-only; sign in to submit work. Organization databases receive no seeded course from an APK install; build approved organization content through its instructor workflow.

## Upgrade, preservation and rollback

Local workspace schema v1/v2 upgrades atomically to v3 after making `local-test/workspace-before-template.json` in app-private no-backup storage. Only the exact unchanged former factory subject (including its three items, owner and original eligibility/order metadata) is replaced in place. The subject ID and three legacy item IDs survive; those items advance revisions so historical demo results cannot masquerade as work for the new prompts. Historical records remain in the local file.

Edited/extended factory content, other instructor subjects, custom accounts, passwords, notices, files and results are retained. If the old demo was edited, it is treated as instructor work and a new template is added. Migration runs once; reopening does not add copies or undo later edits. Reset explicitly deletes local data, restores the new template/default accounts and removes the migration backup.

Older APKs reject v3. To downgrade test data, restore a consistent pre-upgrade workspace/files backup with its matching APK/signing identity; do not feed the v3 file to an older APK. Physical installation/upgrade and PDF appearance remain unverified until tested on a phone.

Current schema/upgrade instructions are in [FORMS_RELEASE.md](FORMS_RELEASE.md): server v7 and local v4 preserve legacy work. The v3 migration description above records the previous content upgrade; new form conversion adds another private snapshot and revision changes. Source edits affect future seeds; existing teacher-edited content is not silently replaced.
