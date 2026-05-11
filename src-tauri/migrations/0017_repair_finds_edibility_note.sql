-- Recovery migration: previously migration 0014 incorrectly targeted species_profiles
-- instead of finds. This migration is intentionally a no-op SQL statement because the
-- Rust migration runner (migrate_db in import.rs) guards this path with a runtime
-- column-existence check and only executes it when finds.edibility_note is missing.
-- Plain SQL cannot use IF NOT EXISTS in ALTER TABLE (bundled SQLite limitation).
-- The Rust guard makes this file safe as a no-op placeholder.
SELECT 1;
