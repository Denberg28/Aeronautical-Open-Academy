# Aeronautical Open Academy 0.1.0-alpha.1

Test candidate notes prepared with source. **No APK has yet been built or released.** If this file is attached by the signed-candidate workflow, that workflow provides separate build/signature/source evidence; device and organization tests remain required.

New: Subjects/Scan/Downloads, local QR/manual routing, catalog search and refresh, sample subjects/text companions, WorkManager PDF transfers with verification/cancellation, offline page reader, explicit external viewing, and private-only build/candidate workflows.

Configured compatibility: Android 8.0/API 26+, SDK 35, Java 17. Release identity: `org.aeronautical.openacademy`; debug `.test` package is separate. Exact artifact metadata is generated from the workflow commit and APK signature.

Limitations: production Drive access unverified; authenticated in-app Drive download unsupported; transfers restart after interruption; PDF semantic accessibility depends on text companions or external reader; real-device faults/performance/accessibility/upgrade not yet tested. Sample educational content is demonstration material, not an approved syllabus or aircraft maintenance procedure.

Installation and upgrades: see DELIVERY.md. Keep same release certificate, increase versionCode, retain known-good APK/configuration. Roll back via a forward-version correction where possible; uninstall deletes local offline data. Private developer releases do not establish a student distribution channel.
