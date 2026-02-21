-- Migration 4: Add closed_slots JSONB column to coaches table
-- This stores per-date, per-hour closed slot data instead of whole-day closures
-- Format: [{"dateKey": "2/21", "hour": "10:00"}, ...]

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS closed_slots JSONB DEFAULT '[]';
