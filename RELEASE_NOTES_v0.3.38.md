# Gljivobook v0.3.38

This release prepares the map for libraries that continue growing well beyond today's
photo count, while preserving the same filters, popups, zones, saved viewport, and
location-picker workflow.

## Highlights

- Wide map views now request compact server-side clusters instead of every find row.
- At zoom 12 and above, the app loads only pins inside the visible viewport, with a 25%
  overscan margin and a short debounce to keep panning smooth and avoid flicker.
- Clicking a cluster progressively zooms toward the existing individual pins and popups.
- Species filters and fit-to-species use lightweight global map metadata, so filtering
  remains complete even though point rows are viewport-bound.
- The location picker uses the same scalable path and still transfers the existing
  location note when an individual pin is selected.
- Zone controls remain available on cluster views; explicit zone editing loads the full
  selected-species context only when that operation needs it.

## Measured result

The repeatable synthetic SQLite benchmark now covers map metadata, viewport points, and
zoom-7 clusters. With 100,000 finds, the legacy wide query returned 80,000 rows (11.85
MiB) in about 1.02 seconds. The new wide path returned 8 cluster rows (effectively zero
MiB) in about 147 ms; a detailed viewport measured about 22 ms on the development PC.

## Verification

- Frontend: 368 tests passed.
- Rust: 131 passed, 0 failed, 1 ignored (optional real-GPS EXIF fixture).
- TypeScript, production frontend build, Cargo all-targets, and diff checks pass.
- New regression coverage verifies map bounds/species filtering, metadata, cluster
  aggregation, cluster zoom behavior, location-picker pin behavior, and delayed fit data.

## Install

Download the Windows setup file from the GitHub release and run it. To update an existing
installation, run the new installer over the previous version. No photographs are copied
or changed by this map upgrade.
