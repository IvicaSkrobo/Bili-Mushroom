CREATE TABLE IF NOT EXISTS species_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  species_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_species_recipes_species_name
ON species_recipes(species_name);

