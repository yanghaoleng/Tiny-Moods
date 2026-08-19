import crypto from "node:crypto";
import {mkdir, readdir, readFile, rename, rm, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import {createAdminAuth} from "./admin.mjs";
import {createAnalyticsStore, summarizeEvents} from "./analytics.mjs";
import {getImageTheme} from "./background.mjs";
import {
  faceFilename,
  writeDemoOriginalSheet,
  writeFaceWebp,
} from "./face-assets.mjs";
import {
  defaultImageModelKey,
  findImageModel,
  publicImageModelOptions,
  resolveImageModel,
} from "./image-models.mjs";
import {buildAvatarManifest, runGenerationPipeline} from "./pipeline.mjs";
import {
  PAYMENT_AMOUNT_CNY,
  createPayment,
  getPaymentStatus,
  hashAccessToken,
  verifyAccessToken,
  verifyXunhuCallback,
} from "./payment.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({path: process.env.ENV_FILE || path.join(projectRoot, ".env.local")});

const app = express();
const port = Number(process.env.PORT || 4173);
const dataRoot = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : projectRoot;
const generatedRoot = path.join(dataRoot, "generated");
const ordersRoot = path.join(dataRoot, "orders");
const adminAuth = createAdminAuth();
const analytics = createAnalyticsStore({dataRoot, salt: process.env.ANALYTICS_SALT});
const jobs = new Map();
const orders = new Map();
const rateHits = new Map();
const workQueue = [];
let activeWork = 0;
const maxConcurrentWork = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS || 1));
const maxOrdersPerHour = Math.max(1, Number(process.env.MAX_ORDERS_PER_HOUR || 10));
const retentionMs = Number(process.env.JOB_RETENTION_HOURS || 168) * 60 * 60 * 1000;
const orderExpiryMs = Number(process.env.ORDER_EXPIRY_MINUTES || 30) * 60 * 1000;
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 12 * 1024 * 1024, files: 1},
  fileFilter: (_request, file, callback) => callback(
    imageMimeTypes.has(file.mimetype) ? null : new Error("仅支持 JPG、PNG 或 WebP 图片"),
    imageMimeTypes.has(file.mimetype),
  ),
});
const faceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 9 * 1024 * 1024, files: 9, fields: 4},
  fileFilter: (_request, file, callback) => callback(
    ["image/png", "image/webp"].includes(file.mimetype) ? null : new Error("本地抠图结果必须是 PNG 或 WebP"),
    ["image/png", "image/webp"].includes(file.mimetype),
  ),
});

