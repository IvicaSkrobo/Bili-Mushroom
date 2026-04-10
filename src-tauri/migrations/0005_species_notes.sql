CREATE TABLE IF NOT EXISTS species_notes (
    species_name TEXT PRIMARY KEY,
    notes        TEXT NOT NULL DEFAULT '',
    updated_at   TEXT NOT NULL DEFAULT ''
);
