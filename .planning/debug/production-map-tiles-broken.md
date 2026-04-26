# Production map tiles broken

Date: 2026-04-26

## Problem

Packaged production builds show Leaflet's gray grid and broken tile images on the map tab, while `tauri dev` renders map tiles correctly.

## Initial read

- `FindsMap` mounts `LayerSwitcher`, which creates base layers through `createRustProxyTileLayer`.
- The custom grid layer fetches each tile through the Rust `fetch_tile` command, then falls back to assigning the remote tile URL directly if the proxy fails.
- Production has a stricter CSP than the dev server, so any direct remote fallback must be treated as unreliable in packaged builds.

## Plan

1. Rework the tile layer so the Rust proxy path is authoritative inside Tauri and the browser fallback is only used outside Tauri/test contexts.
2. Make Leaflet tile completion happen after the image data has actually loaded or errored, not immediately after setting `src`.
3. Cover proxy success, proxy failure, and browser fallback behavior with focused tests.
4. Run build/test verification.

## Result

- Updated `src/components/map/RustProxyTileLayer.ts` so Tauri production no longer depends on direct browser image fallback after proxy failure.
- Added a local generated SVG atlas tile fallback for packaged Tauri runtime failures, avoiding broken tile icons and preserving map panning/markers when network/proxy tile fetches fail.
- Changed tile completion to wait for `load`/`error` events.
- Expanded `src/components/map/RustProxyTileLayer.test.ts` for proxied load completion, non-Tauri direct fallback, Tauri local fallback, and deterministic fallback tile generation.

## Verification

- `npm.cmd run build` passed.
- `npm.cmd test -- src/components/map/RustProxyTileLayer.test.ts` passed after granting permission for Vitest/esbuild process spawning.
- `npm.cmd run tauri -- build` could not run in this environment because `cargo` was not found on PATH.