const defaultAppearance = Object.freeze({
  backgroundMode: "color",
  patternStyle: "dots",
  decorations: true,
});
const ensureFacePreview = async (directory, index) => {
  const preview = faceFilename(directory, index, "webp");
  try {
    await stat(preview);
  } catch {
    await writeFaceWebp(faceFilename(directory, index, "png"), preview);
  }
  return preview;
};
const uploadedSourceExtension = (file) => {
  if (file.mimetype === "image/png") return "png";
  if (file.mimetype === "image/webp") return "webp";
  return "jpg";
};
const findUploadedSourceFilename = async (job, directory) => {
  const candidates = [
    job.uploadedSourceFilename,
    "upload-original.jpg",
    "upload-original.png",
    "upload-original.webp",
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    try {
      await stat(path.join(directory, candidate));
      return candidate;
    } catch {
      // Older jobs did not keep the uploaded source image.
    }
  }
  return "";
};
const findOriginalSheetFilename = async (job, directory) => {
  const candidates = [
    job.originalSheetFilename,
    "sheet-original.jpg",
    "sheet-original.png",
    "sheet-original.webp",
    "sheet.jpg",
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    try {
      await stat(path.join(directory, candidate));
      return candidate;
    } catch {
      // Older completed jobs may no longer have their original sheet.
    }
  }
  return "";
};
const demoProfiles = [
  {
    id: "jennie",
    title: "Jennie",
    sources: Array.from({length: 9}, (_, index) => path.join(projectRoot, "public", "examples", "jennie", `face-${String(index + 1).padStart(2, "0")}.webp`)),
  },
  {
    id: "tuanzi",
    title: "团子",
    sources: Array.from({length: 9}, (_, index) => path.join(projectRoot, "public", "examples", "tuanzi", `face-${String(index + 1).padStart(2, "0")}.webp`)),
  },
  {
    id: "sun-conure",
    title: "耙耙柑",
    sources: Array.from({length: 9}, (_, index) => path.join(projectRoot, "public", "examples", "sun-conure", `face-${String(index + 1).padStart(2, "0")}.webp`)),
  },
  {
    id: "yangshi-tuotuo",
    title: "羊石坨坨",
    sources: Array.from({length: 9}, (_, index) => path.join(projectRoot, "public", "examples", "yangshi-tuotuo", `face-${String(index + 1).padStart(2, "0")}.webp`)),
  },
];
const patternStyles = new Set(["auto", "dots", "checks", "petals", "confetti", "none"]);
const VISITOR_COOKIE = "tiny_moods_visitor";
const RESUME_COOKIE = "tiny_moods_resume";
const cookieValue = (request, name) => {
  const header = request.get("cookie") || "";
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
};
const visitorCookieValue = (request) => {
  const value = cookieValue(request, VISITOR_COOKIE);
  return /^[a-zA-Z0-9_-]{24,80}$/.test(value) ? value : "";
};
const ensureVisitor = (request, response) => {
  const existing = visitorCookieValue(request);
  if (existing) return existing;
  const visitorId = crypto.randomBytes(24).toString("base64url");
  response.cookie(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  return visitorId;
};

const headerValue = (request, name) => {
  const value = request.get(name);
  return value ? String(value).slice(0, 500) : "";
};
const parseUserAgent = (userAgent = "") => {
  const ua = String(userAgent);
  const wechat = ua.match(/MicroMessenger\/([\d.]+)/i)?.[1] || "";
  const os = ua.match(/iPhone OS ([\d_]+)/i)
    ? `iOS ${ua.match(/iPhone OS ([\d_]+)/i)[1].replaceAll("_", ".")}`
    : ua.match(/iPad.*OS ([\d_]+)/i)
      ? `iPadOS ${ua.match(/OS ([\d_]+)/i)[1].replaceAll("_", ".")}`
      : ua.match(/Android\s+([\d.]+)/i)
        ? `Android ${ua.match(/Android\s+([\d.]+)/i)[1]}`
        : ua.includes("Mac OS X")
          ? "macOS"
          : ua.includes("Windows")
            ? "Windows"
            : "";
  const browser = wechat
    ? `WeChat ${wechat}`
    : ua.match(/Edg\/([\d.]+)/)?.[1]
      ? `Edge ${ua.match(/Edg\/([\d.]+)/)[1]}`
      : ua.match(/CriOS\/([\d.]+)/)?.[1]
        ? `Chrome iOS ${ua.match(/CriOS\/([\d.]+)/)[1]}`
        : ua.match(/Chrome\/([\d.]+)/)?.[1]
          ? `Chrome ${ua.match(/Chrome\/([\d.]+)/)[1]}`
          : ua.match(/Version\/([\d.]+).*Safari/i)?.[1]
            ? `Safari ${ua.match(/Version\/([\d.]+).*Safari/i)[1]}`
            : "";
  const device = ua.includes("iPad")
    ? "iPad"
    : ua.includes("iPhone")
      ? "iPhone"
      : ua.match(/Android[^;]*;\s*([^;)]+)\)/i)?.[1]?.trim() || (ua.includes("Android") ? "Android" : ua.includes("Macintosh") ? "Mac" : ua.includes("Windows") ? "Windows PC" : "");
  return {device, os, browser, wechatVersion: wechat};
};
const requestInfoFrom = (request) => {
  const userAgent = headerValue(request, "user-agent");
  const locationHint = {
    country: headerValue(request, "cf-ipcountry") || headerValue(request, "x-vercel-ip-country"),
    region: headerValue(request, "x-vercel-ip-country-region"),
    city: headerValue(request, "x-vercel-ip-city"),
    timezone: headerValue(request, "x-vercel-ip-timezone"),
  };
  return {
    ip: request.ip || "",
    ips: request.ips || [],
    forwardedFor: headerValue(request, "x-forwarded-for"),
    realIp: headerValue(request, "x-real-ip") || headerValue(request, "cf-connecting-ip") || headerValue(request, "true-client-ip"),
    protocol: request.protocol,
    host: headerValue(request, "host"),
    origin: headerValue(request, "origin"),
    referer: headerValue(request, "referer"),
    acceptLanguage: headerValue(request, "accept-language"),
    userAgent,
    clientHints: {
      ua: headerValue(request, "sec-ch-ua"),
      platform: headerValue(request, "sec-ch-ua-platform"),
      mobile: headerValue(request, "sec-ch-ua-mobile"),
      model: headerValue(request, "sec-ch-ua-model"),
    },
    locationHint,
    device: parseUserAgent(userAgent),
    capturedAt: new Date().toISOString(),
  };
};
const uploadedSourceInfo = async (file) => {
  const image = await sharp(file.buffer).metadata().catch(() => ({}));
  return {
    originalName: path.basename(file.originalname || ""),
    mimeType: file.mimetype,
    bytes: file.size,
    width: image.width || null,
    height: image.height || null,
    format: image.format || null,
    orientation: image.orientation || null,
    hasProfile: Boolean(image.hasProfile),
    hasAlpha: Boolean(image.hasAlpha),
  };
};
const writeUploadedSource = async (file, directory) => {
  const extension = uploadedSourceExtension(file);
  const filename = `upload-original.${extension}`;
  await writeFile(path.join(directory, filename), file.buffer, {mode: 0o600});
  return filename;
};
const friendlyGenerationError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/Lite.*403|尚未开通 Lite|Lite 模型权限/i.test(message)) {
    return "Seedream 5.0 Lite 暂未开通调用权限，请联系作者处理";
  }
  if (/Seedream 请求失败（?403|AccessDenied|Forbidden/i.test(message)) {
    return "生成模型暂时没有访问权限，请稍后再试，或联系管理员检查火山方舟模型权限";
  }
  if (/timeout|aborted|超时/i.test(message)) return "生成模型响应超时，请稍后再试";
  if (/ARK_API_KEY/i.test(message)) return "生成服务密钥尚未配置，请联系管理员";
  return "生成服务没有完成，请稍后重试";
};

const normalizeAppearance = (value = {}) => ({
  backgroundMode: value.backgroundMode === "white" ? "white" : "color",
  patternStyle: patternStyles.has(value.patternStyle) ? value.patternStyle : "dots",
  decorations: value.decorations !== false,
});

const publicJob = (job) => {
  if (!job) return null;
  const {
    internalError: _internalError,
    accessTokenHash: _accessTokenHash,
    visitorId: _visitorId,
    videoUrl: _videoUrl,
    renderError: _renderError,
    originalSheetFilename: _originalSheetFilename,
    uploadedSourceFilename: _uploadedSourceFilename,
    uploadRequest: _uploadRequest,
    uploadedSource: _uploadedSource,
    ...safe
  } = job;
  safe.videoStatus = "local";
  const assetRevision = job.demoAssetsVersion
    ? `demo-${job.demoAssetsVersion}`
    : String(job.assetRevision || job.createdAt || "1");
  const withAssetRevision = (src) => `${src}${src.includes("?") ? "&" : "?"}v=${encodeURIComponent(assetRevision)}`;
  if (Array.isArray(safe.avatars)) {
    safe.avatars = safe.avatars.map((avatar) => ({
      ...avatar,
      src: withAssetRevision(avatar.src),
      ...(avatar.downloadSrc ? {downloadSrc: withAssetRevision(avatar.downloadSrc)} : {}),
    }));
  }
  if (safe.originalImageUrl) safe.originalImageUrl = withAssetRevision(safe.originalImageUrl);
  return safe;
};

