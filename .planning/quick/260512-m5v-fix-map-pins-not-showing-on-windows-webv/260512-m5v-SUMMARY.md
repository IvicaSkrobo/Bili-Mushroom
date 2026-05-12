---
phase: quick
plan: 260512-m5v
subsystem: map
tags: [bug-fix, webview2, leaflet, collection-pins, windows-compat]
dependency_graph:
  requires: []
  provides: [map-pins-windows-webview2-fix]
  affects: [CollectionPins, LocationPickerMap]
tech_stack:
  added: []
  patterns: [leaflet-divicon-anchor-pattern, leaflet-classname-override]
key_files:
  created: []
  modified:
    - src/components/map/CollectionPins.tsx
    - src/components/map/LocationPickerMap.tsx
    - src/index.css
key_decisions:
  - "iconAnchor [6,6] places container origin at dot center — dot stays inside container bounds on WebView2"
  - "CSS centering via translate(-50%,-50%) removed — anchor does the positioning work instead"
  - "prevLocationIcon className set to 'bili-picker-prev-icon' — empty string causes Leaflet to inject leaflet-div-icon white background styles"
metrics:
  duration: "5 minutes"
  completed: "2026-05-12T15:28:18Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase quick Plan 260512-m5v: Fix Map Pins Not Showing on Windows WebView2 Summary

Fixed WebView2-invisible collection pins by correcting Leaflet iconAnchor to [6,6] and removing CSS translate centering; fixed prevLocationIcon white background flash via explicit className.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix collectionIcon anchor and dot CSS | 9d49351 | CollectionPins.tsx, index.css |
| 2 | Fix prevLocationIcon empty className and add CSS rule | e69b476 | LocationPickerMap.tsx, index.css |

## What Was Built

**Task 1 — collectionIcon anchor correction:**

The root cause was `iconAnchor: [0, 0]` combined with CSS `transform: translate(-50%, -50%)` on the dot. This positioned the 12x12 dot at (-6, -6) relative to the container origin — entirely outside the container bounds. Mac's WKWebView renders overflowing content; Windows WebView2 clips it, making pins invisible.

Fix: `iconAnchor: [6, 6]` moves the container's reference point to pixel (6,6) — the dot center. The dot now sits at `top:0; left:0` inside the container and is fully visible. The CSS translate centering is removed (no longer needed), and the hover `scale(1.25)` no longer needs the translate prefix. The label `left` is updated from `0` to `6px` to center it on the dot coordinate.

**Task 2 — prevLocationIcon className:**

Leaflet injects default `leaflet-div-icon` styles (white background, 6x6px border-box) when `className` is empty string. Setting `className: 'bili-picker-prev-icon'` and adding the corresponding CSS rule with `background: transparent !important` prevents the white background flash in LocationPickerMap when previously-found locations are shown.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The `rawToLabelHtml` HTML-escaping that guards the DivIcon html string was already in place and is unaffected by this fix (T-m5v-01, disposition: accept).

## Self-Check: PASSED

- src/components/map/CollectionPins.tsx — iconAnchor: [6, 6] confirmed
- src/index.css — .bili-pin-dot has no translate(-50%,-50%), hover uses scale(1.25) only, .bili-pin-label left: 6px, .bili-picker-prev-icon rule present
- src/components/map/LocationPickerMap.tsx — className: 'bili-picker-prev-icon' confirmed
- Commits 9d49351 and e69b476 confirmed in git log
