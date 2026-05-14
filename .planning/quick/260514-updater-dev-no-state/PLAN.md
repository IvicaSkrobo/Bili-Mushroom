# Plan

## Objective
Prevent Tauri updater commands from panicking when the updater plugin is not registered in dev/local builds.

## Steps
1. Confirm updater plugin is gated by `TAURI_UPDATER_PUBLIC_KEY`.
2. Guard updater commands before calling `app.updater()` when the key is absent.
3. Build to verify TypeScript/Vite path still passes.
4. Report git/tag state and safe push commands.
