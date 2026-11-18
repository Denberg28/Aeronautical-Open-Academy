# Third-party notices

This application uses Android/AndroidX, WorkManager, and ZXing Embedded. Source dependencies are resolved by Gradle; their notices and license obligations must be reviewed against the final resolved dependency graph before redistribution.

- AndroidX AppCompat, Activity, WorkManager: Apache License 2.0, https://source.android.com/docs/setup/about/licenses.
- ZXing Android Embedded 4.3.0: Apache License 2.0, https://github.com/journeyapps/zxing-android-embedded/blob/master/COPYING.
- ZXing core: Apache License 2.0, https://github.com/zxing/zxing/blob/master/LICENSE.
- Gradle wrapper (8.11.1): Apache License 2.0, https://github.com/gradle/gradle/blob/v8.11.1/LICENSE.
- JUnit 4.13.2 (tests only): Eclipse Public License 1.0, https://github.com/junit-team/junit4/blob/main/LICENSE-junit.txt.
- JSON-java 20240303 (tests only): https://github.com/stleary/JSON-java/blob/20240303/LICENSE.
- ReportLab (authoring tool only; not an Android runtime dependency): https://hg.reportlab.com/hg-public/reportlab/file/default/LICENSE.txt.

No organization Drive content is included. Bundled demonstration text is original content. The Gradle wrapper binary was retrieved from Gradle's v8.11.1 source tree and verified against the publisher's SHA-256 reference.

## PDF.js

PDF.js (pdfjs-dist 6.5.438) is provided under Apache-2.0. Pinned upstream viewer/worker/font/WASM assets are copied verbatim by desktop/tools/prepare-pdf.mjs and included with their LICENSE in Windows packages. Source: https://github.com/mozilla/pdf.js .
