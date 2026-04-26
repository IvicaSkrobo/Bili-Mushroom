# Map tile proxy error readout

Date: 2026-04-26

## Goal

Expose the production `fetch_tile` failure directly in the map UI so the installed GitHub/NSIS build can report why real tiles are falling back to the local atlas tiles.

## Steps

1. Emit a browser event from the tile layer whenever `fetch_tile` fails or returns an invalid payload.
2. Listen for that event in the map status control.
3. Render a visible, copyable/screenshot-friendly error line on the map.
4. Run focused frontend verification.

## Result

- `RustProxyTileLayer` now emits `bili-tile-proxy-error` with the URL, timestamp, and exact error message.
- `OnlineStatusBadge` now shows `Tile proxy error: ...` below the Online/Cached badge when that event appears.
- The full URL and timestamp are also present in the readout's tooltip/title.

## Verification

- `npm.cmd run build` passed.
- `npm.cmd test -- src/components/map/RustProxyTileLayer.test.ts src/components/map/OnlineStatusBadge.test.tsx` passed after granting Vitest permission to spawn esbuild.

