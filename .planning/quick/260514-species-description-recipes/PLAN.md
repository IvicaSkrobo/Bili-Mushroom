# Plan

## Objective
Rename edibility-specific species notes into general species descriptions and add per-species recipe notes that can be edited later from the collection/species context.

## Steps
1. Trace current edibility note data flow across Rust, hooks, import/create/edit, collection, species, and i18n.
2. Add/rename persistence for species description while preserving existing edibility_note data.
3. Add recipe persistence and hooks for multiple recipes per species.
4. Update UI labels/flows: import/create/edit use Opis vrste, no conditional edibility note; species page shows Opis vrste and recipe editor.
5. Run focused tests and build.

