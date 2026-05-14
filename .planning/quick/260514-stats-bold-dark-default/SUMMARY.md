# Summary

## Outcome
- Reused the shared species-name renderer across Statistics species surfaces so internal `*...*` markup no longer appears literally.
- Stripped species-name markup from generated statistics insight strings and PDF export text where rich inline species rendering is not available.
- Confirmed dark mode already defaults for new users and still persists the user's saved `bili_theme` choice.

## Verification
- `npm.cmd test -- src/lib/insights.test.ts` passed.
- `npm.cmd run build` passed.
