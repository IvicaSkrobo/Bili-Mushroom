---
phase: 3
slug: map
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
updated: 2026-04-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend), cargo test (Rust) |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` (JS) + `cd src-tauri && cargo test` (Rust) |
| **Estimated runtime** | ~20 seconds (JS) + ~30 seconds (Rust) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (JS tasks) or `cd src-tauri && cargo test` (Rust tasks)
- **After every plan wave:** Run both `npm run test -- --run` and `cd src-tauri && cargo test`
- **Before `/gsd-verify-work`:** Full suite must be green (both JS and Rust)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 3-01-T1 | 01 | 1 | MAP-03 | unit (Rust) | `cd src-tauri && cargo test tile_cache_db` | pending |
| 3-01-T2 | 01 | 1 | MAP-03 | unit (Rust) | `cd src-tauri && cargo test tile_proxy && cargo build` | pending |
| 3-02-T1 | 02 | 1 | MAP-05 | unit | `npm run test -- --run` | pending |
| 3-02-T2 | 02 | 1 | MAP-05 | unit | `npm run test -- --run src/components/map/RustProxyTileLayer.test.ts` | pending |
| 3-02-T3 | 02 | 1 | MAP-05 | unit | `npm run test -- --run src/components/map/FindsMap.test.tsx src/tabs/MapTab.test.tsx` | pending |
| 3-03-T1 | 03 | 2 | MAP-01, MAP-05 | unit | `npm run test -- --run src/components/map/groupFindsByCoords.test.ts src/components/map/FitBoundsControl.test.tsx` | pending |
| 3-03-T2 | 03 | 2 | MAP-01, MAP-04 | unit | `npm run test -- --run src/components/map/FindPopup.test.tsx src/components/map/FindPins.test.tsx` | pending |
| 3-03-T3 | 03 | 2 | MAP-01 | unit | `npm run test -- --run src/tabs/CollectionTab.test.tsx` | pending |
| 3-03-T4 | 03 | 2 | MAP-02, MAP-05 | unit | `npm run test -- --run src/components/map/ && npm run test -- --run` | pending |
| 3-04-T1 | 04 | 2 | MAP-06 | unit | `npm run test -- --run src/components/map/LocationPickerMap.test.tsx && npm run test -- --run` | pending |
| 3-04-T2 | 04 | 2 | MAP-06 | integration | `npm run test -- --run` | pending |
| 3-04-T3 | 04 | 2 | MAP-06 | unit | `npm run test -- --run src/lib/tileCache.test.ts src/components/dialogs/SettingsDialog.test.tsx && npm run test -- --run` | pending |

*Status: pending | green | red | flaky*

---

## Wave 0 Requirements

Plan 01 Task 1 and Plan 02 Task 1 serve as Wave 0 — they create:

- [x] Cargo deps: `reqwest`, `base64`, `sha2` in `src-tauri/Cargo.toml`
- [x] Migration `0006_tile_cache.sql` + registration in `import.rs`
- [x] `src-tauri/src/commands/tile_cache_db.rs` — LRU helpers
- [x] `src/test/setup.ts` — `ResizeObserver` stub for react-leaflet in jsdom
- [x] `src/test/tauri-mocks.ts` — `fetch_tile`, `get_tile_cache_stats`, `clear_tile_cache`, `set_cache_max`, `get_cache_max_bytes` handlers
- [x] `src/components/map/leafletIconFix.ts` — Vite icon path fix
- [x] `src/index.css` — Leaflet Forest Codex overrides
- [x] `src-tauri/tauri.conf.json` — CSP tightened (no external tile hosts in img-src)

All Wave 0 scaffolding is embedded within Plan 01 and Plan 02 tasks. No standalone Wave 0 plan needed.

---

## Test Files Created Per Plan

| Plan | Test Files |
|------|-----------|
| 01 | `src-tauri/src/commands/tile_cache_db.rs` (#[cfg(test)]), `src-tauri/src/commands/tile_proxy.rs` (#[cfg(test)]) |
| 02 | `src/components/map/RustProxyTileLayer.test.ts`, `src/components/map/FindsMap.test.tsx`, `src/tabs/MapTab.test.tsx` |
| 03 | `src/components/map/groupFindsByCoords.test.ts`, `src/components/map/FitBoundsControl.test.tsx`, `src/components/map/FindPopup.test.tsx`, `src/components/map/FindPins.test.tsx`, `src/tabs/CollectionTab.test.tsx`, `src/components/map/LayerSwitcher.test.tsx`, `src/components/map/OnlineStatusBadge.test.tsx` |
| 04 | `src/components/map/LocationPickerMap.test.tsx`, `src/lib/tileCache.test.ts`, `src/components/dialogs/SettingsDialog.test.tsx` |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offline tile caching persists after internet disconnect | MAP-03 | Requires real network toggle and Tauri WebView | 1) Browse map area, 2) Disconnect internet, 3) Reopen app, 4) Verify tiles still display |
| Satellite/OSM layer switch persists pins | MAP-02 | Visual layer verification needs real Tauri WebView | Switch layers, verify pins remain visible on both |
| Map auto-zooms to fit all pins outside Croatia | MAP-05 | Requires real DB data with non-Croatia coordinates | Add find with coordinates outside Balkans region, open map, verify autozoom |
| Pin popup Level 2 thumbnail loads via asset protocol | MAP-04 | Asset protocol requires real Tauri runtime | Click pin, expand to Level 2, verify photo thumbnail renders |
| Location picker full-screen dialog UX | MAP-06 | Full-screen dialog behavior + map interaction | Open EditFindDialog, click Pick on map, verify modal, click map, drag pin, confirm |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 scaffolding covered within Plans 01 and 02
- [x] No watch-mode flags in any verify command
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
