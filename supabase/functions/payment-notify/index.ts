// payment-notify: Receives async payment results from WeChat Pay.
//
// WeChat posts JSON with encrypted `resource` using AES-256-GCM (APIv3 key).
// We:
//   1. Verify the request signature using WeChat platform public key
//   2. Decrypt the resource -> plaintext transaction details
//   3. Look up the order in our `orders` table (by out_trade_no)
//   4. Update order status to 'paid'
//   5. Execute type-specific post-payment logic (create booking / card / enrollment)
//   6. Return 200 to acknowledge, or non-200 so WeChat retries
//
// WeChat expected response:
//   success: HTTP 200 with body: {"code":"SUCCESS","message":"成功"}
//   failure: non-200 with body:  {"code":"FAIL","message":"错误原因"}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { loadEnv, aesGcmDecrypt, rsaVerify } from '../_shared/wechat-pay.ts';

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return wechatAck(false, '仅支持 POST', 405);
    }

    try {
        const env = loadEnv();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const rawBody = await req.text();
        const timestamp = req.headers.get('Wechatpay-Timestamp') || '';
        const nonce = req.headers.get('Wechatpay-Nonce') || '';
        const signature = req.headers.get('Wechatpay-Signature') || '';

        // Verify callback signature
        const signMsg = `${timestamp}\n${nonce}\n${rawBody}\n`;
        const verified = await rsaVerify(env.platformPublicKey, signMsg, signature);
        if (!verified) {
            console.error('[payment-notify] Signature verification failed');
            return wechatAck(false, '签名验证失败', 401);
        }

        const body = JSON.parse(rawBody);
        // body structure: { id, create_time, event_type, resource_type, resource: { ciphertext, associated_data, nonce, algorithm } }
        if (body.event_type !== 'TRANSACTION.SUCCESS') {
            // Some other event (e.g. REFUND.SUCCESS, REFUND.ABNORMAL) — handle below
            if (body.event_type?.startsWith('REFUND.')) {
                await handleRefundNotify(env, supabase, body);
                return wechatAck(true);
            }
            console.log('[payment-notify] Ignoring event_type:', body.event_type);
            return wechatAck(true);
        }

        const resource = body.resource;
        const plaintext = await aesGcmDecrypt(
            env.apiV3Key,
            resource.associated_data,
            resource.nonce,
            resource.ciphertext,
        );
        const tx = JSON.parse(plaintext);
        // tx: { out_trade_no, transaction_id, trade_state, amount: { total, payer_total }, payer: { openid }, success_time, ... }

        if (tx.trade_state !== 'SUCCESS') {
            console.log('[payment-notify] trade_state not SUCCESS:', tx.trade_state);
            return wechatAck(true);
        }

        // Load the order
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('out_trade_no', tx.out_trade_no)
            .single();

        if (error || !order) {
            console.error('[payment-notify] Order not found:', tx.out_trade_no, error);
            return wechatAck(false, '订单不存在', 404);
        }

        if (order.status === 'paid') {
            // Idempotent — already processed
            return wechatAck(true);
        }

        // Mark order paid
        await supabase.from('orders').update({
            status: 'paid',
            transaction_id: tx.transaction_id,
            paid_at: new Date().toISOString(),
        }).eq('id', order.id);

        // Type-specific post-payment logic
        await handlePostPayment(supabase, order);

        return wechatAck(true);
    } catch (err) {
        console.error('[payment-notify] Error:', err);
        return wechatAck(false, err instanceof Error ? err.message : String(err), 500);
    }
});

// ---------- Post-payment handlers ----------

async function handlePostPayment(supabase: any, order: any) {
    const meta = order.metadata || {};
    const amountYuan = Math.round(order.amount) / 100;

    switch (order.type) {
        case 'course': {
            // Increment course enrolled count and create course_card
            if (meta.course_id) {
                const { data: course } = await supabase.from('courses').select('*').eq('id', meta.course_id).single();
                if (course) {
                    await supabase.from('courses').update({ enrolled: (course.enrolled || 0) + 1 }).eq('id', course.id);
                    const now = new Date();
                    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
                    await supabase.from('course_cards').insert({
                        user_id: order.user_id,
                        course_id: course.id,
                        course_name: course.title,
                        total_lessons: course.lessons,
                        remaining_lessons: course.lessons,
                        purchase_date: dateStr,
                    });
                }
            }
            break;
        }
        case 'coach':
        case 'table': {
            // Insert booking record (mini program stored draft data in metadata)
            if (meta.booking) {
                await supabase.from('bookings').insert({
                    user_id: order.user_id,
                    user_name: meta.booking.user_name,
                    type: meta.booking.type,
                    target_id: meta.booking.target_id,
                    target_name: meta.booking.target_name,
                    detail: meta.booking.detail,
                    date: meta.booking.date,
                    time_slots: meta.booking.time_slots,
                    duration: meta.booking.duration,
                    payment_method: 'wechat',
                    amount: amountYuan,
                    status: '待确认',
                    order_id: order.id,
                });
            }
            break;
        }
        case 'activity': {
            // Add user to activity.enrolled_users
            if (meta.activity_id) {
                const { data: activity } = await supabase.from('activities').select('enrolled_users').eq('id', meta.activity_id).single();
                if (activity) {
                    const newEnrolled = [...(activity.enrolled_users || []), {
                        user_id: order.user_id,
                        name: meta.user_name || '用户',
                        enrolled_at: new Date().toISOString(),
                        cost: amountYuan,
                        order_id: order.id,
                    }];
                    await supabase.from('activities').update({ enrolled_users: newEnrolled }).eq('id', meta.activity_id);
                }
            }
            break;
        }
    }

    // Record transaction
    await supabase.from('transactions').insert({
        user_id: order.user_id,
        description: order.description,
        amount: -amountYuan,
        type: 'wechat',
    });
}

async function handleRefundNotify(_env: any, supabase: any, body: any) {
    // Placeholder: decrypt resource and update order.status='refunded'
    // See aesGcmDecrypt usage in TRANSACTION path
    console.log('[payment-notify] Refund event received:', body.event_type);
    try {
        const env = loadEnv();
        const resource = body.resource;
        const plaintext = await aesGcmDecrypt(env.apiV3Key, resource.associated_data, resource.nonce, resource.ciphertext);
        const rx = JSON.parse(plaintext);
        if (rx.out_trade_no && rx.refund_status === 'SUCCESS') {
            await supabase.from('orders').update({
                status: 'refunded',
                refunded_at: new Date().toISOString(),
                refund_id: rx.refund_id,
            }).eq('out_trade_no', rx.out_trade_no);
        }
    } catch (e) {
        console.error('[handleRefundNotify] Error:', e);
    }
}

function wechatAck(ok: boolean, msg = '成功', status?: number): Response {
    const body = JSON.stringify({ code: ok ? 'SUCCESS' : 'FAIL', message: msg });
    return new Response(body, {
        status: status ?? (ok ? 200 : 400),
        headers: { 'Content-Type': 'application/json' },
    });
}
