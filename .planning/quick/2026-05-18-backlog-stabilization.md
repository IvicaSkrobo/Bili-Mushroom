# Backlog stabilization plan

Date: 2026-05-18

Scope: triage and implement reported Bili Mushroom bugs and UX fixes in phases.

## Priorities

1. P0/P1 stability and data correctness
   - Crash when clicking threat/protected status.
   - Species tab opening the wrong collection species.
   - Collection search expanding/opening all finds and searching find text instead of species only.
   - Stale species/location suggestions after deleted or renamed data.
   - Local/common names and synonyms not saving or barely visible.

2. P1 folder and rename safety
   - Species rename should rename the current folder where possible instead of creating duplicate Latin-only folders and leaving old folders empty.
   - Add "open in folder" in collection species, species detail, and edit find flows.
   - Allow editing a find into another species after later identification.

3. P2 language, naming, and formatting
   - Croatian/English labels for common/local title.
   - Import review dialog translations.
   - Remove unneeded common-name display in Species list.
   - Respect user bold markup in stats/seasonal/historical panels.
   - Date formatting as dd.mm.yy for Croatian.

4. P2 statistics improvements
   - Rename story/top widgets.
   - Add first outing/first dated entry.
   - Add field outings list grouped by date and locations.
   - Show species counts alongside find counts where useful.

5. P3 larger UX/features/performance
   - Preserve add-find form draft when leaving and returning.
   - De-emphasize example placeholders.
   - Local-only hidden autocomplete suggestions for locations; keep species cleanup based on real non-empty folders for now.
   - Add photo crop/rotate editing.
   - Investigate slowdown with larger collections.

## First implementation pass

Start with P0/P1 items that are locally testable and have low migration risk.
