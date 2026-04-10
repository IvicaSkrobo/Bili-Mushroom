# Quick Task 260410-ftm: Shared Header Cascade + Per-Card Field Lock — Summary

**Completed:** 2026-04-10
**Commit:** 7f0ac0f

## What was done

### Shared header expansion
- Date, Country, Region, Location Mark fields added to the shared header (2-col grid below name+map row)
- Each field cascades to all cards that are not individually locked

### Reverse geocode → shared state
- Shared map pin confirmation now sets `sharedCountry`/`sharedRegion` state
- Those state changes then cascade via useEffects to unlocked cards
- (Previously cascaded directly to card payloads — now goes through shared state first)

### Per-card field lock
- `PendingItem` gained `locked: Partial<Record<LockableField, boolean>>`
- When user edits date/country/region/location_note directly on a card, that field is auto-locked
- Locked fields show an amber border so the user can see which fields are individually overridden
- An unlock (🔓) icon button appears on locked fields — clicking it removes the lock, allowing the next shared cascade to override

### Tests updated
- `FindPreviewCard.test.tsx`: added `location_note` to `basePayload`, added `locked={{}}` and `onUnlock` mock to all renders
