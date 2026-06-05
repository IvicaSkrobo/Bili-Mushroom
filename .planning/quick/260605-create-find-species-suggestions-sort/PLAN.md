# Create find species suggestions sort

## Goal

Make species suggestions in the "Novi nalaz" dialog consistently alphabetical.

## Scope

- Sort the merged folder/find species suggestion list before it is passed to `SpeciesNameEditor`.
- Use the existing `compareSpeciesNames` helper so markup and Croatian locale are handled consistently.
- Keep the UI styling unchanged.

## Verification

- Run targeted species-name editor/create-find tests where practical.
- Run frontend build/typecheck.
