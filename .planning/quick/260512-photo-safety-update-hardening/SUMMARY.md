# Summary: Photo Safety + Update Hardening

Implemented a safety pass after reports of missing photos following an update:

- Per-photo delete and bulk per-photo delete now show a visible permanent-delete checkbox, defaulted on. Backend supports both permanent removal and Recycle Bin fallback when unchecked.
- Settings advanced cleanup now asks for confirmation and clearly says it only removes missing database references.
- Zone toolbar/editor default positions were reset to avoid map zoom controls and start compactly.

Follow-up: add a library health/audit view that reports missing photo references without mutating anything, so users can diagnose storage-folder/path issues before cleanup.
