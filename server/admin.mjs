import crypto from "node:crypto";

const COOKIE_NAME = "tiny_moods_admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const cookieValue = (request, name) => {
  const header = request.get("cookie") || "";
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
};

export function createAdminAuth() {
  const password = process.env.ADMIN_PASSWORD || "";
  const configured = Boolean(password);
  const secret = process.env.ADMIN_SESSION_SECRET || crypto.createHash("sha256").update(`tiny-moods:${password || crypto.randomBytes(32).toString("hex")}`).digest("hex");

  const sign = (payload) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const createToken = () => {
    const payload = Buffer.from(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      nonce: crypto.randomBytes(12).toString("base64url"),
    })).toString("base64url");
    return `${payload}.${sign(payload)}`;
  };

  const verifyToken = (token) => {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
    try {
      const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return Number(value.exp) > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  };

  const authenticated = (request) => configured && verifyToken(cookieValue(request, COOKIE_NAME));
  const validPassword = (candidate) => configured && safeEqual(candidate, password);
  const cookie = (token, production) => [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    production ? "Secure" : "",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].filter(Boolean).join("; ");
  const clearCookie = (production) => [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    production ? "Secure" : "",
    "Max-Age=0",
  ].filter(Boolean).join("; ");

  return {
    configured,
    authenticated,
    validPassword,
    createSessionCookie: () => cookie(createToken(), process.env.NODE_ENV === "production"),
    clearSessionCookie: () => clearCookie(process.env.NODE_ENV === "production"),
  };
}
