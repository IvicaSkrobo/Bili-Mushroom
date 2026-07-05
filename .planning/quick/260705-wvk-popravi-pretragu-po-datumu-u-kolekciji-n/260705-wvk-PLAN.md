---
phase: quick
plan: 260705-wvk
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/import.rs
  - src/lib/finds.ts
  - src/tabs/CollectionTab.tsx
  - src/i18n/index.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "User can select a new date filter mode that searches by day+month only (no year), and see finds from that day+month across every year in the collection"
    - "Existing exact/range/month/year date filter modes continue to work exactly as before"
  artifacts:
    - path: "src-tauri/src/commands/import.rs"
      provides: "date_day_month filter field on FindSearchFilters + SQL suffix match in push_find_search_filters"
      contains: "date_day_month"
    - path: "src/lib/finds.ts"
      provides: "dateDayMonth field on FindSearchFilters TS interface"
      contains: "dateDayMonth"
    - path: "src/tabs/CollectionTab.tsx"
      provides: "new 'dayMonth' date filter mode wired end-to-end (UI select option, DatePartsInput day+month variant, filter object construction)"
      contains: "dayMonth"
  key_links:
    - from: "src/tabs/CollectionTab.tsx"
      to: "src-tauri/src/commands/import.rs"
      via: "collectionFindFilters.dateDayMonth passed through useInfiniteCollectionFolders -> get_collection_folders/get_finds Tauri invoke"
      pattern: "dateDayMonth"
    - from: "src-tauri/src/commands/import.rs push_find_search_filters"
      to: "SQLite date_found column"
      via: "substr(date_found, 6) = ? equality on 'MM-DD' suffix"
      pattern: "substr\\(.*date_found.*,\\s*6\\)"
---

<objective>
Fix date search in the Collection tab so users can find every find from the same day+month across all years (e.g. "everything found around May 20th, any year") — currently the only modes are exact date, date range, month (with year), and year, none of which can express "day+month regardless of year" because that pattern is a suffix of `YYYY-MM-DD`, not a prefix.

Purpose: Foragers revisit the same spots/species in the same season year after year. They need to look back at "what did I find around this time before" without needing to remember or type every year.

Output: A new "day+month" (anniversary-style) date filter mode, wired end-to-end from UI dropdown through to a proper SQL suffix match in the Rust backend — additive only, all existing modes (exact/range/month/year) keep working unchanged.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Current FindSearchFilters shape and the shared filter-application function. -->
<!-- Executor should extend these directly — no further codebase exploration needed. -->

From src-tauri/src/commands/import.rs (~line 1432-1498), current filter struct and shared filter builder used by get_finds, get_collection_folders, and load_finds_for_species (all three call sites go through this one function):

```rust
#[derive(serde::Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FindSearchFilters {
    pub species_query: Option<String>,
    pub location_query: Option<String>,
    pub favorites_only: Option<bool>,
    pub date_start: Option<String>,
    pub date_end: Option<String>,
    pub date_prefix: Option<String>,
    pub photos_mode: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

fn push_find_search_filters(
    filters: &FindSearchFilters,
    table_alias: &str,
    where_clauses: &mut Vec<String>,
    query_params: &mut Vec<Box<dyn ToSql>>,
    include_species_query: bool,
) {
    // ... existing species/location/favorites/date_start/date_end/date_prefix handling ...
    if let Some(date_prefix) = normalized_date_prefix(filters.date_prefix.as_deref()) {
        where_clauses.push(format!("{} LIKE ?", col("date_found")));
        query_params.push(Box::new(format!("{}%", date_prefix)));
    }
}

fn normalized_date_prefix(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.len() <= 10 && trimmed.chars().all(|ch| ch.is_ascii_digit() || ch == '-') {
        Some(trimmed.to_string())
    } else {
        None
    }
}
```

`date_found` is always stored as full `YYYY-MM-DD`. `normalized_date_prefix`/`date_prefix` work for month (`YYYY-MM`) and year (`YYYY`) because those are always the LEADING characters — that mechanism cannot express "any year, this MM-DD" since that's a SUFFIX, not a prefix.

