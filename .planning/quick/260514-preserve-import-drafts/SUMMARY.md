# Summary

## Outcome
- Kept the Collection tab mounted while switching tabs so import/create dialog draft state is preserved.
- Changed Create Find so opening/closing by dismiss does not reset the form.
- Create Find now clears only after successful save or explicit Cancel.
- Import dialog now has an explicit Cancel button that clears the draft.
- Import dismiss/close preserves selected photos and metadata so the user can return and continue.

## Verification
- `npm.cmd test -- src/components/import/ImportDialog.test.tsx src/components/finds/CreateFindDialog.test.tsx` passed.
- `npm.cmd run build` passed.
