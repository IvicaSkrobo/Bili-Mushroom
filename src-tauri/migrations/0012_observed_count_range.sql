ALTER TABLE finds ADD COLUMN observed_count_min INTEGER;
ALTER TABLE finds ADD COLUMN observed_count_max INTEGER;

UPDATE finds
SET observed_count_min = observed_count,
    observed_count_max = observed_count
WHERE observed_count IS NOT NULL
  AND observed_count_min IS NULL
  AND observed_count_max IS NULL;
