CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  find_id INTEGER NOT NULL UNIQUE,
  species_name TEXT NOT NULL,
  sample_year INTEGER NOT NULL,
  sample_no INTEGER NOT NULL,
  folder_path TEXT,
  preservation TEXT,
  storage_location TEXT,
  condition TEXT,
  spore_print INTEGER NOT NULL DEFAULT 0,
  dna_sample INTEGER NOT NULL DEFAULT 0,
  dried_at TEXT,
  dry_weight TEXT,
  loaned_to TEXT,
  loaned_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_samples_species_year ON samples(species_name, sample_year, sample_no);

-- Counters are kept separately so a deleted sample never frees its number:
-- accession numbers may end up on a physical label and must stay retired.
CREATE TABLE IF NOT EXISTS sample_counters (
  species_key TEXT NOT NULL,
  sample_year INTEGER NOT NULL,
  last_no INTEGER NOT NULL,
  PRIMARY KEY (species_key, sample_year)
);
