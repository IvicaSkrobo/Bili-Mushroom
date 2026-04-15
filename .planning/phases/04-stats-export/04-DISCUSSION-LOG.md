# Phase 4: Stats & Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 04-stats-export
**Areas discussed:** Stats layout, Export scope, Seasonal calendar, Per-species stats

---

## Roadmap Change (pre-discussion)

Before discussing Phase 4, the user restructured the roadmap:
- Old Phase 4 (Species Database) → backlog Phase 999.1
- Old Phase 5 (Search, Browse & Wishlist) → backlog Phase 999.2
- Old Phase 6 (Stats & Export) → promoted to new Phase 4
- SpeciesTab and BrowseTab removed from nav (commit 781fdcf)

## Stats Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Stat cards + simple list | 4-6 number cards + ranked lists, no charts | ✓ |
| Stat cards + bar charts | Same cards with visual bar charts | |
| You decide | Claude picks | |

**Metrics selected:** Total finds + unique species, Total locations visited, Top spots by find count, Best months by find count

**Notes:** No charts in v1. Simple and readable.

---

## Export Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Photos + metadata per find | Each find: photo(s), name, date, location, notes | You decide (Claude picks) |
| Text-only summary | No photos, table format | |
| You decide | Claude picks | ✓ |

**CSV:** Yes, include in v1

**Notes:** PDF layout delegated to Claude — aim for forager journal feel. CSV is flat, full collection.

---

## Seasonal Calendar

| Option | Description | Selected |
|--------|-------------|----------|
| Your own find dates only | Built from personal finds, no external data | ✓ |
| General season info | "Chanterelles peak July-Sept" from curated data | |
| Both | Personal + general overlay | |

**Display:**

| Option | Description | Selected |
|--------|-------------|----------|
| Monthly grid with species dots | 12-month grid, dots per month, click to expand | ✓ |
| Species list with month bars | Gantt-style, one row per species | |
| You decide | Claude picks | |

---

## Per-Species Stats

**Location:**

| Option | Description | Selected |
|--------|-------------|----------|
| Section within StatsTab | Ranked list in StatsTab, expandable rows | ✓ |
| Accessible from CollectionTab too | Cross-tab navigation | |
| You decide | Claude picks | |

**Stats per species selected:** Total find count, All locations found, Date of first find, Best month for this species

---

## Deferred Ideas

- Year-end Forager Wrapped — user's idea for a year-end album + stats combination ("something cool")
- Filtered export (by species/date/location)
- Charts/visualizations
- General species season overlay on calendar (requires Species DB backlog)
