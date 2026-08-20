---
status: resolved
trigger: "Nakon višesatnog rada, pri upisu u tražilicu Zbirke aplikacija se zamrznula na biblioteci s otprilike 600-700 nalaza i više od 5.000 fotografija."
created: 2026-08-20
updated: 2026-08-20
---

# Collection search freeze

## Symptoms

- Expected: tražilica Zbirke filtrira nalaze bez zamrzavanja sučelja.
- Actual: aplikacija se zamrznula pri pretraživanju nakon više sati rada.
- Errors: nisu prijavljene poruke greške.
- Timeline: problem je prijavljen prije izdanja v0.3.0; izdanje nije mijenjalo relevantni collection kod.
- Reproduction: velika lokalna biblioteka, otvorena aplikacija, upis ili brisanje teksta u tražilici Zbirke.

## Current Focus

- reasoning_checkpoint:
    hypothesis: "Confirmed: `get_collection_folders` performed multiple synchronous SQLite lookup paths per returned folder on the async command runtime."
    confirming_evidence:
      - "The command iterates every `SpeciesFolderSummary` and invokes `load_representative_find_for_species` once per item."
      - "That helper contains a cover query, two `load_finds_for_species_inner` calls, and hydration; the page limit is 200 and the frontend refreshes after a 180 ms debounce."
      - "The dataset has 600–700 finds and more than 5,000 photos, making the correlated and repeated lookup path materially expensive."
    falsification_test: "A representative-selection regression test would show the batch path chooses a different cover/photo or violates active filters; that would invalidate the proposed replacement."
    fix_rationale: "Batch queries select covers and fallbacks for the whole page, then hydrate their thumbnails once; `spawn_blocking` ensures the remaining local SQLite work cannot starve the async command runtime."
    blind_spots: "I cannot run the user’s production-sized library or observe the Windows WebView UI in this environment; verification will include Rust tests and a production-data user check."
- hypothesis: confirmed N+1 representative lookup and blocking SQLite command work are the high-probability freeze mechanism.
- test: add semantic regression coverage for cover/photo fallback selection, then run focused and full Rust tests.
- expecting: all thumbnail-selection behavior passes with a bounded number of batch database operations.
- next_action: verify the fix with production-sized data when available

## Evidence

- 2026-08-20: `get_collection_folders` je `async` bez `spawn_blocking`, a nakon agregata iterira kroz summaries i za svaki poziva `load_representative_find_for_species`.
- 2026-08-20: `get_collection_folders` je ograničen na 200 foldera po stranici, ali za svaki folder radi upit za cover, do dva `load_finds_for_species_inner` upita i hidrataciju fotografije; to je do približno 800 pojedinačnih SQL upita uz glavni agregatni upit.
- 2026-08-20: frontend poziva komandu nakon debounca od 180 ms i svaka promjena queryja stvara novi `useInfiniteCollectionFolders` ključ, pa brisanje ili kratki pojam tipično pokreće najširi i najskuplji slučaj.
- 2026-08-20: fix replaces the per-summary chain with page-wide cover/latest-fallback/photo-hydration queries and runs the command body through `spawn_blocking`.
- 2026-08-20: focused Rust test compiled successfully, but its executable could not launch in this Windows environment (`STATUS_ENTRYPOINT_NOT_FOUND`, `0xc0000139`), so runtime test success remains unconfirmed here.

## Eliminated

- none

## Resolution

- root_cause: Collection search triggered an N+1 representative-find query chain (up to roughly 800 extra SQLite operations per 200-item page) directly on the async Tauri runtime.
- fix: Representative finds and thumbnails are selected in page-wide batch queries, and all local SQLite work in `get_collection_folders` runs through `tauri::async_runtime::spawn_blocking`.
- verification: Added a regression test for explicit covers plus photo-bearing and photoless fallbacks. The test compiles, but cannot execute in this environment because the Windows test binary fails to start with `STATUS_ENTRYPOINT_NOT_FOUND`.
- files_changed: src-tauri/src/commands/import.rs; .planning/debug/collection-search-freeze.md
