import crypto from "node:crypto";
import {appendFile, mkdir, readdir, readFile} from "node:fs/promises";
import path from "node:path";

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