const ownsJob = (request, job) => Boolean(job?.visitorId && visitorCookieValue(request) === job.visitorId);
const publicJobForRequest = (job, request) => ({...publicJob(job), owned: ownsJob(request, job)});
const historyJob = (job) => ({
  id: job.id,
  title: job.title,
  status: job.status,
  stage: job.stage,
  progress: job.progress,
  pageUrl: job.status === "ready" && job.pageUrl ? job.pageUrl : `/?job=${job.id}`,
  previewUrl: job.avatars?.[0]?.src || null,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  completedAt: job.completedAt || null,
});

const publicOrder = (order) => {
  if (!order) return null;
  const {accessTokenHash: _accessTokenHash, providerOrderId: _providerOrderId, visitorId: _visitorId, ...safe} = order;
  return safe;
};

const publicAdminEvent = (event) => ({
  id: event.id,
  name: event.name,
  sessionId: event.sessionId,
  page: event.page,
  jobId: event.jobId,
  demoId: event.demoId,
  durationMs: event.durationMs,
  properties: event.properties,
  device: event.device,
  browser: event.browser,
  os: event.os,
  trafficSource: event.trafficSource,
  location: event.location,
  occurredAt: event.occurredAt,
  receivedAt: event.receivedAt,
});

const adminJob = (job, request, analyticsMetrics = {}) => {
  const origin = publicOriginFor(request);
  const safe = publicJob(job);
  const order = job.orderId ? orders.get(job.orderId) : null;
  const fixedPath = job.status === "ready" && job.pageUrl ? job.pageUrl : `/?job=${job.id}`;
  return {
    ...safe,
    sheetUrl: safe.originalImageUrl || (job.status === "awaiting_client_processing" ? `/api/admin/jobs/${job.id}/sheet` : null),
    shareUrl: job.pageUrl ? `${origin}${job.pageUrl.startsWith("/") ? "" : "/"}${job.pageUrl}` : null,
    fixedUrl: `${origin}${fixedPath}`,
    adminOpenUrl: job.status === "ready" && job.pageUrl
      ? `${origin}${job.pageUrl}`
      : `${origin}/api/admin/jobs/${job.id}/resume`,
    uploadedSourceUrl: job.uploadedSourceFilename ? `/api/admin/jobs/${job.id}/upload` : null,
    imageUrls: (safe.avatars || []).map((avatar) => `${origin}${avatar.src.startsWith("/") ? "" : "/"}${avatar.src}`),
    generationError: job.internalError || job.error || null,
    generationSeconds: job.completedAt ? Math.max(0, Math.round((Date.parse(job.completedAt) - Date.parse(job.createdAt)) / 1000)) : null,
    uploadedSource: job.uploadedSource || null,
    uploadRequest: job.uploadRequest || null,
    order: order ? {
      id: order.id,
      status: order.status,
      channel: order.channel,
      provider: order.provider,
      amountCny: order.amountCny,
      suggestedDonationCny: order.suggestedDonationCny,
      modelTier: order.modelTier,
      model: order.model,
      modelLabel: order.modelLabel,
      generatedImageSize: order.generatedImageSize,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      consumedAt: order.consumedAt,
    } : null,
    analytics: analyticsMetrics,
  };
};

