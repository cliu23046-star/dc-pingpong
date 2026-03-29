-- Migration 7: Add openid column to users table for WeChat login
ALTER TABLE users ADD COLUMN IF NOT EXISTS openid TEXT UNIQUE;

-- Create index for fast openid lookup
CREATE INDEX IF NOT EXISTS idx_users_openid ON users(openid);
