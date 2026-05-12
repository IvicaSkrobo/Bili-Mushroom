---
status: complete
---

# Fix species folder path corruption from * markers

Added plain_species_name() helper in path_builder.rs that strips *italic* markers before folder path building. Applied in build_dest_path() and bulk_rename_species(). Missing source files now skipped gracefully (DB path still updated). Added test for formatted species names.
