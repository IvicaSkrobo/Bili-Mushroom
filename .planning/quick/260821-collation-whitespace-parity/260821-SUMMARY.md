---
quick_id: 260821-collation-whitespace-parity
subsystem: collection-search
tags: [sqlite, collation, unicode, pagination]
key_files:
  modified:
    - src-tauri/src/commands/import.rs
decisions:
  - Classify every Rust Unicode whitespace scalar in the same low token class as the frontend comparator.
completed: 2026-08-21
commit: 2d5e982
---

# Croatian Collation Whitespace Parity Summary

Rust's Croatian SQLite collation now uses `char::is_whitespace()` instead of recognizing only ASCII space. TAB, ASCII space, and NBSP remain distinct tokens ordered by their code points, matching the frontend comparator without deleting or collapsing characters.

The Collection pagination regression now puts the three near-identical names across pages of size two, concatenates every page, and checks the exact order for both alphabetical mode and equal-date recent mode.

## Verification

- Targeted page-boundary regression: passed.
- Mutation proof: restoring `character == ' '` failed with ASCII space incorrectly preceding TAB.
- Collection Rust suite: 4 passed.
- Full Rust suite: 155 passed, 1 fixture-dependent test ignored.
- `npm run typecheck`: passed.
- `cargo check --all-targets --manifest-path src-tauri/Cargo.toml`: passed.
- `git diff --check`: passed.
- No frontend source file changed.

## Deviations from Plan

None.

## Self-Check: PASSED

Only `src-tauri/src/commands/import.rs` and this task's planning artifacts changed; no commit, installer, tag, or push was created.
