// Shared WeChat Pay v3 utilities for Supabase Edge Functions (Deno runtime).
//
// Implements:
//   - RSA-SHA256 signing of API requests (using merchant private key)
//   - Authorization header building per WeChat Pay v3 spec
//   - AES-256-GCM decryption of notify callback resource field
//   - Signature verification of callback using WeChat platform public key
//   - jscode2session for exchanging login code -> openid
//
// All secrets are read from environment variables. None are hard-coded.

export interface WechatPayEnv {
    appId: string;              // from env WECHAT_APP_ID
    appSecret: string;          // from env WECHAT_APP_SECRET (for jscode2session)
    mchId: string;              // from env WECHAT_MCH_ID
    apiV3Key: string;           // from env WECHAT_API_V3_KEY (32-char APIv3 key)
    merchantSerialNo: string;   // from env WECHAT_MERCHANT_SERIAL_NO
    merchantPrivateKey: string; // from env WECHAT_MERCHANT_PRIVATE_KEY (PEM contents of apiclient_key.pem)
    platformPublicKey: string;  // from env WECHAT_PLATFORM_PUBLIC_KEY (PEM of platform cert, for notify verify)
    notifyUrl: string;          // from env NOTIFY_URL (the payment-notify Edge Function URL)
}

export function loadEnv(): WechatPayEnv {
    const required = [
        'WECHAT_APP_ID', 'WECHAT_APP_SECRET', 'WECHAT_MCH_ID', 'WECHAT_API_V3_KEY',
        'WECHAT_MERCHANT_SERIAL_NO', 'WECHAT_MERCHANT_PRIVATE_KEY',
        'WECHAT_PLATFORM_PUBLIC_KEY', 'NOTIFY_URL',
    ];
    for (const k of required) {
        if (!Deno.env.get(k)) throw new Error(`Missing env: ${k}`);
    }
    return {
        appId: Deno.env.get('WECHAT_APP_ID')!,
        appSecret: Deno.env.get('WECHAT_APP_SECRET')!,
        mchId: Deno.env.get('WECHAT_MCH_ID')!,
        apiV3Key: Deno.env.get('WECHAT_API_V3_KEY')!,
        merchantSerialNo: Deno.env.get('WECHAT_MERCHANT_SERIAL_NO')!,
        merchantPrivateKey: Deno.env.get('WECHAT_MERCHANT_PRIVATE_KEY')!,
        platformPublicKey: Deno.env.get('WECHAT_PLATFORM_PUBLIC_KEY')!,
        notifyUrl: Deno.env.get('NOTIFY_URL')!,
    };
}

// ---------------- PEM & Crypto helpers ----------------

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const clean = pem.replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'pkcs8',
        pemToArrayBuffer(pem),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    );
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'spki',
        pemToArrayBuffer(pem),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
    );
}

export async function rsaSign(privateKeyPem: string, message: string): Promise<string> {
    const key = await importPrivateKey(privateKeyPem);
    const enc = new TextEncoder().encode(message);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc);
    return arrayBufferToBase64(sig);
}

export async function rsaVerify(publicKeyPem: string, message: string, signatureB64: string): Promise<boolean> {
    const key = await importPublicKey(publicKeyPem);
    const enc = new TextEncoder().encode(message);
    const sig = base64ToUint8Array(signatureB64);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, enc);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function base64ToUint8Array(b64: string): Uint8Array {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

// ---------------- Authorization header builder ----------------

function randomNonce(len = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    const rand = new Uint8Array(len);
    crypto.getRandomValues(rand);
    for (let i = 0; i < len; i++) out += chars[rand[i] % chars.length];
    return out;
}

export async function buildAuthHeader(
    env: WechatPayEnv,
    method: string,
    urlPath: string,
    body: string,
): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomNonce();
    // signature string per WeChat Pay v3 spec:
    //   HTTP方法\nURL\n时间戳\n随机串\n请求报文主体\n
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = await rsaSign(env.merchantPrivateKey, message);
    return `WECHATPAY2-SHA256-RSA2048 mchid="${env.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.merchantSerialNo}",signature="${signature}"`;
}

// ---------------- AES-256-GCM decryption for notify callback ----------------

