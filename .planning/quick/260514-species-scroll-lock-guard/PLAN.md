# Plan

## Objective
Reduce risk of Species tab becoming non-scrollable after dialogs/overlays close.

## Steps
1. Inspect Species tab modal/open states and existing body scroll-lock cleanup.
2. Add defensive cleanup for Radix/Tauri leftover body lock styles/attributes after Species overlays close and on unmount.
3. Keep cleanup scoped to cases where no app dialog remains open.
4. Build verification.
