# Summary

## Outcome
- Species name autocomplete now sorts suggestions alphabetically by plain species name.
- Autocomplete now filters by prefix instead of substring, so typing `a` shows names starting with `a`.
- Species and collection searches now use prefix matching against the plain species name.
- Added a focused autocomplete regression test.

## Verification
- `npm.cmd test -- src/components/finds/SpeciesNameEditor.test.tsx src/components/import/ImportDialog.test.tsx src/components/finds/CreateFindDialog.test.tsx src/components/finds/EditFindDialog.test.tsx`
- `npm.cmd run build`

