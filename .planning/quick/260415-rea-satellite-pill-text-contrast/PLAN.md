---
quick_id: 260415-rea
slug: satellite-pill-text-contrast
description: Collection pin pill text unreadable on satellite — amber bg with warm off-white (#F5E6C8) has insufficient contrast; fix to white + text-shadow
date: 2026-04-15
status: in-progress
---

## Task

Collection pin pills on satellite map: text color `#F5E6C8` on `#D4941A` amber background has poor contrast ratio. Fix: use pure white `#FFFFFF` on satellite with `text-shadow` for depth.

## Files

- `src/components/map/CollectionPins.tsx` — line 23, change `color:#F5E6C8` → `color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.7)`
- `src/index.css` — `.bili-col-label` already has `color: #1C1A0C` for non-satellite (keep)

## Steps

1. Update inline color override in `collectionIcon()` from warm off-white to white + text-shadow
2. Commit
