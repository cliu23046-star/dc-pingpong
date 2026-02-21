-- DC Pingpong — Migration 3: Coach closed dates
-- Run after migration2.sql in Supabase SQL Editor

-- Coaches: add closed_dates for per-coach day-off tracking
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS closed_dates TEXT[] DEFAULT '{}';
