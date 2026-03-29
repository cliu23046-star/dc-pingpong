-- Migration 8: Remove Coin system, switch to RMB (¥) pricing
-- All prices are now in RMB yuan (元). Coins column kept for backward compat but no longer used.

-- Set default coins to 0 for new users (no longer relevant)
ALTER TABLE users ALTER COLUMN coins SET DEFAULT 0;

-- Update payment_method values in bookings to use new naming
-- "coin" -> "wechat" (will be real WeChat Pay in production)
UPDATE bookings SET payment_method = 'wechat' WHERE payment_method = 'coin';
