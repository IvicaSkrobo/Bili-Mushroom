-- Recovery: migration 0014 originally targeted species_profiles instead of finds.
-- This ensures finds.edibility_note exists regardless of which version of 0014 ran.
ALTER TABLE finds ADD COLUMN IF NOT EXISTS edibility_note TEXT;
