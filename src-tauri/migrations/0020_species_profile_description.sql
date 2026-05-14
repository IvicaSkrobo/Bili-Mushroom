ALTER TABLE species_profiles ADD COLUMN description TEXT;
UPDATE species_profiles
SET description = edibility_note
WHERE description IS NULL
  AND edibility_note IS NOT NULL
  AND TRIM(edibility_note) <> '';

