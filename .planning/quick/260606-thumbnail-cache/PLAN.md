# Plan: thumbnail cache audit and implementation

## Goal
Improve large photo collection performance by using app-local thumbnails where available and generating them safely without touching original photos.

## Steps
- Inspect current thumbnail APIs/hooks and Rust image handling.
- Identify whether thumbnails are generated, cached, or only proxied from originals.
- Implement missing safe cache/warmup path with original-photo fallback.
- Run focused tests/build checks.

## Done
- Confirmed existing Rust thumbnail cache writes `.bili-cache/thumbnails/*.jpg` and keeps originals untouched.
- Switched Species list, Species finds list, cover picker, map popup, and post-import review thumbnails to use cached thumbnails.
- Added `warm_photo_thumbnail_cache` Rust command and delayed app startup warmup for the first 40 existing photo paths.
- Verified targeted tests, frontend build, and Rust check.