From src/lib/finds.ts (~line 60-70), the TS mirror of the Rust struct (camelCase, passed straight through Tauri invoke serde):

```typescript
export interface FindSearchFilters {
  speciesQuery?: string;
  locationQuery?: string;
  favoritesOnly?: boolean;
  dateStart?: string;
  dateEnd?: string;
  datePrefix?: string;
  photosMode?: 'all' | 'primary';
  limit?: number;
  offset?: number;
}
```

From src/tabs/CollectionTab.tsx — current date filter mode state and UI (~line 686, ~line 1210-1262):

```typescript
const [dateFilterMode, setDateFilterMode] = useState<'exact' | 'range' | 'month' | 'year'>('exact');
const [dateSearch, setDateSearch] = useState('');
const [dateSearchEnd, setDateSearchEnd] = useState('');
const [monthSearch, setMonthSearch] = useState('');
const [yearSearch, setYearSearch] = useState('');
```

Filter object construction (~line 706-744), inside `useMemo`:

```typescript
if (dateFilterMode === 'exact') {
  const complete = parseCompleteDateQuery(debouncedDateSearch);
  if (complete) { filters.dateStart = complete; filters.dateEnd = complete; }
} else if (dateFilterMode === 'range') {
  // dateStart/dateEnd from two DatePartsInput fields
} else if (dateFilterMode === 'month') {
  const [month, year] = splitDateParts(debouncedMonthSearch, false);
  if (year?.length === 4) filters.datePrefix = month ? `${year}-${month.padStart(2, '0')}` : year;
} else {
  // year mode: filters.datePrefix = year (4-digit)
}
```

`DatePartsInput` component (~line 151-226) currently supports exactly two shapes via the `includeDay` boolean prop:
- `includeDay=true` -> `[dd, mm, yyyy]` (used by exact/range modes)
- `includeDay=false` -> `[mm, yyyy]` (used by month mode)

`splitDateParts(value, includeDay)` (~line 159-163) and `joinDateParts` (~line 165-167) are the parse/serialize helpers behind it — space-joined numeric parts, split on non-digit runs.

Date filter dropdown UI (~line 1209-1222):

```tsx
<select
  value={dateFilterMode}
  onChange={(e) => {
    setDateFilterMode(e.target.value as 'exact' | 'range' | 'month' | 'year');
    clearDateSearch();
  }}
  aria-label={t('collection.dateSearchMode')}
  className="h-7 rounded bg-transparent px-1 text-[11px] text-muted-foreground outline-none"
>
  <option value="exact">{t('collection.dateModeExact')}</option>
  <option value="range">{t('collection.dateModeRange')}</option>
  <option value="month">{t('collection.dateModeMonth')}</option>
  <option value="year">{t('collection.dateModeYear')}</option>
</select>
```

Existing i18n keys for the date filter (src/i18n/index.ts, hr block ~line 52-62, en block ~line 675-684):
`collection.dateSearch`, `collection.dateSearchFrom`, `collection.dateSearchTo`, `collection.monthSearch`, `collection.yearSearch`, `collection.dateSearchMode`, `collection.dateModeExact` ("Dan"/"Day"), `collection.dateModeRange`, `collection.dateModeMonth`, `collection.dateModeYear`, `collection.clearDateSearch`.

