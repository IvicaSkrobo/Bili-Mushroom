---
phase: quick-260706-k2m
plan: 01
status: complete
---

# Summary: Collection tab toolbar — collapse filters into a popover, pin Import CTA

## What shipped

- `src/components/ui/popover.tsx` (new): `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` wrapping `radix-ui`'s `Popover` primitive, styled to match existing `dialog.tsx` conventions (`bg-popover`, `border-border`, `shadow-lg`, radix animate-in/out data-state classes).
- `src/tabs/CollectionTab.tsx`:
  - Toolbar outer container gained `flex-wrap gap-y-2` as an overflow safety net.
  - Location search input and the full date-filter control group (mode select + day/month/year inputs + clear button) moved into a `PopoverContent`, triggered by a new "Filters" button (`SlidersHorizontal` icon). The trigger switches to `secondary`/highlighted styling and shows a small `bg-primary` dot when `isLocationSearching || isDateSearching` is true, so active filters stay visible even when collapsed.
  - "New find" and "Import photos" buttons wrapped in a `ml-auto flex-shrink-0` trailing group so they always sit at the right edge and are the last thing to lose space — if the row ever still overflows at very narrow widths, it wraps instead of clipping.
  - Select/Favorites buttons left as-is (already reasonably compact; the popover collapse freed up most of the width).
- `src/i18n/index.ts`: added `collection.filtersButton` ("Filteri"/"Filters") and `collection.filtersActive` ("Filteri (aktivno)"/"Filters (active)") to both hr and en dictionaries.
- `src/tabs/CollectionTab.test.tsx`: the 3 tests in `describe('date filter modes', ...)` now click the new "Filters" button (`fireEvent.click(await screen.findByRole('button', { name: 'Filters' }))`) before asserting on `getByLabelText('Date search mode')` / `getByPlaceholderText('dd'|'mm'|'yyyy')`, since those controls now live inside a closed-by-default popover.

## Commits

- (pending — committed together with this summary)

## Verification

- `npx vitest run src/tabs/CollectionTab.test.tsx` — 16/16 passed.
- `npx tsc --noEmit` — clean.
- `npx vitest run` (full suite) — 5 pre-existing unrelated failures confirmed via `git stash` to exist on `main` before this change (date-formatting issues in `FindCard.test.tsx` / `BulkMetadataBar.test.tsx` and others, unrelated to Collection tab); flagged as a separate follow-up task, not introduced by this change.
- Manual visual check pending: user to confirm in the running Tauri app that Import photos button is never clipped and the Filters popover works.

## Success criteria status

- [x] Import photos button is no longer at risk of clipping at normal widths (popover collapse removes ~350px of always-visible width; ml-auto pins the CTA group; flex-wrap is the last-resort safety net).
- [x] Location search + date filter fully functional inside the new popover, with a visible active-state indicator when collapsed.
- [x] New find / Import pinned together at the right edge.
- [~] Manual visual confirmation in the running app — pending user check.