const atomicWriteJson = async (filename, value) => {
  const temporary = `${filename}.${crypto.randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), {encoding: "utf8", mode: 0o600});
  await rename(temporary, filename);
};

const persistJob = async (job) => {
  const directory = path.join(generatedRoot, job.id);
  await mkdir(directory, {recursive: true});
  await atomicWriteJson(path.join(directory, "job.json"), job);
};

const persistOrder = async (order) => {
  await mkdir(ordersRoot, {recursive: true});
  await atomicWriteJson(path.join(ordersRoot, `${order.id}.json`), order);
};

const updateJob = async (id, patch) => {
  const current = jobs.get(id);
  if (!current) return null;
  const next = {...current, ...patch, updatedAt: new Date().toISOString()};
  jobs.set(id, next);
  await persistJob(next);
  return next;
};

const updateOrder = async (id, patch) => {
  const current = orders.get(id);
  if (!current) return null;
  const next = {...current, ...patch, updatedAt: new Date().toISOString()};
  orders.set(id, next);
  await persistOrder(next);
  return next;
};

const drainWorkQueue = () => {
  while (activeWork < maxConcurrentWork && workQueue.length > 0) {
    const task = workQueue.shift();
    activeWork += 1;
    Promise.resolve()
      .then(task)
      .catch((error) => console.error("Work queue error:", error instanceof Error ? error.message : String(error)))
      .finally(() => {
        activeWork -= 1;
        drainWorkQueue();
      });
  }
};

const enqueueWork = (task) => {
  workQueue.push(task);
  drainWorkQueue();
};

const restoreState = async () => {
  await Promise.all([mkdir(generatedRoot, {recursive: true}), mkdir(ordersRoot, {recursive: true})]);
  for (const entry of await readdir(generatedRoot, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    try {
      const job = JSON.parse(await readFile(path.join(generatedRoot, entry.name, "job.json"), "utf8"));
      if (job.title === "小太阳") job.title = "耙耙柑";
      if (job.status === "failed" && job.internalError) {
        const nextError = friendlyGenerationError(job.internalError);
        if (job.error !== nextError) {
          job.error = nextError;
          job.updatedAt = new Date().toISOString();
          await persistJob(job);
        }
      }
      if (["queued", "generating", "rendering"].includes(job.status)) {
        job.status = job.avatars?.length === 9 ? "ready" : "failed";
        job.stage = job.avatars?.length === 9 ? "素材已保留，视频可在浏览器本机生成" : "任务在服务重启时中断";
        job.error = job.avatars?.length === 9 ? null : "请返回首页重新发起生成";
        job.updatedAt = new Date().toISOString();
        await persistJob(job);
      }
      if (job.avatars?.length === 9 && job.permanent !== true) {
        job.permanent = true;
        job.expiresAt = null;
      }
      if (job.avatars?.length === 9) {
        const directory = path.join(generatedRoot, job.id);
        await Promise.all(Array.from({length: 9}, (_, index) => ensureFacePreview(directory, index + 1)));
        delete job.videoUrl;
        delete job.renderError;
        job.videoStatus = "local";
        job.avatars = job.avatars.map(({downloadSrc: _downloadSrc, ...avatar}, index) => ({
          ...avatar,
          src: `/generated/${job.id}/face-${String(index + 1).padStart(2, "0")}.webp`,
          label: `${job.title} 表情 ${index + 1}`,
        }));
        delete job.downloadArchiveUrl;
        const originalSheetFilename = await findOriginalSheetFilename(job, directory);
        if (originalSheetFilename) {
          job.originalSheetFilename = originalSheetFilename;
          job.originalImageUrl = `/generated/${job.id}/ai-original`;
        } else {
          delete job.originalSheetFilename;
          delete job.originalImageUrl;
        }
        job.pageUrl = `/?view=${job.id}`;
        await persistJob(job);
      }
      jobs.set(job.id, job);
    } catch {
      // Stale or incomplete folders are ignored and removed by cleanup.
    }
  }
  for (const entry of await readdir(ordersRoot, {withFileTypes: true})) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const order = JSON.parse(await readFile(path.join(ordersRoot, entry.name), "utf8"));
      if (order.status === "pending" && Date.parse(order.expiresAt) < Date.now()) order.status = "expired";
      orders.set(order.id, order);
    } catch {
      // Keep other valid orders available.
    }
  }
};

const ensureDemoJobs = async () => {
  for (const profile of demoProfiles) {
    const id = `demo-${profile.id}`;
    const directory = path.join(generatedRoot, id);
    const existing = jobs.get(id);
    const demoAssetsVersion = 7;
    await mkdir(directory, {recursive: true});
    const facePaths = [];
    for (let index = 0; index < profile.sources.length; index += 1) {
      const target = faceFilename(directory, index + 1, "webp");
      facePaths.push(target);
      try {
        if (existing?.demoAssetsVersion !== demoAssetsVersion) throw new Error("refresh demo assets");
        await stat(target);
      } catch {
        await writeFaceWebp(profile.sources[index], target);
      }
    }
    const themes = await Promise.all(facePaths.map(getImageTheme));
    const originalSheetFilename = "sheet-original.jpg";
    try {
      if (existing?.demoAssetsVersion !== demoAssetsVersion) throw new Error("refresh demo original");
      await stat(path.join(directory, originalSheetFilename));
    } catch {
      await writeDemoOriginalSheet(profile.sources, path.join(directory, originalSheetFilename));
    }
    await Promise.all(Array.from({length: 9}, (_, index) => rm(faceFilename(directory, index + 1, "png"), {force: true})));
    await rm(path.join(directory, "faces-jpg-v2.zip"), {force: true});
    const createdAt = existing?.createdAt || new Date().toISOString();
    const job = {
      ...existing,
      id,
      title: profile.title,
      demo: true,
      demoId: profile.id,
      demoAssetsVersion,
      status: "ready",
      stage: "示例互动页已准备好，视频可在浏览器本机生成",
      progress: 100,
      appearance: normalizeAppearance(existing?.appearance || defaultAppearance),
      avatars: buildAvatarManifest(id, profile.title, "", themes),
      originalSheetFilename,
      originalImageUrl: `/generated/${id}/ai-original`,
      pageUrl: `/?demo=${profile.id}`,
      permanent: true,
      expiresAt: null,
      videoStatus: "local",
      createdAt,
      updatedAt: new Date().toISOString(),
    };
    delete job.videoUrl;
    delete job.renderError;
    delete job.downloadArchiveUrl;
    jobs.set(id, job);
    await persistJob(job);
  }
};

const cleanupExpiredJobs = async () => {
  const now = Date.now();
  for (const entry of await readdir(generatedRoot, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    if (jobs.get(entry.name)?.permanent === true) continue;
    const directory = path.join(generatedRoot, entry.name);
    const details = await stat(directory);
    if (now - details.mtimeMs <= retentionMs) continue;
    await rm(directory, {recursive: true, force: true});
    jobs.delete(entry.name);
  }
};

const publicOriginFor = (request) => (
  process.env.PUBLIC_ORIGIN || `${request.protocol}://${request.get("host")}`
).replace(/\/$/, "");

const accessTokenFrom = (request) => request.get("x-access-token") || request.query.token || "";
const searchResumeTokenFor = (job) => crypto
  .createHmac("sha256", job.accessTokenHash)
  .update(`tiny-moods-search-resume:${job.id}`)
  .digest("base64url");
const verifySearchResumeToken = (token, job) => {
  if (!token || !job?.accessTokenHash) return false;
  const supplied = Buffer.from(String(token));
  const expected = Buffer.from(searchResumeTokenFor(job));
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};
const canProcessJob = (request, job) => (
  ownsJob(request, job)
  || verifyAccessToken(accessTokenFrom(request), job.accessTokenHash)
  || verifySearchResumeToken(accessTokenFrom(request), job)
  || verifySearchResumeToken(cookieValue(request, RESUME_COOKIE), job)
);

