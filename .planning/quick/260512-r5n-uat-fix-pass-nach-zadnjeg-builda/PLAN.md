---
slug: uat-fix-pass-nach-zadnjeg-builda
created: 2026-05-12
status: planned
---

# UAT Fix Pass — 12 UI/UX Bugs

## Goal

Fix 12 confirmed UAT regressions across stats rendering, map viewport persistence, lightbox UX, species tab layout, import dialog layout, and Croatian edibility translations.

---

## Tasks

### Task 1 — Stats: bold asterisks + section order + null-date crash
**Files:** `src/tabs/StatsTab.tsx`, `src-tauri/src/commands/stats.rs`

**Changes:**

**Bold asterisks (StatsTab.tsx):**
The `HistoricalComparison` component or any stat text that contains `**text**` is being rendered as a plain string, not parsed as markdown. Audit all places in `StatsTab.tsx` and child components where markdown-style bold (`**...**`) is produced or displayed. Replace with a tiny inline renderer — a helper that splits on `**`, alternates plain/bold spans:

```typescript
function renderBold(text: string): React.ReactNode {
  const parts = text.split('**');
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
  );
}
```

Apply this helper wherever strings containing `**...**` are rendered (look for `{insight.body}`, `{speciesSpotHint}`, and anything from `buildSeasonalityInsights` / `buildSpeciesSpotHint` / `buildHistoricalComparison`).

**Section order (StatsTab.tsx):**
Move "This Time in Past Years" (`historicalComparison`) block ABOVE "Top Spots" (`RankedList` flex row). In the current JSX at line ~218, the ranked lists come before the historical comparison at line ~261. Swap so the order from top is:
1. Stat cards grid
2. Divider
3. Historical comparison ("This Time in Past Years")
4. Divider
5. Top Spots + Best Months (flex row)
6. Seasonal Insights
7. Hint reminder
8. Divider
9. SeasonalCalendar
10. Divider
11. Per-species

**Null date crash (stats.rs):**
The SQL queries for `get_best_months`, `get_calendar`, and `get_species_stats` (first aggregate query + best_month sub-query) all call `strftime('%m', date_found)` and `strftime('%Y-%m', date_found)`. When `date_found` is NULL, `strftime` returns NULL, and `CAST(NULL AS INTEGER)` maps to rusqlite NULL — which fails the `row.get::<_, i64>(0)?` coercion or produces a 0 that becomes month=0 (invalid).

Fix by adding `AND date_found IS NOT NULL AND date_found != ''` to every query that filters by or selects from `date_found`. Specifically:

- `get_best_months`: add `AND date_found IS NOT NULL AND date_found != ''` to the WHERE clause
- `get_calendar`: same
- `get_species_stats` first query (MIN aggregate for `first_find`): add the same filter so `first_find` is never an empty/null string that crashes downstream display
- `get_species_stats` best_month sub-query: add filter
- `get_stats_cards` `most_active_month` query: already uses `.ok()` so it won't crash, but add filter for correctness

**Verify:** `cargo test --no-run` (compile check); then run `cargo test` — existing tests should still pass. No new tests required (null-date path is a data-invariant guard, existing test helpers always provide dates).

---

### Task 2 — Stats: observed range display in SpeciesStatRow
**Files:** `src/components/stats/SpeciesStatRow.tsx`

**Changes:**

The `formatObserved` function at line 12 already computes `rangeStr` correctly (shows `${min}–${max}` when min ≠ max). However the UAT bug says it shows "avg count" instead of the range. The issue is that `observed_avg` is being shown when `observed_min` / `observed_max` are null (because Rust returns `observed_avg` from the AVG aggregate even when MIN/MAX are null).

The fix: Show ONLY the range (`observed_min–observed_max`). Do not show avg at all — it adds noise without value. Update `formatObserved` to:

```typescript
function formatObserved(min: number | null, max: number | null): string {
  if (min == null && max == null) return '--';
  if (min === max || max == null) return String(min ?? max!);
  return `${min}–${max}`;
}
```

Remove the `avg` parameter from the call site at line 110. Update the call:
```typescript
{formatObserved(stat.observed_min, stat.observed_max)}
```

The label above already says "Observed" — no need for a unit suffix here. The unit "kom" (pieces) is Croatian informal; this component is purely numeric, leave units out (the ImportDialog/EditFind already provides context). If the product later requires a unit suffix, it goes in the `<span>` outside this helper.

