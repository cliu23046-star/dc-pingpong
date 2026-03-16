-- Migration 5: Backfill enrolled_users with user_id, enrolled_at, cost
-- The enrolled_users JSONB column already exists in activities table.
-- Currently stores [{name: "..."}], need to enrich to [{user_id, name, enrolled_at, cost}].
-- This migration updates existing entries by adding the missing fields.

-- Backfill: add enrolled_at and cost to existing entries that lack them
UPDATE activities
SET enrolled_users = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'user_id' IS NULL THEN
        elem || jsonb_build_object(
          'user_id', COALESCE((SELECT id FROM users WHERE nickname = elem->>'name' LIMIT 1), 0),
          'enrolled_at', created_at::text,
          'cost', cost
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(enrolled_users) AS elem
)
WHERE jsonb_array_length(enrolled_users) > 0;
