# Create find species suggestions sort summary

## Changed

- Sorted the merged species suggestion list in `CreateFindDialog` with the shared `compareSpeciesNames` helper before passing it to `SpeciesNameEditor`.

## Verified

- `npm.cmd test -- --run src/components/finds/SpeciesNameEditor.test.tsx src/components/finds/CreateFindDialog.test.tsx`
  - `SpeciesNameEditor.test.tsx` passed.
  - `CreateFindDialog.test.tsx` has existing failures because tests query the old accessible name "Species name" while the current UI exposes "Latin name".
- `npm.cmd run build`
