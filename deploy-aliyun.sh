#!/usr/bin/env bash
# 一键部署 dc-pingpong 网页版到阿里云 OSS
#
# 用法：
#   bash deploy-aliyun.sh
#
# 凭据：从 .aliyun-credentials（git 已忽略）中读取，**禁止把密钥写入本脚本**
# 工具：ossutil（首次自动下载到 ~/.local/bin/ossutil）
set -euo pipefail

# ---------- 路径 / 工具 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CREDS_FILE="$SCRIPT_DIR/.aliyun-credentials"
DIST_DIR="$SCRIPT_DIR/dist"

# ossutil 路径——优先 PATH，再 ~/.local/bin
if command -v ossutil >/dev/null 2>&1; then
    OSSUTIL="$(command -v ossutil)"
elif [ -x "$HOME/.local/bin/ossutil" ]; then
    OSSUTIL="$HOME/.local/bin/ossutil"
else
    echo "[deploy] ossutil 未安装，自动下载 mac-arm64 版本..."
    mkdir -p "$HOME/.local/bin"
    TMP_ZIP="$(mktemp -d)/ossutil.zip"
    OS_ARCH="$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)"
    case "$OS_ARCH" in
        darwin-arm64)  URL="https://gosspublic.alicdn.com/ossutil/current/ossutil-mac-arm64.zip" ;;
        darwin-x86_64) URL="https://gosspublic.alicdn.com/ossutil/current/ossutil-mac-amd64.zip" ;;
        linux-x86_64)  URL="https://gosspublic.alicdn.com/ossutil/current/ossutil-linux-amd64.zip" ;;
        linux-aarch64) URL="https://gosspublic.alicdn.com/ossutil/current/ossutil-linux-arm64.zip" ;;
        *) echo "[deploy] 不支持的平台: $OS_ARCH，请手动安装 ossutil"; exit 1 ;;
    esac
    curl -fsSL -o "$TMP_ZIP" "$URL"
    unzip -oq "$TMP_ZIP" -d "$(dirname "$TMP_ZIP")"
    cp "$(dirname "$TMP_ZIP")"/*/ossutil "$HOME/.local/bin/ossutil"
    chmod +x "$HOME/.local/bin/ossutil"
    OSSUTIL="$HOME/.local/bin/ossutil"
fi
echo "[deploy] using $OSSUTIL ($("$OSSUTIL" --version | head -1))"

# ---------- 凭据 ----------
if [ ! -f "$CREDS_FILE" ]; then
    echo "[deploy] ❌ 找不到 $CREDS_FILE"
    echo "请先创建该文件并填入："
    echo "  ALIYUN_ACCESS_KEY_ID=\"...\""
    echo "  ALIYUN_ACCESS_KEY_SECRET=\"...\""
    echo "  ALIYUN_OSS_ENDPOINT=\"oss-cn-shanghai.aliyuncs.com\""
    echo "  ALIYUN_OSS_BUCKET=\"dc-pingpong-admin\""
    exit 1
fi
# shellcheck disable=SC1090
source "$CREDS_FILE"
: "${ALIYUN_ACCESS_KEY_ID:?missing in $CREDS_FILE}"
: "${ALIYUN_ACCESS_KEY_SECRET:?missing in $CREDS_FILE}"
: "${ALIYUN_OSS_ENDPOINT:?missing in $CREDS_FILE}"
: "${ALIYUN_OSS_BUCKET:?missing in $CREDS_FILE}"

# ---------- 构建 ----------
echo "[deploy] 🔨 npm run build ..."
npm run build

if [ ! -d "$DIST_DIR" ]; then
    echo "[deploy] ❌ build 失败，dist/ 不存在"
    exit 1
fi
echo "[deploy] ✅ build 完成，dist/ 准备就绪"

# ---------- 上传 ----------
# ossutil 通用参数：每次都通过 -e/-i/-k 显式传入凭据，不依赖 ~/.ossutilconfig
OSS_PREFIX="oss://$ALIYUN_OSS_BUCKET/"
OSS_FLAGS=(
    -e "$ALIYUN_OSS_ENDPOINT"
    -i "$ALIYUN_ACCESS_KEY_ID"
    -k "$ALIYUN_ACCESS_KEY_SECRET"
)

echo "[deploy] 🚀 sync dist/ → $OSS_PREFIX (--delete = remove orphans)"
# ossutil sync 自动递归；-u 增量、--delete 清理对端多余文件、-f 不交互
"$OSSUTIL" sync -u -f --delete "$DIST_DIR/" "$OSS_PREFIX" "${OSS_FLAGS[@]}"

# ---------- 设 bucket ACL：public-read（允许通过 URL 直接访问） ----------
echo "[deploy] 🔓 设置 bucket ACL=public-read（首次必要）"
"$OSSUTIL" set-acl "$OSS_PREFIX" public-read -b -f "${OSS_FLAGS[@]}" >/dev/null 2>&1 \
    || echo "[deploy] (set-acl 跳过，可能 bucket 已是 public-read 或权限不足)"

# ---------- 设缓存策略 ----------
# index.html：no-cache（每次访问都校验，避免新版本不生效）
echo "[deploy] 🗂  设 index.html Cache-Control: no-cache"
"$OSSUTIL" set-meta "${OSS_PREFIX}index.html" "Cache-Control:no-cache, must-revalidate" --update -f "${OSS_FLAGS[@]}" >/dev/null

# assets/*：长缓存（vite 已加 hash，文件名变即缓存失效）
echo "[deploy] 🗂  设 assets/* Cache-Control: max-age=31536000, immutable"
"$OSSUTIL" set-meta "${OSS_PREFIX}assets/" "Cache-Control:max-age=31536000, immutable" --update -r -f "${OSS_FLAGS[@]}" >/dev/null

# ---------- 验证 ----------
URL="https://$ALIYUN_OSS_BUCKET.$ALIYUN_OSS_ENDPOINT/index.html"
echo "[deploy] 🔍 验证 $URL"
HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "$URL" || true)"
if [ "$HTTP_CODE" = "200" ]; then
    echo "[deploy] ✅ 部署成功 → $URL"
else
    echo "[deploy] ⚠️  HTTP $HTTP_CODE（如果是首次部署可能需要等几秒，或检查 bucket 公开访问权限）"
    echo "    手动访问看看：$URL"
fi
