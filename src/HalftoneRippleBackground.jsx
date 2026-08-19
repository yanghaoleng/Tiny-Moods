import {useEffect, useRef} from "react";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOutCubic = (value) => 1 - Math.pow(1 - clamp(value), 3);
const smoothstep = (edge0, edge1, value) => {
  const progress = clamp((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
};

export default function HalftoneRippleBackground({
  backgroundMode,
  baseColor,
  baseAccent,
  nextColor,
  nextAccent,
  transition,
  transitionDuration = 5625,
  reduceMotion,
}) {
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const settingsRef = useRef({backgroundMode, baseColor, baseAccent, nextColor, nextAccent, transition, transitionDuration, reduceMotion});

  useEffect(() => {
    settingsRef.current = {backgroundMode, baseColor, baseAccent, nextColor, nextAccent, transition, transitionDuration, reduceMotion};
    runtimeRef.current?.sync(Boolean(transition));
  }, [backgroundMode, baseColor, baseAccent, nextColor, nextAccent, transition, transitionDuration, reduceMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d", {alpha: false, desynchronized: true});
    const state = {
      width: 0,
      height: 0,
      dpr: 1,
      gap: 20,
      grid: [],
      baseLayer: document.createElement("canvas"),
      nextLayer: document.createElement("canvas"),
      transitionStartedAt: 0,
      transitionId: null,
      animatingUntil: 0,
      frame: 0,
      running: false,
      lastFrameAt: 0,
      hidden: document.hidden,
    };

    const palette = (kind) => {
      const settings = settingsRef.current;
      const white = settings.backgroundMode === "white";
      return {
        background: white ? "#ffffff" : kind === "next" && settings.nextColor ? settings.nextColor : settings.baseColor,
        dots: white ? "#57535a" : kind === "next" && settings.nextAccent ? settings.nextAccent : settings.baseAccent,
        highlight: white ? "#242127" : kind === "next" && settings.nextAccent ? settings.nextAccent : settings.baseAccent,
      };
    };

    const drawStaticLayer = (layer, colors) => {
      layer.width = Math.max(1, Math.round(state.width * state.dpr));
      layer.height = Math.max(1, Math.round(state.height * state.dpr));
      const layerContext = layer.getContext("2d", {alpha: false});
      layerContext.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      layerContext.fillStyle = colors.background;
      layerContext.fillRect(0, 0, state.width, state.height);
      if (settingsRef.current.backgroundMode === "white") return;
      layerContext.beginPath();
      for (const point of state.grid) {
        layerContext.moveTo(point.x + 1.3, point.y);
        layerContext.arc(point.x, point.y, 1.3, 0, Math.PI * 2);
      }
      layerContext.globalAlpha = 0.16;
      layerContext.fillStyle = colors.dots;
      layerContext.fill();
      layerContext.globalAlpha = 1;
    };

    const rebuildLayers = () => {
      drawStaticLayer(state.baseLayer, palette("base"));
      drawStaticLayer(state.nextLayer, palette("next"));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      state.width = Math.max(1, Math.round(rect.width));
      state.height = Math.max(1, Math.round(rect.height));
      state.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      state.gap = state.width < 520 ? 18 : state.width > 1500 ? 22 : 20;
      canvas.width = Math.round(state.width * state.dpr);
      canvas.height = Math.round(state.height * state.dpr);
      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      state.grid = [];
      const offsetX = (state.width % state.gap) / 2;
      const offsetY = (state.height % state.gap) / 2;
      for (let y = offsetY; y <= state.height; y += state.gap) {
        for (let x = offsetX; x <= state.width; x += state.gap) state.grid.push({x, y});
      }
      rebuildLayers();
      draw();
    };

    const getRipples = (now) => {
      const ripples = [];
      const transitionSettings = settingsRef.current.transition;
      if (transitionSettings && state.transitionStartedAt) {
        const progress = clamp((now - state.transitionStartedAt) / settingsRef.current.transitionDuration);
        const fade = smoothstep(0, 0.09, progress) * (1 - smoothstep(0.72, 1, progress));
        ripples.push({
          x: transitionSettings.x,
          y: transitionSettings.y,
          radius: easeOutCubic(progress) * Math.hypot(state.width, state.height) * 1.12,
          bandWidth: state.gap * 3,
          fade,
        });
      }
      return ripples;
    };

    const drawHighlights = (ripples, colors) => {
      if (!ripples.length || settingsRef.current.backgroundMode === "white") return;
      const buckets = Array.from({length: 6}, () => new Path2D());
      for (const point of state.grid) {
        let energy = 0;
        for (const ripple of ripples) {
          const distance = Math.hypot(point.x - ripple.x, point.y - ripple.y);
          const bandDistance = Math.abs(distance - ripple.radius);
          const band = Math.exp(-Math.pow(bandDistance / ripple.bandWidth, 2.1));
          const wake = distance < ripple.radius ? Math.exp(-(ripple.radius - distance) / (state.gap * 7.5)) * 0.16 : 0;
          energy = Math.max(energy, (band + wake) * ripple.fade);
        }
        if (energy < 0.045) continue;
        const bucket = Math.min(5, Math.floor(energy * 6.5));
        const radius = 1.5 + energy * state.gap * 0.24;
        buckets[bucket].moveTo(point.x + radius, point.y);
        buckets[bucket].arc(point.x, point.y, radius, 0, Math.PI * 2);
      }

      context.fillStyle = colors.highlight;
      buckets.forEach((path, index) => {
        context.globalAlpha = 0.18 + index * 0.13;
        context.fill(path);
      });
      context.globalAlpha = 1;
    };

    const draw = (now = performance.now()) => {
      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      context.clearRect(0, 0, state.width, state.height);
      context.drawImage(state.baseLayer, 0, 0, state.width, state.height);

      const transitionSettings = settingsRef.current.transition;
      if (transitionSettings && state.transitionStartedAt) {
        const progress = clamp((now - state.transitionStartedAt) / settingsRef.current.transitionDuration);
        const radius = easeOutCubic(progress) * Math.hypot(state.width, state.height) * 1.12;
        context.save();
        context.beginPath();
        context.arc(transitionSettings.x, transitionSettings.y, radius, 0, Math.PI * 2);
        context.clip();
        context.drawImage(state.nextLayer, 0, 0, state.width, state.height);
        context.restore();
      }

      if (!settingsRef.current.reduceMotion) {
        const useNextPalette = transitionSettings && now - state.transitionStartedAt > settingsRef.current.transitionDuration / 2;
        drawHighlights(getRipples(now), palette(useNextPalette ? "next" : "base"));
      }
    };

    const tick = (now) => {
      if (state.hidden || settingsRef.current.reduceMotion) {
        state.running = false;
        return;
      }
      if (now - state.lastFrameAt >= 32) {
        draw(now);
        state.lastFrameAt = now;
      }
      if (now < state.animatingUntil) state.frame = window.requestAnimationFrame(tick);
      else {
        draw(now);
        state.running = false;
      }
    };

    const startAnimation = () => {
      if (state.running || state.hidden || settingsRef.current.reduceMotion) return;
      state.running = true;
      state.lastFrameAt = 0;
      state.frame = window.requestAnimationFrame(tick);
    };

    const sync = (isTransition) => {
      const transitionId = settingsRef.current.transition?.id ?? null;
      if (isTransition && transitionId !== state.transitionId) {
        state.transitionId = transitionId;
        state.transitionStartedAt = performance.now();
        state.animatingUntil = state.transitionStartedAt + settingsRef.current.transitionDuration + 34;
      } else if (!isTransition) {
        state.transitionId = null;
        state.transitionStartedAt = 0;
        state.animatingUntil = 0;
      }
      rebuildLayers();
      if (isTransition) startAnimation();
      else draw();
    };

    const handleVisibility = () => {
      state.hidden = document.hidden;
      if (!state.hidden) {
        state.lastFrameAt = performance.now();
        if (performance.now() < state.animatingUntil) startAnimation();
        else draw();
      }
    };

    runtimeRef.current = {sync};
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibility);
    resize();

    return () => {
      runtimeRef.current = null;
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.cancelAnimationFrame(state.frame);
    };
  }, []);

  return <canvas ref={canvasRef} className="halftone-ripple-background" aria-hidden="true" />;
}