const rateAllowed = (key, limit) => {
  const now = Date.now();
  const recent = (rateHits.get(key) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= limit) return false;
  rateHits.set(key, [...recent, now]);
  return true;
};

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.urlencoded({extended: false, limit: "256kb"}));
app.use(express.json({limit: "1mb"}));

const requireAdmin = (request, response, next) => {
  if (!adminAuth.configured) return response.status(503).json({error: "管理后台尚未配置 ADMIN_PASSWORD"});
  if (!adminAuth.authenticated(request)) return response.status(401).json({error: "请先登录管理后台"});
  next();
};

const analyticsDaysFrom = (request) => {
  const value = Number(request.query.days ?? 7);
  return [0, 1, 7, 30, 90].includes(value) ? value : 7;
};

app.post("/api/analytics/events", async (request, response) => {
  const ip = request.ip || "unknown";
  if (!rateAllowed(`analytics:${ip}`, 5000)) return response.status(429).json({error: "事件上报过于频繁"});
  const accepted = await analytics.record(request.body, request);
  response.status(202).json({ok: true, accepted});
});

app.get("/api/admin/session", (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json({configured: adminAuth.configured, authenticated: adminAuth.authenticated(request)});
});

app.post("/api/admin/session", (request, response) => {
  if (!adminAuth.configured) return response.status(503).json({error: "请先在服务器配置 ADMIN_PASSWORD"});
  const ip = request.ip || "unknown";
  if (!rateAllowed(`admin-login:${ip}`, 12)) return response.status(429).json({error: "登录尝试过于频繁，请稍后再试"});
  if (!adminAuth.validPassword(String(request.body.password || ""))) return response.status(401).json({error: "管理密码不正确"});
  response.setHeader("Set-Cookie", adminAuth.createSessionCookie());
  response.setHeader("Cache-Control", "no-store");
  response.json({configured: true, authenticated: true});
});

app.delete("/api/admin/session", (_request, response) => {
  response.setHeader("Set-Cookie", adminAuth.clearSessionCookie());
  response.status(204).end();
});

app.get("/api/admin/dashboard", requireAdmin, async (request, response) => {
  const days = analyticsDaysFrom(request);
  const events = await analytics.list({days, limit: 250_000});
  const analyticsSummary = summarizeEvents(events);
  const includeDemos = request.query.includeDemos === "1";
  const query = String(request.query.q || "").trim().toLowerCase().slice(0, 80);
  const status = String(request.query.status || "all");
  const page = Math.max(1, Number(request.query.page) || 1);
  const pageSize = Math.max(12, Math.min(100, Number(request.query.pageSize) || 36));
  const allJobs = [...jobs.values()].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const realJobs = allJobs.filter((job) => !job.demo);
  const eligibleJobs = includeDemos ? allJobs : realJobs;
  const filteredJobs = eligibleJobs.filter((job) => {
    if (status !== "all" && job.status !== status) return false;
    if (!query) return true;
    return [job.id, job.orderId, job.title, job.modelTier, job.modelLabel, job.model, job.status].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const offset = (page - 1) * pageSize;
  const pagedJobs = filteredJobs.slice(offset, offset + pageSize).map((job) => adminJob(job, request, analyticsSummary.perJob[job.id] || {}));
  const chinaDateKey = (value) => new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = chinaDateKey(new Date().toISOString());
  const totalEstimatedCostCny = realJobs.reduce((total, job) => total + Number(job.seedreamCostEstimate?.estimatedTotalCny || 0), 0);

  response.setHeader("Cache-Control", "no-store");
  response.json({
    rangeDays: days,
    overview: {
      totalJobs: realJobs.length,
      readyJobs: realJobs.filter((job) => job.status === "ready").length,
      failedJobs: realJobs.filter((job) => job.status === "failed").length,
      processingJobs: realJobs.filter((job) => !["ready", "failed"].includes(job.status)).length,
      todayJobs: realJobs.filter((job) => job.createdAt && chinaDateKey(job.createdAt) === today).length,
      permanentJobs: realJobs.filter((job) => job.permanent).length,
      totalImages: realJobs.reduce((total, job) => total + (job.avatars?.length || 0), 0),
      demoJobs: allJobs.filter((job) => job.demo).length,
      totalEstimatedCostCny: Number(totalEstimatedCostCny.toFixed(2)),
      visits: analyticsSummary.visits,
      uniqueSessions: analyticsSummary.uniqueSessions,
      interactions: analyticsSummary.interactions,
      averageStaySeconds: analyticsSummary.averageStaySeconds,
      visibleSeconds: analyticsSummary.visibleSeconds,
    },
    topActions: analyticsSummary.topActions,
    acquisition: analyticsSummary.acquisition,
    daily: analyticsSummary.daily,
    jobs: pagedJobs,
    pagination: {
      page,
      pageSize,
      total: filteredJobs.length,
      pages: Math.max(1, Math.ceil(filteredJobs.length / pageSize)),
    },
    recentEvents: events.slice(0, 60).map(publicAdminEvent),
  });
});

app.get("/api/admin/jobs/:id/events", requireAdmin, async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job) return response.status(404).json({error: "没有找到这个生成任务"});
  const days = analyticsDaysFrom(request);
  const limit = Math.max(20, Math.min(1000, Number(request.query.limit) || 200));
  const events = await analytics.list({days, jobId: job.id, limit});
  response.setHeader("Cache-Control", "no-store");
  response.json({job: adminJob(job, request, summarizeEvents(events).perJob[job.id] || {}), summary: summarizeEvents(events), events: events.map(publicAdminEvent)});
});

