// decrypt-phone: 把微信 getPhoneNumber 返回的临时 code 换成真实手机号
//
// 微信小程序里，<Button open-type="getPhoneNumber" ...> 的回调（onGetPhoneNumber）
// 会带回一个 code（基础库 ≥ 2.21.2），后端可以拿这个 code 调用
//   https://api.weixin.qq.com/wxa/business/getuserphonenumber
// 直接拿到 phoneInfo.phoneNumber，无需自己用 session_key 做 AES 解密——
// 微信新版接口已经替我们处理好了。
//
// Request body (JSON):
//   { "code": "abcd..." }
//
// Response (JSON):
//   成功:  { "ok": true, "phone": "13800138000", "purePhone": "13800138000", "countryCode": "86" }
//   失败:  { "ok": false, "msg": "...", "errcode": N }
//
// 环境变量（与 content-check 共用）:
//   WECHAT_APP_ID
//   WECHAT_APP_SECRET

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------- access_token 内存缓存 ----------------

interface TokenCache {
    token: string;
    expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
        return tokenCache.token;
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cgi-bin/token HTTP ${res.status}`);
    const data = await res.json();
    if (!data.access_token) throw new Error(`cgi-bin/token 错误: ${data.errcode} ${data.errmsg}`);
    const ttlMs = Math.max(60, (data.expires_in || 7200) - 300) * 1000;
    tokenCache = { token: data.access_token, expiresAt: Date.now() + ttlMs };
    return data.access_token;
}

// ---------------- 调用 getuserphonenumber ----------------

interface PhoneInfo {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
    watermark?: { timestamp: number; appid: string };
}

interface GetPhoneResp {
    errcode: number;
    errmsg?: string;
    phone_info?: PhoneInfo;
}

async function getUserPhoneNumber(accessToken: string, code: string): Promise<GetPhoneResp> {
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(`getuserphonenumber HTTP ${res.status}`);
    return await res.json();
}

// ---------------- 主处理 ----------------

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json({ ok: false, msg: 'Method not allowed' }, 405);

    try {
        const appId = Deno.env.get('WECHAT_APP_ID');
        const appSecret = Deno.env.get('WECHAT_APP_SECRET');
        if (!appId || !appSecret) {
            console.error('[decrypt-phone] 缺少 WECHAT_APP_ID / WECHAT_APP_SECRET');
            return json({ ok: false, msg: '服务未配置' }, 500);
        }

        const payload = await req.json().catch(() => ({}));
        const code: string = String(payload.code || '').trim();
        if (!code) return json({ ok: false, msg: '缺少 code 参数' }, 400);

        // 1) 取 access_token
        let accessToken: string;
        try {
            accessToken = await getAccessToken(appId, appSecret);
        } catch (e) {
            console.error('[decrypt-phone] access_token 获取失败:', e);
            return json({ ok: false, msg: '获取手机号失败，请稍后重试' }, 502);
        }

        // 2) code → phone
        let result: GetPhoneResp;
        try {
            result = await getUserPhoneNumber(accessToken, code);
        } catch (e) {
            console.error('[decrypt-phone] getuserphonenumber 调用失败:', e);
            return json({ ok: false, msg: '获取手机号失败，请稍后重试' }, 502);
        }

        // 3) access_token 失效则刷新重试一次
        if (result.errcode === 40001 || result.errcode === 42001 || result.errcode === 40014) {
            console.warn('[decrypt-phone] access_token 失效，刷新后重试');
            tokenCache = null;
            try {
                accessToken = await getAccessToken(appId, appSecret);
                result = await getUserPhoneNumber(accessToken, code);
            } catch (e) {
                console.error('[decrypt-phone] 重试失败:', e);
                return json({ ok: false, msg: '获取手机号失败，请稍后重试' }, 502);
            }
        }

        if (result.errcode !== 0 || !result.phone_info) {
            console.error('[decrypt-phone] 微信返回错误:', result);
            const msg =
                result.errcode === 40029 ? 'code 已失效，请重新点击登录按钮' :
                result.errcode === 45011 ? '请求过于频繁，请稍后再试' :
                '获取手机号失败';
            return json({ ok: false, msg, errcode: result.errcode }, 200);
        }

        const info = result.phone_info;
        return json({
            ok: true,
            phone: info.phoneNumber,
            purePhone: info.purePhoneNumber,
            countryCode: info.countryCode,
        });
    } catch (e) {
        console.error('[decrypt-phone] 未捕获异常:', e);
        return json({ ok: false, msg: '服务异常' }, 500);
    }
});
