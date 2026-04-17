// create-payment: Creates a WeChat Pay JSAPI prepay order.
//
// Request body (JSON):
//   {
//     "user_id": 123,
//     "type": "course" | "coach" | "table" | "activity",
//     "target_id": 45,                        // optional
//     "amount": 8000,                         // fen (80元 = 8000)
//     "description": "购买课程: 基础班",
//     "openid": "oX...",                      // preferred — mini program passes openid after login
//     "code": "001ABC...",                    // alt — wx.login code, edge fn will exchange for openid
//     "metadata": { ... }                     // optional — stored with the order for post-payment handling
//   }
//
// Response (JSON):
//   {
//     "ok": true,
//     "out_trade_no": "DC...",
//     "pay_params": { timeStamp, nonceStr, package, signType: "RSA", paySign }
//   }
//
// The mini program passes `pay_params` directly to Taro.requestPayment(...).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
    loadEnv, createJsapiOrder, buildMiniProgramPayParams,
    code2Openid, generateOutTradeNo,
} from '../_shared/wechat-pay.ts';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    try {
        const env = loadEnv();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const payload = await req.json();
        const { user_id, type, target_id, amount, description, openid: openidIn, code, metadata } = payload;

        if (!user_id || !type || !amount || !description) {
            return json({ ok: false, error: '缺少必要参数: user_id / type / amount / description' }, 400);
        }
        if (!['course', 'coach', 'table', 'activity'].includes(type)) {
            return json({ ok: false, error: `非法订单类型: ${type}` }, 400);
        }
        if (!Number.isInteger(amount) || amount <= 0) {
            return json({ ok: false, error: 'amount 必须是正整数（单位：分）' }, 400);
        }

        // Resolve openid
        let openid = openidIn;
        if (!openid && code) {
            const r = await code2Openid(env, code);
            openid = r.openid;
        }
        if (!openid) {
            // Try to fetch from users table
            const { data: user } = await supabase.from('users').select('openid').eq('id', user_id).maybeSingle();
            if (user?.openid) openid = user.openid;
        }
        if (!openid) {
            return json({ ok: false, error: '无法获取用户 openid，请先登录微信' }, 400);
        }

        // Persist openid to user row for future payments if not already stored
        await supabase.from('users').update({ openid }).eq('id', user_id).is('openid', null);

        // Create order row first (pending)
        const outTradeNo = generateOutTradeNo();
        const { data: order, error: insertErr } = await supabase.from('orders').insert({
            out_trade_no: outTradeNo,
            user_id,
            openid,
            type,
            target_id: target_id ?? null,
            description,
            amount,
            status: 'pending',
            metadata: metadata || {},
        }).select().single();

        if (insertErr || !order) {
            console.error('Failed to create order row:', insertErr);
            return json({ ok: false, error: '创建订单失败' }, 500);
        }

        // Call WeChat unified order
        const { prepayId } = await createJsapiOrder(env, {
            description,
            outTradeNo,
            amount,
            openid,
        });

        // Store prepay_id on the order
        await supabase.from('orders').update({ prepay_id: prepayId }).eq('id', order.id);

        // Build mini-program payment params
        const payParams = await buildMiniProgramPayParams(env, prepayId);

        return json({
            ok: true,
            out_trade_no: outTradeNo,
            order_id: order.id,
            pay_params: payParams,
        });
    } catch (err) {
        console.error('[create-payment] Error:', err);
        return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}
