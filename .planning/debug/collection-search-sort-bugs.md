---
status: resolved
slug: collection-search-sort-bugs
trigger: "Tester (Ivan) izvjestio nakon prolaska kroz cijelu app: u Zbirka (Collection) tabu, pretraga po datumu ne radi i sortiranje zbirke po abecedi ne radi. Ico (dev) potvrdio da mu se cinilo da sort po abecedi radi, treba provjeriti."
created: 2026-07-06
updated: 2026-07-06
---

## Symptoms

- expected: (1) Date filter/search in Collection tab (Zbirka) narrows the visible finds/folders to those matching the selected date. (2) Alphabetical sort option orders the collection list A-Z (species/folder names) correctly.
- actual: (1) Date search returns no/wrong results — filter appears to do nothing or filters incorrectly. (2) Alphabetical sort does not visibly reorder the list, even though the sort control is present and selectable.
- errors: None reported yet — no console/error info gathered from live repro.
- timeline: Found during a full pass through the app by a tester; unclear if regression or always broken. Dev thought alphabetical sort "seemed to work" previously — worth confirming exact conditions where it fails (e.g. only within folders/species groups, or top-level list, case sensitivity, diacritics).
- reproduction: Open Zbirka (Collection) tab. (1) Use the date picker/day-month-year search fields to filter by a known find date, observe results are empty/incorrect. (2) Change list sort control to alphabetical, observe list order is unchanged from default (likely date/recency order).

## Context

- Platform: Windows Tauri 2 + React 18 + Rust, local SQLite via rusqlite
- Feature area: `src/tabs/CollectionTab.tsx` (per CLAUDE.md, large orchestration component) — likely also touches `src/components/finds/` and `src/lib/` filter/sort helpers
- User confirms date search exists ONLY in Collection tab (Zbirka) — not present elsewhere in the app, so no cross-tab consistency concern.
- Two distinct bugs, possibly two distinct root causes (search/filter logic vs sort comparator) — investigate both, may require two separate fixes.

## Current Focus

- hypothesis: BUG 1 (date search) CONFIRMED — the compact-digit regex fallback in `parseCompleteDateQuery` (CollectionTab.tsx) cannot disambiguate day/month digit-count when one part is 1 digit and the other is 2 digits, silently producing a wrong date. BUG 2 (alphabetical sort) — CollectionTab has NO sort control/state at all; folders are always ordered by backend SQL `ORDER BY latest_date DESC, species_name ASC`. The "alphabetical sort" toggle that actually exists in the codebase lives in StatsTab (`speciesSortMode`), not in Collection tab (Zbirka) — tester's report maps to a missing feature in Collection, not a broken one.
- test: Node repro of parseCompleteDateQuery with realistic DatePartsInput outputs (space-joined day/month/year parts, mixed digit lengths)
- expecting: n/a — confirmed via direct execution
- next_action: none — both fixes implemented, independently re-verified, and session resolved
- reasoning_checkpoint:
    hypothesis_1: "Date search fails because parseCompleteDateQuery's compact-digit fallback regex is positionally ambiguous when day/month digit-lengths differ, so it silently misparses single-digit day or month into the wrong ISO date."
    confirming_evidence_1:
      - "Direct Node execution: parseCompleteDateQuery('1 12 2026') returns '2026-02-11' instead of correct '2026-12-01'."
      - "Traced DatePartsInput -> joinDateParts confirms real UI output is space-joined digits (never dotted), so the dotted regex branch is dead code for actual UI input and every query falls into the ambiguous compact-digit branch."
    falsification_test_1: "If parseCompleteDateQuery correctly parsed '1 12 2026' as 2026-12-01, or if DatePartsInput never allowed single-digit day/month to reach state, hypothesis would be false. Neither holds — confirmed by direct execution and by reading updatePart's auto-advance logic (only advances after 2 digits; single digit + manual focus change is reachable)."
      fix_rationale_1: "Fix must resolve ambiguity by construction, not by better guessing: build the ISO date directly from the known field values (day, month, year) collected by DatePartsInput, instead of round-tripping through a joined/re-parsed free-text string. This eliminates the ambiguous regex entirely for the primary UI path while keeping parseCompleteDateQuery as a defensive fallback for any literal/pasted text."
    blind_spots_1: "Have not tested actual Tauri app UI interaction (keyboard-only trace via code reading + Node simulation of the exact string-processing functions, not a live browser session). Have not audited whether other date-consuming call sites depend on the old ambiguous parse behavior (checked - only used in collectionFindFilters memo, all three: exact, range start & end)."
    hypothesis_2: "Alphabetical sort in Collection tab doesn't work because it doesn't exist there; the sort feature exists only in Stats tab."
    confirming_evidence_2:
      - "Full read of CollectionTab.tsx: zero sort state, zero sort UI, zero .sort() call on groups/filteredGroups."
      - "get_collection_folders SQL always orders by latest_date DESC first; species name is only a same-date tiebreaker."
    falsification_test_2: "If a sort control/state existed in CollectionTab with a broken comparator, hypothesis would be false. Grep + full read found none."
    fix_rationale_2: "Add the missing feature: a client-side alphabetical/recent toggle over filteredGroups in CollectionTab, using the same compareSpeciesNames comparator already proven correct in StatsTab. This directly satisfies the reported expectation without touching backend ordering (which must stay latest-first by default for the primary UX)."
    blind_spots_2: "This is a feature addition, not a pure bug fix, since no working sort code path existed to break. Confirmed via user's own workflow language treating it as an existing-but-broken control; scope decision is to implement it since that matches expected behavior and is the minimal way to make the tester's report true."
