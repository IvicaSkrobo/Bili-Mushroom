---
quick_id: 260821-collection-word-prefix-search
status: complete
completed: 2026-08-21
commit: 7424e6f
files_modified:
  - src-tauri/src/commands/import.rs
---

# Collection word-prefix search — Summary

## Delivered

- Collection species search now matches the beginning of the complete name or the beginning of any later space-separated word.
- `b` finds `Boletus edulis`, `edu` finds it through its second word, and `dul` remains excluded as a middle-of-word fragment.
- Both SQL branches stay parameter-bound. User-entered `%` and `_` remain escaped literals rather than LIKE wildcards.
- Matching remains case-insensitive and ignores stored `*` presentation markup.
- Filtering remains in SQLite, while global alphabetical ordering continues to run before bounded pagination.

## Files Changed

- `src-tauri/src/commands/import.rs`

## Verification

- `npm run test:rust -- collection_folder_species_search` — passed.
- Mutation proof: temporarily restoring unrestricted `%query%` matching made the regression test fail; restoring the word boundary made it pass.
- `npm run test:rust -- collection_folder_alpha_sort_happens_before_pagination` — passed.
- `npm run test:rust` — 154 passed, 0 failed, 1 fixture-dependent test ignored.
- `cargo check --all-targets --manifest-path src-tauri/Cargo.toml` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed (existing Vite chunk-size and mixed-import warnings only).

## Deviations from Plan

None — the planned two-pattern, parameterized SQL implementation and regression coverage were applied directly.

## Manual UAT

Pending user verification in Collection: search `b`, `edu`, and `dul`, then clear the search and confirm the alphabetically sorted first page remains stable.

## Self-Check: PASSED

- Implementation and regression test are present in `src-tauri/src/commands/import.rs`.
- Plan and summary artifacts are present under `.planning/quick/260821-collection-word-prefix-search/`.
