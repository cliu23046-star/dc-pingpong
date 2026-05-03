#!/usr/bin/env bash
# 一键部署 dc-pingpong 网页版到 Cloudflare Pages
#
# 用法：
#   bash deploy-cf.sh                  # 交互式 OAuth 登录（首次）后部署
#   CLOUDFLARE_API_TOKEN=xxx bash deploy-cf.sh   # CI / 自动化用 token
#
# 首次使用前请先：
#   wrangler login
#
# 项目名：dc-pingpong
# 部署后地址：https://dc-pingpong.pages.dev
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_NAME="${CF_PAGES_PROJECT:-dc-pingpong}"
DIST_DIR="$SCRIPT_DIR/dist"

# ---------- 检查 wrangler ----------
if ! command -v wrangler >/dev/null 2>&1; then
    echo "[deploy-cf] wrangler 未安装，运行: npm install -g wrangler"
    exit 1
fi
echo "[deploy-cf] wrangler $(wrangler --version | head -1)"

# ---------- 检查认证 ----------
# 优先看环境变量 CLOUDFLARE_API_TOKEN（CI 友好）；否则 wrangler whoami
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo "[deploy-cf] 使用环境变量 CLOUDFLARE_API_TOKEN"
elif ! wrangler whoami >/dev/null 2>&1; then
    echo ""
    echo "[deploy-cf] ❌ 未登录 Cloudflare"
    echo "请先运行（仅首次需要）："
    echo ""
    echo "    wrangler login"
    echo ""
    echo "完成浏览器 OAuth 后，再次运行 bash deploy-cf.sh"
    exit 1
else
    EMAIL="$(wrangler whoami 2>&1 | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' | head -1 || true)"
    echo "[deploy-cf] 已登录: ${EMAIL:-(账户已认证)}"
fi

# ---------- 构建 ----------
echo "[deploy-cf] 🔨 npm run build ..."
npm run build

if [ ! -d "$DIST_DIR" ]; then
    echo "[deploy-cf] ❌ build 失败，dist/ 不存在"
    exit 1
fi
echo "[deploy-cf] ✅ build 完成"

# ---------- 部署 ----------
# --commit-dirty=true 允许 git 工作区有未提交更改也能部署
# --branch=main 把这次部署关联到 main，CF Pages 上即视为 production
BRANCH="${CF_PAGES_BRANCH:-main}"
echo "[deploy-cf] 🚀 wrangler pages deploy → project=$PROJECT_NAME branch=$BRANCH"
wrangler pages deploy "$DIST_DIR" \
    --project-name "$PROJECT_NAME" \
    --branch "$BRANCH" \
    --commit-dirty=true

# ---------- 提示 ----------
echo ""
echo "[deploy-cf] ✅ 部署完成"
echo "    Production URL: https://${PROJECT_NAME}.pages.dev"
echo ""
echo "（首次部署 Cloudflare 会自动创建 project；如果 project 已存在但你换账号，"
echo " 删除 Cloudflare Dashboard → Pages → ${PROJECT_NAME} 后重试）"
