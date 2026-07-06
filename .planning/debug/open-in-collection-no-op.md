---
status: resolved
slug: open-in-collection-no-op
trigger: "Bug (recurring, korisnik kaze 'opet'): u Species tabu, klik na gumb 'Otvori u zbirci' (species.viewCollection) ne radi nista - ne prebacuje prikaz niti otvara/skrolla na odgovarajuci species folder u Collection tabu."
created: 2026-07-05
updated: 2026-07-06
---

## Symptoms

- expected: Clicking "Otvori u zbirci" (Open in Collection) on a species in the Species tab switches to the Collection tab, expands and scrolls to that species' folder, with a brief "jump" highlight.
- actual: Nothing visible happens — the button click appears to do nothing, no folder opens or highlights.
- errors: None reported by the user (no console/error info gathered yet — needs live repro to confirm).
- timeline: User describes this as recurring ("opet") — has happened before/more than once during this session's testing.
- reproduction: In Species tab, select a species, click the "Otvori u zbirci" button (GalleryHorizontal icon, next to "Otvori folder" and "Prikazi na karti").

## Context

- Platform: Windows Tauri 2 + React 18 + Rust, local SQLite via rusqlite
- Button: src/tabs/SpeciesTab.tsx ~line 1163-1172 — onClick calls `setSelectedCollectionSpecies(selectedJournal.speciesName)` then `setActiveTab('collection')`
- Store: src/stores/appStore.ts — `selectedCollectionSpecies: string | null`, Zustand, no persistence/middleware beyond default
- Consumer: src/tabs/CollectionTab.tsx ~line 912-944 — useEffect reacting to `[allGroups, selectedCollectionSpecies, setSelectedCollectionSpecies]`
- `allGroups` (~line 903-908) is derived via `useMemo` from `folderSummaries` (async query-backed), filtered to exclude internal library names
- Match logic tries exact name match, then `plainSpeciesName().toLowerCase()` match (strips markdown italics), then a startsWith fallback; only calls `setSelectedCollectionSpecies(null)` to "consume" the signal if a match was found
- Species names in the DB/UI may contain markdown italics markup (e.g. `*Boletus* edulis`) — `plainSpeciesName` is the existing helper that strips this

## Flow Summary

