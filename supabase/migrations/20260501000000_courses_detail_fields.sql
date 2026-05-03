-- 课程详情页所需新增字段：
--   description_detail：课程详细描述（长文本，可包含换行/段落）
--   highlights：课程亮点列表（如「比单节课更划算」「可选择任意教练」「未来多店通用」）
--   rules：课程卡使用规则说明（长文本）
--   cover_detail_url：详情页封面图（与 cover_url 区分；后续支持上传）
--
-- 全部字段允许为空，老数据无需回填。

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS description_detail TEXT,
    ADD COLUMN IF NOT EXISTS highlights        TEXT[] DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS rules             TEXT,
    ADD COLUMN IF NOT EXISTS cover_detail_url  TEXT;

-- 软删除支持（修复 FK 删除失败时的退路）：扩展 status 字段允许 'archived'
-- 现有 status 仍是 TEXT，新增 'archived' 不破坏旧值。前端在过滤时排除 'archived' 即可。
COMMENT ON COLUMN courses.status IS '上架 / 下架 / archived（软删除）';