app.get("/api/admin/jobs/:id/upload", requireAdmin, async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job) return response.status(404).end();
  const directory = path.join(generatedRoot, job.id);
  const uploadedSourceFilename = await findUploadedSourceFilename(job, directory);
  if (!uploadedSourceFilename) return response.status(404).end();
  const extension = path.extname(uploadedSourceFilename) || ".jpg";
  const sourceFile = path.join(directory, uploadedSourceFilename);
  const title = String(job.title || "Tiny Moods").replace(/[<>/\\]/g, "").trim() || "Tiny Moods";
  response.setHeader("Cache-Control", "private, no-store");
  if (request.query.download === "1") return response.download(sourceFile, `${title}-用户上传原图${extension}`);
  return response.sendFile(sourceFile);
});

app.get("/api/admin/jobs/:id/sheet", requireAdmin, async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job) return response.status(404).end();
  const directory = path.join(generatedRoot, job.id);
  const originalSheetFilename = await findOriginalSheetFilename(job, directory);
  if (!originalSheetFilename) return response.status(404).end();
  response.setHeader("Cache-Control", "private, no-store");
  response.sendFile(path.join(directory, originalSheetFilename));
});

app.get("/api/admin/jobs/:id/resume", requireAdmin, (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job || job.demo) return response.status(404).json({error: "没有找到这个作品"});
  response.cookie(RESUME_COOKIE, searchResumeTokenFor(job), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
  response.redirect(303, `/?job=${encodeURIComponent(job.id)}`);
});

app.get("/api/health", (_request, response) => {
  const payment = getPaymentStatus();
  const defaultModel = resolveImageModel(defaultImageModelKey());
  response.setHeader("Cache-Control", "no-store");
  response.json({
    ok: true,
    configured: Boolean(process.env.ARK_API_KEY) || process.env.GENERATOR_DEMO_MODE === "1",
    demoMode: process.env.GENERATOR_DEMO_MODE === "1",
    model: defaultModel.model,
    priceCny: defaultModel.priceCny,
    suggestedDonationCny: defaultModel.priceCny,
    defaultImageModel: defaultModel.key,
    imageModels: publicImageModelOptions(),
    legacyPaidPriceCny: PAYMENT_AMOUNT_CNY,
    payment,
    donationMode: true,
    freeGeneration: true,
    hybridProcessing: false,
    localMediaProcessing: true,
    clientVideoRendering: true,
    serverVideoRendering: false,
  });
});

app.get("/api/history", (request, response) => {
  const visitorId = ensureVisitor(request, response);
  const items = [...jobs.values()]
    .filter((job) => !job.demo && job.visitorId === visitorId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map(historyJob);
  response.setHeader("Cache-Control", "private, no-store");
  response.json({items});
});

app.get("/api/works/search", (request, response) => {
  const name = String(request.query.name || "").normalize("NFKC").trim().slice(0, 20);
  if (!name) return response.status(400).json({error: "请输入完整名字"});
  const ip = request.ip || "unknown";
  if (!rateAllowed(`work-search:${ip}`, 120)) return response.status(429).json({error: "查询太频繁，请稍后再试"});
  const normalizedName = name.toLocaleLowerCase("zh-CN");
  const items = [...jobs.values()]
    .filter((job) => !job.demo && String(job.title || "").normalize("NFKC").trim().toLocaleLowerCase("zh-CN") === normalizedName)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((job) => ({
      ...historyJob(job),
      ...(!["ready", "failed"].includes(job.status) ? {resumeToken: searchResumeTokenFor(job)} : {}),
    }));
  response.setHeader("Cache-Control", "no-store");
  response.json({items});
});

app.post("/api/orders/donation", async (request, response) => {
  const ip = request.ip || "unknown";
  if (!rateAllowed(`donation:${ip}`, maxOrdersPerHour)) return response.status(429).json({error: "生成请求过于频繁，请稍后再试"});

  const id = `D${Date.now().toString(36)}${crypto.randomBytes(6).toString("hex")}`.slice(0, 32);
  const accessToken = crypto.randomBytes(24).toString("base64url");
  const now = new Date();
  const title = String(request.body.title || "我的").replace(/[<>/\\]/g, "").trim().slice(0, 20) || "我的";
  const requestedModelKey = String(request.body.model || defaultImageModelKey());
  const selectedModel = findImageModel(requestedModelKey);
  if (!selectedModel) return response.status(400).json({error: "请选择可用的生成模型"});
  const order = {
    id,
    title,
    channel: "donation",
    provider: "voluntary_tip",
    amountCny: "0.00",
    suggestedDonationCny: selectedModel.priceCny,
    modelTier: selectedModel.key,
    model: selectedModel.model,
    modelLabel: selectedModel.label,
    generatedImageSize: selectedModel.size,
    status: "paid",
    visitorId: ensureVisitor(request, response),
    accessTokenHash: hashAccessToken(accessToken),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    paidAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + orderExpiryMs).toISOString(),
  };
  orders.set(id, order);
  await persistOrder(order);
  response.status(201).json({...publicOrder(order), accessToken});
});

app.post("/api/orders", async (request, response) => {
  const payment = getPaymentStatus();
  const channel = request.body.channel === "alipay" ? "alipay" : "wechat";
  if (!payment.channels.includes(channel)) return response.status(503).json({error: "这个支付通道正在配置中"});
  const ip = request.ip || "unknown";
  if (!rateAllowed(`order:${ip}`, maxOrdersPerHour)) return response.status(429).json({error: "订单创建过于频繁，请稍后再试"});

  const id = `F${Date.now().toString(36)}${crypto.randomBytes(6).toString("hex")}`.slice(0, 32);
  const accessToken = crypto.randomBytes(24).toString("base64url");
  const now = new Date();
  const title = String(request.body.title || "我的").replace(/[<>/\\]/g, "").trim().slice(0, 20) || "我的";
  const order = {
    id,
    title,
    channel,
    provider: payment.provider,
    amountCny: PAYMENT_AMOUNT_CNY,
    status: "pending",
    visitorId: ensureVisitor(request, response),
    accessTokenHash: hashAccessToken(accessToken),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + orderExpiryMs).toISOString(),
  };
  orders.set(id, order);
  await persistOrder(order);
  try {
    const paymentResult = await createPayment({order, channel, publicOrigin: publicOriginFor(request)});
    const readyOrder = await updateOrder(id, paymentResult);
    response.status(201).json({...publicOrder(readyOrder), accessToken});
  } catch (error) {
    await updateOrder(id, {status: "failed"});
    response.status(502).json({error: error instanceof Error ? error.message : "支付订单创建失败"});
  }
});

