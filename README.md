# Aeronautical Open Academy

A lightweight **link to knowledge**: Android learning workspace with **admin, instructor, and student accounts**, with a spacious white/navy/gold interface, plus a public offline sample library containing **Subject A, Subject B, and Subject C**.

Version: **0.8.1-alpha.1**. Source is public by user authorization. Organization credentials, protected material bytes, learner records, and real quiz answer keys must stay outside this repository. A public repository does not grant access to the learning service.

Instructors paste `http://` or `https://` addresses into subject text or a single material entry. Students see short clickable links for Google Docs/Slides/Sheets/Drive, PDFs, spreadsheets, YouTube and public websites. Originals stay on their platforms; no per-link button or separate URL/type entry is needed. The first material line becomes its title. Links open outside the app after a fresh permission/reference check. Host sharing and sign-in still apply.

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

## Subject list and interface

Hold a subject’s **≡** handle to lift and drag it. Rows move aside as you drag, including wrapped/multiline cards. Your order is saved on drag finish/cancel and when leaving the screen; it is personal to that account and organization on this device. Use **⋮ → Move up / Move down** as an accessible alternative. Tap a subject card to open it. Newly available subjects append; removed/revoked subjects disappear. Arrangement does not alter enrollment, materials or results and does not synchronize across phones.

Both subject and entry **+** controls have transparent resting backgrounds. The interface uses a consistent type hierarchy, 48 dp minimum button/handle targets, 52 dp text boxes, 12 dp corner radii, even card/form padding and a centered 760 dp maximum content pane. Pages use a short content transition only when navigating; refresh does not crossfade. Android’s disabled-animation preference is respected for page transitions.

## Minimal workflow

- Student: sign in → enrolled subjects with progress bars → read / submit written work or quiz → My results. Use the left Menu to scan the instructor’s subject QR; eligible accounts enroll automatically.
- Instructor: create subject → + → enter material/quiz/work → Done → Menu → set eligible student IDs or All students → Students & compliance → assess outputs and feedback → export a roster page to Excel. Edit/download only creator-owned materials.
- Admin: register accounts → assign role → enroll students → manage suspension/reactivation/deletion and password reset → publish global announcements. Administrators can oversee all content.

Students cannot self-register, select their own role, join ineligible/revoked subjects, alter grades, retrieve answer keys, or manually complete an unsubmitted quiz. Automatic enrollment is instructor-controlled and defaults closed. Admins assign verified unique student ID numbers; instructors allow those IDs or select All students. Administrative removal blocks rejoining; admin/pre-update enrollments remain overrides. Reading is student-reported; participation completion, submission compliance and grades are separate. Excel `.xlsx` reports cover up to 100 students per roster page; use Next students for further pages. Written activities/exams accept text output; quizzes have one question per item.

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

- Public sample catalog: offline after installation; subject QR/manual codes `A`, `B`, `C`; PDFs can be saved and read offline.
- Protected course data: retrieved after active-session/enrollment checks. Protected PDFs use a temporary app-private viewer, no-store responses, and online reauthorization. Student offline copies of protected PDFs are not implemented in this version.
- Instructor/admin downloads: explicit export to the user's chosen location after authorization. Exported files cannot be remotely revoked.
- Optional uploaded-PDF store: organization Shared Drive adapter. Link-only deployments do not need it. Service-account credentials remain on the server; no direct private Drive URL or key is sent to students. Local private disk is for development tests.

## Documentation

- [Specification and role matrix](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security and access review](docs/SECURITY.md)
- [Full source review and reliability findings](docs/CODE_REVIEW.md)
- [Backend setup](server/README.md)
- [Material/content workflow](docs/CONTENT_GUIDE.md)
- [Testing and evidence](docs/TESTING.md)
- [Delivery and rollback](docs/DELIVERY.md)
- [Known issues](docs/KNOWN_ISSUES.md)

This is a focused learning workflow inspired by common open-university LMS patterns, not an official UPOU system or a full Moodle implementation.
