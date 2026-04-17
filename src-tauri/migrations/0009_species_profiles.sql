CREATE TABLE IF NOT EXISTS species_profiles (
    species_name    TEXT PRIMARY KEY,
    cover_photo_id  INTEGER,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_species_profiles_cover_photo_id
ON species_profiles(cover_photo_id);
