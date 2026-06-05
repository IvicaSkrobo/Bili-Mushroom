# PLAN - 260606-exif-location-prefill-new-photos

Mode: /gsd-quick

## Goal
When users add photos through create/edit find flows, read EXIF GPS from the first selected photo that has it and pre-fill the find location picker/form.

## Scope
- Reuse existing `parseExif` and reverse geocoding helpers.
- Preserve existing manual/import dialog EXIF behavior.
- Do not overwrite user-entered coordinates or location fields.

## Verification
- Focused frontend tests for create/edit dialog behavior where practical.
- TypeScript/test run for touched areas.