app.get("/api/orders/:id", async (request, response) => {
  const order = orders.get(request.params.id);
  if (!order || !verifyAccessToken(accessTokenFrom(request), order.accessTokenHash)) {
    return response.status(404).json({error: "没有找到这个订单"});
  }
  if (order.status === "pending" && Date.parse(order.expiresAt) < Date.now()) await updateOrder(order.id, {status: "expired"});
  response.setHeader("Cache-Control", "no-store");
  response.json(publicOrder(orders.get(order.id)));
});

app.post("/api/orders/:id/mock-pay", async (request, response) => {
  if (process.env.PAYMENT_PROVIDER !== "mock" || process.env.NODE_ENV === "production") return response.status(404).end();
  const order = orders.get(request.params.id);
  if (!order || !verifyAccessToken(accessTokenFrom(request), order.accessTokenHash)) return response.status(404).json({error: "没有找到这个订单"});
  const paid = await updateOrder(order.id, {status: "paid", paidAt: new Date().toISOString(), providerTransactionId: `mock_${Date.now()}`});
  response.json(publicOrder(paid));
});

app.post("/api/payments/xunhu/notify", async (request, response) => {
  const order = orders.get(String(request.body.trade_order_id || ""));
  if (!order) return response.status(404).type("text/plain").send("fail");
  const verified = verifyXunhuCallback(order, request.body);
  if (!verified.ok) return response.status(400).type("text/plain").send("fail");
  if (order.status !== "paid") {
    await updateOrder(order.id, {
      status: "paid",
      paidAt: new Date().toISOString(),
      providerTransactionId: String(request.body.transaction_id || ""),
      providerOrderId: String(request.body.open_order_id || order.providerOrderId || ""),
    });
  }
  response.type("text/plain").send("success");
});

app.post("/api/jobs", photoUpload.single("photo"), async (request, response) => {
  if (!request.file) return response.status(400).json({error: "请上传一张 JPG、PNG 或 WebP 图片"});
  if (request.body.consent !== "true") return response.status(400).json({error: "请先确认您有权使用这张照片"});
  const order = orders.get(String(request.body.orderId || ""));
  const accessToken = String(request.body.accessToken || "");
  if (!order || !verifyAccessToken(accessToken, order.accessTokenHash)) return response.status(403).json({error: "订单校验失败"});
  if (order.status !== "paid") return response.status(402).json({error: "订单尚未支付"});
  if (order.jobId) {
    const existing = jobs.get(order.jobId);
    if (existing) return response.status(200).json({...publicJob(existing), accessToken});
  }

  const id = crypto.randomUUID().replaceAll("-", "");
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const fallbackModel = resolveImageModel(order.modelTier);
  const selectedModel = {
    ...fallbackModel,
    key: order.modelTier || fallbackModel.key,
    label: order.modelLabel || fallbackModel.label,
    model: order.model || fallbackModel.model,
    size: order.generatedImageSize || fallbackModel.size,
    priceCny: order.suggestedDonationCny || fallbackModel.priceCny,
  };
  const directory = path.join(generatedRoot, id);
  await mkdir(directory, {recursive: true});
  const [uploadedSourceFilename, uploadedSource] = await Promise.all([
    writeUploadedSource(request.file, directory),
    uploadedSourceInfo(request.file),
  ]);
  const job = {
    id,
    orderId: order.id,
    visitorId: order.visitorId || ensureVisitor(request, response),
    title: order.title,
    status: "queued",
    stage: "正在排队",
    progress: 2,
    resumeUrl: `/?job=${id}`,
    appearance: defaultAppearance,
    accessTokenHash: order.accessTokenHash,
    payment: {
      status: order.provider === "voluntary_tip" ? "donation_optional" : "paid",
      amountCny: order.amountCny || PAYMENT_AMOUNT_CNY,
      suggestedDonationCny: selectedModel.priceCny,
      channel: order.channel,
    },
    renderCount: 0,
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(now + retentionMs).toISOString(),
    modelTier: selectedModel.key,
    model: selectedModel.model,
    modelLabel: selectedModel.label,
    generatedImageSize: selectedModel.size,
    suggestedDonationCny: selectedModel.priceCny,
    uploadedSourceFilename,
    uploadedSource,
    uploadRequest: requestInfoFrom(request),
  };
  jobs.set(id, job);
  await persistJob(job);
  await updateOrder(order.id, {jobId: id, consumedAt: createdAt});
  response.status(202).json({...publicJobForRequest(job, request), accessToken});

  const publicOrigin = publicOriginFor(request);
  enqueueWork(async () => {
    try {
      await runGenerationPipeline({
        job,
        sourceBuffer: request.file.buffer,
        projectRoot,
        generatedRoot,
        publicOrigin,
        update: (patch) => updateJob(id, patch),
      });
    } catch (error) {
      await updateJob(id, {
        status: "failed",
        stage: "生成没有完成",
        error: friendlyGenerationError(error),
        internalError: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

app.get("/api/jobs/:id", (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job) return response.status(404).json({error: "没有找到这个生成任务"});
  response.setHeader("Cache-Control", "no-store");
  response.json(publicJobForRequest(job, request));
});

app.patch("/api/jobs/:id/appearance", async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job || (!ownsJob(request, job) && !verifyAccessToken(accessTokenFrom(request), job.accessTokenHash))) {
    return response.status(404).json({error: "没有找到这个作品"});
  }
  const appearance = normalizeAppearance(request.body);
  const next = await updateJob(job.id, {appearance});
  response.setHeader("Cache-Control", "private, no-store");
  response.json({appearance: next.appearance});
});

app.get("/api/jobs/:id/sheet", async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job || !canProcessJob(request, job)) return response.status(404).end();
  const directory = path.join(generatedRoot, job.id);
  const originalSheetFilename = await findOriginalSheetFilename(job, directory);
  if (!originalSheetFilename) return response.status(404).end();
  response.setHeader("Cache-Control", "private, no-store");
  response.sendFile(path.join(directory, originalSheetFilename));
});

app.post("/api/jobs/:id/faces", faceUpload.array("faces", 9), async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job || !canProcessJob(request, job)) return response.status(404).json({error: "没有找到这个任务"});
  if (job.avatars?.length === 9) return response.json(publicJob(job));
  if (job.status !== "awaiting_client_processing") return response.status(409).json({error: "任务暂时不能接收抠图结果"});
  if (request.files?.length !== 9) return response.status(400).json({error: "需要上传九张透明表情"});

  const directory = path.join(generatedRoot, job.id);
  try {
    const facePaths = Array.from({length: 9}, (_, index) => faceFilename(directory, index + 1, "webp"));
    await Promise.all(request.files.map((file, index) => writeFaceWebp(file.buffer, facePaths[index])));
    const themes = await Promise.all(facePaths.map(getImageTheme));
    await Promise.all(Array.from({length: 9}, (_, index) => rm(faceFilename(directory, index + 1, "png"), {force: true})));
    const originalSheetFilename = await findOriginalSheetFilename(job, directory);
    const avatars = buildAvatarManifest(job.id, job.title, publicOriginFor(request), themes);
    const next = await updateJob(job.id, {
      status: "ready",
      stage: "AI 原图、轻量表情和互动页已完成，视频可在浏览器本机生成",
      progress: 100,
      avatars,
      originalSheetFilename: originalSheetFilename || undefined,
      originalImageUrl: originalSheetFilename ? `/generated/${job.id}/ai-original` : undefined,
      downloadArchiveUrl: undefined,
      assetRevision: Date.now(),
      videoStatus: "local",
      pageUrl: `/?view=${job.id}`,
      permanent: true,
      expiresAt: null,
      completedAt: new Date().toISOString(),
    });
    response.status(201).json(publicJob(next));
  } catch (error) {
    response.status(400).json({error: "抠图结果无法读取，请重新处理"});
  }
});

