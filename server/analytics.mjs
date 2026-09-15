import crypto from "node:crypto";
import {appendFile, mkdir, readdir, readFile} from "node:fs/promises";
import {isIP} from "node:net";
import path from "node:path";
import {GeoLite2} from "@maxminddatabase/geolite2";

const allowedEventNames = new Set([
  "page_view",
  "page_stay",
  "interaction",
  "generation_started",
  "generation_job_created",
  "client_processing_completed",
  "client_processing_failed",
  "local_video_started",
  "local_video_completed",
  "local_video_failed",
]);

const text = (value, maxLength = 120) => String(value || "").trim().slice(0, maxLength);
const number = (value, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(minimum, Math.min(maximum, parsed));
};

const cleanProperties = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 16).flatMap(([key, item]) => {
    const safeKey = text(key, 48).replace(/[^a-zA-Z0-9_:-]/g, "_");
    if (!safeKey) return [];
    if (typeof item === "boolean") return [[safeKey, item]];
    if (typeof item === "number" && Number.isFinite(item)) return [[safeKey, Math.max(-1_000_000_000, Math.min(1_000_000_000, item))]];
    if (typeof item === "string") return [[safeKey, text(item, 160)]];
    return [];
  }));
};

const coarseDevice = (userAgent = "") => {
  const value = String(userAgent).toLowerCase();
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobile|iphone|android/.test(value)) return "mobile";
  return "desktop";
};

