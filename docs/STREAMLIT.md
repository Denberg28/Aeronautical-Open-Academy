# Academy web portal — development candidate

Baseline: `655847ac30f3771fbb47bab789aacb657e355be5` (Android 0.11.0-alpha.1). The web portal adds a client to the existing Academy API. It does not modify the database schema, Android code, accounts, IDs, or storage adapters. Python 3.12 and Node 24.19.0 are the supported verification setup.

## Scope and acceptance

Instructors/admins sign in, create subjects, manage student-ID/All enrollment eligibility, create text/link or PDF drafts, upload/replace PDFs up to 50 MiB, review, publish/unpublish and archive materials. Students join eligible subjects, search published titles, read text/PDFs in the page and mark reading progress. Subject/progress sits above a 480 px scrolling content region. Existing quizzes, choice activities/exams and written submissions can be taken on the web, with API-generated results. Assessment authoring/grading remains in the existing Academy app. Admin can register accounts; password changes and logout use the existing API.

Acceptance: a draft is invisible to enrolled students until published; a published PDF round trip matches its SHA-256; outsiders/student uploads are denied; stale uploads fail with 409; marking read updates the shared summary; suspended users lose access on the next interaction; choice answers are graded by the API; passwords/tokens never enter source, URLs or shared Streamlit caches. These are automated integration checks in `web/tests/test_portal.py`. Current shared sync and protected page reading are documented in [SHARED_ACCESS_SYNC.md](SHARED_ACCESS_SYNC.md). Real browser/mobile PDF rendering, upload-picker interaction and deployed Drive/HTTPS behavior are additional operator checks, not implied by AppTest.

## Run locally

From the repository root:

```sh
python -m venv .venv
# Linux/macOS; Windows: .venv\Scripts\activate
. .venv/bin/activate
pip install -r requirements.txt
```

Start the API in a separate terminal using [server/README.md](../server/README.md). Copy `server/.env.example` to `server/.env` and privately configure the bootstrap administrator. For local PDF testing set `MATERIAL_STORAGE=local` and `NODE_ENV=development`; start from `server/` with `node --env-file=.env src/main.mjs`. Never use sample/test credentials for a real deployment.

Start the portal from the repository root:

```sh
export ACADEMY_API_URL=http://127.0.0.1:8787
export ACADEMY_ALLOW_LOCAL_API=1
streamlit run streamlit_app.py
```

PowerShell uses `$env:ACADEMY_API_URL="http://127.0.0.1:8787"` and `$env:ACADEMY_ALLOW_LOCAL_API="1"`. These local flags are not production settings. In either shell the portal defaults to port 8501. Alternatively configure the API URL in private `.streamlit/secrets.toml`.

## Deploy to Streamlit Community Cloud

1. Sign in at https://share.streamlit.io/ with the account that can deploy `Denberg28/Aeronautical-Open-Academy`.
2. Create an app from that repository; select `main` after this PR is merged, or the feature branch for a controlled preview. Set the main file to `streamlit_app.py` and Python to **3.12**.
3. In Advanced settings → Secrets, set only the API origin:

   ```toml
   ACADEMY_API_URL = "https://your-existing-academy-api-host"
   ```

4. Deploy. No database password, bootstrap password or Drive private key belongs in Streamlit Secrets. The example above is a placeholder, not a deployed server. Keep `ACADEMY_ALLOW_LOCAL_API` unset. A relative API path or HTTP production URL is rejected.
5. Sign in to the Academy portal with a provisioned account. As administrator create an instructor/student, have each change their temporary password, and verify the sequence below before real materials/users.

**Deployment dependency:** Community Cloud runs the Python web client, not the Node API. The API must run as one instance on a persistent host behind HTTPS, with a private persistent `ACADEMY_DATA_DIR`. The repository's backend was not publicly deployed at baseline. Streamlit sign-in, an actual API host/origin and organization Drive credentials/folder were unavailable in this development session; no live web deployment is claimed. Do not use an ephemeral Streamlit filesystem as the account/material database. Do not create a new paid host without authorization.

For text and hosted links, production `MATERIAL_STORAGE=links` needs no Drive account. For actual PDF uploads use the existing `MATERIAL_STORAGE=drive` mode and privately set `GOOGLE_SERVICE_ACCOUNT_JSON` plus `DRIVE_FOLDER_ID` on the **API host**. Provision approved Shared Drive access first. The portal reads the API capability and offers PDF draft creation only when storage is enabled. Local file storage remains development-only. Google Docs/Slides/Sheets/YouTube and other materials can be pasted as hosted references; only PDF bytes are uploaded.

## Instructor and student workflow

