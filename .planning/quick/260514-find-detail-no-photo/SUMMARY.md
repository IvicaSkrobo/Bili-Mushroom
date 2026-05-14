# Summary

## Completed
- Added find fallback support to `PhotoLightbox` so the detail panel can open without a photo.
- Routed collection find-row clicks through the detail panel for all finds, including zero-photo finds.
- Routed species recorded-find clicks through the same detail panel instead of opening edit for zero-photo finds.
- Updated generic `FindCard` click behavior so no-photo finds remain clickable when a photo/detail click handler is provided.

## Verification
- `npm.cmd run build`
