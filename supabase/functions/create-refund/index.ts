// create-refund: Initiates a WeChat Pay refund for a paid order.
//
// Request body (JSON):
//   {
//     "order_id": 123,              // our orders.id
//     "refund_amount": 8000,        // fen — must be <= order.amount
//     "reason": "用户取消预约"      // optional
//   }
//
// OR by out_trade_no:
//   { "out_trade_no": "DC...", "refund_amount": 8000, "reason": "..." }
//
// Response:
//   { "ok": true, "refund_id": "...", "status": "..." }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { loadEnv, createRefund, generateOutTradeNo } from '../_shared/wechat-pay.ts';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

    try {
        const env = loadEnv();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const { order_id, out_trade_no, refund_amount, reason } = await req.json();

        if (!refund_amount || refund_amount <= 0) {
            return json({ ok: false, error: 'refund_amount 必须为正整数（单位：分）' }, 400);
        }

        // Locate order
        let orderQuery = supabase.from('orders').select('*');
        if (order_id) orderQuery = orderQuery.eq('id', order_id);
        else if (out_trade_no) orderQuery = orderQuery.eq('out_trade_no', out_trade_no);
        else return json({ ok: false, error: '必须提供 order_id 或 out_trade_no' }, 400);

        const { data: order, error } = await orderQuery.single();
        if (error || !order) return json({ ok: false, error: '订单不存在' }, 404);
        if (order.status !== 'paid') {
            return json({ ok: false, error: `订单状态为 ${order.status}，无法退款` }, 400);
        }
        if (refund_amount > order.amount - (order.refund_amount || 0)) {
            return json({ ok: false, error: '退款金额超过订单可退金额' }, 400);
        }

        const outRefundNo = generateOutTradeNo('R');

        // Mark order refunding first
        await supabase.from('orders').update({
            status: 'refunding',
            refund_no: outRefundNo,
        }).eq('id', order.id);

        try {
            const result = await createRefund(env, {
                outTradeNo: order.out_trade_no,
                outRefundNo,
                refundAmount: refund_amount,
                totalAmount: order.amount,
                reason: reason || '用户取消',
            });

            // Immediately update order with refund_id; final status arrives via payment-notify callback
            await supabase.from('orders').update({
                refund_id: result.refundId,
                refund_amount: refund_amount,
            }).eq('id', order.id);

            // If WeChat returns SUCCESS synchronously (not common but possible)
            if (result.status === 'SUCCESS') {
                await supabase.from('orders').update({
                    status: 'refunded',
                    refunded_at: new Date().toISOString(),
                }).eq('id', order.id);
            }

            return json({ ok: true, refund_id: result.refundId, status: result.status });
        } catch (e) {
            // Roll back order status if refund API call failed
            await supabase.from('orders').update({ status: 'paid', refund_no: null }).eq('id', order.id);
            throw e;
        }
    } catch (err) {
        console.error('[create-refund] Error:', err);
        return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}
