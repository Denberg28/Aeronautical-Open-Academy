# Scope, assumptions, and baseline

Baseline: existing repository `Denberg28/Aeronautical-Open-Academy`; GitHub reports empty, default branch `main`, public visibility. No starting commit, working release, application ID, or signing key exists in repository evidence. Development is local until visibility matches authorization. Local branch: `feat/android-mvp`.

Assumptions: students use Android phones with intermittent connectivity; instructors maintain approved content in organization Google Drive; initial in-app access needs no account; some materials may require browser sign-in. No organization files or sharing policy have been supplied. No external hardware is controlled.

## MVP and non-goals

Student: launch → browse/search or scan/manual code → subject → module/resource → text, online view, or offline PDF → Downloads → read/remove.

Instructor: prepare approved content and accessible text → publish a validated versioned catalog → student refreshes → stable subject ID still resolves. Preserve IDs, increase changed resource revisions, and keep previous catalogs for recovery.

MVP: three primary destinations, QR scan/manual fallback, grouped resources, background downloads, offline reader/text notes, catalog update/recovery, storage management, help, automated source checks, reproducible Android build configuration, and gated candidate workflow.

Non-goals: grading, attendance, quizzes, messaging, AI tutors, payments, full LMS, in-app content editing, authenticated Drive API/OAuth, bulk folder crawling, streamed offline video, cross-device student progress, and public distribution. No budgeted services are needed for the implementation; organization quotas and policies still need verification.

## Measurable acceptance criteria

These targets were set before device measurements. They are acceptance budgets, not observed results. Reference device for sign-off: one Android 8–10 device/emulator and one physical Android 14+ phone, including the user's Android 16 phone if available. Record model, RAM, OS, connection, and file/catalog size.

| ID | Criterion | Required evidence |
| --- | --- | --- |
| A1 | Cold launch to interactive bundled catalog ≤2 seconds in 4 of 5 runs on reference physical device | Device timing/video or trace |
| A2 | Valid local QR/code resolves correct subject within 100 ms after decoded value is supplied | Instrumented timing; camera decode measured separately |
| A3 | Unknown, malformed, unrelated, or overly long QR never auto-launches a URL or crashes | Core checks plus actual scan/manual tests |
| A4 | Denied camera permission leaves browsing and manual code usable | Physical device |
| A5 | Failed/invalid refresh keeps the previous catalog and completed PDFs | Fault integration test |
| A6 | Completed sample and approved remote PDF reopen after process restart in airplane mode | Physical device and approved Drive source |
| A7 | Interrupted/cancelled/oversize/HTML responses do not appear as completed PDFs | Device/network fault tests |
| A8 | Duplicate taps cause one active download per resource; retries remain bounded | Device + WorkManager inspection |
| A9 | TalkBack reaches all main controls; 200% font size and portrait/landscape do not clip required controls | Physical device/screenshots |
| A10 | Catalog/resource update preserves stable subject QR; old offline copy remains readable until replacement succeeds | Update fault test |
| A11 | Download maximum 50 MiB, catalog maximum 1 MiB; enforce limits even without Content-Length | Core/integration tests |
| A12 | PDF page bitmap ≤1600 × 2400; page turns do not crash during a 30-page/10-minute session | Device memory observation |
| A13 | Signed install and same-key upgrade succeed; downloaded copies persist across upgrade | Two consecutive signed candidate builds |
| A14 | APK SHA-256, certificate fingerprint, version, source commit, and gate results are recorded | Packaging checks |

HIL actuator/control authority checks are N/A because this app does not command equipment. Camera, storage, permissions, PDF viewing, lifecycle, install/upgrade, and OS behavior remain required device checks.

## Interfaces and state

- Catalog: schema 1 JSON, ≤100 subjects, ≤200 resources per subject, globally unique safe IDs, integer version/revisions, bounded text and URLs.
- QR: `aoa://subject/{stable-id}` or manual ID, matched against cached catalog; no arbitrary URL execution.
- Content: approved HTTPS Google Drive/Docs/Googleusercontent destinations; revalidate each redirect; assets only from the bundled catalog.
- Download: QUEUED → RUNNING → VERIFIED → AVAILABLE; cancellation/failure leaves the prior available copy. Worker restart begins a new transfer rather than resuming partial bytes.
- Catalog: BUNDLED/CACHED → REFRESHING → VALIDATED/COMMITTED, or error with previous state retained.
- Offline index: atomic private JSON metadata, complete PDF files only, hash verification at startup; partial files excluded.

Missing Drive policy, external build dependencies, signing identity, and real-device evidence are explicit blockers to production readiness. They do not prevent source implementation or documented host checks.
