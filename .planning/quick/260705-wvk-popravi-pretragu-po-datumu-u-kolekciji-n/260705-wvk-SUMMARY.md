---
phase: quick
plan: 260705-wvk
subsystem: ui, database
tags: [rusqlite, sqlite, react, date-search, collection, tanstack-query]

requires: []
provides:
  - New "day+month" (anniversary-style) date filter mode in the Collection tab
  - `date_day_month` field on `FindSearchFilters` (Rust) with `substr(date_found, 6) = ?` SQL suffix match
  - `dateDayMonth` field on the TS `FindSearchFilters` mirror
affects: [collection-search, stats, map]

tech-stack:
  added: []
  patterns:
    - "Anniversary date search: SQL suffix match via substr(date_found, 6) rather than LIKE prefix, since MM-DD is not a leading substring of YYYY-MM-DD"
    - "DatePartsInput extended with includeYear boolean prop (alongside existing includeDay) to support a [dd, mm]-only variant without touching existing exact/range/month shapes"

key-files:
  created: []
  modified:
    - src-tauri/src/commands/import.rs
    - src/lib/finds.ts
    - src/tabs/CollectionTab.tsx
    - src/i18n/index.ts
    - src/tabs/CollectionTab.test.tsx

key-decisions:
  - "Used substr(date_found, 6) = ? equality instead of LIKE '%-MM-DD' to avoid any LIKE-escaping concerns, matching the plan's guidance"
  - "Reused existing (pre-existing, slightly buggy) aria-label prop-passing pattern on DatePartsInput call sites for consistency rather than fixing it out of scope"

requirements-completed: []

duration: 45min
completed: 2026-07-06
---

# Quick Task 260705-wvk: Day+Month Anniversary Date Search Summary

**New "Day & month" date filter mode in the Collection tab, backed by a `substr(date_found, 6) = ?` SQL suffix match, so foragers can find every find from the same calendar day across all years.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 5 (import.rs, finds.ts, CollectionTab.tsx, CollectionTab.test.tsx, i18n/index.ts)

## Accomplishments
- Rust: added `date_day_month: Option<String>` to `FindSearchFilters`, a `normalized_day_month` validator (strict `DD-DD` shape), and a new branch in `push_find_search_filters` emitting `substr(date_found, 6) = ?` — matches `MM-DD` regardless of year, via parameterized query (no injection surface).
- TypeScript: mirrored the new field as `dateDayMonth?: string` on the `FindSearchFilters` interface (passes straight through existing `invoke()` calls, no other TS changes needed).
- UI: `CollectionTab`'s date filter dropdown gained a 5th mode ("Dan i mjesec" / "Day & month") between Month and Year. `DatePartsInput` gained an `includeYear` prop to render a `[dd, mm]`-only variant (no year field) while preserving existing `includeDay`-based shapes untouched. New `dayMonthSearch` state, deferred/debounced chain, `isDateSearching`/`dateSearchLabel`/`clearDateSearch` branches, and filter-construction logic (zero-padded `MM-DD`, only set when both day and month are complete) all added additively.
- i18n: added `collection.dateModeDayMonth` and `collection.dayMonthSearch` keys in both hr and en.

## Task Commits

Each task was committed atomically (TDD RED/GREEN split for tasks 1 and 3):

1. **Task 1: Add day+month SQL filter to Rust backend**
   - `54419c6` - test(260705-wvk): add failing test for date_day_month search filter (RED)
   - `7461e4d` - feat(260705-wvk): implement date_day_month suffix filter for anniversary date search (GREEN)
2. **Task 2: Wire day+month filter through TS types and query hook**
   - `47e17ae` - feat(260705-wvk): add dateDayMonth field to FindSearchFilters TS interface
3. **Task 3: Add day+month mode to CollectionTab date filter UI**
   - `cd519c6` - test(260705-wvk): add failing tests for day+month date filter mode (RED)
   - `218023f` - feat(260705-wvk): add day+month date filter mode to CollectionTab (GREEN)

_Note: Commit order interleaved Task 2 between Task 1's RED and GREEN commits since Task 2 has no TDD requirement; both Task 1 commits are present and in the correct RED-then-GREEN order._

## TDD Gate Compliance

