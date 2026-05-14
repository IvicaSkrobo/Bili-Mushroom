# Summary

## Completed
- Updated shared species-name display helper to tolerate unmatched `*` markers.
- Raw `*` markers no longer leak into stats chips or titles.
- Added tests covering `Coprinellus micaceus *(Bull.) Vilgalys`.

## Verification
- `npm.cmd test -- --run src/lib/speciesName.test.tsx`
- `npm.cmd run build`
