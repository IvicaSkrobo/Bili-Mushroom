---
quick_id: 260415-qf3
slug: collection-pin-badge-latin-name-bg
description: "Collection pin: show amber badge, Latin name only, amber label background"
date: 2026-04-15
status: planned
---

# Quick Task 260415-qf3

Fix collection pin rendering:
1. Badge amber background not showing — replace oklch() with hex + fix centering (text-align not flex)
2. Label shows full species_name (includes Croatian) — extract Latin part before comma
3. Label amber background not showing — same oklch fix

## Files
- src/components/map/CollectionPins.tsx

## Commit
`fix(quick-260415-qf3): collection pin amber badge+label bg, Latin name only`