- tdd_checkpoint: (none — tdd_mode not set)

## Evidence

- timestamp: 2026-07-06T00:00:00Z
  checked: src/tabs/CollectionTab.tsx full read (1763 lines)
  found: No sort control, no `sortBy`/`sortMode` state, no `.sort()` call anywhere on `groups`/`filteredGroups`. `groups = allGroups` directly from `folderSummaries` (backend order).
  implication: Alphabetical sort in the Collection tab is not merely broken — it does not exist as a feature. Any "sort" the user/dev observed must be confused with a different tab or with the backend's secondary alpha tiebreaker.

- timestamp: 2026-07-06T00:05:00Z
  checked: src-tauri/src/commands/import.rs `get_collection_folders` (line ~1233-1299)
  found: SQL `ORDER BY latest_date DESC, f.species_name COLLATE NOCASE ASC` — species name is only a tiebreaker for folders sharing the exact same `latest_date`. Primary sort is always by most-recent find date, descending.
  implication: Confirms no way for the UI to request a pure alphabetical order from the backend either. This explains "Ico thought sort worked" — for the common case of few folders with staggered dates, the secondary alpha ordering is invisible/coincidental, easy to mistake for full alpha sort when scanning a short list.

- timestamp: 2026-07-06T00:10:00Z
  checked: src/i18n/index.ts nav labels + src/tabs/StatsTab.tsx sort toggle (lines 116, 256-262, 455-478)
  found: 'nav.collection' = "Zbirka" (hr) / "Collection" (en); 'nav.stats' = "Statistike" / "Stats". The only real alphabetical sort toggle in the app (`speciesSortMode` state, `stats.sortAlphabetical` label "Abeceda") lives in StatsTab, not CollectionTab. StatsTab's sort logic itself (`sortedSpeciesStats` useMemo, `compareSpeciesNames` comparator, stable `key={s.species_name}`) reads as correct — no bug found there.
  implication: Tester's bug report "sortiranje zbirke po abecedi ne radi" (sorting the collection alphabetically doesn't work) in "Zbirka" tab refers to a feature gap in Collection tab, not a defect in an existing implementation. Fix = add the missing feature to Collection tab (client-side alpha sort toggle over `filteredGroups`), rather than "fix" a broken comparator.

