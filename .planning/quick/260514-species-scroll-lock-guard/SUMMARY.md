# Summary

## Completed
- Added a defensive cleanup in Species tab for stale Radix/Tauri modal locks.
- Cleanup clears body `overflow`, `paddingRight`, `pointerEvents`, and `data-scroll-locked`.
- Cleanup runs only after Species overlays close and no app dialog/alert-dialog content remains open.
- Cleanup also runs when Species tab unmounts.

## Verification
- `npm.cmd run build`