const browserName = (userAgent = "") => {
  const value = String(userAgent);
  if (/MicroMessenger/i.test(value)) return "微信浏览器";
  if (/Edg\//i.test(value)) return "Edge";
  if (/OPR\//i.test(value)) return "Opera";
  if (/CriOS|Chrome\//i.test(value)) return "Chrome";
  if (/FxiOS|Firefox\//i.test(value)) return "Firefox";
  if (/Safari\//i.test(value)) return "Safari";
  return "其他浏览器";
};

const operatingSystem = (userAgent = "") => {
  const value = String(userAgent);
  if (/iPhone|iPad|iPod/i.test(value)) return "iOS / iPadOS";
  if (/Android/i.test(value)) return "Android";
  if (/Windows/i.test(value)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(value)) return "macOS";
  if (/Linux/i.test(value)) return "Linux";
  return "其他系统";
};

const normalizeIp = (value) => String(value || "").trim().replace(/^::ffff:/, "").replace(/^\[|\]$/g, "");
const privateIp = (value) => (
  value === "::1"
  || value === "127.0.0.1"
  || /^10\./.test(value)
  || /^192\.168\./.test(value)
  || /^172\.(1[6-9]|2\d|3[01])\./.test(value)
  || /^fc|^fd|^fe80:/i.test(value)
);
const localizedName = (record) => text(record?.names?.["zh-CN"] || record?.names?.en, 80);

let cityReader = null;
let cityReaderUnavailable = false;
const coarseLocation = (request) => {
  const ip = normalizeIp(request.ip);
  if (!isIP(ip)) return null;
  if (privateIp(ip)) return {countryCode: "LOCAL", country: "本地网络", region: "", city: "", timezone: ""};
  if (!cityReader && !cityReaderUnavailable) {
    try {
      cityReader = new GeoLite2("City").reader;
    } catch {
      cityReaderUnavailable = true;
    }
  }
  if (!cityReader) return null;
  try {
    const match = cityReader?.city(ip);
    if (!match) return null;
    const subdivision = match.subdivisions?.[0];
    const country = match.country || match.registeredCountry;
    return {
      countryCode: text(country?.isoCode, 8),
      country: localizedName(country),
      region: localizedName(subdivision),
      city: localizedName(match.city),
      timezone: text(match.location?.timeZone, 64),
    };
  } catch {
    return null;
  }
};

const normalizedHost = (value) => text(value, 160).toLowerCase().replace(/^www\./, "");
const hostMatches = (host, domains) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
const trafficSource = (properties = {}) => {
  const utmSource = text(properties.utmSource, 80);
  const referrerHost = normalizedHost(properties.referrerHost);
  const siteHost = normalizedHost(properties.siteHost);
  if (utmSource) return `UTM: ${utmSource}`;
  if (!referrerHost) return "直接访问";
  if (siteHost && (referrerHost === siteHost || referrerHost.endsWith(`.${siteHost}`))) return "站内跳转";
  if (hostMatches(referrerHost, ["baidu.com", "bing.com", "google.com", "google.com.hk", "so.com", "sogou.com", "sm.cn"])) return "搜索引擎";
  if (hostMatches(referrerHost, ["weixin.qq.com", "wechat.com", "weibo.com", "xiaohongshu.com", "douyin.com", "tiktok.com", "zhihu.com", "qq.com"])) return "社交平台";
  return "外部网站";
};

const validOccurredAt = (value, fallback) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  const drift = parsed - Date.parse(fallback);
  if (drift > 10 * 60 * 1000 || drift < -30 * 24 * 60 * 60 * 1000) return fallback;
  return new Date(parsed).toISOString();
};

const chinaDayMs = 8 * 60 * 60 * 1000;
const dateKey = (iso) => new Date(Date.parse(iso) + chinaDayMs).toISOString().slice(0, 10);

export function createAnalyticsStore({dataRoot, salt = crypto.randomBytes(32).toString("hex")}) {
  const analyticsRoot = path.join(dataRoot, "analytics");
  const eventsRoot = path.join(analyticsRoot, "events");
  let writeChain = Promise.resolve();

  const init = () => mkdir(eventsRoot, {recursive: true});

  const visitorHashFor = (request, day) => crypto
    .createHash("sha256")
    .update(`${salt}:${day}:${request.ip || "unknown"}`)
    .digest("hex")
    .slice(0, 20);

  const normalizeEvent = (input, request, receivedAt) => {
    const name = text(input?.name, 48);
    const sessionId = text(input?.sessionId, 80);
    if (!allowedEventNames.has(name) || !/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) return null;
    const day = dateKey(receivedAt);
    return {
      id: crypto.randomUUID(),
      name,
      sessionId,
      visitorHash: visitorHashFor(request, day),
      page: text(input.page, 64) || "unknown",
      jobId: text(input.jobId, 80) || null,
      demoId: text(input.demoId, 80) || null,
      durationMs: name === "page_stay" ? number(input.durationMs, 0, 10 * 60 * 1000) || 0 : null,
      properties: cleanProperties(input.properties),
      device: coarseDevice(request.get("user-agent")),
      browser: browserName(request.get("user-agent")),
      os: operatingSystem(request.get("user-agent")),
      trafficSource: name === "page_view" ? trafficSource(input.properties) : null,
      location: name === "page_view" ? coarseLocation(request) : null,
      occurredAt: validOccurredAt(input.occurredAt, receivedAt),
      receivedAt,
    };
  };

  const record = async (payload, request) => {
    const receivedAt = new Date().toISOString();
    const candidates = Array.isArray(payload?.events) ? payload.events.slice(0, 24) : [payload];
    const events = candidates.map((input) => normalizeEvent(input, request, receivedAt)).filter(Boolean);
    if (!events.length) return 0;
    const groups = new Map();
    events.forEach((event) => {
      const filename = path.join(eventsRoot, `${dateKey(event.receivedAt)}.jsonl`);
      groups.set(filename, [...(groups.get(filename) || []), event]);
    });
    writeChain = writeChain.then(async () => {
      await init();
      for (const [filename, items] of groups) {
        await appendFile(filename, `${items.map((item) => JSON.stringify(item)).join("\n")}\n`, {encoding: "utf8", mode: 0o600});
      }
    });
    await writeChain;
    return events.length;
  };

  const eventFiles = async (days) => {
    await init();
    const names = (await readdir(eventsRoot))
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
      .sort()
      .reverse();
    if (!days) return names;
    const currentDay = Math.floor((Date.now() + chinaDayMs) / (24 * 60 * 60 * 1000));
    const threshold = new Date((currentDay - days + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return names.filter((name) => name.slice(0, 10) >= threshold);
  };

  const list = async ({days = 7, jobId = "", sessionId = "", limit = 100_000} = {}) => {
    const files = await eventFiles(days);
    const events = [];
    for (const filename of files) {
      let content = "";
      try {
        content = await readFile(path.join(eventsRoot, filename), "utf8");
      } catch {
        continue;
      }
      const lines = content.trim().split("\n").reverse();
      for (const line of lines) {
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          const eventJobId = event.jobId || (event.demoId ? `demo-${event.demoId}` : "");
          if (jobId && eventJobId !== jobId) continue;
          if (sessionId && event.sessionId !== sessionId) continue;
          events.push(event);
          if (events.length >= limit) return events.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
        } catch {
          // Ignore a partially written or manually damaged line without losing the rest of the file.
        }
      }
    }
    return events.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  };

  return {init, list, record};
}

export function summarizeEvents(events) {
  const sessions = new Set();
  const eventCounts = new Map();
  const actionCounts = new Map();
  const perJob = new Map();
  const daily = new Map();
  let visibleMs = 0;
  let visits = 0;
  let interactions = 0;

  const entranceViews = new Map();
  const entrancePriority = (event) => {
    if (text(event.properties?.utmSource, 80)) return 0;
    const referrerHost = normalizedHost(event.properties?.referrerHost);
    const siteHost = normalizedHost(event.properties?.siteHost);
    if (referrerHost && (!siteHost || (referrerHost !== siteHost && !referrerHost.endsWith(`.${siteHost}`)))) return 1;
    if (!referrerHost) return 2;
    return 3;
  };
  events
    .filter((event) => event.name === "page_view")
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
    .forEach((event) => {
      const existing = entranceViews.get(event.sessionId);
      if (!existing || (
        Date.parse(event.occurredAt) === Date.parse(existing.occurredAt)
        && entrancePriority(event) < entrancePriority(existing)
      )) entranceViews.set(event.sessionId, event);
    });

  events.forEach((event) => {
    sessions.add(event.sessionId);
    eventCounts.set(event.name, (eventCounts.get(event.name) || 0) + 1);
    const day = dateKey(event.receivedAt || event.occurredAt);
    const dayStats = daily.get(day) || {date: day, visits: 0, interactions: 0, visibleMs: 0, sessions: new Set()};
    dayStats.sessions.add(event.sessionId);
    if (event.name === "page_view") {
      visits += 1;
      dayStats.visits += 1;
    }
    if (event.name === "interaction") {
      interactions += 1;
      dayStats.interactions += 1;
      const action = text(event.properties?.action, 80) || "unknown";
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }
    if (event.name === "page_stay") {
      visibleMs += Number(event.durationMs || 0);
      dayStats.visibleMs += Number(event.durationMs || 0);
    }
    daily.set(day, dayStats);

    const jobId = event.jobId || (event.demoId ? `demo-${event.demoId}` : "");
    if (!jobId) return;
    const jobStats = perJob.get(jobId) || {
      visits: 0,
      interactions: 0,
      visibleMs: 0,
      sessions: new Set(),
      lastEventAt: null,
    };
    jobStats.sessions.add(event.sessionId);
    if (event.name === "page_view") jobStats.visits += 1;
    if (event.name === "interaction") jobStats.interactions += 1;
    if (event.name === "page_stay") jobStats.visibleMs += Number(event.durationMs || 0);
    if (!jobStats.lastEventAt || Date.parse(event.occurredAt) > Date.parse(jobStats.lastEventAt)) jobStats.lastEventAt = event.occurredAt;
    perJob.set(jobId, jobStats);
  });

  const normalizedPerJob = Object.fromEntries([...perJob.entries()].map(([jobId, value]) => [jobId, {
    visits: value.visits,
    interactions: value.interactions,
    visibleSeconds: Math.round(value.visibleMs / 1000),
    uniqueSessions: value.sessions.size,
    averageStaySeconds: value.sessions.size ? Math.round(value.visibleMs / value.sessions.size / 1000) : 0,
    lastEventAt: value.lastEventAt,
  }]));

  const ranked = (values, total, limit = 12) => [...values.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      percentage: total ? Math.round(count / total * 100) : 0,
    }));
  const sourceCounts = new Map();
  const referrerCounts = new Map();
  const deviceCounts = new Map();
  const browserCounts = new Map();
  const osCounts = new Map();
  const locationCounts = new Map();
  let locatedSessions = 0;

  entranceViews.forEach((event) => {
    const source = event.trafficSource || trafficSource(event.properties);
    const referrer = normalizedHost(event.properties?.referrerHost) || "直接访问";
    const device = text(event.device, 40) || "unknown";
    const browser = text(event.browser, 40) || "未知浏览器";
    const os = text(event.os, 40) || "未知系统";
    const locationParts = [event.location?.country, event.location?.region, event.location?.city].filter((value, index, items) => value && items.indexOf(value) === index);
    const location = locationParts.join(" / ") || "未知位置";
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    referrerCounts.set(referrer, (referrerCounts.get(referrer) || 0) + 1);
    deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
    browserCounts.set(browser, (browserCounts.get(browser) || 0) + 1);
    osCounts.set(os, (osCounts.get(os) || 0) + 1);
    locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
    if (location !== "未知位置") locatedSessions += 1;
  });

  return {
    totalEvents: events.length,
    visits,
    interactions,
    uniqueSessions: sessions.size,
    visibleSeconds: Math.round(visibleMs / 1000),
    averageStaySeconds: sessions.size ? Math.round(visibleMs / sessions.size / 1000) : 0,
    eventCounts: Object.fromEntries([...eventCounts.entries()].sort((left, right) => right[1] - left[1])),
    topActions: [...actionCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([action, count]) => ({action, count})),
    acquisition: {
      totalEntrances: entranceViews.size,
      locatedSessions,
      sources: ranked(sourceCounts, entranceViews.size),
      referrers: ranked(referrerCounts, entranceViews.size),
      devices: ranked(deviceCounts, entranceViews.size),
      browsers: ranked(browserCounts, entranceViews.size),
      systems: ranked(osCounts, entranceViews.size),
      locations: ranked(locationCounts, entranceViews.size),
    },
    perJob: normalizedPerJob,
    daily: [...daily.values()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((value) => ({
        date: value.date,
        visits: value.visits,
        interactions: value.interactions,
        visibleSeconds: Math.round(value.visibleMs / 1000),
        uniqueSessions: value.sessions.size,
      })),
  };
}