- timestamp: 2026-07-06T00:20:00Z
  checked: src/tabs/CollectionTab.tsx `normalizeDateQuery`, `dateVariants`, `parseCompleteDateQuery`, `DatePartsInput`/`splitDateParts`/`joinDateParts`, plus live Node execution of the exact parsing logic
  found: `DatePartsInput` builds `dateSearch`/`dateSearchEnd` by joining day/month/year parts with a SPACE via `joinDateParts` (`parts.filter(Boolean).join(' ')`) — never with a `.` separator. `parseCompleteDateQuery` then calls `normalizeDateQuery` which strips all whitespace, so the dotted-separator regex (`^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$`) never matches real UI input — it always falls through to the compact-digit regex `^(\d{1,2})(\d{1,2})(\d{4})$`. That regex is positionally ambiguous: for input "1 12 2026" (day=1, month=12, year=2026 — a fully valid, reachable UI state whenever the user leaves day as a single digit, e.g. by clicking/Tabbing to the next field instead of typing a leading zero), normalized query is "1122026", and greedy regex backtracking assigns day="11", month="02", producing `2026-02-11` instead of the correct `2026-12-01`.
  implication: ROOT CAUSE of bug 1. Live Node reproduction: `parseCompleteDateQuery("1 12 2026")` → `"2026-02-11"` (wrong); expected `"2026-12-01"`. Confirmed the 2-digit/2-digit and 1-digit/1-digit cases parse correctly (`"06 07 2026"` → correct, `"1 2 2026"` → correct by coincidence of equal lengths), but any 1-digit/2-digit or 2-digit/1-digit mix corrupts the date. This matches "date search returns no/wrong results" — user searching for a date with a single-digit day or month (very common, e.g. day 1-9) silently searches the wrong date instead of erroring, so results look empty/wrong.

- timestamp: 2026-07-06T00:40:00Z
  checked: Independent re-verification pass (second investigator, same session continued after coordinator redirect) — re-read CollectionTab.tsx end-to-end, useFinds.ts, lib/finds.ts, src-tauri/src/commands/import.rs (push_find_search_filters, normalized_date_bound/prefix/day_month, get_collection_folders SQL), src-tauri/src/commands/exif.rs date normalization, lib/dateFormat.ts, components/ui/date-input.tsx. Independently reproduced `parseCompleteDateQuery("1 12 2026")` → `2026-02-11` bug via isolated Node execution before checking whether a fix already existed, then found the fix already applied in the working tree.
  found: All Rust-side date filter plumbing (WHERE clause construction, ISO validation, day-month substr matching) is correct and was not the source of either bug — confirmed no Rust changes were needed or made. Confirmed via git diff that only `src/tabs/CollectionTab.tsx`, `src/tabs/CollectionTab.test.tsx`, and `src/i18n/index.ts` were modified.
  implication: Confirms root cause attribution is fully client-side and scoped correctly; no backend changes required for either bug.

## Eliminated

- hypothesis: Alphabetical sort exists in CollectionTab but its comparator (e.g. compareSpeciesNames) is broken.
  evidence: No comparator, no sort call, no sort state exists anywhere in CollectionTab.tsx — grepped full file and confirmed via read. The only alpha-sort code in the app is in StatsTab and it functions correctly.
  timestamp: 2026-07-06T00:10:00Z

- hypothesis: Date filter fails because backend SQL date comparison/format handling is wrong (e.g. `normalized_date_bound`/`normalized_date_prefix`/`normalized_day_month` in import.rs).
  evidence: Read `push_find_search_filters` and the three `normalized_*` helper functions — all correctly validate/pass through strict ISO `YYYY-MM-DD` (or prefix/day-month) formats. The corruption happens entirely client-side, before the filter payload is even sent to Rust; by the time Rust receives `dateStart`/`dateEnd`, they are well-formed but already wrong values.
  timestamp: 2026-07-06T00:20:00Z

- hypothesis: EXIF-derived or manually-entered date_found values are stored in a non-padded/inconsistent format, causing exact/prefix date matches to fail.
  evidence: `normalize_exif_date` (exif.rs) always produces zero-padded `YYYY-MM-DD` from EXIF `DateTimeOriginal`. `parseDateInputToIso` (lib/dateFormat.ts) used by the manual create/edit date input always zero-pads via `normalizeIsoParts`. No code path writes an unpadded or differently-formatted date to `date_found`.
  timestamp: 2026-07-06T00:40:00Z

## Resolution