**Verify:** `npm run build` (TypeScript compile check).

---

### Task 3 — Map: viewport persistence after find edit/create
**Files:** `src/stores/appStore.ts`, `src/components/map/FindsMap.tsx`

**Analysis:**
`saveMapViewport` / `loadMapViewport` already exist in `appStore.ts` (lines 82–96). `MapViewportSaver` in `FindsMap.tsx` already saves on `moveend`. The `MapContainer` at line 183–187 already restores from `initialViewport.current`.

The actual bug: After editing/creating a find with a location in `EditFindDialog` / `CreateFindDialog` / `ImportDialog`, the user is redirected or the map tab opens fresh. The `initialViewport` ref is computed once on component mount — so if the `FindsMap` is unmounted and remounted (e.g. tab switch), `loadMapViewport()` is re-called. This should work already. 

The real issue is likely that `LocationPickerMap` itself doesn't call `saveMapViewport` when the user confirms a location. So the user moves the map inside `LocationPickerMap`, picks a location, but that viewport change is never persisted — the next time they open the map tab, it still shows the old position, not the location they just picked.

**Fix in `appStore.ts`:** No changes needed — `saveMapViewport` is already exported.

**Fix in `FindsMap.tsx`:** The `MapViewportSaver` component already saves on every `moveend`. The fix is to also save the viewport when the `LocationPickerMap` `onConfirm` fires. However `LocationPickerMap` is used in multiple places. The cleanest fix is: in `LocationPickerMap`, call `saveMapViewport(lat, lng, currentZoom)` just before calling `onConfirm`. 

Read `src/components/map/LocationPickerMap.tsx` to find where `onConfirm` is invoked and insert:
```typescript
import { saveMapViewport } from '@/stores/appStore';
// inside the confirm handler, before calling props.onConfirm:
saveMapViewport(confirmedLat, confirmedLng, map.getZoom());
```

**Files to modify:** `src/components/map/LocationPickerMap.tsx` (read it first, then insert the `saveMapViewport` call in the confirm handler).

**Verify:** `npm run build`.

---

### Task 4 — Lightbox: notes contrast + finds without photos click
**Files:** `src/components/finds/PhotoLightbox.tsx`, `src/tabs/CollectionTab.tsx`

**Changes:**

**Notes contrast (PhotoLightbox.tsx):**
At line 372, notes are rendered with `text-foreground/75`. On a dark `bg-card/80` panel this can be low-contrast. Change to `text-foreground/90` for better readability. Also the notes label at line 368 uses `text-muted-foreground/50` — bump to `text-muted-foreground/70` to match other section labels in the same panel.

The notes already show (lines 367–376) when `find.notes` is truthy. No structural change needed there.

**Finds without photos — open detail panel instead of nothing (CollectionTab.tsx):**
In `CollectionTab.tsx`, the find header row click handler at line 616:
```typescript
onClick={() => selectMode ? toggleSelect(f.id) : (!autoExpand && toggleFindExpand(f.id))}
```
When `autoExpand` is true (find has 0 or 1 photo) and `selectMode` is false, clicking does nothing useful. For finds with 0 photos, `autoExpand` is true, the expanded state shows `isExpanded && f.photos.length > 0` — so the photo grid never renders. The row click does nothing.

Fix: When a find has 0 photos and the user clicks the row (not in selectMode), open `EditFindDialog` for that find (same as clicking the edit pencil). This gives the user access to the find's details.

Change the click handler on the find header row:
```typescript
onClick={() => {
  if (selectMode) {
    toggleSelect(f.id);
  } else if (f.photos.length === 0) {
    setEditing(f);
  } else if (!autoExpand) {
    toggleFindExpand(f.id);
  }
}}
```

**Verify:** `npm run build`.

---

### Task 5 — SpeciesTab: remove add tag UI, fix section order, fix scroll lock
**Files:** `src/tabs/SpeciesTab.tsx`

**Changes:**

**Remove "Add tag" UI:**
In `SpeciesTab.tsx`, the entire tags section (lines 788–830) contains:
- A "Tags" heading with saving indicator
- The existing tags list with remove buttons
- The `<input>` + "Add tag" button

