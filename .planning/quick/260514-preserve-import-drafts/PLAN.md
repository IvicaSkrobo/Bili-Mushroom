# Plan

## Objective
Preserve import/create dialog draft state when the user closes by clicking outside or navigates to other app tabs. Clear drafts only on explicit cancel or successful save/import.

## Steps
1. Inspect ImportDialog/CreateFindDialog open-state and reset behavior.
2. Split dismiss/close from explicit cancel/reset actions.
3. Ensure successful save/import clears draft and explicit cancel clears draft.
4. Build/test focused paths.
