# Aeronautical Open Academy

A lightweight **link to knowledge**: Android learning workspace with **admin, instructor, and student accounts**, with a spacious white/navy/gold interface, plus one complete **AE 101 - Foundations of Aeronautical Engineering** practice subject.

Version: **0.10.1-alpha.1**. Source is public by user authorization. Organization credentials, protected material bytes, learner records, and real quiz answer keys must stay outside this repository. A public repository does not grant access to the learning service.

Instructors paste `http://` or `https://` addresses into subject text or a single material entry. Students see short clickable links for Google Docs/Slides/Sheets/Drive, PDFs, spreadsheets, YouTube and public websites. Originals stay on their platforms; no per-link button or separate URL/type entry is needed. The first material line becomes its title. Unfamiliar hosts and HTTP links show their full destination before opening. Links open outside the app after a fresh permission/reference check. Host sharing and sign-in still apply.

## Try the three roles on one phone

Open **Sign in**, leave **Local test accounts** checked and enter:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin` |
| Instructor | `instructor` | `instructor` |
| Student | `student` | `student` |

These defaults are for the development test APK’s local workspace. No server is required. Student ID: `TEST-001`. The original `@academy.test` email aliases also work with the new matching passwords. Previous unchanged defaults migrate automatically; customized passwords remain unchanged. Subjects, files and learning records are preserved. Reset local test data restores defaults after confirmation.

Open a subject as admin or instructor → tap **+** below the last entry → choose Material / links, Quiz, Written activity, Written examination or PDF → enter text → **Done**. Web addresses become clickable references. The first line supplies the title. Done saves and publishes; PDF entries require a selected file and publish after upload. The list scrolls to its final entry and the + button remains below it. Hold the drag handle to move entries; drop above/below another entry or on + to append. Entry **⋮** offers Edit, Move up, Move down and Delete. Deleting removes the entry from the current course while retaining historical learning records. Subject QR, eligibility, enrollment and student reports are in Menu.

Sign out to switch roles. All local accounts share the saved test workspace on this installation; nothing synchronizes across phones. Use synthetic data. Organization sign-in still requires an HTTPS backend and its own accounts; short default credentials never authenticate to that service. Test mode is disabled in release builds.

Screen capture is temporarily enabled for development feedback, including account screens and the in-app PDF viewer. `SCREEN_CAPTURE_ALLOWED=true` controls this build policy; restore it to `false` when the features are streamlined. Account permissions and PDF access checks continue to apply.

## Complete subject practice template

Sign in as instructor or student to open **AE 101 - Foundations of Aeronautical Engineering**. The student is already enrolled in the local template. Admin can inspect the same subject. Code **A** shows the course guide, eight lessons and sixteen assessment cards. Tap **Read**, **Take quiz**, **Take activity** or **Take examination**. Reading opens in the app. A selected assessment continues through local sign-in to its exact form; questions are not offered as text/PDF downloads. Existing saved handouts remain in Downloads.

| Period | Lessons | Quizzes | Activity | Examination |
| --- | --- | --- | --- | --- |
| Prelim | 1-2 | 1-2 | 1 | 1 |
| Midterm | 3-4 | 3-4 | 2 | 2 |
| Semifinals | 5-6 | 5-6 | 3 | 3 |
| Finals | 7-8 | 7-8 | 4 | 4 |
| Total | 8 | 8 | 4 | 4 |

The subject contains 25 ordered entries: a course guide, eight lessons and sixteen assessments. All sixteen assessments open as in-app selection forms. The eight quizzes have one question each; the four activities and four examinations each have four questions (40 questions total). Choose one answer per question, review and submit to see correct/total and a percentage. Completed cards collapse to a compact result with Review. Lessons, outcomes, examples and suggested study weeks remain available. Planning weights are illustrative and manually applied; the app does not compute a weighted course grade. This original fictional course is a build/practice template, not an institutional syllabus or flight/maintenance authorization.

Local schema v4 upgrades unchanged template assessments to selection forms with new revisions, retaining IDs and historical results. Edited/extended work is preserved; new template forms are added alongside edited published assessments. The exact original factory demo also upgrades in place. Edited/extended subjects and their work are preserved; one new template is added alongside them. Migration saves a private local workspace backup and is idempotent. Previously saved public PDFs remain in Downloads until explicitly removed. A full local reset is optional and destructive, not required to receive the template. See [subject build guide](docs/SUBJECT_TEMPLATE.md).

## Subject list and interface

Hold a subject’s **≡** handle to lift and drag it. Rows move aside as you drag, including wrapped/multiline cards. Your order is saved on drag finish/cancel and when leaving the screen; it is personal to that account and organization on this device. Use **⋮ → Move up / Move down** as an accessible alternative. Tap a subject card to open it. Newly available subjects append; removed/revoked subjects disappear. Arrangement does not alter enrollment, materials or results and does not synchronize across phones.

The account header and bottom navigation stay mounted while the center pane changes. Tab changes have no vertical slide; saved scroll positions restore before drawing, including after rotation. Loading uses a fixed-height indicator delayed by 150 ms to avoid flashing on short requests. Subjects and News are one tap away; students also have Results, and administrators have Accounts. Menu retains QR enrollment, reports and account actions. Forms use one persistent label per field, sign-in offers Show password and keyboard submission, and requests temporarily disable action buttons. Public samples show search counts and download progress. Account identity is in Menu; repeated introductions and progress detail are removed from routine screens. Meaningful errors, content, results and submission confirmations remain available.

Both subject and entry **+** controls have transparent resting backgrounds. The interface uses a consistent type hierarchy, 48 dp minimum button/handle targets, 52 dp text boxes, 12 dp corner radii, even card/form padding and a centered 760 dp maximum content pane. Tab navigation changes only the center content without translation or crossfade; header/tab instances and insets remain stable. Subject drag animations remain independent.

## Minimal workflow

- Student: sign in → enrolled subjects with progress bars → read / submit written work or quiz → My results. Use the left Menu to scan the instructor’s subject QR; eligible accounts enroll automatically.
- Instructor: create subject → + → enter material/quiz/work → Done → Menu → set eligible student IDs or All students → Students & compliance → assess outputs and feedback → export a roster page to Excel. Edit/download only creator-owned materials.
- Admin: register accounts → assign role → enroll students → manage suspension/reactivation/deletion and password reset → publish global announcements. Administrators can oversee all content.

Students cannot self-register, select their own role, join ineligible/revoked subjects, alter grades, retrieve answer keys, or manually complete an unsubmitted quiz. Automatic enrollment is instructor-controlled and defaults closed. Admins assign verified unique student ID numbers; instructors allow those IDs or select All students. Administrative removal blocks rejoining; admin/pre-update enrollments remain overrides. Reading is student-reported; participation completion, submission compliance and grades are separate. Excel `.xlsx` reports cover up to 100 students per roster page; use Next students for further pages. New selection forms support 1–20 questions with 2–8 choices each. Legacy written outputs and single-question quizzes remain supported. Form scoring is trusted-side and normalized /100; reading completion remains separate.

A subject QR identifies a subject; the backend checks the signed-in account’s eligibility and enrolls it once. QR codes contain no credentials. Existing students can receive their verified ID through Admin → Accounts.

## Android build

JDK 17, Android SDK 35/build tools 35.0.0, and Gradle 8.11.1 (wrapper included).

```sh
sh tools/core_checks.sh
python3 tools/project_checks.py
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm test --prefix server
./gradlew --no-daemon :app:coreChecks :app:testDebugUnitTest :app:lintDebug :app:lintRelease :app:assembleDebug :app:assembleRelease
```

Android 8.0/API 26+ is configured. Debug package: `org.aeronautical.openacademy.test`; release package: `org.aeronautical.openacademy`. Debug output: `app/build/outputs/apk/debug/app-debug.apk`. Unsigned release output is not installable until organization-controlled signing is configured. Windows: use `gradlew.bat` or Android Studio.

GitHub Actions verifies source, backend boundaries, JVM catalog tests, Android lint, and debug/unsigned release builds. The candidate workflow requires a persistent signing key and refuses stable tags. See the actual Actions results before calling a build verified.

## Run the account backend locally

The backend uses Node **24.19.0**, built-in SQLite/crypto/HTTP, and no third-party runtime packages. It is a single-instance starting point; Node's SQLite API stability and deployment limits are documented in server/README.md.

```sh
cd server
npm test
# Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD privately for first startup.
node --env-file=.env src/main.mjs
```

Copy `server/.env.example` to a private `.env` file and fill it locally. There is no built-in administrator password and no production demo accounts. Keep data/secret files outside Git. The server binds to loopback in development. For Android emulator testing use `http://10.0.2.2:8787` in the debug app's sign-in form. Release builds require your organization's HTTPS origin.

