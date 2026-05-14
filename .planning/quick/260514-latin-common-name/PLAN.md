# Plan: split Latin and common mushroom names

## Goal
Replace the single mushroom name input with separate Latin/stable and common/display names, preserving existing species_name data and adding a species-level common_name field.

## Steps
- Add DB migration and backend plumbing for species_profiles.common_name.
- Extend frontend types/hooks/import/create/edit payloads to carry common_name.
- Update import, new find, edit find, and species edit UI to show Latinski naziv + Narodni naziv.
- Improve key collection/species/map/lightbox displays to show common names as secondary text where useful.
- Run focused tests and a production build.
