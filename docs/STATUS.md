# Current development checkpoint

Goal: repair user-reported test.87 oversized header and PDF-first subject navigation. Repository Denberg28/Aeronautical-Open-Academy, branch fix/subject-actions-header. Baseline 25eb145 / v0.10.0-alpha.1-test.87. Standing PR/source/prerelease publication is authorized; no signing or live database changes.

Implemented: explicit wrap-content Sign in width, single-line brand labels, canonical public Read/Take cards, exact assessment handoff through local sign-in/rotation, and account lessons behind Read. Existing saved files and records are retained. Version 0.10.1-alpha.1; no schema change.

Verification: local Python/content/XML/hash/secret and diff checks passed. Added JVM public-entry contract and Android 35 emulator regression for header at 200% fonts and Read → quiz → sign-in → submit/result/review. Android build/lint/JVM/emulator checks must pass on final source before merge. Physical-phone/performance/accessibility/upgrade checks remain NOT TESTED.

PR #8 merged as 2d9e0bd after both branch/PR emulator runs passed. Main build checks passed, but two main emulator attempts were blocked by a system Pixel Launcher ANR, identified in saved screenshots/hierarchies with an empty Academy crash log. A test-only follow-up stops that emulator background launcher immediately before app launch and requires all four successful screenshots before publication. App assertions and product code are unchanged. Next: verify this CI setup repair through PR, then inspect main verification/publication. Release/workflow/PR records hold final status and source SHA. Do not promote broken test.87 or invent device evidence.
