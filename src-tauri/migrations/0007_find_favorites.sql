ALTER TABLE finds ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_finds_is_favorite ON finds(is_favorite);
