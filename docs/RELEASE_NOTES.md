# 0.12.0-alpha.1 — shared sync and protected reading

Streamlit sessions are bound to their issuing API origin. Retained editor versions reject stale saves; changed assessments require review, and reading actions preserve the displayed intent. Deploy the matching API advertising `revision_writes` before the portal. Optional revision fields preserve older clients without a database migration.


Add Sync in the APK header and web portal, shared authenticated sync receipts, and Sign out all devices. The service rejects student protected-file download requests even for legacy offline grants. The Streamlit reader displays authorized PNG pages instead of delivering the original PDF to its browser viewer. Existing IDs, grades, progress, account credentials, schema 7 and signing identity are preserved.

Use the same updated HTTPS Academy API for APK, Windows organization mode and Streamlit. Local test workspaces remain separate and are never silently imported. See [shared access/sync contract](SHARED_ACCESS_SYNC.md) for compatibility, error/recovery behavior, verification and copy-prevention limits. Current CI gates control development-candidate delivery; actual production login/Drive, physical devices and signed upgrades remain unverified. No live service or database was modified here.
