-- ============================================================
-- DC Pingpong — Migration: Feature Enhancements
-- Run after schema.sql in Supabase SQL Editor
-- ============================================================

-- 1. Tables: add open_weekend_dates for admin-opened weekend dates
ALTER TABLE tables ADD COLUMN IF NOT EXISTS open_weekend_dates TEXT[] DEFAULT '{}';

-- 2. Activities: add occupied_table_count and occupied_time_slots
ALTER TABLE activities ADD COLUMN IF NOT EXISTS occupied_table_count INTEGER DEFAULT 0;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS occupied_time_slots TEXT[] DEFAULT '{}';

-- 3. Users: add search index on nickname (optional, improves admin search)
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users (nickname);

-- 4. Bookings: add target_name index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings (type);
