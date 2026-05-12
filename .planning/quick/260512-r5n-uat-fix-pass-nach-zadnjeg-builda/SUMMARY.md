---
status: complete
---

# UAT Fix Pass — 12 UI/UX Bugs

All 12 UAT bugs fixed across 6 groups. Build passes (npm run build + cargo test --no-run).

## Changes

**Stats (4 fixes):** Added `renderBold()` helper for `**text**` markdown; reordered sections (Past Years above Top Spots); added null-date guards to all strftime queries in stats.rs; changed observed display from avg to min–max range.

**Map (1 fix):** `LocationPickerMap` now calls `saveMapViewport(lat, lng, zoom)` on confirm so map returns to last edited location.

**Lightbox / Photos (2 fixes):** Notes text contrast improved to `text-foreground/90`; clicking a find with no photos now opens `EditFindDialog` instead of doing nothing.

**Species tab (3 fixes):** Removed add-tag input/button; reordered right column (Field Journal first); added useEffect to clear body overflow lock on modal close.

**Import dialog (1 fix):** Added `min-w-0` to species editor and `flex-shrink-0` to map-pin button in both `ImportDialog.tsx` and `CreateFindDialog.tsx`.

**Translations (1 fix):** `edibility.edible` → "jestiva"; `edibility.inedible` → "nejestiva" in `src/i18n/index.ts`.
