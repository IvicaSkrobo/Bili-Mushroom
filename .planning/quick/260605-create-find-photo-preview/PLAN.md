# PLAN - 260605-create-find-photo-preview

Mode: /gsd-quick

## Goal
Allow manual find entry to attach photos, preview selected images, and open them with zoom before saving.

## Scope
- Update CreateFindDialog photo picker/preview UX.
- Reuse existing add_find_photos command after create_find succeeds.
- Keep selected-source previews local to the dialog and avoid changing collection lightbox behavior.

## Verification
- Targeted TypeScript/build or focused tests where practical.
