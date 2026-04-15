---
created: 2026-04-15T17:15:00.834Z
title: Implement dark and light color themes Forest Codex
area: ui
files: []
---

## Problem

App currently only has dark Forest Codex theme (deep moss bg + chanterelle amber). User wants a proper dark/light theme pair:

- **Dark (A):** High-contrast dark — near-black bg, golden amber cards with dark borders, gold/amber typography, dramatic forest atmosphere. Cards have rich dark backgrounds with glowing amber accents.
- **Light (B):** Warm light mode — parchment/cream bg (`~oklch(0.93 0.02 80)`), dark olive/forest-green card borders, muted gold accents, aged manuscript feel. Feels like a field journal or herbarium page.

Reference image provided at task creation (ask user to share image again when working on this).

Both themes share the same forest/nature identity — just expressed as night vs. day. Not generic dark/light toggle.

## Solution

Use `frontend-design` skill before implementing. Ask user for reference image again at task start.

- Define CSS custom properties for both themes in `src/index.css`
- Implement theme toggle (likely Zustand state + `data-theme` attribute on `<html>`)
- Map Forest Codex palette vars to light equivalents — parchment bg, dark text, muted amber accents
- Apply consistently across all components (cards, tabs, map overlays, badges, popups)
- Preserve Playfair Display + DM Sans typography in both modes