export async function aesGcmDecrypt(
    apiV3Key: string,
    associatedData: string,
    nonce: string,
    ciphertextB64: string,
): Promise<string> {
    const keyBytes = new TextEncoder().encode(apiV3Key);
    if (keyBytes.length !== 32) throw new Error('APIv3 key must be 32 bytes');
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const ctWithTag = base64ToUint8Array(ciphertextB64);
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new TextEncoder().encode(nonce), additionalData: new TextEncoder().encode(associatedData) },
        key,
        ctWithTag,
    );
    return new TextDecoder().decode(plaintext);
}

// ---------------- WeChat Pay API calls ----------------

const WECHAT_PAY_BASE = 'https://api.mch.weixin.qq.com';

export interface UnifiedOrderParams {
    description: string;
    outTradeNo: string;
    amount: number;          // fen
    openid: string;
}

export interface UnifiedOrderResult {
    prepayId: string;
}

export async function createJsapiOrder(env: WechatPayEnv, p: UnifiedOrderParams): Promise<UnifiedOrderResult> {
    const urlPath = '/v3/pay/transactions/jsapi';
    const body = JSON.stringify({
        appid: env.appId,
        mchid: env.mchId,
        description: p.description,
        out_trade_no: p.outTradeNo,
        notify_url: env.notifyUrl,
        amount: { total: p.amount, currency: 'CNY' },
        payer: { openid: p.openid },
    });
    const auth = await buildAuthHeader(env, 'POST', urlPath, body);
    const res = await fetch(`${WECHAT_PAY_BASE}${urlPath}`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'dc-pingpong-edge/1.0' },
        body,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`WeChat unified order failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    if (!data.prepay_id) throw new Error(`No prepay_id in response: ${JSON.stringify(data)}`);
    return { prepayId: data.prepay_id };
}

// Generate the final params that mini program passes to wx.requestPayment
export interface MiniProgramPayParams {
    timeStamp: string;
    nonceStr: string;
    package: string; // "prepay_id=xxx"
    signType: 'RSA';
    paySign: string;
}

export async function buildMiniProgramPayParams(env: WechatPayEnv, prepayId: string): Promise<MiniProgramPayParams> {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomNonce();
    const pkg = `prepay_id=${prepayId}`;
    // sign: appId\ntimeStamp\nnonceStr\npackage\n
    const message = `${env.appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
    const paySign = await rsaSign(env.merchantPrivateKey, message);
    return { timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign };
}

// ---------------- Refund ----------------

export interface RefundParams {
    outTradeNo: string;
    outRefundNo: string;
    refundAmount: number;  // fen
    totalAmount: number;   // fen
    reason?: string;
}

export interface RefundResult {
    refundId: string;
    status: string;
}

export async function createRefund(env: WechatPayEnv, p: RefundParams): Promise<RefundResult> {
    const urlPath = '/v3/refund/domestic/refunds';
    const body = JSON.stringify({
        out_trade_no: p.outTradeNo,
        out_refund_no: p.outRefundNo,
        reason: p.reason || '用户取消',
        notify_url: env.notifyUrl,
        amount: { refund: p.refundAmount, total: p.totalAmount, currency: 'CNY' },
    });
    const auth = await buildAuthHeader(env, 'POST', urlPath, body);
    const res = await fetch(`${WECHAT_PAY_BASE}${urlPath}`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'dc-pingpong-edge/1.0' },
        body,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`WeChat refund failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return { refundId: data.refund_id, status: data.status };
}

// ---------------- jscode2session ----------------

export async function code2Openid(env: WechatPayEnv, code: string): Promise<{ openid: string; session_key?: string; unionid?: string }> {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.appId}&secret=${env.appSecret}&js_code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.openid) throw new Error(`jscode2session failed: ${JSON.stringify(data)}`);
    return { openid: data.openid, session_key: data.session_key, unionid: data.unionid };
}

// ---------------- Utility: generate unique order number ----------------

export function generateOutTradeNo(prefix = 'DC'): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const h = String(now.getUTCHours()).padStart(2, '0');
    const min = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
    return `${prefix}${y}${m}${d}${h}${min}${s}${rand}`;
}
