import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ghost } from "@phosphor-icons/react/Ghost";
import { House } from "@phosphor-icons/react/House";
import { Play } from "@phosphor-icons/react/Play";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/SpeakerSlash";
import HalftoneRippleBackground from "./HalftoneRippleBackground";

import avatar02 from "../assets/image 2-1.webp";
import avatar03 from "../assets/image 3.webp";
import avatar04 from "../assets/image 3-1.webp";
import avatar05 from "../assets/image 4.webp";
import avatar06 from "../assets/image 4-1.webp";
import avatar07 from "../assets/image 4-2.webp";
import avatar08 from "../assets/image 4-3.webp";
import avatar09 from "../assets/image 5.webp";
import avatar10 from "../assets/image 5-1.webp";
import avatar11 from "../assets/image 6.webp";

export const jennieAvatars = [
  { src: `${import.meta.env.BASE_URL}hero.webp`, accent: "#ef6f9a", deep: "#8f2851", bg: "#ffd9e7", label: "苹果花苞 Jennie" },
  { src: avatar02, accent: "#e7587f", deep: "#7f2544", bg: "#ffcfdc", label: "波点蝴蝶结 Jennie" },
  { src: avatar03, accent: "#df8b42", deep: "#74401c", bg: "#ffe0b8", label: "嘴巴嘟嘟 Jennie" },
  { src: avatar04, accent: "#6b96c7", deep: "#25486f", bg: "#d7e9ff", label: "墨镜酷酷 Jennie" },
  { src: avatar05, accent: "#4ea7b2", deep: "#205b64", bg: "#cceff0", label: "蓝色眼线 Jennie" },
  { src: avatar06, accent: "#9a78c9", deep: "#523774", bg: "#e8dcff", label: "紫色眼线 Jennie" },
  { src: avatar07, accent: "#e75f8c", deep: "#842d51", bg: "#ffd2e3", label: "粉色眼线 Jennie" },
  { src: avatar08, accent: "#e36d4e", deep: "#7c3221", bg: "#ffd9ca", label: "橘色眼线 Jennie" },
  { src: avatar09, accent: "#db7fa6", deep: "#7c3455", bg: "#ffe0ed", label: "粉色耳机 Jennie" },
  { src: avatar10, accent: "#728ca8", deep: "#334c67", bg: "#dce8f2", label: "银色耳机 Jennie" },
  { src: avatar11, accent: "#b57868", deep: "#68382e", bg: "#f3d8cc", label: "编发 Jennie" },
];

const stickerImages = [
  "sparkle", "heart", "flower", "butterfly",
  "cherries", "music", "crown", "wand",
  "camera", "planet", "cookie", "balloon",
].map((name) => `${import.meta.env.BASE_URL}decorations/doodle-${name}.webp`);

const scribbleImages = Array.from(
  {length: 12},
  (_, index) => `${import.meta.env.BASE_URL}decorations/crayon-scribble-${String(index + 1).padStart(2, "0")}.webp`,
);

const stickerSlots = [
  { x: 14, y: 22, size: 116, rotate: -13 },
  { x: 86, y: 22, size: 68, rotate: 11 },
  { x: 85, y: 84, size: 48, rotate: -7 },
];

const THEME_TRANSITION_DURATION = 1200;
const AUTO_CHANGE_INTERVAL = 1500;
const mobileMotionQuery = "(max-width: 768px), (pointer: coarse)";
const isWeChatBrowser = () =>
  typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent);
