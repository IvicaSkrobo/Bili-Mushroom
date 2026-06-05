# Lightbox header overlap fix

## Goal

Fix the photo lightbox metadata header where long species names overlap the inline delete confirmation/actions.

## Scope

- Keep the Forest Codex lightbox styling.
- Change only the header layout in `PhotoLightbox.tsx`.
- Ensure long names wrap inside the left column and actions stay readable on the right.

## Verification

- Run TypeScript/build after the scoped UI change.
