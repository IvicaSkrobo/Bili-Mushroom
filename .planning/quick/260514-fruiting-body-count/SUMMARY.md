# Summary

## Outcome
- Replaced the species detail metric with editable `Broj plodnih tijela` / `Fruiting body count`.
- Default display is the average range per find, e.g. `324-344`; users can overwrite it per species.
- Added an optional total-range reveal for users who want the summed count.
- Persisted the override in `species_profiles.fruiting_body_count_override` via migration `0019`.
- Moved the metric section above recorded finds.
- Moved synonyms/local names under the species thumbnail card.
- Switched species thumbnails in the sidebar, species hero, find rows, and cover picker to uncropped `object-contain`.
- Renamed observed-count labels to fruiting-body terminology across import/edit/preview/species/stat surfaces.

## Verification
- `npm.cmd run build` passed.
- `cargo check` passed.
