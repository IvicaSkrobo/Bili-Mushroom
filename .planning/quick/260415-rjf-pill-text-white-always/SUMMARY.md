---
quick_id: 260415-rjf
slug: pill-text-white-always
status: complete
date: 2026-04-15
---

## Summary

Pill text now always white. Removed `isSatellite` store read + `colorOverride` inline style — per-layer JS override was brittle (relied on store update timing). CSS base `.bili-col-label` now `color:#fff` + `text-shadow:0 1px 3px rgba(0,0,0,0.7)` — works on all layers.
