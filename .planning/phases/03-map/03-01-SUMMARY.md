---
plan: 03-01
phase: 03-map
status: complete
completed_at: 2026-04-15
---

# Plan 03-01 Summary: Rust Tile Proxy Backend

## What was built

Rust backend for tile fetching and disk caching, delivering MAP-03 end-to-end.

**Migration 0006** (`src-tauri/migrations/0006_tile_cache.sql`):
- `tile_cache_meta` table — tile_key, file_path, size_bytes, last_accessed
- `tile_cache_settings` table — key/value for user-configurable max cache size
- Index on `last_accessed` for efficient LRU eviction

**`tile_cache_db.rs`** — LRU cache helpers:
- `insert_tile_meta` / `update_last_accessed` / `total_cache_size` / `tile_count`
- `evict_if_over_limit` — LRU eviction by last_accessed ASC until under max_bytes
- `clear_all` — removes all DB rows + disk files

**`tile_proxy.rs`** — Tauri commands:
- `fetch_tile(url, storage_path)` — SSRF allowlist (OSM + Esri only), disk cache hit/miss, reqwest fetch on miss, data URI return
- `get_tile_cache_stats` / `clear_tile_cache` / `set_cache_max` / `get_cache_max_bytes`
- Default 200 MB LRU cap enforced after every cache miss

## Deviations

- Also added `set_cache_max` and `get_cache_max_bytes` commands (required by must_haves, needed `tile_cache_settings` table added to migration)
- Fixed pre-existing `setup_in_memory_db()` test helper — was missing migrations 0004+0005, causing 9 import tests to fail

## Key files

### Created
- `src-tauri/migrations/0006_tile_cache.sql`
- `src-tauri/src/commands/tile_cache_db.rs`
- `src-tauri/src/commands/tile_proxy.rs`

### Modified
- `src-tauri/Cargo.toml` — added reqwest 0.12, base64 0.22, sha2 0.10, tokio
- `src-tauri/src/commands/import.rs` — migration 0006 registered; test helpers fixed
- `src-tauri/src/commands/mod.rs` — tile_cache_db + tile_proxy modules registered
- `src-tauri/src/lib.rs` — 5 new commands in invoke_handler; smoke test updated to user_version=6

## Test results

```
cargo test tile_cache_db  →  6/6 passed
cargo test tile_proxy     →  5/5 passed
cargo test (full suite)   →  48/48 passed
```

## Self-Check: PASSED
