# Summary: stable open-in-collection navigation

## Done
- Changed collection handoff so `selectedCollectionSpecies` opens/expands the raw species group directly instead of writing the species name into search.
- Added fallback resolution for display strings with markup or appended common names, without splitting on commas.
- Normalized manual collection search input with `plainSpeciesName` so star markup does not break matching.
- Updated the collection test expectation to match the new behavior.

## Verification
- `npm.cmd test -- --run src/tabs/CollectionTab.test.tsx`
- `npm.cmd run build`

## Note
- The broader `SpeciesTab.test.tsx` suite has stale hook mocks from previous recipe/photo-edit changes and currently hangs in this environment after mock updates; the app build passes.
