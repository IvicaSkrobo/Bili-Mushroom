# Plan: PDF export code split

## Goal
Keep heavy React-PDF code out of the regular Stats/export orchestrator chunk until the user actually exports, and avoid loading fallback renderer unless worker rendering fails.

## Steps
- [x] Split PDF data types/constants into a renderer-free module.
- [x] Update ExportDocument, worker, and export orchestrator imports.
- [x] Make main-thread fallback dynamically import React-PDF and document components.
- [x] Run focused tests/build.

## Result
- `exportPdf` production chunk dropped from about 1.49 MB to about 8.65 KB.
- React-PDF remains isolated in the PDF worker and a fallback-only dynamic chunk.
- Normal startup, collection, species, map, and stats browsing no longer pull the main-thread PDF renderer path.