1. Instructor → Create subject → Subject settings → select All registered students or enter eligible IDs. Empty list with All off keeps automatic enrollment closed. Admin enrollment overrides remain supported by the API.
2. Add material → title and nonempty reading/instructions → Text and links or PDF upload → Create draft. For PDFs, open the draft → Edit material → choose PDF → Upload PDF. Review the in-page reader, then check Published → Save material.
3. Student → Enroll in a subject → Join → select subject → Read. Drafts and unrelated subjects stay hidden. Mark as read updates the same account records used by the Android client.
4. To replace a PDF, open the item → Edit material → Replace PDF. API version checks reject concurrent edits. The replacement retains its current publication state; unpublish first if it needs private review.
5. After an interrupted create/upload, refresh and inspect the existing drafts before retrying creation. Upload errors keep the draft, and upload retries use its latest edit version. Archive removes a material from active listings; it is not permanent object deletion.

## Persistence, privacy and recovery

### Online sync and concurrent editing — 0.11.1-alpha.1

**Sync now** reloads authorized subjects, published content, progress and results from the same Academy API used by organization Android accounts. Every normal interaction also revalidates the session. There is no background polling, offline write queue or automatic submission replay; idle pages do not keep API sessions alive. Results submitted elsewhere appear on the next interaction. Local APK practice accounts and local Windows workspaces are independent of these API accounts. The Windows application is maintained on its separate desktop branch; this change does not migrate or unify its database lineage.

Existing material/subject editors retain their displayed snapshot and text through sync and rejected stale saves. An explicit **Reload material** or **Reload subject settings** discards that edit draft and loads current values. Keep one active editor of each kind per browser session. New-subject/material creation and password/upload forms still submit as batches; syncing/navigation before submitting those forms can discard their unsent fields. No draft is saved to the API until Save/Create succeeds. Choice/written inputs persist during same-revision interactions; a changed assessment requires **Load updated assessment**, which starts new revision-specific inputs. Reading buttons retain the intent/revision actually displayed, even when another tab updates progress first.

The matching backend advertises `revision_writes: true` in `/v1/me`; the student portal stops with an update message when this capability is absent. New web requests include `expected_revision` for reading, legacy quizzes and written submissions. The updated backend rejects supplied stale/malformed revisions with 409 before writing progress/work. Older Android clients may omit the optional field and retain existing behavior; mandatory revision checks for choice forms are unchanged. No schema migration is introduced. Deploy the backend code first under the existing backup/restart policy, then the portal. Legacy backend code ignores the new optional fields and must not be used with this portal.

Tokens are bound to the API origin that issued them. Changing the configured origin clears the token and all per-session drafts before any authenticated request; older unbound sessions must sign in again. Logout, expiry and suspension continue to clear local state. Protected PDF downloads remain permission-controlled by the API; rendering PDF bytes in a browser still permits copying and is not DRM. This update does not claim stronger PDF copy prevention or live deployment.

All accounts, subjects, progress and file references stay in the existing API database; PDF bytes stay in its configured adapter. Sessions are per Streamlit browser session, uncached and revalidated at each interaction. A page reload/disconnect can require sign-in and lose unsent form text. No offline sync, autosave, bulk upload, generic file type storage or public file URL feature is added.

The portal does not promise copy prevention: PDFs/text delivered to a browser can be copied or retained. The page-image reader uses Streamlit image delivery; do not treat it as DRM or instant remote revocation. A newly denied API request clears the rendered workflow on rerun, but idle pages/already delivered bytes are not recalled. Disable public unauthenticated host/static serving of the API data directory. Set retention, backup and access policy on the host; real institutional deployment review is still required.

Transport has 5 s connect and 30 s read inactivity timeouts (125 s for upload), bounded response bytes, no write retries and no credential-bearing redirects. A 401 clears local account state. A 409 requests refresh/review. Reading/PDF content is never put in `st.cache_data` or a global HTTP session. Only escaped/plain user text is rendered; external references require the API's current-item link validation. Uploaded PDFs pass size/signature/end-marker checks on both client and server, with fetched-byte SHA-256 checks; this is not malware scanning.

Before upgrading a live backend, take and restore-check a consistent SQLite/material backup per `server/README.md`. This client requires no migration. Rollback: restore the prior Streamlit source revision or disable the portal; shared API data remains intact. Do not downgrade the backend database in place.

## Verification

```sh
python -m unittest discover -s web/tests -p 'test_*.py' -v
npm test --prefix server
```

CI: `.github/workflows/web.yml`. Test accounts and SQLite/material files are isolated in temporary directories. AppTest drives actual Streamlit forms against a real loopback Node/SQLite API. PDF upload uses the actual HTTP client/API; the file-picker event and rendered PDF pages need a real browser check.

Before live use: exercise PDF upload, review, publish, student enrollment/read, suspended-user denial, browser refresh/sign-out and interrupted uploads on desktop and an Android browser; verify no cross-account content remains; check text spacing/keyboard/zoom and the fixed content region; test real Drive denies/replacements and host restart/persistent data/backup restore. The existing Android device/signing gates remain unchanged. This work is a web development candidate, not an Android release or stable institutional deployment.
