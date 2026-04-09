-- Phase 02.1: Multi-photo finds
-- 1. Create the new find_photos table
CREATE TABLE IF NOT EXISTS find_photos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  find_id   INTEGER NOT NULL REFERENCES finds(id) ON DELETE CASCADE,
  photo_path TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Migrate existing finds.photo_path into find_photos (is_primary = 1)
INSERT INTO find_photos (find_id, photo_path, is_primary, created_at)
SELECT id, photo_path, 1, created_at
FROM finds
WHERE photo_path IS NOT NULL AND photo_path != '';

-- 3. Create index for fast lookup by find_id
CREATE INDEX IF NOT EXISTS idx_find_photos_find_id ON find_photos(find_id);

-- 4. Drop the now-redundant column from finds
ALTER TABLE finds DROP COLUMN photo_path;

-- 5. Record schema version
INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('schema_version', '3');
