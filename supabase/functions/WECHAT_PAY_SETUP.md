# WeChat Pay Integration — Setup Guide

Real WeChat Pay (v3 / JSAPI) integration for the DC Pingpong mini program.

## Architecture

```
┌────────────────┐    1. create-payment     ┌────────────────────┐
│ Mini Program   │ ─────────────────────>  │ Supabase Edge Fn    │
│ (Taro)         │                          │ create-payment      │
│                │ <─ pay_params ────────── │  (signs w/ priv key)│
│                │                          └────────────────────┘
│                │                                    │
│                │                                    ▼
│                │                          ┌────────────────────┐
│                │ 2. Taro.requestPayment ─>│ WeChat Cashier      │
│                │ <── user pays ─────────  │ (minprogram)        │
└────────────────┘                          └────────────────────┘
                                                     │
                                                     ▼ async
┌────────────────┐    3. notify callback   ┌────────────────────┐
│ WeChat         │ ─────────────────────>  │ payment-notify      │
│ platform       │     (encrypted)         │  (verify + decrypt) │
│                │ <── 200 SUCCESS ─────── │  creates booking    │
└────────────────┘                          └────────────────────┘
```

## 1. WeChat Merchant Credentials Required

From [商户平台](https://pay.weixin.qq.com/):

| Item | Where to get it | Env var |
|------|----------------|---------|
| 商户号 (Mch ID) | 商户平台首页 → 账户中心 | `WECHAT_MCH_ID` |
| 小程序 AppID | 微信公众平台 → 开发管理 | `WECHAT_APP_ID` |
| 小程序 AppSecret | 微信公众平台 → 开发管理 → 重置 | `WECHAT_APP_SECRET` |
| APIv3 密钥 | 账户中心 → API安全 → 设置APIv3密钥 (32 chars) | `WECHAT_API_V3_KEY` |
| 商户证书序列号 | 账户中心 → API安全 → 申请API证书 → 证书管理 | `WECHAT_MERCHANT_SERIAL_NO` |
| 商户私钥 (apiclient_key.pem) | 证书文件，下载后得到 | `WECHAT_MERCHANT_PRIVATE_KEY` |
| 平台证书公钥 | 用商户私钥 + APIv3 key 拉取 `/v3/certificates` 后解密得到 | `WECHAT_PLATFORM_PUBLIC_KEY` |

### Fetching the platform public key

Run this once locally (Node) after you have the merchant cert + APIv3 key:

```bash
# Use the official tool
npm i -g wechatpay-axios-plugin
wxpay cert download --mchid "$WECHAT_MCH_ID" \
  --serial "$WECHAT_MERCHANT_SERIAL_NO" \
  --privatekey ./apiclient_key.pem \
  --apiv3 "$WECHAT_API_V3_KEY" \
  --output ./wechatpay_cert.pem
```

Then copy the full PEM (with `-----BEGIN CERTIFICATE-----` headers) into the env var.

## 2. Deploy Edge Functions

```bash
cd ~/dc-pingpong
# Supabase CLI must be installed and logged in
supabase login
supabase link --project-ref vgvchsjarhyghficuwzc

# Deploy all three functions
supabase functions deploy create-payment
supabase functions deploy payment-notify --no-verify-jwt   # WeChat calls without JWT
supabase functions deploy create-refund
```

### Set secrets (one time):

```bash
# Replace each <PLACEHOLDER> with your actual value — never commit the filled-in version
supabase secrets set \
  WECHAT_APP_ID=<YOUR_MINI_PROGRAM_APPID> \
  WECHAT_APP_SECRET=<YOUR_MINI_PROGRAM_APPSECRET> \
  WECHAT_MCH_ID=<YOUR_MCH_ID> \
  WECHAT_API_V3_KEY=<YOUR_32CHAR_APIV3_KEY> \
  WECHAT_MERCHANT_SERIAL_NO=<YOUR_MERCHANT_CERT_SERIAL> \
  NOTIFY_URL=https://vgvchsjarhyghficuwzc.supabase.co/functions/v1/payment-notify

# Multi-line secrets must come from a file
supabase secrets set --env-file <(printf 'WECHAT_MERCHANT_PRIVATE_KEY=%s\n' "$(cat apiclient_key.pem)")
supabase secrets set --env-file <(printf 'WECHAT_PLATFORM_PUBLIC_KEY=%s\n' "$(cat wechatpay_cert.pem)")
```

## 3. Register Notify URL with WeChat

In WeChat merchant platform → 产品中心 → 支付产品 → JSAPI支付 → 开发配置:

- **Notify URL**: `https://vgvchsjarhyghficuwzc.supabase.co/functions/v1/payment-notify`

Also in 微信公众平台 (mini program) → 开发管理 → 服务器域名 → request合法域名:

- Add: `https://vgvchsjarhyghficuwzc.supabase.co`
- Add: `https://api.mch.weixin.qq.com` (if mini program calls WeChat API directly — we don't, but safe to add)

## 4. Run DB migration

```bash
supabase db push
# or manually apply both:
#   supabase/migrations/20260416000000_orders_table.sql
#   supabase/migrations/20260416000001_bookings_order_link.sql
```

## 5. Test flow

1. Compile mini program, preview on real device
2. Book a coach (低价时段测试，e.g. ¥1)
3. WeChat cashier should pop up; complete payment
4. Check Supabase `orders` table: a row with `status='paid'` and `transaction_id` filled
5. Check `bookings` table: a new booking with `order_id` pointing to the paid order
6. Cancel booking: `orders.status` should go to `refunding`, then `refunded` after WeChat callback

## 6. Troubleshooting

- **`签名验证失败` in payment-notify logs** — platform public key is wrong or WeChat rotated certs. Re-download the cert chain and update `WECHAT_PLATFORM_PUBLIC_KEY`.
- **`requestPayment:fail -2 fail` on client** — usually a signature mismatch on `pay_params`. Check that `WECHAT_APP_ID` env matches the mini program's AppID.
- **Order stuck at `pending`** — WeChat didn't call notify. Check that `NOTIFY_URL` is publicly reachable and matches what you registered.
- **`Missing env: WECHAT_*`** — `loadEnv()` will throw. Set the missing secret via `supabase secrets set`.

## 7. Web version

The React web app (`~/dc-pingpong`) intentionally does not integrate real WeChat Pay — JSAPI requires mini-program (or Official Account) context. Users attempting to pay on the web receive an alert directing them to the mini program.
