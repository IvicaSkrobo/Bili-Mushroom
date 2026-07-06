---
phase: quick-260706-p4x
plan: 01
status: complete
---

# Summary: Calendar-based date picker for Collection tab filters

## What shipped

- `src/components/ui/calendar.tsx` (new):
  - `Calendar` — day-grid month picker. Internal `{year, month}` view state (defaults to the selected date's month, or today's). Prev/next month arrows; `showYear` prop hides the year and locks navigation to month-only (year pinned to a fixed leap year, `2024`, so Feb 29 is always selectable) — used for the "day+month, any year" recurring mode. Grid always renders 42 cells via plain `Date` arithmetic (no manual month-length edge cases), with grayed adjacent-month days, amber `bg-primary` selected state, and a subtle ring on today. Month label in `font-serif`, day numbers in `font-mono`, locale-aware via `Intl.DateTimeFormat` (`lang` prop).
  - `MonthYearPicker` — 12-month grid (`Intl` short month names) with prev/next year arrows, for the "filter by month" mode.
- `src/tabs/CollectionTab.tsx`:
  - Removed `DatePartsInput` (digit-triplet typing component) and its props interface entirely — dead code once migrated.
  - Added conversion helpers: `isoFromDateParts`/`datePartsFromIso` (exact/range "day month year" ↔ ISO), `isoFromDayMonth`/`dayMonthFromIso` (day+month "any year" ↔ ISO using the fixed `DAY_MONTH_REF_YEAR = 2024`), `monthYearFromValue` (month mode "month year" string → `{month, year}`). These preserve the exact same `dateSearch`/`dateSearchEnd`/`monthSearch`/`dayMonthSearch` string formats already consumed by `parseCompleteDateQuery`/`splitDateParts` downstream — no changes needed to filter-building logic.
  - All 5 date-filter-mode usages (exact, range × 2, month, day+month) now render a small trigger button (shows the formatted current value, or a "Pick date"/"Pick month"/"Pick day and month" placeholder) opening a `Popover` with the `Calendar` or `MonthYearPicker`. Year mode is unchanged (plain text input — a single year doesn't benefit from a calendar).
  - Range mode's two triggers keep distinct `aria-label`s ("Date search from"/"Date search to") since both would otherwise show identical placeholder text; the other three triggers rely on their own visible text as the accessible name (simpler, and avoids a stale aria-label overriding the live formatted-date text for screen readers).
- `src/i18n/index.ts`: added `collection.pickDate`, `collection.pickMonth`, `collection.pickDayMonth` (hr + en).
- `src/tabs/CollectionTab.test.tsx`: rewrote the `date filter modes` describe block (renamed to "date filter modes (calendar picker)") for the new UI — clicking through Popover triggers and calendar day/month-nav buttons instead of typing into digit inputs. Derives expected values from the real current date (`new Date()`) rather than mocking system time, since `vi.useFakeTimers()` hangs Testing Library's `waitFor`/`findBy*` polling unless timers are manually advanced. Added a new test covering month navigation (the actual feature requested) and kept the single-digit-day regression test from the collection-search-sort-bugs debug session.

## Commits

- (pending — committed together with this summary)

## Verification

- `npx vitest run src/tabs/CollectionTab.test.tsx` — 17/17 passed.
- `npx tsc --noEmit` — clean.
- `npx vitest run` (full suite) — same 5 pre-existing, unrelated failures as before this change (flagged separately, see task_bf311b8c); no new failures.
- Manual visual check pending in the running Tauri app (frontend-only change, Vite HMR should apply live).

## Success criteria status

- [x] Exact/range/day+month modes use a visual calendar instead of typed digits.
- [x] Month mode uses a 12-month grid instead of typed digits.
- [x] Day+month mode always allows Feb 29 regardless of the real current year (fixed 2024 reference year).
- [~] Manual visual confirmation in the running app — pending user check.
