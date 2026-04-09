-- Phase 1 initial schema
-- Enable Write-Ahead Logging per D-08 / Pitfall 1
PRAGMA journal_mode=WAL;

-- App metadata / fallback key-value store
-- (Primary preferences live in tauri-plugin-store; this is a per-library fallback.)
CREATE TABLE IF NOT EXISTS app_metadata (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

-- Record schema version for debugging
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '1');
