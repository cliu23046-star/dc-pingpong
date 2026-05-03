// content-check: 微信官方内容安全检测（msg_sec_check）
//
// 用于审核用户发帖、评论等 UGC 文本，符合微信小程序合规要求。
//
// Request body (JSON):
//   {
//     "content": "用户输入的文本",
//     "openid": "oX...",      // 可选 — 有则用 version=2 AI 检测
//     "code": "001ABC...",    // 可选 — wx.login code，没有 openid 时用它换取（优先级低于 openid）
//     "scene": 2              // 可选，默认 2（评论）。1=资料 2=评论 3=论坛 4=社交日志
//   }
//
// 未提供 openid 且无法通过 code 换取时，自动降级为 version=1 旧版文本检测（网页版兜底）。
//
// Response (JSON):
//   成功通过:  { "ok": true }
//   不通过:    { "ok": false, "msg": "内容包含违规信息，请修改后重试", "label": N }
//   接口错误:  { "ok": false, "msg": "内容检测失败，请稍后重试", "errcode": N }
//
// 环境变量:
//   WECHAT_APP_ID      小程序 AppID
//   WECHAT_APP_SECRET  小程序 AppSecret
//
// 性能:
//   access_token 在内存中缓存（TTL 约 2 小时），同一 Edge Function 实例内复用。
//   冷启动时第一次请求会多一次 cgi-bin/token 调用。

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------- access_token 内存缓存 ----------------

interface TokenCache {
    token: string;
    expiresAt: number; // Unix ms
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
    // 提前 60 秒视为过期，避免临界值
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
        return tokenCache.token;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`cgi-bin/token HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.access_token) {
        throw new Error(`cgi-bin/token 返回错误: ${data.errcode} ${data.errmsg}`);
    }

    // expires_in 默认 7200s，缓存 (expires_in - 300)s 留出续期缓冲
    const ttlMs = Math.max(60, (data.expires_in || 7200) - 300) * 1000;
    tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + ttlMs,
    };
    return data.access_token;
}

// ---------------- msg_sec_check 调用 ----------------

interface MsgSecCheckResult {
    errcode: number;
    errmsg?: string;
    result?: { suggest: 'pass' | 'review' | 'risky'; label: number };
    detail?: Array<{ strategy: string; errcode: number; suggest: string; label: number; keyword?: string }>;
    trace_id?: string;
}

async function callMsgSecCheck(
    accessToken: string,
    content: string,
    openid: string | null,
    scene: number,
): Promise<MsgSecCheckResult> {
    const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(accessToken)}`;
    // version=2 需要 openid 和 scene；无 openid 时降级为 version=1（旧版文本检测）
    const body: Record<string, unknown> = openid
        ? { content, version: 2, scene, openid }
        : { content, version: 1 };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`msg_sec_check HTTP ${res.status}`);
    }
    return await res.json();
}

// 通过 wx.login code 换取 openid
async function code2Openid(appId: string, appSecret: string, code: string): Promise<string | null> {
    try {
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.openid || null;
    } catch (e) {
        console.error('[content-check] code2Openid 失败:', e);
        return null;
    }
}

// ---------------- 主处理 ----------------

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }
    if (req.method !== 'POST') {
        return json({ ok: false, msg: 'Method not allowed' }, 405);
    }

    try {
        const appId = Deno.env.get('WECHAT_APP_ID');
        const appSecret = Deno.env.get('WECHAT_APP_SECRET');
        if (!appId || !appSecret) {
            console.error('[content-check] 缺少环境变量 WECHAT_APP_ID / WECHAT_APP_SECRET');
            return json({ ok: false, msg: '服务未配置' }, 500);
        }

        const payload = await req.json().catch(() => ({}));
        const content: string = String(payload.content || '').trim();
        let openid: string | null = payload.openid ? String(payload.openid).trim() : null;
        const code: string | null = payload.code ? String(payload.code).trim() : null;
        const scene: number = Number.isInteger(payload.scene) ? payload.scene : 2;

        if (!content) {
            return json({ ok: false, msg: '内容不能为空' }, 400);
        }
        if (content.length > 2500) {
            return json({ ok: false, msg: '内容长度超限（最多 2500 字）' }, 400);
        }

        // 1) 取 access_token
        let accessToken: string;
        try {
            accessToken = await getAccessToken(appId, appSecret);
        } catch (e) {
            console.error('[content-check] 获取 access_token 失败:', e);
            return json({ ok: false, msg: '内容检测失败，请稍后重试' }, 502);
        }

        // 2) 无 openid 但有 code 时，换取 openid（version=2 首选）
        if (!openid && code) {
            openid = await code2Openid(appId, appSecret, code);
        }

        // 3) 调用 msg_sec_check（openid 存在用 version=2，否则 version=1 降级）
        let result: MsgSecCheckResult;
        try {
            result = await callMsgSecCheck(accessToken, content, openid, scene);
        } catch (e) {
            console.error('[content-check] msg_sec_check 调用失败:', e);
            return json({ ok: false, msg: '内容检测失败，请稍后重试' }, 502);
        }

        // access_token 失效时强制刷新后重试一次
        if (result.errcode === 40001 || result.errcode === 42001 || result.errcode === 40014) {
            console.warn('[content-check] access_token 失效，刷新后重试');
            tokenCache = null;
            try {
                accessToken = await getAccessToken(appId, appSecret);
                result = await callMsgSecCheck(accessToken, content, openid, scene);
            } catch (e) {
                console.error('[content-check] 重试失败:', e);
                return json({ ok: false, msg: '内容检测失败，请稍后重试' }, 502);
            }
        }

        if (result.errcode !== 0) {
            // version=1 的旧接口命中违规时直接返回 errcode=87014，这里视为不通过
            if (result.errcode === 87014) {
                console.warn('[content-check] version=1 命中违规');
                return json({ ok: false, msg: '内容包含违规信息，请修改后重试' }, 200);
            }
            console.error('[content-check] msg_sec_check 返回错误:', result);
            return json({ ok: false, msg: '内容检测失败，请稍后重试', errcode: result.errcode }, 200);
        }

        // version=1 成功时只返回 errcode=0，没有 result 字段 → 视为通过
        if (!result.result) {
            return json({ ok: true }, 200);
        }

        const suggest = result.result.suggest;
        const label = result.result.label ?? 0;

        // pass = 安全；review = 疑似违规；risky = 确认违规
        // 严格模式：只有 pass 才放行
        if (suggest === 'pass') {
            return json({ ok: true }, 200);
        }

        console.warn('[content-check] 命中违规:', { suggest, label, detail: result.detail });
        return json({
            ok: false,
            msg: '内容包含违规信息，请修改后重试',
            label,
            suggest,
        }, 200);
    } catch (e) {
        console.error('[content-check] 未知错误:', e);
        return json({ ok: false, msg: '内容检测失败，请稍后重试' }, 500);
    }
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}