Remove only the input row and the "Add tag" button (lines 813–829). Keep the existing tags display (lines 795–812) so users can still see and remove tags they previously added. The `tagInput` state and `handleAddTag` function can be removed too (nothing calls them after). Remove:
- `const [tagInput, setTagInput] = useState('');` (line 354)
- `handleAddTag` function (lines 441–458)
- The `<div className="flex gap-2">` add-tag input row (lines 813–829)

**Section order:**
The UAT bug says "Finds/Terenski dnevnik" and "Browsing" sections should appear ABOVE the main content. Looking at the current layout, the main content area starts at line 612 with a two-column grid: left = hero photo card, right = stats + field journal + when-to-look cards + finds list. 

The "Terenski dnevnik" (`species.fieldJournal`) card is already inside the right column. The requirement to move it above likely means: show the field journal card and the finds list card BEFORE the stat cards grid and the when-to-look / best-spot / year-over-year cards. Reorder the right column children so:
1. Field journal card (currently at lines 727–842)
2. Finds list card (currently at lines 940–1005)  
3. Stat cards grid (lines 682–725)
4. When to look + best spot cards (lines 844–872)
5. Dates found + year over year cards (lines 874–937)

**Scroll lock after modal close:**
When the cover picker `Dialog` (line 1013) opens and closes, Radix UI sets `document.body` `overflow: hidden` and sometimes fails to restore it (known issue with Tauri WebView). Fix by adding a `useEffect` that restores scroll on dialog close:

```typescript
useEffect(() => {
  if (!coverPickerOpen) {
    // Radix Dialog sometimes leaves overflow:hidden on body after close in Tauri WebView
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
}, [coverPickerOpen]);
```

Add this effect near the other `useEffect` calls at the top of the component.

**Verify:** `npm run build`.

---

### Task 6 — Import/Create dialog: pick-on-map overflow + translations
**Files:** `src/components/import/ImportDialog.tsx`, `src/components/finds/CreateFindDialog.tsx`, `src/i18n/index.ts`

**Changes:**

**Pick on map overflow (ImportDialog.tsx):**
At lines 423–456, the species name + map pin row uses `flex items-end gap-2`. When the species name is long, `SpeciesNameEditor` (which is `flex-1`) expands but the map pin button column at the right has no `flex-shrink-0` / `min-width` protection. The coord label `whitespace-nowrap` below the pin already handles that, but the outer container can let `flex-1` crush or overflow.

Fix: ensure the map pin button container doesn't shrink and the species editor doesn't overflow. Change the pin container div from:
```tsx
<div className="flex flex-col items-center gap-0.5 pb-0.5">
```
to:
```tsx
<div className="flex flex-col items-center gap-0.5 pb-0.5 flex-shrink-0">
```

Also add `min-w-0` to the species editor wrapper `<div className="relative flex-1">` → `<div className="relative flex-1 min-w-0">`.

Apply the same pattern in `CreateFindDialog.tsx` at lines 187–218 (same structure: `<div className="flex items-end gap-2">` containing a `flex-1` editor and a pin button div). Add `flex-shrink-0` to the pin container div and `min-w-0` to the editor wrapper.

**Translations (i18n/index.ts):**
Change two HR strings:
- Line 245: `'edibility.edible': 'Može se jesti'` → `'jestiva'`  
  (Lowercase, adjective form used standalone in badges)
- Line 249: `'edibility.inedible': 'Nije za jelo'` → `'nejestiva'`

These strings feed the edibility badges in `SpeciesMetadataBadges` and the status dropdowns. Only the `hr` dict needs changing — the `en` strings (`'Edible'`, `'Inedible'`) are correct.

**Verify:** `npm run build` (covers all three files in one pass).

---

## Execution order

Run tasks in order 1 → 2 → 3 (needs LocationPickerMap read) → 4 → 5 → 6. Each task ends with its stated verify command. A final full `npm run build && cargo test --no-run` after task 6 confirms no cross-file regressions.

## Notes on task 3

Task 3 requires reading `src/components/map/LocationPickerMap.tsx` before editing — that file was not listed in the investigation set. Read it first to find the confirm handler, then apply the `saveMapViewport` call. If `LocationPickerMap` already has access to the map zoom level via a `useMap()` hook or state, use it. If not, store the last zoom from `moveend` in a ref inside `LocationPickerMap` and pass it to `saveMapViewport` on confirm.
