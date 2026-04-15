CREATE TABLE IF NOT EXISTS tile_cache_meta (
    tile_key TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    last_accessed TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tile_cache_accessed ON tile_cache_meta(last_accessed);

CREATE TABLE IF NOT EXISTS tile_cache_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
