-- Migration: Create goals channel
-- Description: Adds default goals channel to comms_channels table
-- SQL Version: 2023.10.beta3

-- Create temp table if not exists
CREATE TEMP TABLE IF NOT EXISTS temp_channels AS
SELECT 1 FROM comms_channels WHERE name = 'goals';

-- Insert goals channel only if it doesn't exist
INSERT INTO comms_channels (name, description, type, members, created_at, last_active_at)
SELECT 
  'goals',
  'Goal tracking and alignment discussions',
  'public',
  ARRAY[]::text[], -- Empty members array
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM temp_channels);

-- Clean up temp table
DROP TABLE IF EXISTS temp_channels;