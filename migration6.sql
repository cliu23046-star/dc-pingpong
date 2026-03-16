-- Migration 6: Create comments table for community post comments
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    user_name TEXT NOT NULL DEFAULT '',
    user_avatar TEXT DEFAULT '🙋',
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on comments" ON comments FOR ALL USING (true) WITH CHECK (true);

-- Add index for fast lookup by post
CREATE INDEX idx_comments_post_id ON comments(post_id);
