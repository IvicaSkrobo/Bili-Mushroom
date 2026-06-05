# PLAN - 260605-collection-list-virtualization

Date: 2026-06-05
Mode: /gsd-quick

## Objective

Virtualize the collection species folder list so scrolling and broad searches render only visible rows.

## Scope

- `package.json`
- `package-lock.json`
- `src/tabs/CollectionTab.tsx`
- `src/tabs/CollectionTab.test.tsx`

## Verification

- `npm.cmd run test -- src/tabs/CollectionTab.test.tsx`
- `npm.cmd run build`
