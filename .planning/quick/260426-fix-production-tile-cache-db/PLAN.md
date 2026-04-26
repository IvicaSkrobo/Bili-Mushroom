# Fix production tile cache DB

Date: 2026-04-26

## Problem

The installed app reports:

`Tile proxy error: Migration 0003 failed: no such column: photo_path ...`

This happens because the Rust tile proxy stores tile metadata in the app cache directory, but opens that metadata DB through the main journal `open_db` migration path. A fresh cache DB does not need the journal `finds` schema, so migration 0003 can fail before tile fetching starts.

## Plan

1. Give tile-cache metadata its own SQLite file and schema initializer.
2. Route tile proxy cache reads/writes/stats/settings through that initializer.
3. Keep the main library DB migrations untouched.
4. Verify frontend build and Rust tests where available.

## Result

- Tile cache metadata now opens `bili-tile-cache.db` in the app cache metadata directory.
- The tile proxy now applies only `0006_tile_cache.sql`, avoiding journal migrations like `0003_find_photos.sql`.
- Existing bad cache metadata files named `bili-mushroom.db` are ignored by the fixed proxy path.
- `.gitignore` now ignores local `.exe` artifacts and `.claude/worktrees/`.

## Verification

- `npm.cmd run build` passed.
- `cargo test tile_proxy` could not run locally because `cargo` is not available on PATH in this environment.