app.post("/api/jobs/:id/renders", async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job || !verifyAccessToken(accessTokenFrom(request), job.accessTokenHash)) return response.status(404).json({error: "没有找到这个任务"});
  if (!job.avatars?.length) return response.status(409).json({error: "九张表情还没有准备好"});
  return response.status(410).json({error: "视频已改为浏览器本机生成，请刷新页面后点击保存视频"});
});

app.post("/api/public/jobs/:id/renders", async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job?.permanent || !job.avatars?.length) return response.status(404).json({error: "没有找到这个永久作品"});
  return response.status(410).json({error: "视频已改为浏览器本机生成，请刷新页面后点击保存视频"});
});

app.get("/generated/:id/:filename", async (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job) return response.status(404).end();
  if (!/^(?:face-\d{2}\.(?:png|webp)|ai-original|video\.mp4)$/.test(request.params.filename)) return response.status(404).end();
  response.setHeader("Cache-Control", request.params.filename === "video.mp4" ? "private, no-cache" : "private, max-age=31536000, immutable");
  const directory = path.join(generatedRoot, request.params.id);
  const filename = path.join(directory, request.params.filename);
  const title = String(job.title || "Tiny Moods").replace(/[<>/\\]/g, "").trim() || "Tiny Moods";

  if (request.params.filename === "ai-original") {
    if (!job.permanent) return response.status(404).end();
    const originalSheetFilename = await findOriginalSheetFilename(job, directory);
    if (!originalSheetFilename) return response.status(404).end();
    const extension = path.extname(originalSheetFilename) || ".jpg";
    const originalFile = path.join(directory, originalSheetFilename);
    if (request.query.download === "1") return response.download(originalFile, `${title}-AI生成原图${extension}`);
    return response.sendFile(originalFile);
  }

  if (request.params.filename === "video.mp4" && request.query.download === "1") {
    return response.download(filename, `${title}-Tiny-Moods.mp4`);
  }
  return response.sendFile(filename);
});

if (process.env.NODE_ENV === "production") {
  const distRoot = path.join(projectRoot, "dist");
  app.use("/assets", express.static(path.join(distRoot, "assets"), {index: false, maxAge: "1y", immutable: true}));
  app.use(express.static(distRoot, {index: false}));
  app.get(/^(?!\/api\/|\/generated\/).*/, (_request, response) => response.sendFile(path.join(distRoot, "index.html")));
} else {
  const {createServer} = await import("vite");
  const vite = await createServer({root: projectRoot, server: {middlewareMode: true}, appType: "spa"});
  app.use(vite.middlewares);
}

app.use((error, _request, response, _next) => {
  const isUploadError = error instanceof multer.MulterError || error?.message?.startsWith("仅支持") || error?.message?.startsWith("本地抠图");
  response.status(isUploadError ? 400 : 500).json({error: isUploadError ? error.message : "服务暂时不可用"});
});

await restoreState();
await ensureDemoJobs();
await analytics.init();
await cleanupExpiredJobs();
setInterval(() => void cleanupExpiredJobs(), 60 * 60 * 1000).unref();

app.listen(port, "0.0.0.0", () => {
  console.log(`Tiny Moods generator: http://127.0.0.1:${port}/`);
});