A live hosting destination has **not** been configured. Optional organization Drive upload credentials are also unconfigured; they are not needed for link-only materials. Organization account screens require a running backend; the development APK’s local test workspace does not. Public sample PDFs/text can be explored without one. No existing unrelated cloud database was modified. Set MATERIAL_STORAGE=links (the example default) for references only; no Google service account or uploaded file store is required. Accounts, eligibility, materials metadata and results still require the running backend.

## Materials and offline access

- Public sample catalog: offline after installation; subject QR/manual code `A`; PDFs can be saved and read offline.
- Protected course data: retrieved after active-session/enrollment checks. Protected PDFs use a temporary app-private viewer, no-store responses, and online reauthorization. Student offline copies of protected PDFs are not implemented in this version.
- Instructor/admin downloads: explicit export to the user's chosen location after authorization. Exported files cannot be remotely revoked.
- Optional uploaded-PDF store: organization Shared Drive adapter. Link-only deployments do not need it. Service-account credentials remain on the server; no direct private Drive URL or key is sent to students. Local private disk is for development tests.

## Documentation

- [Specification and role matrix](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security and access review](docs/SECURITY.md)
- [Current security scope, acceptance and rollback](docs/SECURITY_RELEASE.md)
- [Targeted manual edit guide](docs/CODE_EDIT_GUIDE.md)
- [Full source review and reliability findings](docs/CODE_REVIEW.md)
- [Backend setup](server/README.md)
- [Material/content workflow](docs/CONTENT_GUIDE.md)
- [Testing and evidence](docs/TESTING.md)
- [Delivery and rollback](docs/DELIVERY.md)
- [Known issues](docs/KNOWN_ISSUES.md)

This is a focused learning workflow inspired by common open-university LMS patterns, not an official UPOU system or a full Moodle implementation.

## In-app assessment workflow

Student: open a subject → Start an assessment → select one choice per question → Submit → confirm → view the score. Review reopens your selections without exposing the answer key. Draft selections are encrypted on this device, scoped to account/item/revision and cleared after submission or sign-out. Rotation can reopen an unfinished form after fresh authorization.

Instructor: + → Quiz / Activity / Examination → enter a title/instructions → add questions and choices → select each correct answer → Done. Existing form questions/keys are immutable; create a new form to change them. Legacy written entries retain their previous editor and grading route. New-form authoring requires the matching service advertising choice_forms.

Server schema v7 adds a nullable questions column and automatically scored form submissions; do not downgrade a v7 database to an older server. Local schema v4 preserves a private workspace-before-forms.json migration backup. No live organization database is changed by this source update. See [forms and layout acceptance](docs/FORMS_RELEASE.md).
