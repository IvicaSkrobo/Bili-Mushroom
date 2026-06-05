# Plan: cover picker, lightbox, index audit

## Goal
Reduce remaining large-species/photo pressure without touching user files.

## Steps
- [x] Make cover picker load species finds/photos in pages instead of a single 2000-find query.
- [x] Keep PhotoLightbox render input bounded for very large loaded photo sets.
- [x] Audit and add conservative SQLite indexes for common species/date/photo lookup paths.
- [x] Run focused frontend build/tests and Rust check.

## Result
- Cover picker now uses paginated species finds with all photos, loading more on dialog scroll.
- PhotoLightbox receives a bounded moving window around the active photo instead of a potentially huge array.
- Existing performance index hardening already covered most collection queries; added composite indexes for species/date pagination and zone lookups.
