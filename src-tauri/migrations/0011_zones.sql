CREATE TABLE IF NOT EXISTS zones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    species_name    TEXT NOT NULL,
    zone_type       TEXT NOT NULL CHECK (zone_type IN ('local', 'region')),
    name            TEXT NOT NULL DEFAULT '',
    geometry_type   TEXT NOT NULL CHECK (geometry_type IN ('circle', 'polygon')),
    center_lat      REAL,
    center_lng      REAL,
    radius_meters   REAL,
    polygon_json    TEXT,
    source_find_id  INTEGER,
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY(source_find_id) REFERENCES finds(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_zones_species_name ON zones(species_name);
CREATE INDEX IF NOT EXISTS idx_zones_type ON zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_zones_source_find ON zones(source_find_id);
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '11');
