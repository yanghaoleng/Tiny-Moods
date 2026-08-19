import crypto from "node:crypto";

export const PAYMENT_AMOUNT_CNY = "6.00";
const paymentProvider = () => process.env.PAYMENT_PROVIDER || "xunhu";

const credentialsFor = (channel) => {
  const prefix = channel === "alipay" ? "XUNHU_ALIPAY" : "XUNHU_WECHAT";
  return {
    appid: process.env[`${prefix}_APP_ID`] || "",
    secret: process.env[`${prefix}_APP_SECRET`] || "",
  };
};

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const hashAccessToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const verifyAccessToken = (token, expectedHash) => (
  Boolean(token && expectedHash) && safeEqual(hashAccessToken(token), expectedHash)
);

export const generateXunhuHash = (payload, secret) => {
  const serialized = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== null && value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("md5").update(`${serialized}${secret}`).digest("hex");
};

export const getPaymentStatus = () => {
  if (paymentProvider() === "mock" && process.env.NODE_ENV !== "production") {
    return {provider: "mock", channels: ["wechat", "alipay"], configured: true};
  }
  const channels = ["wechat", "alipay"].filter((channel) => {
    const {appid, secret} = credentialsFor(channel);
    return Boolean(appid && secret);
  });
  return {provider: "xunhu", channels, configured: channels.length > 0};
};

export async function createPayment({order, channel, publicOrigin}) {
  if (paymentProvider() === "mock" && process.env.NODE_ENV !== "production") {
    return {provider: "mock", payUrl: null, qrCodeUrl: null, providerOrderId: null};
  }

  const {appid, secret} = credentialsFor(channel);
  if (!appid || !secret) throw new Error(`${channel === "alipay" ? "支付宝" : "微信"}支付通道尚未配置`);

  const payload = {
    version: "1.1",
    appid,
    trade_order_id: order.id,
    total_fee: PAYMENT_AMOUNT_CNY,
    title: "脸变变视频生成",
    time: Math.floor(Date.now() / 1000),
    notify_url: `${publicOrigin}/api/payments/xunhu/notify`,
    return_url: `${publicOrigin}/?order=${encodeURIComponent(order.id)}`,
    callback_url: publicOrigin,
    plugins: "9face-web",
    attach: channel,
    nonce_str: crypto.randomBytes(12).toString("hex"),
  };
  payload.hash = generateXunhuHash(payload, secret);

  const gateway = process.env.XUNHU_GATEWAY || "https://api.xunhupay.com/payment/do.html";
  const response = await fetch(gateway, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`支付平台请求失败（${response.status}）`);
  const result = await response.json();
  if (!safeEqual(generateXunhuHash(result, secret), result.hash)) throw new Error("支付平台响应验签失败");
  if (Number(result.errcode) !== 0) throw new Error(result.errmsg || "支付订单创建失败");

  return {
    provider: "xunhu",
    payUrl: result.url || null,
    qrCodeUrl: result.url_qrcode || null,
    providerOrderId: result.openid ? String(result.openid) : null,
  };
}

export function verifyXunhuCallback(order, payload) {
  const {appid, secret} = credentialsFor(order.channel);
  if (!appid || !secret) return {ok: false, reason: "channel-unconfigured"};
  if (!safeEqual(payload.appid, appid)) return {ok: false, reason: "appid-mismatch"};
  if (!safeEqual(generateXunhuHash(payload, secret), payload.hash)) return {ok: false, reason: "invalid-signature"};
  if (!safeEqual(payload.trade_order_id, order.id)) return {ok: false, reason: "order-mismatch"};
  if (Number(payload.total_fee) !== Number(PAYMENT_AMOUNT_CNY)) return {ok: false, reason: "amount-mismatch"};
  if (payload.status !== "OD") return {ok: false, reason: "not-paid"};
  return {ok: true};
}
