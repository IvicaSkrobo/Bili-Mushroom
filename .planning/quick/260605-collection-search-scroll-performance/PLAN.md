# PLAN - 260605-collection-search-scroll-performance

Date: 2026-06-05
Mode: /gsd-quick

## Objective

Reduce lag while searching and scrolling the collection, especially while entering date filters.

## Scope

- `src/tabs/CollectionTab.tsx`
- `src/tabs/CollectionTab.test.tsx`

## Verification

- `npm.cmd run test -- src/tabs/CollectionTab.test.tsx`
- `npm.cmd run build`
