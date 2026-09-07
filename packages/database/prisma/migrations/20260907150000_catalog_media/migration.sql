-- Structured, text-only image references for catalog administration.
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS icon VARCHAR(2048);
ALTER TABLE services ADD COLUMN IF NOT EXISTS icon VARCHAR(2048);
