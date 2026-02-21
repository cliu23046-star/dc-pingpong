-- DC Pingpong — Migration 2: Min Participants + Dynamic Tables
-- Run after migration.sql in Supabase SQL Editor

-- Activities: add min_participants for minimum enrollment threshold
ALTER TABLE activities ADD COLUMN IF NOT EXISTS min_participants INTEGER DEFAULT 0;
