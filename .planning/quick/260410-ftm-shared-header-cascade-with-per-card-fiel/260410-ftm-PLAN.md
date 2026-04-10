---
quick_id: 260410-ftm
description: "Shared header cascade with per-card field lock in ImportDialog"
status: pending
created: 2026-04-10
---

# Quick Task 260410-ftm: Shared Header Cascade + Per-Card Field Lock

## Scope

Expand the shared header in ImportDialog to include date, country, region, location_note fields
that cascade to all cards. When a user edits one of those fields directly on a card, that field
gets auto-locked so shared changes no longer override it. A small "Allow override" unlock button
appears next to locked fields.

---

## Task 1: Update PendingItem type and cascade logic in ImportDialog

**Files:** `src/components/import/ImportDialog.tsx`

**Changes:**
1. Add `locked: Partial<Record<'date_found'|'country'|'region'|'location_note', boolean>>` to `PendingItem`
2. Add shared state: `sharedDate`, `sharedCountry`, `sharedRegion`, `sharedLocationNote`
3. `buildInitialPayload` stays unchanged
4. Cascade effects: each shared field change cascades to cards where `!item.locked[field]`
5. `handleSharedMapConfirm`: set `sharedCountry`/`sharedRegion` from geocode result AND cascade to unlocked cards (replace the current direct-cascade-to-payload approach with shared state)
6. Shared header UI: add date, country, region, location_note inputs in a 2-column grid below name+map row
7. `updateAt` updated to accept an optional `lockField` param — when provided, sets `locked[lockField]=true` for that card

---

## Task 2: Per-card lock indicators in FindPreviewCard

**Files:** `src/components/import/FindPreviewCard.tsx`

**Changes:**
1. Add props: `locked: Partial<Record<'date_found'|'country'|'region'|'location_note', boolean>>`, `onUnlock: (field: string) => void`
2. For date_found, country, region, location_note fields: when `locked[field]` is true, show a small
   unlock icon button (Unlock from lucide-react) inline with the field label/input
3. When user types in date/country/region/location_note on the card, call `onChange` with updated payload
   AND signal to parent to lock that field — do this via a separate `onFieldEdit(field)` callback prop
4. Remove the per-card country/region/location_note inputs from the 2-col grid since they're now in shared header
   — NO, keep them on each card for per-card overrides, but show the lock state

**Design:** Each lockable field row shows a small `[🔓 Allow override]` button when locked.
Clicking it calls `onUnlock(field)`.
