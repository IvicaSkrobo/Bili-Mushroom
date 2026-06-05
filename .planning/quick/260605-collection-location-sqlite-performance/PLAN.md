# PLAN - 260605-collection-location-sqlite-performance

Date: 2026-06-05
Mode: /gsd-quick

## Objective

Add collection location search and move collection filtering toward SQLite-side search/pagination while keeping the virtualized list fast.

## Scope

- `src-tauri/src/commands/import.rs`
- `src/lib/finds.ts`
- `src/hooks/useFinds.ts`
- `src/tabs/CollectionTab.tsx`
- `src/tabs/CollectionTab.test.tsx`
- `src/i18n/index.ts`

## Verification

- `npm.cmd run test -- src/tabs/CollectionTab.test.tsx`
- `npm.cmd run build`
- `cargo test`
