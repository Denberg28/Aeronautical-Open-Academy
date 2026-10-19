# Content workflow

## Protected teaching materials

1. Admin registers an instructor account; the instructor changes its temporary password and signs in.
2. Instructor creates a subject, then a draft material, written activity, quiz, or written examination. Material instructions can also contain an accessible text companion.
3. For a PDF material, upload the PDF from Android's document picker. Review the result, then choose Edit/publish and enable Published. Drafts stay hidden from students.
4. Admin registers students. Either admin enrolls them, or the instructor explicitly opens self-enrollment and students join through Menu → Enroll subjects. Give students the subject QR from Show subject QR. The QR identifies the subject and does not grant enrollment.
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
