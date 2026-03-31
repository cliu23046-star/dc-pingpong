-- Migration 10: Phone-based login
-- Make phone the unique identifier for users

-- Ensure phone column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add UNIQUE constraint to phone (skip nulls — only enforced on non-null values)
ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);

-- Add openid column if not exists (for WeChat mini program association)
ALTER TABLE users ADD COLUMN IF NOT EXISTS openid TEXT;