`isDateSearching` (~line 970-974) and `dateSearchLabel` (~line 1039-1043) both switch on `dateFilterMode` and must gain a `dayMonth` branch each, or the clear-button/active-search-label UI will silently ignore the new mode.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add day+month SQL filter to Rust backend</name>
  <files>src-tauri/src/commands/import.rs</files>
  <behavior>
    - Test 1: `push_find_search_filters` with `date_day_month = Some("05-20".into())` produces a WHERE clause matching a find with `date_found = "2019-05-20"` and a find with `date_found = "2024-05-20"`, but NOT a find with `date_found = "2024-05-21"` or `date_found = "2024-06-20"`.
    - Test 2: `date_day_month = Some("invalid".into())` (or empty string) is ignored — no WHERE clause added, no panic.
    - Implement via an in-memory SQLite integration test (matching the existing `mod tests` conventions in this file: `setup_in_memory_db()`, `make_find_record()`, `insert_find_row()`), asserting on actual query results — not just string-matching the generated SQL.
  </behavior>
  <action>
    Add a new `date_day_month: Option<String>` field to `FindSearchFilters` (`#[serde(rename_all = "camelCase")]` already on the struct handles the `dateDayMonth` <-> `date_day_month` camelCase/snake_case mapping automatically — no extra serde attribute needed).

    In `push_find_search_filters` (~line 1446-1498), add a new branch after the existing `date_prefix` handling:
    ```rust
    if let Some(day_month) = normalized_day_month(filters.date_day_month.as_deref()) {
        where_clauses.push(format!("substr({}, 6) = ?", col("date_found")));
        query_params.push(Box::new(day_month));
    }
    ```
    Use `substr(date_found, 6)` (1-indexed in SQLite, so this extracts the `MM-DD` suffix from `YYYY-MM-DD`) equality rather than a `LIKE '%-MM-DD'` suffix pattern — equality on a fixed-length substring is simpler to reason about and avoids any LIKE-escaping concerns.

    Add a new validation helper near `normalized_date_prefix` (~line 1524-1534):
    ```rust
    fn normalized_day_month(value: Option<&str>) -> Option<String> {
        let trimmed = value?.trim();
        if trimmed.len() == 5
            && trimmed.chars().nth(2) == Some('-')
            && trimmed[0..2].chars().all(|c| c.is_ascii_digit())
            && trimmed[3..5].chars().all(|c| c.is_ascii_digit())
        {
            Some(trimmed.to_string())
        } else {
            None
        }
    }
    ```
    This expects the caller (frontend) to send a zero-padded `MM-DD` string (e.g. `"05-20"`) — matching the existing convention where `date_prefix` also expects pre-formatted, zero-padded segments from the frontend (see how `month` mode builds `${year}-${month.padStart(2, '0')}`).

    Add the RED test in `mod tests` (~after the existing duplicate-detection tests, before `test_remember_source_path_deduplicates_normalized_paths`), following the exact structure of `test_has_existing_photo_path_returns_true_when_exists`: build an in-memory DB, insert 3-4 finds with `make_find_record` at different dates spanning multiple years (reuse the same day+month, e.g. `"2019-05-20"` and `"2024-05-20"`, plus a decoy `"2024-05-21"` and `"2024-06-20"`), call `get_finds`-equivalent logic (or construct `FindSearchFilters { date_day_month: Some("05-20".into()), ..Default::default() }`, call `push_find_search_filters`, build the SQL, and run the query directly against the connection) and assert only the two May-20th finds are returned, in any year.
  </action>
  <verify>
    <automated>cd src-tauri && cargo test push_find_search_filters</automated>
  </verify>
  <done>New `date_day_month` field exists on `FindSearchFilters`; `push_find_search_filters` emits a `substr(date_found, 6) = ?` clause when it's set to a valid `MM-DD` string; invalid/empty values are silently ignored; new Rust test passes and existing Rust tests in import.rs still pass.</done>
</task>

