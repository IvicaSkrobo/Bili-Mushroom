# Summary

## Completed
- Guarded updater commands so dev/local builds without `TAURI_UPDATER_PUBLIC_KEY` return cleanly instead of calling unregistered updater state.
- Updated the auto bump hook script to keep `package-lock.json` and `Cargo.lock` aligned with the app version.
- Synchronized current lock files to `0.2.14`.

## Verification
- `npm.cmd run build`
