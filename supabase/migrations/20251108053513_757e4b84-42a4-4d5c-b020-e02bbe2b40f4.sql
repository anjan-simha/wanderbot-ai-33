-- Add language preference to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en-US';

-- Add comment explaining the column
COMMENT ON COLUMN profiles.preferred_language IS 'User preferred language for voice and text output (BCP 47 format, e.g., en-US, es-ES, fr-FR)';