- root_cause: |
    Bug 1 (date search): `parseCompleteDateQuery` in CollectionTab.tsx fell back to a positionally-ambiguous regex (`^(\d{1,2})(\d{1,2})(\d{4})$`) to parse the space-joined day/month/year string produced by `DatePartsInput`. When day and month have different digit lengths (one is a single digit, e.g. day=1), the regex's greedy backtracking misassigned which digits belong to day vs month, producing a wrong ISO date that was silently sent to the backend as a well-formed (but incorrect) filter — yielding empty/wrong results with no error. This affects any single-digit day or month (very common: days/months 1-9), which is almost certainly what the tester hit during normal use.
    Bug 2 (alphabetical sort): Not a regression — the feature never existed in CollectionTab. No sort control, state, or comparator was present; folder order always came from the backend's `ORDER BY latest_date DESC, species_name ASC` in `get_collection_folders`, where species name is only a same-date tiebreaker. The dev's impression that alphabetical sort "seemed to work" is explained by that tiebreaker being coincidentally visible in small collections. The only real alphabetical sort in the codebase lived in StatsTab and works correctly there.
- fix: |
    Bug 1: In `parseCompleteDateQuery` (src/tabs/CollectionTab.tsx), added a check on the raw (pre-whitespace-strip) query for exactly 3 space-separated numeric tokens (day, month, year — matching DatePartsInput's `joinDateParts` output format). When present, the ISO date is built directly from those unambiguous field boundaries (with day 1-31 / month 1-12 range validation, returning null on invalid values) instead of falling through to the old compact-digit regex, which now only runs for genuinely compact/dotted input (e.g. "06072026" or "06.07.2026" typed/pasted directly) where digit lengths are either fixed-width or delimiter-separated and therefore unambiguous.
    Bug 2: Added `speciesSortMode` state ('recent' | 'alpha', default 'recent') to CollectionTab. `groups` is now a `useMemo` that returns `allGroups` unchanged in 'recent' mode (preserving existing backend latest-date-first order) or a copy sorted with the existing, already-correct `compareSpeciesNames` comparator (from src/lib/speciesName.tsx, same comparator used by StatsTab) in 'alpha' mode. Added a segmented toggle button (Recent / Alphabetical) in the Collection tab toolbar, plus new i18n keys `collection.sortMode`, `collection.sortRecent`, `collection.sortAlphabetical` (hr + en).
  verification: |
    - Added regression test "produces the correct exact-mode dateStart/dateEnd when day is a single digit and month is two digits" to src/tabs/CollectionTab.test.tsx — confirmed FAILS against pre-fix code (asserted 2026-12-01, pre-fix code produced 2026-02-11) and PASSES against fixed code.
    - Added regression test "reorders species folders alphabetically when Alphabetical sort is selected" — confirmed FAILS against pre-fix code (no "Alphabetical" button existed) and PASSES against fixed code, verifying actual DOM reordering (Chanterelle/Amanita muscaria) when toggle is clicked, and that default 'recent' mode preserves original backend order.
    - Full existing CollectionTab test suite (16 tests total after additions) passes with zero regressions. Independently re-run and confirmed green.
    - `npx tsc --noEmit` passes with zero errors. Independently re-run and confirmed clean.
    - Independent re-verification (second pass): re-derived the ambiguous-regex bug from scratch via isolated Node execution before inspecting the fix, confirmed the same failure (`"1 12 2026"` → `"2026-02-11"`) on the pre-fix logic, then confirmed the applied fix resolves it plus handles additional edge cases correctly: `"12 1 2026"` → `2026-01-12`, `"06 07 2026"` → `2026-07-06`, literal ISO `"2026-05-10"` → unchanged, pasted dotted `"10.05.2026"` → `2026-05-10`, invalid day `"32 1 2026"` → null, invalid month `"1 13 2026"` → null.
    - Independently confirmed via `git diff --stat` that only `src/tabs/CollectionTab.tsx`, `src/tabs/CollectionTab.test.tsx`, and `src/i18n/index.ts` are modified — no Rust/backend files touched, consistent with root cause being fully client-side.
    - `cargo check --lib` (Rust) passes cleanly, confirming backend is unaffected by the fix (no Rust source was changed).
    - Live Tauri UI click-through not performed (no interactive Tauri runtime available in this environment); confidence in the fix is based on: reproducing the exact failure mode in isolation prior to the fix, exhaustive edge-case testing of the corrected logic, full component test suite passing (including DOM-level assertions for both the date filter payload and the sort toggle's actual reordering effect on rendered species folder names), and clean typecheck.
  files_changed:
    - src/tabs/CollectionTab.tsx
    - src/tabs/CollectionTab.test.tsx
    - src/i18n/index.ts
