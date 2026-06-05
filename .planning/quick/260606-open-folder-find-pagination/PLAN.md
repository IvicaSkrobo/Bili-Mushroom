# Plan: paginate opened folder finds

## Goal
Keep Collection responsive when a single species folder contains many finds/photos by rendering/loading finds incrementally inside the opened folder.

## Steps
- Inspect current folder find query and row rendering.
- Add incremental rendering/page controls for opened SpeciesFindRows without changing stored photos/folders.
- Keep open-in-collection behavior and date search auto-expand working.
- Run focused tests and build.

## Done
- Confirmed opened species folders already use SQLite-side `useInfiniteSpeciesFinds`, virtualized find rows, and capped photo grids.
- Added auto-fetch near the bottom of the opened folder's internal scroll container so large species folders load the next page without forcing a button click.
- Verified with focused CollectionTab tests and production frontend build.
