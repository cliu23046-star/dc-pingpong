-- 用户最近一次访问社区页的时间戳。
-- 用途：算"未读消息数"——比这个时间晚的、来自他人的对我的回应（评论我的帖子 / 评论我评论过的帖子 /
-- 评论我点赞过的帖子 / 给我帖子点赞）记为未读。
--
-- 默认 NULL：表示用户从未访问过社区，此时所有他人的回应均算未读。

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_community_visit TIMESTAMPTZ;

-- 加索引在按用户查询自己的访问时间时效率更高（实际上是 PK 主键查询，意义不大，留作备忘）。
COMMENT ON COLUMN users.last_community_visit IS '用户最近一次访问社区页的时间，用于未读红点计算';