const carouselBackgrounds = [
  {bg: "#f8e9ee", accent: "#d98ba5"},
  {bg: "#eaf4fa", accent: "#78afd0"},
  {bg: "#edf6ef", accent: "#80b991"},
  {bg: "#f1edfa", accent: "#a18bc8"},
  {bg: "#fbf4df", accent: "#d0aa62"},
];
function buildStickers(look) {
  const colorfulCount = 1 + (look % 2);
  const colorfulStart = (look * 2) % stickerSlots.length;
  return stickerSlots.map((slot, index) => {
    const sway = Math.sin((look + 1) * (index + 2)) * 3.2;
    const isColorful = ((index - colorfulStart + stickerSlots.length) % stickerSlots.length) < colorfulCount;
    return {
      ...slot,
      x: slot.x + sway,
      y: slot.y + Math.cos((look + 3) * (index + 1)) * 2.2,
      rotate: slot.rotate + ((look * 7 + index * 3) % 13) - 6,
      kind: isColorful ? "colorful" : "scribble",
      src: isColorful
        ? stickerImages[(look * 5 + index * 3) % stickerImages.length]
        : scribbleImages[(look * 7 + index * 5) % scribbleImages.length],
    };
  });
}

function useMobileMotionPacing() {
  const [slowMobileMotion, setSlowMobileMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(mobileMotionQuery);
    const update = () => setSlowMobileMotion(query.matches);
    update();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    query.addListener?.(update);
    return () => query.removeListener?.(update);
  }, []);
  return slowMobileMotion;
}

function Sticker({ sticker, index, look, reduceMotion }) {
  const burstX = `${(50 - sticker.x) * 0.82}vw`;
  const burstY = `${(50 - sticker.y) * 0.76}vh`;
  const delay = index * 0.028;

  return (
    <motion.span
      className={`floating-sticker sticker-${index} sticker-${sticker.kind}`}
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        "--sticker-size": `${sticker.size}px`,
        "--sticker-mobile-size": `${Math.max(20, Math.round(sticker.size * 0.82))}px`,
        "--sticker-rotate": `${sticker.rotate}deg`,
      }}
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              scale: 0.12,
              x: burstX,
              y: burstY,
              rotate: sticker.rotate + (index % 2 === 0 ? -42 : 42),
            }
      }
      animate={
        reduceMotion
          ? { opacity: 1, scale: 1, rotate: sticker.rotate }
          : {
              opacity: 1,
              scale: 1,
              x: 0,
              y: 0,
              rotate: sticker.rotate,
            }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.18, delay },
              scale: { type: "spring", stiffness: 128, damping: 10, mass: 0.72, delay },
              x: { type: "spring", stiffness: 118, damping: 13, mass: 0.76, delay },
              y: { type: "spring", stiffness: 118, damping: 13, mass: 0.76, delay },
              rotate: { type: "spring", stiffness: 118, damping: 12, mass: 0.72, delay },
            }
      }
      aria-hidden="true"
    >
      <span className="sticker-art">
        <img src={sticker.src} alt="" draggable="false" />
      </span>
    </motion.span>
  );
}

