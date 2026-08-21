# Gljivobook v0.3.37

This release focuses on reliability and growth: large collections remain responsive,
database changes are safer, and background caches stay bounded during long sessions.

## Highlights

- Collection search and browsing no longer block the app while SQLite is working.
- Collection folders, map points, statistics, species autocomplete, and dialogs use
  purpose-built lightweight queries instead of loading the entire library.
- Bulk delete/move uses bounded batch work and reports partial file failures accurately.
- Thumbnail decoding/cache growth and map icon growth are bounded for long sessions.
- SQLite WAL improves concurrency where available, with a safe fallback for network or
  virtual filesystems that cannot support WAL.
- Migration backups are verified, disk-budgeted, retained outside cache folders, and do
  not copy the user's photo collection.
- Settings shows database, thumbnail/map cache, and backup storage usage.
- Multiple data-loss edge cases around species profiles, casing, partial rename, CSV
  photo paths, and photo-lightbox edits are fixed.

## Verification

- Frontend: 359 tests passed.
- Rust: 131 passed, 0 failed, 1 ignored (optional real-GPS EXIF fixture).
- TypeScript, production frontend, website, Cargo all-targets, and version checks pass.
- Synthetic SQLite baseline covers 5,000, 50,000, and 100,000 finds. At 5,000 finds,
  collection/search queries measured about 7 ms and map/statistics about 15–16 ms on
  the development machine.

## Install

Download the Windows setup file from the GitHub release and run it. To update an existing
installation, run the new installer over the previous version. The first opening after an
upgrade may briefly create a verified metadata backup before applying database migrations.

No photographs are included in automatic migration backups; the database stores journal
metadata and paths, while photographs remain in the user's library folders.