<task type="auto">
  <name>Task 2: Wire day+month filter through TS types and query hook</name>
  <files>src/lib/finds.ts</files>
  <action>
    Add `dateDayMonth?: string;` to the `FindSearchFilters` TS interface (~line 60-70), directly below `datePrefix?: string;`, matching the existing camelCase field naming (Tauri's serde `rename_all = "camelCase"` on the Rust side maps `dateDayMonth` <-> `date_day_month` automatically, same as the other date fields — no other changes needed in this file since filters are passed straight through to `invoke()` calls that already forward the whole `FindSearchFilters` object).
  </action>
  <verify>
    <automated>cd . && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "finds.ts" || echo "no finds.ts errors"</automated>
  </verify>
  <done>`FindSearchFilters` TS interface has a `dateDayMonth?: string` field; `tsc --noEmit` shows no new errors from this file.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add day+month mode to CollectionTab date filter UI</name>
  <files>src/tabs/CollectionTab.tsx, src/i18n/index.ts</files>
  <behavior>
    - Test 1: with `dateFilterMode = 'dayMonth'` and a day+month input of "20" / "05", `collectionFindFilters` produces `{ dateDayMonth: '05-20' }` (zero-padded, no `dateStart`/`dateEnd`/`datePrefix` set).
    - Test 2: with `dateFilterMode = 'dayMonth'` and an incomplete input (only day, no month, or vice versa), `collectionFindFilters` produces no date-related filter key at all (mirrors how `month` mode requires a complete 4-digit year before setting `datePrefix`).
    - Add these as new test cases in `src/tabs/CollectionTab.test.tsx` (no existing date-filter tests exist in this file — these will be the first; place them in a new `describe('date filter modes')` block, extracting/re-exercising `collectionFindFilters` construction by rendering `CollectionTab`, opening the date mode dropdown, and asserting on the `get_collection_folders`/`get_finds` invoke mock call args, consistent with how other CollectionTab behavior is tested in this file today).
  </behavior>
  <action>
    Before implementing, invoke the `frontend-design` skill to confirm the new dropdown option and paired input read consistently with the existing Forest Codex date-filter treatment (uppercase-tracked labels, existing `DatePartsInput`/select sizing) — this is a small additive UI change (one new `<option>` + one new input variant reusing existing styling), not a new design surface, so keep the skill check lightweight and match current patterns exactly rather than introducing new visual treatment.

    1. **Extend `DatePartsInput` to support a day+month-only (no year) variant.** Add a new optional prop, e.g. `variant?: 'day-month-year' | 'month-year' | 'day-month'` (or simplest: add a second boolean `includeYear = true` alongside the existing `includeDay` prop — pick whichever reads more clearly against the current `includeDay` prop, but do not remove/rename `includeDay` since exact/range modes depend on its current default). Update `splitDateParts`, the `placeholders`/`widths` arrays, and the day/month bounds-checking logic in `updatePart` (~line 175-201) to handle the new `[dd, mm]` (no year) shape the same way the existing `[dd, mm, yyyy]` and `[mm, yyyy]` shapes are handled — day bounds check (1-31) and month bounds check (1-12) logic already exists and should apply unchanged, just against the new 2-element array.

    2. **Add `'dayMonth'` to the `dateFilterMode` union** (~line 686): `useState<'exact' | 'range' | 'month' | 'year' | 'dayMonth'>('exact')`. Add a new `dayMonthSearch` state string (mirrors `monthSearch`), its `useDeferredValue` and `useDebouncedValue` wrapping (mirrors lines 695/701), following the exact same pattern as the existing `monthSearch`/`debouncedMonthSearch` chain.

    3. **Add a new branch in the `collectionFindFilters` useMemo** (~line 706-744), after the `month` branch and before the final `else` (year) branch:
       ```typescript
       } else if (dateFilterMode === 'dayMonth') {
         const [day, month] = splitDateParts(debouncedDayMonthSearch, true).slice(0, 2);
         // reuse splitDateParts with includeDay=true parsing convention: it returns [day, month, year] shape,
         // but the dayMonth input only ever populates day/month — take first two parts.
         if (day && month && day.length <= 2 && month.length <= 2) {
           filters.dateDayMonth = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
         }
       }
       ```
       Add `debouncedDayMonthSearch` to the `useMemo` dependency array. Add `filters.dateDayMonth` to the filters type annotation at the top of the block (~line 707-715), alongside the existing `datePrefix?: string;`.

       Note: only set `filters.dateDayMonth` when BOTH day and month are present and pass basic length validation — do not rely on `DatePartsInput`'s internal bounds-check alone, since a partially-typed value (e.g. only day filled) must NOT produce a filter (matching the existing "month mode requires a complete year" gating pattern at line 735).

    4. **Update `isDateSearching`** (~line 970-974) to add: `(dateFilterMode === 'dayMonth' && dayMonthSearch.length > 0) ||`

    5. **Update `dateSearchLabel`** (~line 1039-1043) to add a `dayMonth` branch analogous to the `month` branch, using `dayMonthSearch`.

    6. **Update `clearDateSearch`** (~line 1033-1038) to also reset `dayMonthSearch`.

    7. **Add the new dropdown option and conditional input render** in the toolbar (~line 1218-1262):
       - Add `<option value="dayMonth">{t('collection.dateModeDayMonth')}</option>` after the `month` option and before `year` (keeps exact -> range -> month -> dayMonth -> year, an intuitive granularity progression).
       - Update the `onChange` handler's type cast to include `'dayMonth'`.
       - Add a new conditional render block: `{dateFilterMode === 'dayMonth' && (<DatePartsInput value={dayMonthSearch} onChange={setDayMonthSearch} /* new no-year variant prop */ ariaLabel={t('collection.dayMonthSearch')} />)}` immediately after the existing `month` block (~line 1245-1252).

    8. **Add new i18n keys** to `src/i18n/index.ts` in both the hr block (~after line 61 `collection.dateModeYear`) and en block (~after line 684 `collection.dateModeYear`):
       - hr: `'collection.dateModeDayMonth': 'Dan i mjesec'`, `'collection.dayMonthSearch': 'Pretraži po danu i mjesecu (svaka godina)'`
       - en: `'collection.dateModeDayMonth': 'Day & month'`, `'collection.dayMonthSearch': 'Search by day and month (every year)'`

    Do not modify the exact/range/month/year branches' existing behavior — this task is purely additive.
  </action>
  <verify>
    <automated>npx vitest run src/tabs/CollectionTab.test.tsx</automated>
  </verify>
  <done>Collection tab date filter dropdown offers a 5th "day+month" (Dan i mjesec / Day &amp; month) mode; entering a day and month produces `filters.dateDayMonth` in `MM-DD` format sent to the backend; incomplete input produces no date filter; clearing/switching modes resets the new field; existing exact/range/month/year modes are unaffected; new and existing tests in CollectionTab.test.tsx pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Frontend (CollectionTab) -> Rust command (get_finds/get_collection_folders) | User-typed day/month digits cross into a Tauri IPC call as `dateDayMonth` string, then into a raw SQL WHERE clause via `push_find_search_filters` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick260705wvk-01 | Tampering/Injection | `push_find_search_filters` new `date_day_month` branch | mitigate | Value is validated by `normalized_day_month` (exact `DD` digit, `-`, `DD` digit shape, length 5) before use; bound as a parameterized query value (`query_params.push`), never string-interpolated into SQL — same pattern as existing `date_start`/`date_end`/`date_prefix` handling, so no new injection surface is introduced. |
| T-quick260705wvk-02 | Denial of Service | Frontend `DatePartsInput` day/month bounds checking | accept | Existing bounds-check logic (day 1-31, month 1-12) already rejects out-of-range input at the UI layer before it reaches the backend; even if bypassed, `normalized_day_month`'s strict format check means malformed values are simply ignored (filter no-op), not an error — local single-user desktop app, no remote attacker model. |
</threat_model>

<verification>
1. `cd src-tauri && cargo test` — all Rust tests pass, including new `push_find_search_filters`/`normalized_day_month` coverage.
2. `npx tsc --noEmit -p tsconfig.json` — no new TypeScript errors.
3. `npx vitest run src/tabs/CollectionTab.test.tsx` — all tests pass, including new day+month filter tests.
4. Manual smoke check (optional, not required for automated pass): run the app, import/create two finds with the same day+month in different years (e.g. `2019-05-20` and `2024-05-20`) plus one decoy on a different day, switch date filter mode to "Dan i mjesec" / "Day & month", enter `20`/`05`, confirm only the two matching finds appear regardless of year.
</verification>

<success_criteria>
- A new "day+month" date filter mode exists in the Collection tab, discoverable via the existing date-mode dropdown, with hr/en i18n labels consistent with existing mode naming conventions.
- Selecting it and entering a day+month value returns all finds sharing that day+month across every year in the collection, via a real SQL `substr(date_found, 6) = ?` match executed in the Rust backend (not a client-side filter over a fetched dataset).
- All four existing date filter modes (exact, range, month, year) continue to work exactly as before — zero regressions.
- New Rust and Vitest tests cover the added behavior; all existing tests continue to pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260705-wvk-popravi-pretragu-po-datumu-u-kolekciji-n/260705-wvk-SUMMARY.md`
</output>
