# Pending Todo: Home location, map search, and code audit follow-up

Date: 2026-04-23
Status: pending
Type: research/backlog

## Why this was added

Review pass identified a meaningful UX gap around map onboarding and a few code/performance improvements worth scheduling after the grouped-import work.

## Confirmed current state

- First run only asks for storage folder; there is no "home country" or "home map region" choice.
  - `src/components/dialogs/FirstRunDialog.tsx`
- Settings also has no home location or default map region control.
  - `src/components/dialogs/SettingsDialog.tsx`
- Map defaults are hardcoded to Croatia in both the main map and location picker.
  - `src/components/map/FindsMap.tsx`
  - `src/components/map/LocationPickerMap.tsx`
- The app has reverse geocoding only; there is no forward place/country search for the map.
  - `src/lib/geocoding.ts`

## Backlog item A: Home location / default map region

### User value

- Better first-run experience for non-Croatia users
- More relevant initial zoom both on the main map and in the location picker
- Cleaner mental model: "this app knows my usual foraging region"

### Minimal scope

- Add optional "home country / home region" selection on first run
- Mirror the same control in Settings
- Persist the chosen home location in app state/local storage
- Use that saved location as the default center/zoom for:
  - `FindsMap`
  - `LocationPickerMap`

### Safe implementation note

- Store a lat/lng center plus optional label, not just a country string
- Keep Croatia as fallback when nothing is set

## Backlog item B: Map place search

### User value

- User can search for a country/place instead of dragging around the map
- Supports your requested flow: type a country and jump there

### Minimal scope

- Add forward geocoding helper alongside `reverseGeocode`
- Add a small search input to `LocationPickerMap`
- On result selection:
  - fly map to result bounds/center
  - allow user to place or adjust the final pin manually

### Safe implementation note

- Search should navigate the map, not silently set the final find location until user confirms
- Cache successful searches similarly to reverse geocoding where practical

## Backlog item C: High-value code/performance improvements

### C1. Move heavy derived map computations behind memoized selectors/utilities

- `CollectionPins.tsx` recomputes grouped collections and crowded-marker state from raw finds on each relevant render/move cycle
- Fine for small libraries, but likely to feel heavier as the collection grows
- Improvement path:
  - extract stable grouping/centroid math into tested helpers
  - reduce recomputation where possible
  - consider viewport-aware marker work only if needed after measurement

### C2. Add app-level "preferences" model instead of scattering localStorage keys

- Current persisted settings are spread across store helper functions (`language`, `theme`, `mapLayer`)
- Adding home location will make this more fragmented
- Improvement path:
  - centralize persisted preferences structure
  - version it lightly for future migrations

### C3. Add forward-geocode and map-default tests before feature rollout

- `LocationPickerMap` and first-run/settings flows are user-critical
- Add tests for:
  - home-location persistence
  - default map center fallback behavior
  - place search result -> map move -> confirm flow

### C4. Import UX safety pass after grouped-import work

- After grouped import lands, do a focused UX pass on:
  - clearer copy for "one find with many photos"
  - obvious handling when a batch likely contains mixed finds
  - future split/ungroup affordance if users need it

### C5. Bulk operations consistency pass

- Review bulk rename/delete/move flows for:
  - consistent confirmation patterns
  - predictable cache invalidation and UI refresh
  - shared language and button structure across dialogs

### C6. Tile cache policy review

- Current implementation already has:
  - disk-backed cache metadata
  - LRU-style eviction by `last_accessed`
  - default max size of `200 MB`
  - manual clear-cache control in Settings
- Follow-up review should decide whether to:
  - expose configurable cache size in Settings
  - add smarter defaults by platform
  - improve cache status copy so users understand offline map behavior

### C7. Large-library query/list strategy for 5k+ photos

- Clarification:
  - React Query is not caching raw image bytes for every photo
  - it is caching the full `get_finds` payload: find metadata plus photo metadata/path arrays
  - actual photo rendering still happens via `convertFileSrc(...)` when images are shown
- Why this still matters:
  - with 5k+ photos, the app can still feel heavy because large metadata payloads are fetched, grouped, filtered, and rendered on the client
  - broad invalidation currently refreshes the whole finds dataset after many mutations
- Follow-up work should evaluate:
  - splitting "all finds" into lighter query shapes where useful
  - paginated or incremental loading for heavy surfaces if needed
  - virtualization/windowing for long find lists and large species groups
  - more targeted cache updates for favorite/edit/delete flows instead of always invalidating the full finds query
  - dataset-size smoke tests using a realistic large local library

## Priority order (current recommendation)

### Priority 1

1. Grouped import + merge suggestion
2. Large-library query/list strategy for 5k+ photos
3. Home location/default map region

### Priority 2

4. Place/country search in `LocationPickerMap`
5. Preferences model cleanup
6. Import UX safety pass after grouped import

### Priority 3

7. Bulk operations consistency pass
8. Tile cache policy review
9. Map scalability audit (grouping/clustering/render costs)
10. Staged i18n expansion beyond hr/en

## Suggested execution order

1. Grouped import + merge suggestion quick task
2. Large-library query/list strategy for 5k+ photos
3. Home location/default map region
4. Location picker place search
5. Preferences model cleanup
6. Import UX safety pass
7. Bulk operations consistency pass
8. Tile cache policy review
9. Map perf pass only after measuring real-world dataset size
