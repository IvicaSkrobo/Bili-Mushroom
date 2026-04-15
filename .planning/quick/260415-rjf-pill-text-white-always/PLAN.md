---
quick_id: 260415-rjf
slug: pill-text-white-always
description: Pill text always white — remove per-layer conditional, set color:#fff in CSS base
date: 2026-04-15
status: complete
---

## Task

Collection pin pill label text unreadable on satellite. Prior fix used per-layer JS override (`isSatellite` → inline color) — brittle. Fix: white text + text-shadow in CSS base, remove conditional.

## Files

- `src/index.css` — `.bili-col-label`: `#1C1A0C` → `#fff` + `text-shadow`
- `src/components/map/CollectionPins.tsx` — remove `isSatellite`, `colorOverride`, unused param
