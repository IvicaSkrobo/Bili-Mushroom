---
phase: quick-260706-b7f
plan: 01
status: complete
---

# Summary: Default Collection tab sort to Alphabetical

## What shipped

- `src/tabs/CollectionTab.tsx`: `speciesSortMode` initial state changed from `useState<'recent' | 'alpha'>('recent')` to `useState<'recent' | 'alpha'>('alpha')`. The Recent/Alphabetical toggle UI and comparator logic are unchanged — this only flips which mode is active on tab load.
- `src/tabs/CollectionTab.test.tsx`: updated the `species sort mode` test to assert alphabetical order (`Amanita muscaria`, `Chanterelle`) as the default, then click "Recent" and assert backend order (`Chanterelle`, `Amanita muscaria`) is restored — inverse of the previous assertion, now exercising the Recent path instead of Alphabetical.

## Commits

- (pending — committed together with this summary in Step 8 of the quick workflow)

## Verification

- `npx vitest run src/tabs/CollectionTab.test.tsx` — 16/16 passed.

## Success criteria status

- [x] Opening the Collection tab shows species sorted alphabetically by default.
- [x] Recent/Alphabetical toggle still works both directions (test now covers switching back to Recent).
