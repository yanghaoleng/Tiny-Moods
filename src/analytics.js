import {useEffect} from "react";

const API_URL = `${import.meta.env.BASE_URL}api/analytics/events`;
const SESSION_KEY = "tiny-moods:analytics-session";
const HEARTBEAT_MS = 15_000;
let activeContext = {page: "unknown", jobId: "", demoId: ""};
let queue = [];
let flushTimer = null;

const createSessionId = () => {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const value = crypto.randomUUID().replaceAll("-", "");
    window.sessionStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  }
};

const sessionId = createSessionId();

const flush = (beacon = false) => {
  window.clearTimeout(flushTimer);
  flushTimer = null;
  if (!queue.length) return;
  const payload = JSON.stringify({events: queue.splice(0, 24)});
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon(API_URL, new Blob([payload], {type: "application/json"}));
    return;
  }
  void fetch(API_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: payload,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt the product flow.
  });
};

export const trackEvent = (name, properties = {}, overrides = {}, immediate = false) => {
  queue.push({
    name,
    sessionId,
    page: overrides.page || activeContext.page,
    jobId: overrides.jobId ?? activeContext.jobId,
    demoId: overrides.demoId ?? activeContext.demoId,
    durationMs: overrides.durationMs,
    properties,
    occurredAt: new Date().toISOString(),
  });
  if (immediate || queue.length >= 12) flush(immediate);
  else if (!flushTimer) flushTimer = window.setTimeout(() => flush(false), 900);
};

export function usePageAnalytics(context) {
  const contextKey = `${context.page}:${context.jobId || ""}:${context.demoId || ""}`;

  useEffect(() => {
    activeContext = context;
    let visibleStartedAt = document.visibilityState === "visible" ? performance.now() : null;
    let pendingVisibleMs = 0;
    let closed = false;

    const accumulateVisibleTime = () => {
      if (visibleStartedAt === null) return;
      pendingVisibleMs += Math.max(0, performance.now() - visibleStartedAt);
      visibleStartedAt = document.visibilityState === "visible" ? performance.now() : null;
    };

    const reportStay = (reason, beacon = false) => {
      accumulateVisibleTime();
      const durationMs = Math.round(pendingVisibleMs);
      if (durationMs < 800) return;
      pendingVisibleMs = 0;
      trackEvent("page_stay", {reason}, {...context, durationMs}, beacon);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportStay("hidden");
      } else {
        visibleStartedAt = performance.now();
      }
    };
    const onPageHide = () => {
      if (closed) return;
      closed = true;
      reportStay("pagehide", true);
      flush(true);
    };

    trackEvent("page_view", {
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      referrerHost: (() => {
        try { return document.referrer ? new URL(document.referrer).host : ""; } catch { return ""; }
      })(),
    }, context);

    const heartbeat = window.setInterval(() => reportStay("heartbeat"), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (!closed) reportStay("route_change");
    };
  }, [contextKey]);
}

const readableLabel = (element) => (
  element.dataset.analyticsLabel
  || element.getAttribute("aria-label")
  || element.getAttribute("title")
  || element.textContent
  || ""
).replace(/\s+/g, " ").trim().slice(0, 100);

const inferredAction = (element, eventType) => {
  if (element.dataset.analyticsAction) return element.dataset.analyticsAction;
  if (element.id) return `${eventType}:${element.id}`;
  const role = element.getAttribute("role");
  const className = typeof element.className === "string" ? element.className.split(/\s+/).filter(Boolean)[0] : "";
  return `${eventType}:${role || className || element.tagName.toLowerCase()}`.slice(0, 80);
};

export function bindInteractionAnalytics(root = document) {
  const onClick = (event) => {
    const element = event.target.closest?.("button, a, [role='button'], [role='switch'], [data-analytics-action]");
    if (!element || !root.contains(element)) return;
    let destination = "";
    if (element.tagName === "A" && element.getAttribute("href")) {
      try { destination = new URL(element.href, window.location.href).pathname; } catch { destination = ""; }
    }
    trackEvent("interaction", {
      action: inferredAction(element, "click"),
      label: readableLabel(element),
      target: element.dataset.analyticsTarget || "",
      element: element.tagName.toLowerCase(),
      destination,
    });
  };

  const onChange = (event) => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;
    const properties = {
      action: inferredAction(element, "change"),
      label: readableLabel(element),
      element: element.tagName.toLowerCase(),
      inputType: element.getAttribute("type") || "",
    };
    if (element instanceof HTMLInputElement && element.type === "file") properties.fileCount = element.files?.length || 0;
    if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) properties.checked = element.checked;
    trackEvent("interaction", properties);
  };

  root.addEventListener("click", onClick, true);
  root.addEventListener("change", onChange, true);
  return () => {
    root.removeEventListener("click", onClick, true);
    root.removeEventListener("change", onChange, true);
    flush(false);
  };
}
