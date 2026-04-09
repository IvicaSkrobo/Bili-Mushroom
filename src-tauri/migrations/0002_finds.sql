-- Phase 2: Finds table
CREATE TABLE IF NOT EXISTS finds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_path      TEXT NOT NULL,       -- relative path within StorageRoot
    original_filename TEXT NOT NULL,
    species_name    TEXT NOT NULL DEFAULT '',
    date_found      TEXT NOT NULL,       -- ISO date: YYYY-MM-DD
    country         TEXT NOT NULL DEFAULT '',
    region          TEXT NOT NULL DEFAULT '',
    lat             REAL,
    lng             REAL,
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL        -- ISO datetime: YYYY-MM-DDTHH:MM:SSZ
);

CREATE INDEX IF NOT EXISTS idx_finds_date ON finds(date_found);
CREATE INDEX IF NOT EXISTS idx_finds_original_filename ON finds(original_filename);
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '2');
