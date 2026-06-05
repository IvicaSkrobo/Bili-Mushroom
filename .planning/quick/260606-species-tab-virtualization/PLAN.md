# Plan: Species tab virtualization

## Goal
Make Species tab scale better when there are many species or many finds under one species.

## Steps
- [x] Virtualize the left species list using the existing TanStack virtual pattern.
- [x] Stop auto-loading every find page for the selected species.
- [x] Add scroll-triggered pagination and virtualization for the selected species Finds tab.
- [x] Run focused tests/build.

## Result
- The left species list renders only visible rows once it grows beyond the threshold.
- Species summaries still continue loading so search can cover the full species list.
- The selected species Finds tab now renders visible rows only and fetches additional find pages as that internal list scrolls.
