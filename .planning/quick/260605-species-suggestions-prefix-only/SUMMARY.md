# Species suggestions prefix-only summary

## Changed

- Autocomplete matching now requires latin name, common name, synonym, or other name to start with the typed query.
- This prevents entries with common names like `svjetlucava` from appearing for a single `t` just because the letter exists inside the word.

## Verified

- `npm.cmd test -- --run src/lib/speciesName.test.tsx src/components/finds/SpeciesNameEditor.test.tsx`
- `npm.cmd run build`