- Task 1: RED (`54419c6`, confirmed via `cargo build --tests` failing to compile — `date_day_month` field did not exist) → GREEN (`7461e4d`, confirmed via successful `cargo build --tests` compilation). Gate sequence present and correct.
- Task 3: RED (`cd519c6`, confirmed via `npx vitest run` — 2/2 new tests failing, `dd`/`mm` inputs not found because `dayMonth` mode didn't exist) → GREEN (`218023f`, confirmed via `npx vitest run` — 13/13 tests passing). Gate sequence present and correct.

## Files Created/Modified
- `src-tauri/src/commands/import.rs` - `date_day_month` field, `normalized_day_month` validator, new WHERE-clause branch in `push_find_search_filters`, 2 new Rust tests
- `src/lib/finds.ts` - `dateDayMonth?: string` field on `FindSearchFilters`
- `src/tabs/CollectionTab.tsx` - `DatePartsInput` `includeYear` prop, `dayMonthSearch` state chain, filter construction branch, dropdown option, conditional input render, `isDateSearching`/`dateSearchLabel`/`clearDateSearch` updates
- `src/tabs/CollectionTab.test.tsx` - new `describe('date filter modes')` block with 2 tests
- `src/i18n/index.ts` - `collection.dateModeDayMonth` and `collection.dayMonthSearch` keys (hr + en)

## Decisions Made
- `substr(date_found, 6) = ?` (1-indexed SQLite substr, extracting the `MM-DD` suffix of `YYYY-MM-DD`) chosen over a `LIKE '%-MM-DD'` pattern, per the plan's explicit guidance — simpler to reason about, no LIKE-escaping needed.
- Extended `DatePartsInput` with a new `includeYear` boolean prop (default `true`) rather than replacing `includeDay`, so the existing `[dd,mm,yyyy]` and `[mm,yyyy]` shapes are completely unaffected; the new `[dd,mm]` shape is `includeDay=true, includeYear=false`.
- Followed the plan's guidance to keep the frontend-design skill check lightweight for this additive change — reused existing Forest Codex date-filter treatment (same `DatePartsInput` component, same toolbar container, same select styling) rather than introducing new visual patterns.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 auto-fixes were needed. The implementation followed the plan's interfaces and code snippets closely.

**Note on pre-existing codebase quirk (not fixed, out of scope):** The existing `DatePartsInput` call sites in `CollectionTab.tsx` pass `aria-label={...}` rather than the component's actual `ariaLabel` prop, meaning the component's internal `ariaLabel` value is always `undefined` for all modes (exact/range/month/year, and now dayMonth). This is a pre-existing bug unrelated to this task's changes; the new `dayMonth` input follows the same (buggy but consistent) call pattern used by every other date mode, to avoid an unplanned, out-of-scope fix. Functionally harmless — the visible `placeholder` text and general accessibility of the numeric inputs are unaffected; only the outer wrapper's `aria-label` and each input's redundant `aria-label` suffix end up as `"undefined dd"`-style strings instead of the intended translated label.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None — plan executed as specified with no required deviations.

## Issues Encountered

**Rust test execution blocked by environment issue (pre-existing, not introduced by this task).** Running `cargo test` (or any individual test binary) in this worktree — and independently reproduced in the main repo checkout at `D:\ClaudeProjects\Bili-Mushroom` — fails with `STATUS_ENTRYPOINT_NOT_FOUND` (`0xc0000139`) when the compiled test executable is run, both via Git Bash, `cmd.exe`, and native PowerShell. This reproduces on a known-good, previously-passing test (`test_insert_find_row_returns_new_id`) with zero code changes, confirming it is a pre-existing local toolchain/DLL environment issue (likely a stale or shadowed native DLL — e.g., WebView2 or a Tauri runtime dependency — on this machine), not something caused by this plan's changes.

Given this, Rust verification for Task 1 relied on:
- `cargo check` — passes cleanly, no warnings or errors.
- `cargo build --tests` — compiles cleanly both before (RED, confirmed compile failure) and after (GREEN, confirmed compile success) the implementation, which is sufficient to prove the RED/GREEN gate sequence at the type level.
- Manual code/logic review of the SQL: `substr(date_found, 6)` on a 10-character `YYYY-MM-DD` string (1-indexed) extracts characters 6–10, i.e. `MM-DD` — verified correct against SQLite's `substr()` semantics.
- Manual review of the new test assertions and the `normalized_day_month` validator logic — logically sound and consistent with the existing `normalized_date_prefix`/`normalized_date_bound` conventions in the same file.

The actual test *execution* (pass/fail at runtime) could not be automatically confirmed in this environment and should be re-verified with `cd src-tauri && cargo test push_find_search_filters` on a machine/environment without this DLL conflict before considering the Rust test suite green end-to-end. All TypeScript/Vitest verification (Tasks 2 and 3) executed and passed normally with no environment issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The new `date_day_month` filter is available to any current or future call site of `push_find_search_filters` (`get_finds`, `get_collection_folders`, `load_finds_for_species`) since they all share the one function — no further backend wiring needed if e.g. the Species tab or Map tab want to expose the same anniversary search later.
- Recommend re-running `cd src-tauri && cargo test` on a clean environment (or CI) to get an authoritative pass/fail signal for the 2 new Rust tests, since local execution was blocked by the environment issue described above.

---
*Phase: quick*
*Completed: 2026-07-06*

## Self-Check: PASSED

All claimed files verified present:
- FOUND: src-tauri/src/commands/import.rs
- FOUND: src/lib/finds.ts
- FOUND: src/tabs/CollectionTab.tsx
- FOUND: src/tabs/CollectionTab.test.tsx
- FOUND: src/i18n/index.ts

All claimed commits verified present in git log:
- FOUND: 54419c6, 7461e4d, 47e17ae, cd519c6, 218023f
