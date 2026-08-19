import {useEffect, useRef, useSyncExternalStore} from "react";
import {Cursor} from "@phosphor-icons/react/Cursor";
import "./emotion-cursor-trail.css";

const EMOTION_WORDS = [
  "开心",
  "CRUSH",
  "松弛",
  "BRAVE",
  "好奇",
  "FREE",
  "柔软",
  "VIVID",
  "平静",
  "HOPE",
  "想念",
  "GLOW",
  "甜甜",
  "SHY",
  "上头",
  "HEALED",
  "雀跃",
  "SENSITIVE",
  "笃定",
  "ROMANCE",
  "发光",
  "LAZY",
  "坚定",
  "LUCKY",
];

const COLORS = [
  "#c6ff3d",
  "#ff4f91",
  "#42ddf5",
  "#ff944d",
  "#b978ff",
  "#ffe24a",
  "#ff6868",
  "#43eaa0",
  "#5a91ff",
  "#f975e7",
];

const STATIC_BADGES = [
  {text: "心动", color: COLORS[1]},
  {text: "CHILL", color: COLORS[2]},
  {text: "勇敢", color: COLORS[4]},
];

const DROP_INTERVAL_MS = 88;
const MIN_TRAVEL_PX = 26;
const BADGE_LIFE_MS = 1180;
const COLLISION_GAP_PX = 4;
const MAX_LIVE = 16;

function subscribeMedia(query, callback) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function useMedia(query, fallback = false) {
  return useSyncExternalStore(
    (callback) => subscribeMedia(query, callback),
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

function shuffleIndexes(length) {
  const indexes = Array.from({length}, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes;
}

function intersects(candidate, badge) {
  return (
    candidate.left < badge.right + COLLISION_GAP_PX
    && candidate.right + COLLISION_GAP_PX > badge.left
    && candidate.top < badge.bottom + COLLISION_GAP_PX
    && candidate.bottom + COLLISION_GAP_PX > badge.top
  );
}

export default function EmotionCursorTrail() {
  const layerRef = useRef(null);
  const cursorRef = useRef(null);
  const finePointer = useMedia("(hover: hover) and (pointer: fine)", true);
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)", false);

  useEffect(() => {
    const layer = layerRef.current;
    const cursor = cursorRef.current;
    if (!layer || !cursor || !finePointer || reducedMotion) return undefined;

    const root = document.documentElement;
    const liveBadges = new Map();
    let bag = [];
    let lastWordIndex = -1;
    let lastVisibleWord = "";
    let colorIndex = Math.floor(Math.random() * COLORS.length);
    let lastDropTime = -Infinity;
    let lastDropX = 0;
    let lastDropY = 0;
    let hasDropped = false;
    let pointerX = -100;
    let pointerY = -100;
    let cursorFrame = 0;
    let visible = false;
    let paused = document.hidden;

    const clearBadges = () => {
      liveBadges.forEach(({element, timer}) => {
        window.clearTimeout(timer);
        element.remove();
      });
      liveBadges.clear();
    };

    const nextWord = () => {
      if (bag.length === 0) {
        bag = shuffleIndexes(EMOTION_WORDS.length);
        if (bag[bag.length - 1] === lastWordIndex && bag.length > 1) {
          [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
        }
      }
      const wordIndex = bag.pop();
      lastWordIndex = wordIndex;
      return EMOTION_WORDS[wordIndex];
    };

    const publishCursor = () => {
      cursorFrame = 0;
      cursor.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
    };

    const scheduleCursor = () => {
      if (!cursorFrame) cursorFrame = window.requestAnimationFrame(publishCursor);
    };

    const spawnBadge = (x, y, now) => {
      if (liveBadges.size >= MAX_LIVE) return;

      let text = nextWord();
      while (text === lastVisibleWord) text = nextWord();

      const element = document.createElement("span");
      element.className = "emotion-trail-badge";
      element.textContent = text;
      element.style.background = COLORS[colorIndex];
      element.style.visibility = "hidden";
      layer.appendChild(element);

      const {width, height} = element.getBoundingClientRect();
      const left = Math.max(6, Math.min(window.innerWidth - width - 6, x - width / 2));
      const top = Math.max(6, Math.min(window.innerHeight - height - 6, y - height / 2));
      const candidate = {left, top, right: left + width, bottom: top + height};

      if ([...liveBadges.values()].some(({rect}) => intersects(candidate, rect))) {
        element.remove();
        return;
      }

      element.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      element.style.visibility = "visible";
      element.dataset.live = "true";
      lastVisibleWord = text;
      colorIndex = (colorIndex + 1) % COLORS.length;

      const timer = window.setTimeout(() => {
        element.remove();
        liveBadges.delete(element);
      }, BADGE_LIFE_MS + 40);

      liveBadges.set(element, {element, rect: candidate, timer});
      lastDropTime = now;
      lastDropX = x;
      lastDropY = y;
      hasDropped = true;
    };

    const onPointerMove = (event) => {
      if (event.pointerType === "touch" || paused) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      scheduleCursor();

      if (!visible) {
        visible = true;
        cursor.dataset.visible = "true";
      }

      const now = performance.now();
      const traveled = hasDropped
        ? Math.hypot(pointerX - lastDropX, pointerY - lastDropY)
        : Infinity;
      if (now - lastDropTime >= DROP_INTERVAL_MS && traveled >= MIN_TRAVEL_PX) {
        spawnBadge(pointerX, pointerY, now);
      }
    };

    const hideCursor = () => {
      visible = false;
      cursor.dataset.visible = "false";
      cursor.dataset.pressed = "false";
    };

    const onPointerOut = (event) => {
      if (!event.relatedTarget) hideCursor();
    };

    const onPointerDown = (event) => {
      if (event.pointerType !== "touch") cursor.dataset.pressed = "true";
    };

    const onPointerUp = () => {
      cursor.dataset.pressed = "false";
    };

    const onVisibilityChange = () => {
      paused = document.hidden;
      layer.dataset.paused = paused ? "true" : "false";
      if (paused) {
        hideCursor();
        clearBadges();
        hasDropped = false;
      }
    };

    root.classList.add("emotion-cursor-active");
    window.addEventListener("pointermove", onPointerMove, {passive: true});
    window.addEventListener("pointerout", onPointerOut, {passive: true});
    window.addEventListener("pointerdown", onPointerDown, {passive: true});
    window.addEventListener("pointerup", onPointerUp, {passive: true});
    window.addEventListener("pointercancel", onPointerUp, {passive: true});
    window.addEventListener("blur", hideCursor);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      root.classList.remove("emotion-cursor-active");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", hideCursor);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (cursorFrame) window.cancelAnimationFrame(cursorFrame);
      clearBadges();
    };
  }, [finePointer, reducedMotion]);

  const showStatic = !finePointer || reducedMotion;

  return (
    <div ref={layerRef} className="emotion-cursor-layer" aria-hidden="true">
      {showStatic ? (
        <div className="emotion-static-trail">
          {STATIC_BADGES.map((badge) => (
            <span key={badge.text} style={{background: badge.color}}>{badge.text}</span>
          ))}
        </div>
      ) : null}
      <span ref={cursorRef} className="emotion-cursor" data-visible="false" data-pressed="false">
        <Cursor size={37} weight="fill" aria-hidden="true" />
      </span>
    </div>
  );
}
