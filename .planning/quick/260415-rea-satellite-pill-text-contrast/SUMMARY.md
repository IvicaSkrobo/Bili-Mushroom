---
quick_id: 260415-rea
slug: satellite-pill-text-contrast
status: complete
date: 2026-04-15
---

## Summary

Fixed collection pill text contrast on satellite map.

Previous fix used `#F5E6C8` (warm off-white) on amber `#D4941A` — insufficient contrast ratio, text still appeared muddy. Changed to pure white `#fff` with `text-shadow:0 1px 3px rgba(0,0,0,0.7)` for clear legibility against the amber background on dark satellite imagery.

Non-satellite layers unchanged (dark `#1C1A0C` text from CSS base).