1. User clicks button in SpeciesTab -> `setSelectedCollectionSpecies(name)` + `setActiveTab('collection')`
2. CollectionTab mounts/re-renders, its effect fires when `selectedCollectionSpecies` is non-null
3. Effect tries to match `rawTarget` against `allGroups` (current in-memory folder list) and set `expanded`/`search`/`jumpTargetSpecies` accordingly
4. If no match found (e.g. `allGroups` not yet loaded, or name normalization mismatch, or the current `search`/filter state already narrows `allGroups` such that the target species isn't present), the effect does NOT clear `selectedCollectionSpecies`, and no fallback/retry appears to be wired beyond re-running when `allGroups` changes

## Hypotheses

1. PRIMARY: Timing/race — `folderSummaries`/`allGroups` has not finished loading (or is empty/stale from a previous filtered view) at the moment the effect first runs after tab switch, so the match fails silently; if `allGroups` never subsequently updates to include the match (e.g. because a leftover filter like `favoritesOnly`, an active search string, or a `photosMode` restriction excludes that species from the current query), the effect never re-matches and the signal is permanently stuck un-consumed.
2. SECONDARY: Name normalization mismatch — `selectedJournal.speciesName` (from Species tab's aggregation) differs subtly from the `species_name` stored per-find/folder-summary (e.g. different italics markup, whitespace, or synonym casing) in a way that both the exact-match and the `plainSpeciesName` normalized match fail, and the `startsWith` fallback also doesn't cover the actual mismatch shape.
3. TERTIARY: CollectionTab is not mounted/rendered when `setActiveTab('collection')` is called (e.g. conditional rendering keyed off `activeTab` unmounts/remounts CollectionTab), causing the effect to run against a freshly-reset `allGroups` (empty on first paint) with no guaranteed re-run once data arrives, depending on how the data-fetching hook behaves on remount.

## Current Focus

reasoning_checkpoint:
  hypothesis: "The jump-to-species effect in CollectionTab.tsx sets `search` to the raw (markup-containing) target species name, which is stripped of asterisks only on the client before being sent as `speciesQuery`, but matched server-side (Rust LIKE) against the RAW unstripped `species_name` DB column — so any species name containing `*asterisk*` markup causes the server-side folders query to exclude that very species, making `allGroups` never contain the target and the match permanently fail."
  confirming_evidence:
    - "Direct code read: CollectionTab.tsx line 925 sets search = rawTarget (unstripped); line 716 builds speciesQuery = plainSpeciesName(debouncedSearch) (stripped)"
    - "Direct code read: import.rs push_find_search_filters line 1470-1473 builds `LOWER(f.species_name) LIKE '%<stripped query>%'` against the raw DB column f.species_name (not stripped) — asterisk in DB value breaks the substring match for any name with embedded markup"
    - "Existing test (CollectionTab.test.tsx line 177) uses an asterisk-free name and a mock that ignores filters entirely, so it cannot and does not catch this — explains why this shipped and recurred"
  falsification_test: "If I set selectedCollectionSpecies to a name with embedded *asterisk* markup and run the real (non-mocked) filter path, the folders query should return zero matching rows for that species even though it exists in the DB. If instead the query still returns the row, this hypothesis is wrong."
  fix_rationale: "The jump-to-species lookup should never let raw markup control the server-side substring filter. Root cause is architectural: reusing the debounced/plain search-query pipeline (designed for user-typed free text) to drive an exact folder-lookup causes stripped-query vs raw-column mismatches. Fix removes this coupling for the jump path by matching directly against the already-loaded (or unfiltered) allGroups instead of relying on the filtered query result to already contain the target before matching can succeed."
  blind_spots: "Have not run the actual app / live repro with a real asterisk-containing species name end-to-end (only traced code paths). Have not checked whether other filters (favoritesOnly, date filters carried over from a prior session) could compound this independently of markup — SECONDARY root cause explains the reported recurring behavior without needing that, but it's not fully ruled out as a contributing factor in some sessions."

- next_action: Implement fix in src/tabs/CollectionTab.tsx: decouple the jump-to-species matching effect from the debounced/filtered `search` query pipeline so matching happens against the full unfiltered folder list, and only set the visible search box to a plain (asterisk-stripped or exact) value that does not corrupt the LIKE filter server-side.

## Evidence

- timestamp: 2026-07-06T00:00:00Z
  checked: src/tabs/CollectionTab.tsx lines 700-944 (search state, collectionFindFilters memo, useInfiniteCollectionFolders, allGroups memo, selectedCollectionSpecies effect)
  found: The jump-to-species effect (line 912-944) sets `search` to the RAW target species name (including any `*markup*`, line 925: `setSearch((current) => (current === rawTarget ? current : rawTarget))`). This `search` value feeds into `collectionFindFilters.speciesQuery` via `plainSpeciesName(debouncedSearch).trim()` (line 716), which strips asterisks from the QUERY string but NOT from the underlying DB column. The `speciesQuery` filter is sent to the Rust `get_collection_folders` command and applied server-side, so `allGroups` (derived from `folderSummaries`, which comes from the filtered query result) will only contain species that pass this server-side filter — it is not a client-side re-filter of an already-loaded full list.
  implication: If the target species name contains markup asterisks, the effect poisons its own search/filter pipeline, potentially causing allGroups to permanently exclude the very species being jumped to.
- timestamp: 2026-07-06T00:05:00Z
  checked: src-tauri/src/commands/import.rs push_find_search_filters (lines 1454-1506) and normalized_like_query (lines 1508-1518)
  found: Server-side, `species_query` (already asterisk-stripped client-side) is turned into `LOWER(f.species_name) LIKE '%<plain query>%' ESCAPE '\\'`. `f.species_name` is the RAW, unstripped DB column (asterisks intact). For a species like `"*Vrganj* smrekov"`, the plain query becomes `"vrganj smrekov"`, but `LOWER(f.species_name)` is `"*vrganj* smrekov"` — the asterisk between the words breaks the substring match, so the LIKE clause NEVER matches the row it's supposed to find.
  implication: Confirmed root cause mechanism — any species name containing markdown-style `*asterisk*` markup (a normal, supported naming convention per src/lib/speciesName.tsx and used in SpeciesNameEditor suggestions) will silently fail to be found via "Otvori u zbirci", because the jump effect's own search-population step causes the folders query to exclude that species entirely. `allGroups` ends up empty/missing the target, `matchedSpecies` is null, `setSelectedCollectionSpecies(null)` is never called (signal stuck), effect keeps re-running on every `allGroups` change but never finds a match — visually a total no-op with no error.
- timestamp: 2026-07-06T00:10:00Z
  checked: src/tabs/CollectionTab.test.tsx lines 40-90 (mock setup) and src/test/tauri-mocks.ts lines 50-56 (get_collection_folders / get_finds mock handlers)
  found: Existing regression test "opens the requested species through search when jumping from Species tab" (line 177) uses `species_name: 'Boletus edulis'` (no markup) and the mock `get_finds` handler ignores the `filters` argument entirely (`invokeHandlers.get_finds = () => [find1, find2]`), so the test never exercises real server-side LIKE filtering. This is why the existing test suite did not catch the bug — it bypasses the exact mechanism (Rust LIKE clause vs. raw DB column) that breaks in production.
  implication: Fix must either (a) not taint the folders-query filter with an unstripped name, and/or (b) not rely on the search-query round-trip to find the match at all when we already know we're specifically jumping to a known folder name. Regression test must simulate real substring-filter behavior (asterisk mismatch) to catch this class of bug.

## Eliminated

- hypothesis: TERTIARY — CollectionTab unmounted/remounted losing allGroups state when activeTab switches
  evidence: Not needed to explain the bug; the self-inflicted filter exclusion (search poisoned with raw markup) fully and deterministically reproduces the reported no-op independent of mount/unmount timing. Not pursued further since PRIMARY/SECONDARY combined mechanism is sufficient and directly confirmed via code inspection of both TS and Rust layers.
  timestamp: 2026-07-06T00:12:00Z

## Resolution

- root_cause: |
    Two compounding facts caused the permanent no-op:
    1. `CollectionTab` is kept mounted across tab switches via `forceMount` on its `TabsContent` in `src/components/layout/AppShell.tsx` (line 229), so its `search`/filter state persists between visits rather than resetting. A stale/unrelated search or filter left active from a prior visit means `allGroups` does not contain the newly-requested species at the moment the jump effect first runs.
    2. The jump effect (`src/tabs/CollectionTab.tsx` ~line 912-944) sets `search` to the RAW target species name, including any `*asterisk*` bold/non-bold display markup that species names may legitimately contain (convention defined in `src/lib/speciesName.tsx`, used e.g. in `SpeciesNameEditor` suggestions). `search` feeds `collectionFindFilters.speciesQuery` via `plainSpeciesName(debouncedSearch)` (line 716) — asterisks stripped from the QUERY string only. That filter is sent to the Rust `get_collection_folders` command (`src-tauri/src/commands/import.rs`, `push_find_search_filters`), which built `LOWER(f.species_name) LIKE '%<plain query>%'` against the RAW, unstripped `species_name` DB column. For a name like `"*Vrganj* smrekov"`, the plain query `"vrganj smrekov"` is not a substring of `"*vrganj* smrekov"` (asterisk breaks the match), so the SQL LIKE clause never matches the row — confirmed empirically with a standalone sqlite3 query. The folders query therefore returns zero/incomplete rows for that species, `allGroups` never contains the target, the effect's match logic (line 917-920) can never succeed, `setSelectedCollectionSpecies(null)` is never called to consume the signal, and the effect keeps re-running on every `allGroups` change but never finds a match — a silent, permanent no-op, reproducing for any species name containing markup (a normal, supported naming pattern in this app), matching the user's "recurring" report.
- fix: |
    1. `src-tauri/src/commands/import.rs` (`push_find_search_filters`): changed the species-name LIKE clause from `LOWER(species_name) LIKE ?` to `LOWER(REPLACE(species_name, '*', '')) LIKE ?`, so the DB-side comparison strips markup symmetrically with the already-stripped client-side query string. This fixes species-name substring search for ALL callers of this shared filter helper (`get_finds`, `get_collection_folders`, and the third caller), not just the jump-to-collection path.
    2. `src/tabs/CollectionTab.tsx` (jump effect): changed `setSearch(...)` to use `plainSpeciesName(rawTarget)` instead of the raw target string, so the visible search box shows a clean plain name instead of literal asterisks (cosmetic follow-on fix, same root issue).
- verification: |
    - Added regression test in `src/tabs/CollectionTab.test.tsx` ("opens the requested species when its name contains *markup* asterisks even with a stale search active") that mounts CollectionTab, sets an unrelated active search (simulating the forceMount-persisted stale state), then dispatches `selectedCollectionSpecies` for a species with `*asterisk*` markup, using a mock `get_finds` handler that mirrors the real (fixed) Rust filtering behavior (strips '*' from both the query and the compared name). Test passes with the fix.
    - Confirmed test is a genuine regression guard: temporarily reverted the mock to the pre-fix asymmetric behavior (strip only the query, not the compared name) — test failed as expected, proving it exercises the exact root-cause mechanism.
    - Full existing `CollectionTab.test.tsx` suite (12 tests) passes after the fix, including the original non-markup jump test.
    - Empirically verified the SQL fix directly against sqlite3 (Python harness): `LOWER(REPLACE(species_name, '*', '')) LIKE '%vrganj smrekov%'` matches `'*Vrganj* smrekov'`, while the pre-fix `LOWER(species_name) LIKE '%vrganj smrekov%'` does not.
    - `cargo check --lib` passes cleanly on the Rust change (no warnings/errors). Rust unit tests could not be executed in this environment due to a pre-existing, unrelated `STATUS_ENTRYPOINT_NOT_FOUND` test-binary issue reproduced identically on a clean `main` checkout (not caused by this fix).
    - Full frontend `vitest run` suite: 5 pre-existing unrelated test file failures (FindCard, BulkMetadataBar, others) confirmed present on `main` before this change (verified via `git stash` + rerun); no new failures introduced by this fix.
    - Still needs human end-to-end confirmation in the real running app (see checkpoint).
- files_changed:
    - src-tauri/src/commands/import.rs
    - src/tabs/CollectionTab.tsx
    - src/tabs/CollectionTab.test.tsx
