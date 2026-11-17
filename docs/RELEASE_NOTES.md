# 0.10.1-alpha.1 — repaired header and direct subject actions

Fixes the oversized public header reported in test.87: Sign in now wraps its width and the academy name stays on two single-line labels. The bundled subject displays its course guide, eight lessons and sixteen assessments, using Read, Take quiz, Take activity and Take examination. No PDF save/read cards appear in this subject. Previously saved files remain available in Downloads.

Read opens text in the app. Taking an assessment preserves the exact selected entry through local sign-in and opens its authorized choice form. Submitted forms show correct/total and percentage, then collapse to Review. Account lesson cards also open text behind Read. No account is signed out or switched automatically; organization access remains separate.

Required CI now includes Android 35 emulator checks at 360 dp, the header at 200% fonts, and the public reading/quiz/sign-in/submission/result flow. The release includes emulator screenshots and verification evidence. Consult the final workflow result; physical-phone layout, performance, camera, TalkBack and signed upgrade remain NOT TESTED.

Development test prerelease. No database/schema, signing identity or live backend change in this repair. Existing forms still require the matching schema-v7 backend outside local test mode. Keep private pre-upgrade backups; downgrade across data schemas requires a matching snapshot.
