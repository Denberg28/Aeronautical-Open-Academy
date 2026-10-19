# Content workflow

## Protected teaching materials

1. Admin registers an instructor account; the instructor changes its temporary password and signs in.
2. Instructor creates a subject, then a draft material, written activity, quiz, or written examination. Material instructions can also contain an accessible text companion.
3. For a PDF material, upload the PDF from Android's document picker. Review the result, then choose Edit/publish and enable Published. Drafts stay hidden from students.
4. Admin registers students. Either admin enrolls them, or the instructor saves eligible student ID numbers or All students in Enrollment eligibility; eligible students scan the subject QR and join automatically. Give students the subject QR from Show subject QR. The QR identifies the subject; server eligibility and active-account checks decide enrollment.
5. Students sign in, open My subjects or scan the QR, read the published material, mark materials read (self-reported), submit written activity/exam outputs, or answer quiz items.
6. Instructor edits only creator-owned items. Upload replacement PDFs or edit content to increment the item revision; prior quiz attempts stay tied to the earlier revision. Quiz choice/key changes require a new quiz item in this version.
7. Archive removes an item from student views while retaining authorized records. Account deletion is separate from material archival. Admins oversee retained materials after an instructor is deleted.

The backend stores private PDFs in organization Shared Drive in production. Its service account needs approved Shared Drive membership and folder access. Do not make restricted files public or put credentials in the app/catalog/repository. Real Drive validation is pending. Development uses private server disk and does not prove organization access.

Instructor/admin download explicitly exports an authorized PDF to a chosen location. Files already exported or photographed cannot be remotely revoked. Student private offline downloads are not implemented; public samples remain offline-capable.

## Public samples

Only Subject A, Subject B, and Subject C are bundled, with generic original demonstration notes and matching text companions. Manual codes: A/B/C. QR payloads: aoa://subject/a, aoa://subject/b, aoa://subject/c.

Regenerate committed sample assets with tools/generate_samples.py (ReportLab authoring dependency). Validate with `python3 tools/validate_catalog.py app/src/main/assets/catalog.json --bundled`.

The optional public Google Drive catalog feature remains separate from account-protected subjects. Its schema is demonstrated by the bundled catalog; replace asset URLs with approved HTTPS Google Drive content URLs, retain stable IDs, and increase catalog/resource versions. Validate with `python3 tools/validate_catalog.py catalog.json`. Normal Drive viewing/sign-in webpages are not downloadable JSON/PDF content. Failed refreshes preserve the prior valid public catalog.

Instructor assessment: subject → Students & compliance → student → Read submitted output → Assess output. Save a 0–100 score and feedback; a zero is a valid grade. Quiz results show selected answer and server score. Awaiting assessment remains visible separately from compliance. Export this roster page to Excel creates an actual workbook for up to 100 enrolled students; advance pages and export each as needed. Keep files private.

Editing instructions creates a new revision and resets current participation requirements. Current views/reports exclude historical versions; retained earlier records require operator retention review. Written examinations are untimed text responses, not proctored exams. Activity attachments, deadlines/late status, weighted totals and multi-question quiz authoring are not included.


0.4 setup: Admin → Accounts → Assign verified student ID for migrated students (or include it when registering a new student). Instructor → subject → Enrollment eligibility → enter one ID per line or check All students → Save eligibility. All includes active registered students; blank list with All unchecked closes automatic joins. Students use the left menu Scan subject QR or Enter subject code; camera denial offers manual entry. They must sign in/change temporary password before enrollment succeeds.

A narrower rule removes new automatic enrollments but retains progress/results. Administrator and pre-v3 legacy enrollments remain overrides; admin removal revokes access and blocks rejoin. Correcting an ID clears its old allowlist grants and automatic enrollment, so instructors must authorize the corrected ID and the student re-scans. Do not distribute eligibility lists or student reports publicly.


## 0.5 minimal linked material

1. Subject → Add learning item → Material text / links. Enter one text field, for example:

   Week 1 resources
   Read https://docs.google.com/document/d/your-document-id/edit
   Watch https://www.youtube.com/watch?v=your-video-id

2. First line becomes the title; leave Published unchecked while reviewing, then publish. Web addresses render as underlined compact links with an external arrow, not separate buttons. HTTP is supported and labeled HTTP; prefer HTTPS where the host offers it. For subject-level links, use Menu → Edit subject text.
3. Students tap the link to open the host app/browser after the Academy permission/reference check. They may need their organization Google/other host account. Set intended host sharing yourself; the Academy never makes documents public or bypasses those permissions.
4. Keep students' reading mark separate from opening. The app cannot know that they read/watched or finished an external document. Quiz/assessment records remain in the Academy workspace.
5. Editing the text/link creates a new item revision; current reading resets. Archiving removes the app reference while the original stays on its platform. Same-URL provider edits are not detected; revise the material text when you want to reset the requirement.

For link-only deployment use MATERIAL_STORAGE=links; service-account credentials are not required. No upload/download/transcoding/iframe/preview is performed for references. Existing uploaded PDFs require their original configured adapter, or create replacement hosted-link entries. Do not put credentials or sensitive student records into link text, and do not post real private links in the public repository.
