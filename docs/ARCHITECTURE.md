# Architecture and decisions

Native Java + Android framework views, AppCompat, WorkManager, and ZXing Embedded. Java avoids an additional language/compiler plugin. AppCompat/Activity provide lifecycle-aware result handling; WorkManager supplies durable scheduling rather than Activity-owned transfer threads. ZXing performs QR decoding locally without a network scanning service. The cheaper viable alternative of launching a separate scanner app would introduce another app dependency for students.

Toolchain: JDK 17, Gradle 8.11.1, Android Gradle Plugin 8.9.2, SDK/build tools 35. Direct dependencies are pinned. Full transitive resolution and dependency vulnerability auditing remain blocked until an Android build environment is available; do not invent a lockfile before resolution. Generate and review dependency reports/locks after that first successful build.

| Component | Responsibility |
| --- | --- |
| MainActivity | Three navigation destinations, subject search, resource actions, QR/manual routing, permissions, useful error states |
| Catalog | Immutable validated catalog, global ID uniqueness, resource revision/update consistency |
| AcademyRepository | Serialized catalog I/O, last-valid cache, offline index, atomic metadata writes |
| QrRouter | Local-only subject resolution; no implied trust from QR payload |
| SafeHttp + UrlPolicy | Approved HTTPS providers, timeouts, explicit redirect validation, clear access errors |
| DownloadWorker | Persistent unique work, bounded transfer, cancellation, verification, atomic promotion |
| TransferPolicy | PDF header/size/hash checks, usable from host tests |
| PdfActivity | Background PDF rendering with capped bitmap dimensions, page controls, external reader |

## Storage and threading

App-private persistent storage holds `catalog.json`, `downloads.json`, and `downloads/{id}-r{revision}.pdf`. Camera images are not retained. Backups are disabled. Android uninstall/Clear storage removes this state. FileProvider grants temporary read access only to the downloads directory after an explicit external-reader action.

Repository startup and catalog refresh run on a single I/O executor. Workers wait for initial index readiness, so startup cleanup cannot delete a running worker's partial file. A synchronized in-memory index prevents concurrent completed workers from overwriting each other's metadata. Catalog refresh and metadata writes use Android AtomicFile; readers continue using the prior in-memory catalog until commit.

Workers write a `.part` file, enforce a 50 MiB cap, check the expected byte count where supplied, flush it, validate PDF header/hash and Android PdfRenderer readability, then rename it on the same filesystem. Only after complete metadata is committed is a previous resource revision removed. A stopped/failed transfer does not delete an older completed copy. Process-death partial files are removed on next startup and the worker restarts from byte zero; resumption is deliberately not claimed.

There is a small crash window between PDF rename and index commit. An unindexed file is never shown as available and is not silently deleted as a completed user copy; a retry can replace/reindex it. Startup hash failures hide corrupt copies without claiming successful recovery. The current UI does not provide index-repair administration.

## Network and access

10-second connection timeout, 15-second socket read timeout, at most five redirects, 1 MiB catalog, 50 MiB PDFs. Download retries are limited to two for timeouts, DNS errors, HTTP 429, or server errors with WorkManager exponential backoff beginning at 10 seconds. Permanent access/format/storage failures require user action. WorkManager may defer remote work until a network is available and the OS permits it.

Drive viewing pages, sign-in pages, and download confirmation HTML cannot become valid saved PDFs. This version does not inject cookies, embed OAuth credentials, bypass policy, or automate Drive permission changes. A student can explicitly open the approved source in a browser for organization sign-in. Direct authenticated in-app downloads require a later scoped authentication design.

Catalogs are trusted educational configuration chosen by the user from the instructor. HTTPS/provider checks limit destinations but do not establish institutional authorship. This is not a signed catalog system. Restrict who can edit the organization catalog; use a verified organization distribution procedure before production.

Existing downloaded copies cannot be immediately revoked while offline. Stable IDs must not be reassigned to other subjects/resources. Catalog downgrades, resource revision downgrades, and changed download references/hash without revision increments are rejected.

## UI and accessibility

Warm off-white, forest green, high-contrast primary actions, scalable text, generous controls, no obligatory sign-in. Main screens support TalkBack labels and text companions from the cached catalog. The built-in PDF page image is not a semantic document reader; use the text companion or another accessible PDF reader. Resource authors must provide suitable accessible content. Real-device TalkBack, enlarged fonts, camera, layout, and edge-to-edge behavior remain untested.

## Official references checked during implementation

- https://developer.android.com/build/releases/agp-8-9-0-release-notes — toolchain compatibility.
- https://github.com/journeyapps/zxing-android-embedded — pinned dependency and ScanContract integration.
- https://developers.google.com/workspace/drive/api/guides/manage-downloads — file downloads/export and access considerations.
- https://gradle.org/release-checksums/ — Gradle 8.11.1 distribution and wrapper checksums.

Wrapper SHA-256: `2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046`.
Gradle binary ZIP SHA-256: `f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6`.
