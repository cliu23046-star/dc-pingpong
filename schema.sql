-- ============================================================
-- DC Pingpong — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Coaches
CREATE TABLE IF NOT EXISTS coaches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT '',
  specialties TEXT[] DEFAULT '{}',
  price_per_hour INTEGER NOT NULL DEFAULT 80,
  avatar_url TEXT,
  available_slots JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT '在职',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE coaches DISABLE ROW LEVEL SECURITY;

-- 2. Courses
CREATE TABLE IF NOT EXISTS courses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  emoji TEXT DEFAULT '📖',
  lessons INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL DEFAULT 0,
  cover_url TEXT,
  outline TEXT[] DEFAULT '{}',
  enrolled INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT '上架',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;

-- 3. Activities
CREATE TABLE IF NOT EXISTS activities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'group',
  emoji TEXT DEFAULT '🎯',
  date TEXT NOT NULL DEFAULT '',
  time TEXT DEFAULT '',
  location TEXT DEFAULT '',
  spots INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  rewards JSONB DEFAULT '[]',
  enrolled_users JSONB DEFAULT '[]',
  reward_distributed BOOLEAN DEFAULT FALSE,
  table_id BIGINT,
  table_slot TEXT,
  status TEXT NOT NULL DEFAULT '未开始',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;

-- 4. Tables (ping-pong tables)
CREATE TABLE IF NOT EXISTS tables (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  price_per_hour INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT '正常',
  closed_dates TEXT[] DEFAULT '{}',
  unavailable_slots JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;

-- 5. Users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nickname TEXT NOT NULL DEFAULT '球友',
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#6C5CE7',
  coins INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 6. Course Cards
CREATE TABLE IF NOT EXISTS course_cards (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  course_id BIGINT REFERENCES courses(id),
  course_name TEXT NOT NULL,
  total_lessons NUMERIC NOT NULL DEFAULT 0,
  remaining_lessons NUMERIC NOT NULL DEFAULT 0,
  purchase_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE course_cards DISABLE ROW LEVEL SECURITY;

-- 7. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  user_name TEXT DEFAULT '',
  type TEXT NOT NULL,
  target_id BIGINT,
  target_name TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  date TEXT NOT NULL,
  time_slots TEXT[] DEFAULT '{}',
  duration NUMERIC NOT NULL DEFAULT 1,
  payment_method TEXT NOT NULL DEFAULT 'coin',
  amount NUMERIC NOT NULL DEFAULT 0,
  card_id BIGINT,
  card_deduct NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT '待确认',
  refund_amount NUMERIC DEFAULT 0,
  refunded BOOLEAN DEFAULT FALSE,
  cancelled_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- 8. Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'coin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 9. Posts (Community)
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  user_name TEXT DEFAULT '',
  user_avatar TEXT DEFAULT '🙋',
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '动态',
  vote_yes INTEGER DEFAULT 0,
  vote_no INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Seed Data — matches existing mock data
-- ============================================================

-- Coaches
INSERT INTO coaches (name, level, specialties, price_per_hour, status, available_slots) VALUES
  ('王教练', '国家一级', ARRAY['正手攻球','发球技术'], 80, '在职', '[{"day":"周一","hours":["10:00","10:30","14:00","14:30"]},{"day":"周三","hours":["14:00","14:30","19:00","19:30"]},{"day":"周五","hours":["19:00","19:30","20:00","20:30"]}]'::jsonb),
  ('李教练', '省级专业', ARRAY['反手拧拉','步伐训练'], 80, '在职', '[{"day":"周二","hours":["10:00","10:30","16:00","16:30"]},{"day":"周四","hours":["16:00","16:30","17:00","17:30"]},{"day":"周六","hours":["09:00","09:30","10:00","10:30"]}]'::jsonb),
  ('张教练', '国家二级', ARRAY['削球打法','比赛策略'], 80, '在职', '[{"day":"周一","hours":["14:00","14:30","15:00","15:30"]},{"day":"周三","hours":["19:00","19:30"]},{"day":"周日","hours":["10:00","10:30","11:00","11:30"]}]'::jsonb);

-- Courses
INSERT INTO courses (title, description, emoji, lessons, price, enrolled, status, outline) VALUES
  ('零基础入门课', '从握拍到基本功', '🌱', 8, 200, 45, '上架', ARRAY['握拍姿势与站位','正手攻球入门','反手推挡基础','简单发球技术','基本步伐移动','正反手切换','简单对练','综合考核']),
  ('进阶技战术', '提升实战能力', '🔥', 12, 350, 32, '上架', ARRAY['正手拉弧圈球','反手拧拉','发球抢攻','接发球处理','步伐强化','前三板战术','相持球处理','反手侧拧','正手连续拉','削球防守','比赛心理','实战模拟']),
  ('发球专项训练', '掌握8种发球变化', '🎯', 6, 180, 28, '上架', ARRAY['下旋发球','侧旋发球','逆旋转发球','急长球','短球控制','组合变化']),
  ('高级对抗训练', '模拟实战对抗', '⚡', 10, 400, 18, '上架', ARRAY['弧圈对拉','反拉反冲','台内挑打','中远台相持','多球强化','体能专项','战术分析','视频复盘','模拟比赛','赛前调整']);

-- Tables
INSERT INTO tables (name, price_per_hour, status) VALUES
  ('1号台', 15, '正常'),
  ('2号台', 15, '正常'),
  ('3号台', 20, '正常'),
  ('4号台 (VIP)', 30, '正常'),
  ('5号台', 15, '正常');

-- Activities
INSERT INTO activities (title, type, emoji, date, time, location, spots, cost, rewards, enrolled_users, status) VALUES
  ('周末友谊赛', 'match', '🏆', '2/22', '14:00', 'A馆', 16, 20, '[{"rank":1,"amount":100},{"rank":2,"amount":50},{"rank":3,"amount":30}]'::jsonb, '[{"name":"小明"},{"name":"阿飞"},{"name":"球姐"}]'::jsonb, '进行中'),
  ('团体训练营', 'group', '🤝', '2/23', '10:00', 'B馆', 8, 10, '[]'::jsonb, '[{"name":"小明"},{"name":"阿飞"}]'::jsonb, '进行中'),
  ('积分挑战赛', 'match', '⚔️', '3/1', '15:00', 'A馆', 32, 30, '[{"rank":1,"amount":200},{"rank":2,"amount":100},{"rank":3,"amount":50}]'::jsonb, '[]'::jsonb, '未开始'),
  ('新手交流局', 'group', '🏓', '3/2', '09:00', 'C馆', 12, 15, '[]'::jsonb, '[]'::jsonb, '未开始');

-- Users (default user)
INSERT INTO users (nickname, avatar_color, coins) VALUES ('球友', '#6C5CE7', 500);

-- Posts
INSERT INTO posts (user_name, user_avatar, content, type, likes, comments, created_at) VALUES
  ('小明', '😎', '今天和王教练练了2小时正手，进步很大！', '动态', 24, 8, NOW() - INTERVAL '2 hours'),
  ('阿飞', '🤠', '建议俱乐部周末增加一个初学者专场', '投票', 45, 15, NOW() - INTERVAL '5 hours'),
  ('球姐', '💪', '分享一个反手拧拉的技巧：手腕要放松', '动态', 67, 22, NOW() - INTERVAL '1 day');

-- Update vote counts for the vote post
UPDATE posts SET vote_yes = 38, vote_no = 7 WHERE user_name = '阿飞' AND type = '投票';
