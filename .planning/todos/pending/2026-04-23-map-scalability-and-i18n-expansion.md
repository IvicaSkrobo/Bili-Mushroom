# Pending Todo: Map scalability audit and expanded i18n coverage

Date: 2026-04-23
Status: pending
Type: research/backlog

## Backlog item A: Map scalability / rendering audit

### Why this matters

- Current map approach is valid for the app: Leaflet + raster tiles + local/offline-friendly behavior is a sensible baseline.
- The next likely pressure point is not the map library itself, but marker/grouping/render work as the collection grows.

### Current baseline

- Main map defaults and picker defaults are simple and reliable.
- Marker grouping and crowded-label calculations are recomputed from raw finds in the client.
- No clustering or viewport-aware optimization exists yet.

### Desired research/implementation follow-up

1. Measure map behavior with larger synthetic/real datasets before changing stack.
2. Audit marker/grouping recomputation costs in:
   - `src/components/map/CollectionPins.tsx`
   - `src/components/map/groupFindsByCoords.ts`
3. Evaluate the smallest useful next step:
   - memoized derived selectors/helpers
   - marker clustering
   - viewport-aware rendering
4. Only consider a larger map-stack shift (for example MapLibre/vector tiles) if the measured bottleneck justifies it.

### Recommendation

- Prefer incremental optimization over map-library replacement.
- Add home region and search first; do clustering/perf work when library size proves it necessary.

## Backlog item B: Expanded i18n coverage

### Why this matters

- Adding more languages has clear user value and does not materially bloat the app if implemented as static translation strings.
- The real cost is copy maintenance, consistency, and regression risk as features evolve.

### Current baseline

- App currently supports:
  - Croatian (`hr`)
  - English (`en`)

### Desired follow-up

1. Keep the current i18n structure, but prepare for more languages cleanly.
2. Add a backlog phase for incremental language rollout instead of attempting many languages at once.
3. Prioritize likely high-value languages first:
   - German (`de`)
   - Italian (`it`)
   - Slovenian (`sl`)
4. Ensure future additions have:
   - fallback behavior
   - translation completeness checks where practical
   - UI review for overflow/fit on buttons, tabs, dialogs, and stats labels

### Recommendation

- Treat extra languages as a staged rollout, not a one-shot expansion.
- Best near-term sequence:
  1. grouped import work
  2. home location + map search
  3. i18n readiness cleanup
  4. add 1-2 new languages
