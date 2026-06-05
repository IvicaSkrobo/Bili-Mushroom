# PLAN - 260605-lightbox-rotation-smooth-save

Mode: /gsd-debug

## Goal
Fix laggy photo rotation preview and make saved rotation match the preview consistently.

## Scope
- Keep PhotoLightbox rotation preview lightweight with a single composited transform.
- Move Rust image editing work off the async command path.
- Normalize source EXIF orientation before applying user rotation/crop so saved pixels match the browser preview.

## Verification
- Frontend build.
- Rust cargo test/build for command compilation where practical.
