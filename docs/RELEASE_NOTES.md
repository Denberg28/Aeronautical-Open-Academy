# 0.8.1-alpha.1 — screen capture for development feedback

Screenshots and screen recording are temporarily enabled on account screens (admin/instructor/student) and the in-app PDF viewer, as requested for reporting development findings. No setting or permission toggle is needed in the app.

The build flag SCREEN_CAPTURE_ALLOWED is true. Set it false when restoring screenshot protection after feature refinement; both original FLAG_SECURE guards use this policy. Authentication, enrollment, PDF permission checks and private file handling are unchanged. The v0.8 subject dragging, transparent + and layout refinements remain included.

Development test APK. Android build/lint and regression checks run in CI. Physical-phone screenshot/recording and OS policy behavior remain NOT TESTED. Rollback: retain the prior test APK; no database or preference migration is introduced. Existing debug signing certificates can differ between builds.
