# Plan

## Objective
Improve the species/detail count UI: default to average/range fruiting body count, allow user override, keep total available as secondary info, and adjust layout/image cropping around finds/synonyms.

## Steps
1. Locate the species detail/page section shown in the screenshot and the data model for observed counts/synonyms/thumbnail.
2. Rework labels and display logic from observed count to fruiting body count average/range.
3. Add editable override UI using the existing species profile/note persistence if available, or the narrowest fitting storage path.
4. Move the count section above recorded finds, move synonyms under the thumbnail, and make thumbnails uncropped where requested.
5. Run focused tests/build.