export default function JennieExperience({
  customAvatars,
  title = "Jennie",
  bgmUrl = `${import.meta.env.BASE_URL}jenniebgm.mp3`,
  videoUrl,
  onExit,
  actionContent,
  onAppearanceChange,
  embedded = false,
  showIntro = true,
  lookCount = 100,
  appearance = {backgroundMode: "color", patternStyle: "dots", decorations: true},
}) {
  const reduceMotion = useReducedMotion();
  const slowMobileMotion = useMobileMotionPacing();
  const avatarSet = customAvatars?.length ? customAvatars : jennieAvatars;
  const [look, setLook] = useState(0);
  const [baseThemeLook, setBaseThemeLook] = useState(0);
  const [themeWipe, setThemeWipe] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [wechatAudioConsent, setWechatAudioConsent] = useState(() => !isWeChatBrowser());
  const [introVisible, setIntroVisible] = useState(showIntro);
  const rippleId = useRef(0);
  const lookRef = useRef(0);
  const themeTimer = useRef(null);
  const portraitButtonRef = useRef(null);
  const audioRef = useRef(null);
  const audioResumeTimer = useRef(null);
  const manualAudioPauseRef = useRef(false);
  const musicEnabledRef = useRef(true);
  const wechatAudioConsentRef = useRef(wechatAudioConsent);
  const stageRef = useRef(null);

  const avatarIndex = (look * 7) % avatarSet.length;
  const avatar = avatarSet[avatarIndex];
  const background = carouselBackgrounds[look % carouselBackgrounds.length];
  const baseBackground = carouselBackgrounds[baseThemeLook % carouselBackgrounds.length];
  const halftoneTransitionDuration = slowMobileMotion ? THEME_TRANSITION_DURATION * 2 : THEME_TRANSITION_DURATION;
  const autoChangeInterval = slowMobileMotion ? AUTO_CHANGE_INTERVAL * 2 : AUTO_CHANGE_INTERVAL;
  const stickers = useMemo(() => buildStickers(look), [look]);

  useEffect(() => {
    const nextAvatar = avatarSet[((look + 1) * 7) % avatarSet.length];
    const img = new Image();
    img.decoding = "async";
    img.src = nextAvatar.src;
  }, [avatarSet, look]);

  useEffect(() => {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    themeMeta?.setAttribute("content", appearance.backgroundMode === "white" ? "#ffffff" : background.bg);
  }, [appearance.backgroundMode, background.bg]);

  useEffect(() => {
    if (!showIntro || reduceMotion) {
      setIntroVisible(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setIntroVisible(false), 3160);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, showIntro]);

  useEffect(
    () => () => {
      window.clearTimeout(themeTimer.current);
    },
    [],
  );

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    wechatAudioConsentRef.current = wechatAudioConsent;
  }, [wechatAudioConsent]);

  const clearAudioResumeTimer = useCallback(() => {
    window.clearTimeout(audioResumeTimer.current);
    audioResumeTimer.current = null;
  }, []);

  const requestAudioPlay = useCallback(async ({allowWhenDisabled = false} = {}) => {
    const audio = audioRef.current;
    if (!audio || (!musicEnabled && !allowWhenDisabled)) return false;

    try {
      clearAudioResumeTimer();
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      setAudioPlaying(false);
      return false;
    }
  }, [clearAudioResumeTimer, musicEnabled]);

  const scheduleAudioResume = useCallback((delay = 360) => {
    if (!musicEnabledRef.current || !wechatAudioConsentRef.current || manualAudioPauseRef.current) return;
    clearAudioResumeTimer();
    audioResumeTimer.current = window.setTimeout(() => {
      audioResumeTimer.current = null;
      const audio = audioRef.current;
      if (!audio || !musicEnabledRef.current || !wechatAudioConsentRef.current || manualAudioPauseRef.current) return;
      if (document.visibilityState === "hidden") return;
      try {
        if (audio.ended || (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration - 0.12)) {
          audio.currentTime = 0;
        }
      } catch {
        // Some embedded browsers can reject currentTime near source teardown.
      }
      void requestAudioPlay();
    }, delay);
  }, [clearAudioResumeTimer, requestAudioPlay]);

  useEffect(() => () => clearAudioResumeTimer(), [clearAudioResumeTimer]);

  useEffect(() => {
    if (!wechatAudioConsent) return;
    void requestAudioPlay();
  }, [bgmUrl, requestAudioPlay, wechatAudioConsent]);

  useEffect(() => {
    if (!musicEnabled || audioPlaying || !wechatAudioConsent) return undefined;
    const unlockAudio = () => void requestAudioPlay();
    window.addEventListener("pointerdown", unlockAudio, {capture: true, once: true});
    window.addEventListener("touchstart", unlockAudio, {capture: true, once: true});
    window.addEventListener("keydown", unlockAudio, {capture: true, once: true});
    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("touchstart", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
  }, [audioPlaying, musicEnabled, requestAudioPlay, wechatAudioConsent]);

  useEffect(() => {
    const resumeVisibleAudio = () => {
      const audio = audioRef.current;
      if (!audio || !audio.paused) return;
      if (document.visibilityState === "hidden") return;
      scheduleAudioResume(80);
    };
    document.addEventListener("visibilitychange", resumeVisibleAudio);
    window.addEventListener("pageshow", resumeVisibleAudio);
    return () => {
      document.removeEventListener("visibilitychange", resumeVisibleAudio);
      window.removeEventListener("pageshow", resumeVisibleAudio);
    };
  }, [scheduleAudioResume]);

  const toggleMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioPlaying) {
      manualAudioPauseRef.current = true;
      clearAudioResumeTimer();
      audio.pause();
      setMusicEnabled(false);
      setAudioPlaying(false);
      return;
    }
    manualAudioPauseRef.current = false;
    setMusicEnabled(true);
    setWechatAudioConsent(true);
    await requestAudioPlay({allowWhenDisabled: true});
  }, [audioPlaying, clearAudioResumeTimer, requestAudioPlay]);

  const startWechatAudio = useCallback(async () => {
    manualAudioPauseRef.current = false;
    setMusicEnabled(true);
    setWechatAudioConsent(true);
    await requestAudioPlay({allowWhenDisabled: true});
  }, [requestAudioPlay]);

  const handleAudioPlaying = useCallback(() => {
    clearAudioResumeTimer();
    setAudioPlaying(true);
  }, [clearAudioResumeTimer]);

  const handleAudioPause = useCallback(() => {
    setAudioPlaying(false);
    scheduleAudioResume();
  }, [scheduleAudioResume]);

  const handleAudioEnded = useCallback(() => {
    setAudioPlaying(false);
    scheduleAudioResume(40);
  }, [scheduleAudioResume]);

  const handleAudioError = useCallback(() => {
    clearAudioResumeTimer();
    setAudioPlaying(false);
  }, [clearAudioResumeTimer]);

  const changeLook = useCallback((event) => {
    const id = rippleId.current + 1;
    const currentLook = lookRef.current;
    const nextLook = (currentLook + 1) % lookCount;
    const portraitRect = (event?.currentTarget ?? portraitButtonRef.current)?.getBoundingClientRect();
    const stageRect = stageRef.current?.getBoundingClientRect();

    rippleId.current = id;
    lookRef.current = nextLook;
    setImageFailed(false);
    setBaseThemeLook(currentLook);
    setLook(nextLook);

    window.clearTimeout(themeTimer.current);
    if (reduceMotion) {
      setBaseThemeLook(nextLook);
      setThemeWipe(null);
    } else {
      setThemeWipe({
        id,
        look: nextLook,
        x: portraitRect ? portraitRect.left + portraitRect.width / 2 - (stageRect?.left || 0) : (stageRect?.width || window.innerWidth) / 2,
        y: portraitRect ? portraitRect.top + portraitRect.height / 2 - (stageRect?.top || 0) : (stageRect?.height || window.innerHeight) / 2,
      });
      themeTimer.current = window.setTimeout(() => {
        setBaseThemeLook(nextLook);
        setThemeWipe((current) => (current?.id === id ? null : current));
      }, halftoneTransitionDuration);
    }

  }, [halftoneTransitionDuration, lookCount, reduceMotion]);

  useEffect(() => {
    let interval;
    const introDelay = reduceMotion ? 400 : 3200;
    const introTimer = window.setTimeout(() => {
      changeLook();
      interval = window.setInterval(() => changeLook(), autoChangeInterval);
    }, introDelay);

    return () => {
      window.clearTimeout(introTimer);
      window.clearInterval(interval);
    };
  }, [autoChangeInterval, changeLook, reduceMotion]);

  const stageStyle = {
    "--accent": avatar.accent,
    "--accent-deep": avatar.deep,
    "--page-bg": appearance.backgroundMode === "white" ? "#ffffff" : background.bg,
  };
  const wipeBackground = themeWipe ? carouselBackgrounds[themeWipe.look % carouselBackgrounds.length] : null;
  const showWechatAudioStart = musicEnabled && !wechatAudioConsent;

  return (
    <>
      <audio
        ref={audioRef}
        src={bgmUrl}
        autoPlay={musicEnabled && wechatAudioConsent}
        loop
        preload="auto"
        onPlaying={handleAudioPlaying}
        onPause={handleAudioPause}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
      />
      <AnimatePresence>
        {introVisible ? (
          <motion.div
            className="experience-intro"
            initial={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.36, ease: [0.76, 0, 0.24, 1]}}
            role="img"
            aria-label={`${title}的9个可爱瞬间`}
          >
            <div className="experience-intro-pattern" aria-hidden="true" />
            <div className="experience-intro-copy" aria-hidden="true">
              <motion.span initial={{opacity: 0, y: 46, rotate: 4, scale: 0.84}} animate={{opacity: 1, y: 0, rotate: 0, scale: 1}} transition={{duration: 0.72, ease: [0.34, 1.56, 0.64, 1]}}>{title.toUpperCase()}的</motion.span>
              <motion.span initial={{opacity: 0, y: 46, rotate: 4, scale: 0.84}} animate={{opacity: 1, y: 0, rotate: 0, scale: 1}} transition={{duration: 0.72, delay: 0.26, ease: [0.34, 1.56, 0.64, 1]}}>9个</motion.span>
              <motion.span initial={{opacity: 0, y: 46, rotate: 4, scale: 0.84}} animate={{opacity: 1, y: 0, rotate: 0, scale: 1}} transition={{duration: 0.72, delay: 0.52, ease: [0.34, 1.56, 0.64, 1]}}>可爱瞬间</motion.span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showWechatAudioStart ? (
          <motion.button
            type="button"
            className={`wechat-audio-cover-start ${appearance.backgroundMode === "white" ? "is-white" : ""}`}
            style={stageStyle}
            initial={{opacity: 0, y: 14, scale: 0.92}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -8, scale: 0.96}}
            transition={{duration: reduceMotion ? 0 : 0.24, ease: [0.34, 1.56, 0.64, 1]}}
            onClick={startWechatAudio}
            data-uisfx="toggle-on"
            data-analytics-action="wechat_audio_start"
            aria-label="播放背景音乐"
          >
            <Play weight="fill" aria-hidden="true" />
            <span>播放音乐</span>
          </motion.button>
        ) : null}
      </AnimatePresence>
      <main ref={stageRef} className={`stage ${embedded ? "is-embedded" : ""} ${appearance.backgroundMode === "white" ? "background-white" : ""} ${showIntro && !reduceMotion ? "stage-intro-open" : ""}`} style={stageStyle}>
        <HalftoneRippleBackground
          backgroundMode={appearance.backgroundMode}
          baseColor={baseBackground.bg}
          baseAccent={baseBackground.accent}
          nextColor={wipeBackground?.bg}
          nextAccent={wipeBackground?.accent}
          transition={themeWipe}
          transitionDuration={halftoneTransitionDuration}
          reduceMotion={reduceMotion}
        />
        <div className="experience-top-actions" aria-label="互动页快捷设置">
          {onExit ? (
            <button type="button" className="experience-top-button experience-home" onClick={onExit} data-uisfx="back" data-analytics-action="home" aria-label="返回主页">
              <House weight="fill" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="experience-top-button experience-bgm-toggle"
            role="switch"
            aria-checked={audioPlaying}
            aria-label={audioPlaying ? "关闭背景音乐" : "播放背景音乐"}
            data-uisfx={audioPlaying ? "toggle-off" : "toggle-on"}
            data-analytics-action={audioPlaying ? "audio_pause" : "audio_play"}
            onClick={toggleMusic}
          >
            {audioPlaying ? <SpeakerHigh weight="fill" aria-hidden="true" /> : <SpeakerSlash weight="fill" aria-hidden="true" />}
            <span>音乐</span>
          </button>
        </div>
        {onAppearanceChange ? (
          <div className="experience-display-controls" aria-label="互动页显示设置">
            <button
              type="button"
              className="experience-display-toggle"
              role="switch"
              aria-checked={appearance.backgroundMode === "color"}
              aria-label="彩色背景"
              data-uisfx={appearance.backgroundMode === "color" ? "toggle-off" : "toggle-on"}
              data-analytics-action="background_toggle"
              onClick={() => onAppearanceChange((value) => ({
                ...value,
                backgroundMode: value.backgroundMode === "color" ? "white" : "color",
                patternStyle: value.backgroundMode === "color" ? "none" : "dots",
              }))}
            >
              <span>背景</span><span className="experience-toggle-track" aria-hidden="true"><span /></span>
            </button>
            <button
              type="button"
              className="experience-display-toggle"
              role="switch"
              aria-checked={appearance.decorations}
              aria-label="周围装饰"
              data-uisfx={appearance.decorations ? "toggle-off" : "toggle-on"}
              data-analytics-action="decorations_toggle"
              onClick={() => onAppearanceChange((value) => ({...value, decorations: !value.decorations}))}
            >
              <span>装饰</span><span className="experience-toggle-track" aria-hidden="true"><span /></span>
            </button>
          </div>
        ) : null}

        <section className="playground" aria-labelledby="main-title">
          <h1 id="main-title" className="sr-only">
            {title}的9个可爱瞬间
          </h1>

          {appearance.decorations ? <div className="sticker-field" aria-hidden="true">
            <AnimatePresence mode="popLayout">
              {stickers.map((sticker, index) => (
                <Sticker
                  key={`${look}-${index}`}
                  sticker={sticker}
                  index={index}
                  look={look}
                  reduceMotion={reduceMotion}
                />
              ))}
            </AnimatePresence>
          </div> : null}

          <motion.div
            className="portrait-zone"
            initial={false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <motion.button
              ref={portraitButtonRef}
              type="button"
              className="portrait-button"
              onClick={changeLook}
              data-uisfx="skip-next"
              data-analytics-action="look_change"
              whileTap={reduceMotion ? undefined : { scale: 0.91, rotate: -4 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              aria-label={`当前是第 ${look + 1} 个造型，${avatar.label}。点击可以立即换一个造型。`}
            >
              <AnimatePresence mode="sync">
                {imageFailed ? (
                  <motion.span
                    key="image-error"
                    className="image-error"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Ghost size="34%" weight="fill" aria-hidden="true" />
                    <span>照片躲起来了</span>
                  </motion.span>
                ) : (
                  <motion.img
                    key={avatar.src}
                    className="portrait"
                    src={avatar.src}
                    alt={avatar.label}
                    fetchPriority="high"
                    decoding="async"
                    draggable="false"
                    onError={() => setImageFailed(true)}
                    initial={
                      reduceMotion || look === 0
                        ? false
                        : { opacity: 0, scale: 1.42, rotate: look % 2 === 0 ? -24 : 24 }
                    }
                    animate={
                      reduceMotion || look === 0
                        ? { opacity: 1, scale: 1, rotate: 0 }
                        : {
                            opacity: 1,
                            scale: [1.42, 0.84, 1.08, 1],
                            rotate: [look % 2 === 0 ? -24 : 24, look % 2 === 0 ? 9 : -9, 0],
                          }
                    }
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 1.25, rotate: look % 2 === 0 ? 18 : -18 }
                    }
                    transition={{ duration: reduceMotion ? 0.12 : 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                  />
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>

        </section>

        {videoUrl || actionContent ? (
          <div className="experience-actions" aria-label="互动页操作">
            {videoUrl ? (
              <a className="experience-download" href={videoUrl} download data-uisfx="success" data-analytics-action="video_download_legacy">
                下载视频
              </a>
            ) : null}
            {actionContent}
          </div>
        ) : null}
      </main>
    </>
  );
}
