---
quick_id: 260821-unicode-and-species-alias-search
subsystem: collection-search-and-species
tags: [sqlite, unicode, croatian-collation, search, species-aliases]
key_files:
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/commands/import.rs
    - src-tauri/src/commands/finds.rs
    - src/lib/finds.ts
    - src/lib/speciesName.tsx
    - src/tabs/SpeciesTab.tsx
decisions:
  - Register an app-owned Unicode normalizer and deterministic Croatian collation on every SQLite connection.
  - Keep aliases in the existing lightweight species summary query rather than loading full profiles or adding per-row queries.
  - Use word-prefix semantics consistently for scientific, common, synonym, and other names.
completed: 2026-08-21
commit: b7af0f2
---

# Unicode and Species Alias Search Summary

Collection search now lowercases stored names with Rust Unicode rules, so lowercase Croatian initials find uppercase `Č/Ć/Š/Ž/Đ` names while escaped `%`/`_`, display markup, and first-or-later-word prefix semantics remain intact. Collection pagination and frontend sorting share explicit Croatian alphabet weights, including `Dž`, `Lj`, and `Nj`, plus practical positions for `Q/W/X/Y` used by scientific names.

Species profile summaries now carry decoded `synonyms` and `other_names` arrays in the existing single lightweight query. Species search uses those arrays together with scientific and common names, without full-profile list reads or N+1 requests.

## Verification

- Mutation: restoring SQLite `LOWER()` failed the uppercase-`Č` regression.
- Mutation: restoring `COLLATE NOCASE` failed the Croatian page-boundary regression.
- Rust: 155 passed, 1 fixture-dependent test ignored.
- Frontend: 381 passed across 49 files.
- Targeted frontend: 30 passed.
- `npm run typecheck`: passed.
- `cargo check --all-targets --manifest-path src-tauri/Cargo.toml`: passed.
- `npm run build`: passed with only pre-existing chunk-size/dynamic-import warnings.

## Deviations from Plan

- `src-tauri/Cargo.lock` did not change because enabling existing rusqlite features introduced no package/version change.
- `src/test/tauri-mocks.ts` required no wire fixture change: its default summary response is an empty array; concrete expanded payloads are covered in the hook and SpeciesTab tests.

## Risks

- SQLite helpers are connection-local; registration is centralized in `open_db` and mirrored by the in-memory test helper.
- The deterministic comparator intentionally uses an explicit Croatian alphabet, scientific-name extensions `Q/W/X/Y`, and a Unicode-scalar fallback instead of OS/browser locale services.
- Collection still searches scientific folder names only; alias discovery is intentionally scoped to Species.

## Self-Check: PASSED

All planned implementation files exist, the application version remains `0.3.40`, and no installer, tag, push, or commit was created by the executor.
