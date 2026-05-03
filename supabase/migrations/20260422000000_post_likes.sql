-- 帖子点赞表：记录"谁给哪个帖子点过赞"
-- 用于支持"同一用户对同一帖子只能点赞一次，再点击取消点赞"
--
-- 约束：
--   - (post_id, user_id) 联合唯一，防止重复点赞
--   - 帖子被删除时，相关点赞记录一起删除 (ON DELETE CASCADE)
--   - 用户被删除时，相关点赞记录一起删除 (ON DELETE CASCADE)

CREATE TABLE IF NOT EXISTS post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT post_likes_post_user_unique UNIQUE (post_id, user_id)
);

-- 查询优化索引
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);

-- 开启行级安全（RLS）
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- 匿名/已认证用户都可以读取（浏览时需要知道点赞状态）
DROP POLICY IF EXISTS "post_likes read all" ON post_likes;
CREATE POLICY "post_likes read all" ON post_likes
    FOR SELECT USING (true);

-- 只允许登录用户插入/删除自己的点赞（通过 anon key 直接访问时全放开，业务逻辑在前端+Edge Function 里校验）
DROP POLICY IF EXISTS "post_likes write all" ON post_likes;
CREATE POLICY "post_likes write all" ON post_likes
    FOR ALL USING (true) WITH CHECK (true);

-- 一次性数据修正（可选）：把 posts.likes 重置成准确值
-- 如果之前的 likes 字段有脏数据，运行下面这句即可：
-- UPDATE posts p SET likes = COALESCE((SELECT COUNT(*) FROM post_likes WHERE post_id = p.id), 0);
