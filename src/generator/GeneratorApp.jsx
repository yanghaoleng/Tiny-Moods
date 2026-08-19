import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion, useReducedMotion} from "motion/react";
import {Calligraph} from "calligraph";
import {ArrowRight} from "@phosphor-icons/react/ArrowRight";
import {ArrowSquareOut} from "@phosphor-icons/react/ArrowSquareOut";
import {Check} from "@phosphor-icons/react/Check";
import {DownloadSimple} from "@phosphor-icons/react/DownloadSimple";
import {ImagesSquare} from "@phosphor-icons/react/ImagesSquare";
import {ClockCounterClockwise} from "@phosphor-icons/react/ClockCounterClockwise";
import {MagnifyingGlass} from "@phosphor-icons/react/MagnifyingGlass";
import {PlayCircle} from "@phosphor-icons/react/PlayCircle";
import {CopySimple} from "@phosphor-icons/react/CopySimple";
import {QrCode} from "@phosphor-icons/react/QrCode";
import {ShieldCheck} from "@phosphor-icons/react/ShieldCheck";
import {UploadSimple} from "@phosphor-icons/react/UploadSimple";
import {WechatLogo} from "@phosphor-icons/react/WechatLogo";
import {X} from "@phosphor-icons/react/X";
import JennieExperience from "../JennieExperience";
import UISoundToggle from "../UISoundToggle";
import {trackEvent, usePageAnalytics} from "../analytics";
import {playUISfx} from "../uiSfx";
import {splitAndMatteSheet} from "./localMatting";
import "./generator.css";

const API_BASE = `${import.meta.env.BASE_URL}api`;
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const defaultAppearance = {backgroundMode: "color", patternStyle: "dots", decorations: true};
const fallbackDonationModels = [
  {key: "pro", label: "Seedream 5.0 Pro", description: "更高画质与复杂指令表现", size: "2144x2144", priceCny: "0.60"},
  {key: "lite", label: "Seedream 5.0 Lite", description: "日常生成，成本更低", size: "2144x2144", priceCny: "0.22"},
];
const donationThanksCopies = [
  "谢谢有品位的您！",
  "感谢您的慷慨支持！",
  "懂得支持创作的您真酷！",
  "谢谢您为喜欢买单！",
  "您的支持特别珍贵！",
  "感谢您支持好创意！",
  "愿意支持的您很有爱！",
  "谢谢您的认可与善意！",
  "您的支持让创意继续！",
  "谢谢特别温暖的您！",
];
const exampleFaceUrl = (folder, index) => `${import.meta.env.BASE_URL}examples/${folder}/face-${String(index + 1).padStart(2, "0")}.webp`;
const blueTheme = {accent: "#3ea3e0", deep: "#1b5679", bg: "#d4eaf7"};
const peachTheme = {accent: "#c88055", deep: "#6a422a", bg: "#f3e2d8"};
const sunTheme = {accent: "#e0a33e", deep: "#79561b", bg: "#f7ead4"};
const clayTheme = {accent: "#c58159", deep: "#68432c", bg: "#f2e2d9"};
const crayonDoodles = Array.from(
  {length: 12},
  (_, index) => `${import.meta.env.BASE_URL}decorations/crayon-scribble-${String(index + 1).padStart(2, "0")}.webp`,
);
const brandFixedLetters = [..."Tiny"];
const brandMoodLetters = [..."Moods"];
const landingHeadlines = [
  "一张照片，可爱九次",
  "一张脸，九种可爱",
  "一张照片，九种心情",
  "一张照片，可爱九连",
  "原来这张照片里，藏着九种可爱",
  "可爱一次不够，那就来九次",
  "上传一张照片，领取九份可爱",
  "扫描一张脸，可爱轮播中",
  "可爱不重样，一次来九个",
  "拍一次，萌九格",
  "把平常的一张照片，变成九个特别瞬间",
];
const brandSwatches = [
  {background: "#171317", foreground: "#fffaf7"},
  {background: "#f04438", foreground: "#171317"},
  {background: "#edb9f3", foreground: "#171317"},
  {background: "#25d98c", foreground: "#171317"},
  {background: "#7048e8", foreground: "#fffaf7"},
  {background: "#f6d94a", foreground: "#171317"},
  {background: "#2cb7ea", foreground: "#171317"},
  {background: "#f47c32", foreground: "#171317"},
  {background: "#ee5a9b", foreground: "#171317"},
];
const typerVariations = ["is-fill", "is-inverse", "is-accent", "is-accent-inverse", "is-accent-fill", "is-border"];
const cameraIconConcepts = [
  "黑色彩圈",
  "标题拼色",
  "丁香拍立得",
  "彩色光圈",
  "珊瑚经典",
  "薄荷玩具机",
  "天空蓝",
  "阶梯色块",
  "黑白编辑感",
];
const cameraIconMemoryKey = "tiny-moods:camera-icon";

const createCameraIconVariant = (previous = 0) => {
  const available = cameraIconConcepts
    .map((_, index) => index + 1)
    .filter((variant) => variant !== previous);
  return available[Math.floor(Math.random() * available.length)];
};

const createInitialCameraIconVariant = () => {
  let previous = 0;
  try {
    if (typeof window !== "undefined") previous = Number(window.sessionStorage.getItem(cameraIconMemoryKey)) || 0;
  } catch {
    // Fall back to a fresh random icon when storage is unavailable.
  }
  return createCameraIconVariant(previous);
};

const createMoodPalette = (previous = []) => {
  const next = [];
  brandMoodLetters.forEach((_, letterIndex) => {
    const available = brandSwatches
      .map((__, swatchIndex) => swatchIndex)
      .filter((swatchIndex) => swatchIndex > 0 && swatchIndex !== previous[letterIndex] && !next.includes(swatchIndex));
    next.push(available[Math.floor(Math.random() * available.length)]);
  });
  return next;
};

const replaceMoodColor = (current, letterIndex) => {
  const next = [...current];
  const available = brandSwatches
    .map((_, swatchIndex) => swatchIndex)
    .filter((swatchIndex) => swatchIndex > 0 && swatchIndex !== current[letterIndex] && !next.includes(swatchIndex));
  next[letterIndex] = available[Math.floor(Math.random() * available.length)];
  return next;
};

const brandMetricClass = (letter) => {
  const normalizedLetter = letter.toLowerCase();
  if (letter !== normalizedLetter) return "is-ascender";
  if ("tid".includes(normalizedLetter)) return "is-ascender";
  if ("ygjpq".includes(normalizedLetter)) return "is-descender";
  return "is-xheight";
};

const tuanziAvatars = Array.from({length: 9}, (_, index) => ({
  ...(index === 1 || index === 6 ? peachTheme : blueTheme),
  src: exampleFaceUrl("tuanzi", index),
  label: `团子 表情 ${index + 1}`,
}));

const sunConureAvatars = Array.from({length: 9}, (_, index) => ({
  ...sunTheme,
  src: exampleFaceUrl("sun-conure", index),
  label: `耙耙柑 可爱瞬间 ${index + 1}`,
}));

const featuredJennieAvatars = Array.from({length: 9}, (_, index) => ({
  ...clayTheme,
  src: exampleFaceUrl("jennie", index),
  label: `Jennie 可爱瞬间 ${index + 1}`,
}));

const yangshiTuotuoAvatars = Array.from({length: 9}, (_, index) => ({
  ...clayTheme,
  src: exampleFaceUrl("yangshi-tuotuo", index),
  label: `羊石坨坨 可爱瞬间 ${index + 1}`,
}));

const exampleProfiles = [
  {id: "jennie", name: "Jennie", avatars: featuredJennieAvatars, brand: "JENNIE 9", lookCount: 9},
  {id: "tuanzi", name: "团子", avatars: tuanziAvatars, brand: "团子 9", lookCount: 9},
  {id: "sun-conure", name: "耙耙柑", avatars: sunConureAvatars, brand: "耙耙柑 9", lookCount: 9},
  {id: "yangshi-tuotuo", name: "羊石坨坨", avatars: yangshiTuotuoAvatars, brand: "羊石坨坨 9", lookCount: 9},
];

const demoJobForProfile = (profile) => ({
  id: `demo-${profile.id}`,
  title: profile.name,
  status: "ready",
  videoStatus: "local",
  pageUrl: `${import.meta.env.BASE_URL}?demo=${encodeURIComponent(profile.id)}`,
  avatars: profile.avatars,
  appearance: defaultAppearance,
});

const routeFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    demo: params.get("demo"),
    jobId: params.get("job"),
    viewId: params.get("view"),
    renderProgress: params.get("render") === "1",
    renderAppearance: {
      backgroundMode: params.get("background") === "white" ? "white" : "color",
      patternStyle: params.get("background") === "white" ? "none" : "dots",
      decorations: params.get("decorations") !== "0",
    },
    orderId: params.get("order"),
  };
};

const renderQuery = (routeKey, routeValue, appearance) => {
  const params = new URLSearchParams({
    [routeKey]: routeValue,
    render: "1",
    background: appearance.backgroundMode === "white" ? "white" : "color",
    decorations: appearance.decorations ? "1" : "0",
  });
  return `?${params.toString()}`;
};

const tokenKey = (type, id) => `9face-${type}-token:${id}`;
const saveToken = (type, id, token) => localStorage.setItem(tokenKey(type, id), token);
const loadToken = (type, id) => id ? localStorage.getItem(tokenKey(type, id)) || "" : "";

const openDraftDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open("9face-local-drafts", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("drafts", {keyPath: "id"});
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const saveDraft = async (id, file) => {
  const db = await openDraftDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite");
    transaction.objectStore("drafts").put({id, file, savedAt: Date.now()});
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

const loadDraft = async (id) => {
  const db = await openDraftDb();
  const draft = await new Promise((resolve, reject) => {
    const request = db.transaction("drafts").objectStore("drafts").get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return draft;
};

const deleteDraft = async (id) => {
  const db = await openDraftDb();
  await new Promise((resolve) => {
    const transaction = db.transaction("drafts", "readwrite");
    transaction.objectStore("drafts").delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
  db.close();
};

function useJob(jobId, initialJob) {
  const [job, setJob] = useState(initialJob || null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return undefined;
    let active = true;
    let timer;
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`, {cache: "no-store"});
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "任务状态读取失败");
        if (!active) return;
        setJob(payload);
        setError("");
        timer = window.setTimeout(refresh, ["ready", "failed"].includes(payload.status) ? 5000 : 1600);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message);
        timer = window.setTimeout(refresh, 3000);
      }
    };
    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [jobId]);

  return {job, error, setJob};
}

function useLocalMatting(job, accessToken, setJob) {
  const running = useRef(false);
  const [local, setLocal] = useState({active: false, progress: 0, stage: "", error: ""});
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (job?.status !== "awaiting_client_processing" || (!accessToken && !job?.owned) || running.current) return undefined;
    let active = true;
    running.current = true;
    const run = async () => {
      try {
        setLocal({active: true, progress: 51, stage: "正在下载九宫格母图", error: ""});
        const authHeaders = accessToken ? {"x-access-token": accessToken} : {};
        const response = await fetch(job.sheetUrl, {headers: authHeaders, cache: "no-store"});
        if (!response.ok) throw new Error("九宫格母图读取失败");
        const blobs = await splitAndMatteSheet(await response.blob(), (done, total) => {
          if (active) setLocal({active: true, progress: 51 + Math.round(done / total * 10), stage: `本地抠图 ${done} / ${total}`, error: ""});
        });
        if (!active) return;
        setLocal({active: true, progress: 62, stage: "正在上传九张透明表情", error: ""});
        const body = new FormData();
        blobs.forEach((blob, index) => body.append("faces", blob, `face-${String(index + 1).padStart(2, "0")}.png`));
        const upload = await fetch(`${API_BASE}/jobs/${job.id}/faces`, {
          method: "POST",
          headers: authHeaders,
          body,
        });
        const payload = await upload.json();
        if (!upload.ok) throw new Error(payload.error || "透明表情上传失败");
        if (active) {
          setJob(payload);
          setLocal({active: false, progress: 63, stage: "", error: ""});
          trackEvent("client_processing_completed", {imageCount: payload.avatars?.length || 0}, {jobId: job.id});
        }
      } catch (error) {
        if (active) {
          setLocal({active: false, progress: 50, stage: "本地处理暂停", error: error.message});
          trackEvent("client_processing_failed", {reason: String(error.message || "unknown").slice(0, 120)}, {jobId: job.id});
        }
      } finally {
        running.current = false;
      }
    };
    void run();
    return () => { active = false; };
  }, [accessToken, job?.id, job?.owned, job?.sheetUrl, job?.status, retry, setJob]);

  return {...local, retry: () => setRetry((value) => value + 1)};
}

function CameraIcon({variant = 1, className = ""}) {
  return (
    <span className={`camera-icon camera-icon-${variant} ${className}`.trim()} aria-hidden="true">
      <span className="camera-icon-body">
        <span className="camera-icon-rail" />
        <span className="camera-icon-flash" />
        <span className="camera-icon-status" />
        <span className="camera-icon-lens" />
      </span>
      <span className="camera-icon-shutter" />
    </span>
  );
}

function BrandButton({onClick, sound = "select"}) {
  const reduceMotion = useReducedMotion();
  const [palette, setPalette] = useState(() => createMoodPalette());
  const [iconVariant, setIconVariant] = useState(createInitialCameraIconVariant);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = window.setInterval(() => setPalette((current) => createMoodPalette(current)), 3000);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(cameraIconMemoryKey, String(iconVariant));
    } catch {
      // Private browsing can disable storage; in-memory switching still works.
    }
  }, [iconVariant]);

  const recolorMoodLetter = (letterIndex) => {
    if (reduceMotion) return;
    setPalette((current) => replaceMoodColor(current, letterIndex));
  };

  const handleClick = () => {
    setPalette((current) => createMoodPalette(current));
    setIconVariant((current) => createCameraIconVariant(current));
    onClick?.();
  };

  return (
    <button type="button" className="generator-brand" onClick={handleClick} data-uisfx={sound} data-analytics-action="brand_click" aria-label={`Tiny Moods，当前为${cameraIconConcepts[iconVariant - 1]}相机，点击切换并返回首页`}>
      <span className="generator-brand-mark">
        <CameraIcon variant={iconVariant} />
      </span>
      <span className="brand-glyph-bar" aria-hidden="true">
        {brandFixedLetters.map((letter, letterIndex) => (
          <span
            className={`brand-glyph is-fixed ${brandMetricClass(letter)}`}
            key={`tiny-${letter}-${letterIndex}`}
            style={{"--brand-glyph-index": letterIndex}}
          >
            {letter}
          </span>
        ))}
        {brandMoodLetters.map((letter, letterIndex) => {
          const swatch = brandSwatches[palette[letterIndex]];
          return (
            <span
              className={`brand-glyph is-mood ${brandMetricClass(letter)} ${letterIndex === 0 ? "is-word-start" : ""}`}
              key={`moods-${letter}-${letterIndex}`}
              style={{
                "--brand-glyph-index": brandFixedLetters.length + letterIndex,
                "--brand-glyph-background": swatch.background,
                "--brand-glyph-foreground": swatch.foreground,
              }}
              onPointerEnter={() => recolorMoodLetter(letterIndex)}
            >
              {letter}
            </span>
          );
        })}
      </span>
    </button>
  );
}

function TyperHeadline({text, onRequestNext}) {
  const reduceMotion = useReducedMotion();
  const headingRef = useRef(null);
  const flowRef = useRef(null);
  const measureRef = useRef(null);
  const [wrapped, setWrapped] = useState(false);
  const commaIndex = text.indexOf("，");
  const phrases = commaIndex >= 0
    ? [text.slice(0, commaIndex + 1), text.slice(commaIndex + 1)]
    : [text];
  const compact = Math.max(...phrases.map((phrase) => [...phrase].length)) >= 8;

  useLayoutEffect(() => {
    const flow = flowRef.current;
    const measure = measureRef.current;
    if (!flow || !measure || phrases.length < 2) {
      setWrapped(false);
      return undefined;
    }

    let active = true;
    const updateWrapped = () => {
      if (!active) return;
      setWrapped(measure.getBoundingClientRect().width > flow.getBoundingClientRect().width + 0.5);
    };

    updateWrapped();
    const resizeObserver = new ResizeObserver(updateWrapped);
    resizeObserver.observe(flow);
    resizeObserver.observe(measure);
    document.fonts?.ready.then(updateWrapped);

    return () => {
      active = false;
      resizeObserver.disconnect();
    };
  }, [text, compact]);

  useLayoutEffect(() => {
    const heading = headingRef.current;
    if (!heading) return undefined;
    const characters = [...heading.querySelectorAll(".typer-char")];
    const timers = [];
    let observer;
    let started = false;
    const characterClass = (character, variation = "") => [
      "typer-char",
      character.dataset.typerComma === "true" ? "typer-comma" : "",
      variation,
    ].filter(Boolean).join(" ");

    const settle = () => {
      characters.forEach((character) => { character.className = characterClass(character); });
      heading.dataset.typerType = "done";
    };

    if (reduceMotion) {
      settle();
      return undefined;
    }

    heading.dataset.typerType = "initial";
    characters.forEach((character) => { character.className = characterClass(character, "is-init"); });

    const run = () => {
      if (started) return;
      started = true;
      heading.dataset.typerType = "in";
      const sequences = [];
      characters.forEach((character, index) => {
        const previous = sequences[index - 1];
        const sequence = Array.from({length: 3}, (_, cycleIndex) => {
          if (previous && Math.random() < 0.34) return previous[cycleIndex];
          return typerVariations[Math.floor(Math.random() * typerVariations.length)];
        });
        sequences.push(sequence);
        const lineIndex = Number(character.dataset.typerLine || 0);
        const characterIndex = Number(character.dataset.typerCharacter || 0);
        const delay = lineIndex * 140 + characterIndex * 56;
        sequence.forEach((variation, cycleIndex) => {
          timers.push(window.setTimeout(() => {
            character.className = characterClass(character, variation);
          }, delay + cycleIndex * 88));
        });
        timers.push(window.setTimeout(() => {
          character.className = characterClass(character);
          if (index === characters.length - 1) heading.dataset.typerType = "done";
        }, delay + sequence.length * 88 + 70));
      });
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (!entries[0]?.isIntersecting) return;
        run();
        observer.disconnect();
      }, {threshold: 0.35});
      observer.observe(heading);
    } else {
      run();
    }

    return () => {
      observer?.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [text, reduceMotion]);

  return (
    <h1 ref={headingRef} className={`typer-headline ${compact ? "is-compact" : ""} ${wrapped ? "is-wrapped" : ""}`}>
      <button
        type="button"
        className="typer-headline-button"
        onClick={onRequestNext}
        data-analytics-action="headline_change"
        aria-label={`换一句标题，当前标题：${text}`}
      >
        <span ref={flowRef} className="typer-flow" aria-hidden="true">
          {phrases.map((phrase, phraseIndex) => (
            <span className="typer-phrase" key={phrase}>
              {[...phrase].map((character, characterIndex) => (
                <span
                  className={`typer-char ${character === "，" ? "typer-comma" : ""}`}
                  data-typer-line={phraseIndex}
                  data-typer-character={characterIndex}
                  data-typer-comma={character === "，" ? "true" : undefined}
                  key={`${phraseIndex}-${characterIndex}-${character}`}
                >
                  {character}
                </span>
              ))}
            </span>
          ))}
        </span>
        <span ref={measureRef} className="typer-measure" aria-hidden="true">
          {[...text].map((character, characterIndex) => (
            <span className="typer-char" key={`${characterIndex}-${character}`}>{character}</span>
          ))}
        </span>
      </button>
    </h1>
  );
}

function LoadingDoodle() {
  const reduceMotion = useReducedMotion();
  const [doodleIndex, setDoodleIndex] = useState(() => Math.floor(Math.random() * crayonDoodles.length));

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = window.setInterval(() => {
      setDoodleIndex((current) => {
        const offset = 1 + Math.floor(Math.random() * (crayonDoodles.length - 1));
        return (current + offset) % crayonDoodles.length;
      });
    }, 880);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.img
        key={doodleIndex}
        className="job-loading-doodle"
        src={crayonDoodles[doodleIndex]}
        alt=""
        initial={reduceMotion ? false : {opacity: 0, scale: 0.58, rotate: -16}}
        animate={{opacity: 1, scale: 1, rotate: 0}}
        exit={reduceMotion ? undefined : {opacity: 0, scale: 1.3, rotate: 16}}
        transition={{duration: reduceMotion ? 0 : 0.34, ease: [0.34, 1.3, 0.64, 1]}}
      />
    </AnimatePresence>
  );
}

function ExamplePortrait({profile, index, reduceMotion, onOpen}) {
  const [faceIndex, setFaceIndex] = useState(index % profile.avatars.length);

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.src = profile.avatars[(faceIndex + 1) % profile.avatars.length].src;
  }, [faceIndex, profile.avatars]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    let interval;
    const delay = window.setTimeout(() => {
      setFaceIndex((current) => (current + 1) % profile.avatars.length);
      interval = window.setInterval(() => {
        setFaceIndex((current) => (current + 1) % profile.avatars.length);
      }, 1800 + index * 230);
    }, index * 420);

    return () => {
      window.clearTimeout(delay);
      window.clearInterval(interval);
    };
  }, [index, profile.avatars.length, reduceMotion]);

  const avatar = profile.avatars[faceIndex];

  return (
    <motion.button
      type="button"
      className={`example-card example-card-${profile.id}`}
      onClick={() => onOpen(profile.id)}
      data-uisfx="open"
      data-analytics-action="example_open"
      data-analytics-target={profile.id}
      aria-label={`打开${profile.name}的互动示例`}
      animate={reduceMotion ? undefined : {y: [0, index % 2 ? 5 : -4, 0]}}
      transition={reduceMotion ? undefined : {duration: 4.2 + index * 0.55, repeat: Infinity, ease: "easeInOut"}}
    >
      <div className="example-card-portrait" aria-live="off">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={avatar.src}
            src={avatar.src}
            alt={`${profile.name} 示例表情 ${faceIndex + 1}`}
            decoding="async"
            loading={index > 1 ? "lazy" : "eager"}
            initial={reduceMotion ? false : {opacity: 0, scale: 0.72, rotate: index % 2 ? 7 : -7}}
            animate={{opacity: 1, scale: 1, rotate: 0}}
            exit={reduceMotion ? undefined : {opacity: 0, scale: 1.16, rotate: index % 2 ? -6 : 6}}
            transition={{duration: reduceMotion ? 0 : 0.48, ease: [0.34, 1.4, 0.64, 1]}}
          />
        </AnimatePresence>
      </div>
      <span className="example-card-label">
        <PlayCircle weight="fill" />
        <span><strong>{profile.name}</strong><small>打开互动示例</small></span>
      </span>
    </motion.button>
  );
}

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("图片读取失败"));
  image.src = src;
});

const QR_SIZE = 1080;
const QR_MARGIN_MODULES = 4;
const QR_INK = "#1d1b1e";
const QR_PAPER = "#fbfbfa";
const QR_ACCENTS = ["#c74362", "#326cae", "#6753b5", "#287c70", "#b95a36"];

const drawRoundedRect = (context, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
};

const qrSeed = (value) => [...value].reduce(
  (seed, character) => ((seed * 31) + character.codePointAt(0)) >>> 0,
  2166136261,
);

const isFinderArea = (row, column, moduleCount) => (
  (row < 8 && column < 8)
  || (row < 8 && column >= moduleCount - 8)
  || (row >= moduleCount - 8 && column < 8)
);

const drawFinder = (context, offset, moduleSize, originRow, originColumn) => {
  const centerX = offset + (originColumn + 3.5) * moduleSize;
  const centerY = offset + (originRow + 3.5) * moduleSize;
  [
    {radius: moduleSize * 3.5, color: QR_INK},
    {radius: moduleSize * 2.45, color: QR_PAPER},
    {radius: moduleSize * 1.45, color: QR_INK},
  ].forEach(({radius, color}) => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();
  });
};

async function buildQrCodeDataUrl(shareUrl, avatarUrl) {
  const {default: QRCode} = await import("qrcode");
  const qrCode = QRCode.create(shareUrl, {errorCorrectionLevel: "H"});
  const moduleCount = qrCode.modules.size;
  const moduleSize = QR_SIZE / (moduleCount + QR_MARGIN_MODULES * 2);
  const offset = QR_MARGIN_MODULES * moduleSize;
  const seed = qrSeed(shareUrl);
  const canvas = document.createElement("canvas");
  canvas.width = QR_SIZE;
  canvas.height = QR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("二维码画布创建失败");

  context.fillStyle = QR_PAPER;
  context.fillRect(0, 0, QR_SIZE, QR_SIZE);
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (!qrCode.modules.data[row * moduleCount + column] || isFinderArea(row, column, moduleCount)) continue;
      const accentKey = (row * 43 + column * 29 + seed) % 61;
      context.fillStyle = accentKey < QR_ACCENTS.length ? QR_ACCENTS[accentKey] : QR_INK;
      context.beginPath();
      context.arc(
        offset + (column + 0.5) * moduleSize,
        offset + (row + 0.5) * moduleSize,
        moduleSize * 0.44,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  drawFinder(context, offset, moduleSize, 0, 0);
  drawFinder(context, offset, moduleSize, 0, moduleCount - 7);
  drawFinder(context, offset, moduleSize, moduleCount - 7, 0);

  if (!avatarUrl) return canvas.toDataURL("image/png");

  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) return canvas.toDataURL("image/png");
    const avatarObjectUrl = URL.createObjectURL(await response.blob());
    try {
      const avatarImage = await loadImageElement(avatarObjectUrl);
      const center = QR_SIZE / 2;
      const tileSize = Math.min(220, moduleSize * 8.8);
      const tileX = center - tileSize / 2;
      const tileY = center - tileSize / 2;
      drawRoundedRect(context, tileX, tileY, tileSize, tileSize, tileSize * 0.18);
      context.fillStyle = "#fffaf7";
      context.fill();
      context.lineWidth = Math.max(4, moduleSize * 0.2);
      context.strokeStyle = QR_INK;
      context.stroke();
      const avatarSize = tileSize * 0.76;
      const ratio = Math.min(avatarSize / avatarImage.naturalWidth, avatarSize / avatarImage.naturalHeight);
      const width = avatarImage.naturalWidth * ratio;
      const height = avatarImage.naturalHeight * ratio;
      context.drawImage(avatarImage, center - width / 2, center - height / 2, width, height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(avatarObjectUrl);
    }
  } catch {
    return canvas.toDataURL("image/png");
  }
}

const shareUrlForJob = (job) => new URL(
  job.pageUrl || `${import.meta.env.BASE_URL}?view=${encodeURIComponent(job.id)}`,
  window.location.origin,
).href;

const copyText = async (value) => {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("复制失败");
  }
};

const safeFilenamePart = (value) => value.replace(/[\\/:*?"<>|]/g, "-").trim() || "作品";

const imageExtension = (src, mimeType = "") => {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg")) return "jpg";
  try {
    const extension = new URL(src, window.location.href).pathname.split(".").pop()?.toLowerCase();
    return ["png", "webp", "jpg", "jpeg"].includes(extension) ? extension.replace("jpeg", "jpg") : "png";
  } catch {
    return "png";
  }
};

const prepareAvatarFiles = async (avatars, title, onProgress = () => {}) => {
  let completed = 0;
  return Promise.all(avatars.map(async (avatar, index) => {
    const source = avatar.downloadSrc || avatar.src;
    const response = await fetch(source);
    if (!response.ok) throw new Error(`第 ${index + 1} 张图片读取失败`);
    const mimeType = response.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());
    const extension = imageExtension(source, mimeType);
    const file = new File(
      [bytes],
      `${safeFilenamePart(title)}-透明表情-${String(index + 1).padStart(2, "0")}.${extension}`,
      {type: mimeType || `image/${extension}`},
    );
    completed += 1;
    onProgress(completed, avatars.length);
    return {file, bytes};
  }));
};

const downloadFilesAsZip = async (assets, title) => {
  const {zipSync} = await import("fflate");
  const entries = Object.fromEntries(assets.map(({file, bytes}) => [file.name, bytes]));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  const archive = zipSync(entries, {level: 0});
  const objectUrl = URL.createObjectURL(new Blob([archive], {type: "application/zip"}));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${safeFilenamePart(title)}-9张透明表情.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
};

function SaveImagesSheet({job, appearance, onClose, onRender}) {
  const reduceMotion = useReducedMotion();
  const [preparedAssets, setPreparedAssets] = useState([]);
  const preparedFiles = useMemo(() => preparedAssets.map(({file}) => file), [preparedAssets]);
  const [saveAllState, setSaveAllState] = useState("");
  const [savingAll, setSavingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const saveAllTimer = useRef(null);

  useEffect(() => {
    if (preparedAssets.length === job.avatars.length) return undefined;
    let active = true;
    setSaveAllState("正在准备原图 0 / 9");
    void prepareAvatarFiles(job.avatars, job.title, (done, total) => {
      if (active) setSaveAllState(`正在准备原图 ${done} / ${total}`);
    })
      .then((assets) => {
        if (!active) return;
        setPreparedAssets(assets);
        setSaveAllState("");
      })
      .catch((requestError) => {
        if (!active) return;
        setSaveAllState("");
        setError(requestError.message);
      });
    return () => { active = false; };
  }, [job.avatars, job.title, preparedAssets.length]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(saveAllTimer.current);
    };
  }, [onClose]);

  const saveVideo = async () => {
    setSubmitting(true);
    setError("");
    try {
      onRender(appearance);
    } catch (requestError) {
      setError(requestError.message);
      setSubmitting(false);
    }
  };

  const saveAllFaces = async () => {
    if (savingAll || preparedAssets.length !== job.avatars.length) return;
    setSavingAll(true);
    setError("");
    try {
      const useSystemSave = window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({files: preparedFiles});
      if (useSystemSave) {
        setSaveAllState("请选择系统保存");
        await navigator.share({files: preparedFiles, title: `${job.title}的9张透明表情`});
        setSaveAllState("已打开系统保存");
      } else {
        setSaveAllState("正在打包 9 张图片");
        await downloadFilesAsZip(preparedAssets, job.title);
        setSaveAllState("已开始下载 ZIP");
      }
      trackEvent("interaction", {action: "faces_save_completed", method: useSystemSave ? "system_share" : "zip"}, {jobId: job.id});
      playUISfx("success");
      window.clearTimeout(saveAllTimer.current);
      saveAllTimer.current = window.setTimeout(() => setSaveAllState(""), 2200);
    } catch (requestError) {
      setSaveAllState("");
      if (requestError.name === "AbortError") return;
      setError("批量保存没有完成，可以点开或长按每张图片保存");
      playUISfx("error");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <motion.div className="share-sheet-backdrop" initial={reduceMotion ? false : {opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section
        className={`share-sheet ${appearance.backgroundMode === "white" ? "is-white" : ""}`}
        initial={reduceMotion ? false : {opacity: 0, y: 28, scale: 0.97}}
        animate={{opacity: 1, y: 0, scale: 1}}
        exit={reduceMotion ? {opacity: 0} : {opacity: 0, y: 20, scale: 0.98}}
        transition={{type: "spring", stiffness: 330, damping: 30}}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-faces-title"
      >
        <button type="button" className="share-sheet-close" onClick={onClose} data-uisfx="close" data-analytics-action="save_images_close" aria-label="关闭保存图片"><X weight="bold" /></button>
        <div className="share-faces-view">
          <div className="share-faces-heading">
            <h2 id="share-faces-title">保存九张图片</h2>
            <p>点按看原图，也可以长按每张图片保存</p>
          </div>
          <div className="share-face-grid" role="list" aria-label="九张透明表情">
            {job.avatars.map((avatar, index) => (
              <a key={avatar.src} className="share-face-item" href={avatar.downloadSrc || avatar.src} target="_blank" rel="noreferrer" role="listitem" aria-label={`查看第 ${index + 1} 张大图`} data-uisfx="open" data-analytics-action="face_open" data-analytics-target={String(index + 1)}>
                <img src={avatar.src} alt={`${job.title}透明表情 ${index + 1}`} decoding="async" />
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              </a>
            ))}
          </div>
          <button type="button" className="share-action-button share-action-primary share-save-all" onClick={saveAllFaces} disabled={savingAll || preparedAssets.length !== job.avatars.length} data-uisfx={preparedAssets.length === job.avatars.length ? "start" : "blocked"} data-analytics-action="faces_save_all"><DownloadSimple weight="bold" />{saveAllState || "一键保存 9 张"}</button>
          <p className="share-save-all-note">手机会打开系统保存，电脑会下载含 9 张原图的 ZIP</p>
          {error ? <p className="share-sheet-error">{error}</p> : null}
          <div className="share-video-section">
            <button type="button" className="share-save-video" onClick={saveVideo} data-uisfx="start" data-analytics-action="video_generate" disabled={submitting}><DownloadSimple weight="bold" />{submitting ? "正在打开视频生成" : "保存视频"}</button>
            <p>测试功能，生成比较慢，请保持页面打开</p>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function QrShareBubble({job, onClose}) {
  const reduceMotion = useReducedMotion();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const shareUrl = useMemo(() => shareUrlForJob(job), [job.id, job.pageUrl]);
  const avatarUrl = job.avatars?.[0]?.src || "";

  useEffect(() => {
    let active = true;
    void buildQrCodeDataUrl(shareUrl, avatarUrl)
      .then((value) => { if (active) setQrDataUrl(value); })
      .catch(() => { if (active) setQrDataUrl(""); });
    return () => { active = false; };
  }, [avatarUrl, shareUrl]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <motion.div className="qr-bubble-layer" initial={reduceMotion ? false : {opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section
        className="qr-share-bubble"
        initial={reduceMotion ? false : {opacity: 0, y: 24, scale: 0.78}}
        animate={{opacity: 1, y: 0, scale: 1}}
        exit={reduceMotion ? {opacity: 0} : {opacity: 0, y: 16, scale: 0.86}}
        transition={{type: "spring", stiffness: 360, damping: 25}}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-share-title"
      >
        <button type="button" className="qr-bubble-close" onClick={onClose} data-uisfx="close" data-analytics-action="qr_close" aria-label="关闭分享二维码"><X weight="bold" /></button>
        <h2 id="qr-share-title">分享这个作品</h2>
        <p>长按二维码保存，发给朋友就能打开互动页</p>
        <div className="qr-bubble-image">
          {qrDataUrl ? (
            <a href={qrDataUrl} download={`${safeFilenamePart(job.title)}-分享二维码.png`} data-uisfx="success" data-analytics-action="qr_save" aria-label="保存带作品表情的分享二维码">
              <img src={qrDataUrl} alt={`${job.title}作品分享二维码，中间是作品表情`} draggable="false" />
            </a>
          ) : <span className="share-qr-skeleton" aria-label="正在生成分享二维码" />}
        </div>
      </motion.section>
    </motion.div>
  );
}

function JobStatus({job, statusError, local, backLabel = "制作新作品", onBack}) {
  const progress = Math.max(0, Math.min(100, local.error ? local.progress : local.active ? local.progress : job?.progress || 0));
  const failed = job?.status === "failed";
  const stage = local.error || local.stage || job?.stage || "正在读取任务";

  return (
    <main className="job-page">
      <nav className="generator-nav">
        <BrandButton onClick={onBack} sound="back" />
        <div className="generator-nav-actions">
          <UISoundToggle />
          <button type="button" className="nav-text-button" onClick={onBack} data-uisfx="back">{backLabel}</button>
        </div>
      </nav>
      <section className="job-panel" aria-live="polite">
        <div className={`job-orb ${failed || local.error ? "is-failed" : "is-loading"}`} aria-hidden="true">
          {failed || local.error ? <X weight="bold" /> : <LoadingDoodle />}
        </div>
        <p className="job-kicker">{failed || local.error ? "需要处理" : "请不要关闭本页面"}</p>
        <h1>{stage}</h1>
        <p className="job-description">
          {failed ? job?.error || statusError || "请稍后重试。" : local.error ? "本地拆图没有成功，原始母图仍安全保留，可以直接重试。" : "九宫格拆图和抠背景都在当前浏览器中完成。"}
        </p>
        {!failed ? <div className="job-progress" aria-label={`当前进度 ${progress}%`}><div className="job-progress-fill" style={{transform: `scaleX(${progress / 100})`}} /></div> : null}
        {job?.avatars?.length ? (
          <div className="job-faces" aria-label="已经生成的表情预览">{job.avatars.map((avatar, index) => <img key={avatar.src} src={avatar.src} alt={`${job.title} 表情 ${index + 1}`} />)}</div>
        ) : <div className="job-skeletons" aria-hidden="true">{Array.from({length: 9}, (_, index) => <span key={index} />)}</div>}
        {local.error ? <button type="button" className="button-primary" onClick={local.retry} data-uisfx="retry" data-analytics-action="client_processing_retry">重试本地拆图</button> : null}
        {failed ? <button type="button" className="button-primary" onClick={onBack} data-uisfx="back">换一张照片</button> : null}
      </section>
    </main>
  );
}

function LocalVideoRenderPage({job, appearance, onBack}) {
  const [state, setState] = useState({status: "rendering", progress: 1, stage: "正在准备本机渲染", error: "", estimatedSeconds: null});
  const [download, setDownload] = useState(null);

  const triggerDownload = useCallback((value) => {
    if (!value?.url) return;
    const link = document.createElement("a");
    link.href = value.url;
    link.download = value.filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  useEffect(() => {
    if (!job?.avatars?.length) return undefined;
    const controller = new AbortController();
    const processingSound = playUISfx("processing");
    let objectUrl = "";
    let active = true;

    const render = async () => {
      try {
        trackEvent("local_video_started", {backgroundMode: appearance.backgroundMode, decorations: appearance.decorations}, {jobId: job.id});
        const {renderVideoLocally} = await import("./localVideoRender");
        if (!active) return;
        const result = await renderVideoLocally({
          job,
          appearance,
          signal: controller.signal,
          onProgress: ({percent, estimatedSeconds}) => {
            if (!active) return;
            setState({status: "rendering", progress: percent, stage: `正在本机渲染视频 ${percent}%`, error: "", estimatedSeconds});
          },
        });
        if (!active) return;
        objectUrl = URL.createObjectURL(result.blob);
        const value = {url: objectUrl, filename: `${job.title}-九格拍立得.${result.extension}`};
        setDownload(value);
        setState({status: "ready", progress: 100, stage: "视频已经保存到本机", error: "", estimatedSeconds: 0});
        processingSound?.stop();
        playUISfx("complete");
        trackEvent("local_video_completed", {extension: result.extension}, {jobId: job.id});
        triggerDownload(value);
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        processingSound?.stop();
        playUISfx("error");
        trackEvent("local_video_failed", {reason: String(error.message || "unknown").slice(0, 120)}, {jobId: job.id});
        setState({status: "failed", progress: 0, stage: "本机渲染没有完成", error: error.message || "请更新浏览器后重试", estimatedSeconds: null});
      }
    };

    void render();
    return () => {
      active = false;
      controller.abort();
      processingSound?.stop();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [appearance.backgroundMode, appearance.decorations, appearance.patternStyle, job?.id, triggerDownload]);

  const ready = state.status === "ready";
  const failed = state.status === "failed";

  return (
    <main className="job-page local-render-page">
      <nav className="generator-nav">
        <BrandButton onClick={onBack} sound="back" />
        <div className="generator-nav-actions">
          <UISoundToggle />
          <button type="button" className="nav-text-button" onClick={onBack} data-uisfx="back">返回互动页</button>
        </div>
      </nav>
      <section className="job-panel" aria-live="polite">
        <div className={`job-orb ${failed ? "is-failed" : ready ? "is-ready" : "is-loading"}`} aria-hidden="true">
          {failed ? <X weight="bold" /> : ready ? <Check weight="bold" /> : <LoadingDoodle />}
        </div>
        <p className="job-kicker">{ready ? "本机生成完成" : failed ? "需要处理" : "本机正在生成"}</p>
        <h1>{state.stage}</h1>
        <p className="job-description">
          {ready ? "下载已经开始；如果浏览器没有弹出保存，请点击下方按钮再次下载。" : failed ? state.error : `全部在当前浏览器完成，不占用服务器渲染${state.estimatedSeconds ? `，预计还需约 ${state.estimatedSeconds} 秒` : ""}。请保持页面打开。`}
        </p>
        {!failed ? <div className="job-progress" aria-label={`当前进度 ${state.progress}%`}><div className="job-progress-fill" style={{transform: `scaleX(${state.progress / 100})`}} /></div> : null}
        <div className="job-faces" aria-label="视频使用的九张表情预览">{job.avatars.map((avatar, index) => <img key={avatar.src} src={avatar.src} alt={`${job.title} 表情 ${index + 1}`} />)}</div>
        <div className="job-actions">
          {download ? <button type="button" className="button-primary" onClick={() => triggerDownload(download)} data-uisfx="success" data-analytics-action="video_download_again">再次下载视频 <DownloadSimple weight="bold" /></button> : null}
          <button type="button" className="button-secondary" onClick={onBack} data-uisfx="back">返回互动页</button>
        </div>
        <p className="retention-note"><ShieldCheck weight="fill" /> 表情图片和视频画面均在当前浏览器处理</p>
      </section>
    </main>
  );
}

function SharedJobExperience({job, onExit, onRender, embedded = false}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [copyState, setCopyState] = useState("");
  const [appearance, setAppearance] = useState(job.appearance || defaultAppearance);
  const copyTimer = useRef(null);
  const appearanceSaveQueue = useRef(Promise.resolve());
  const shareUrl = useMemo(() => shareUrlForJob(job), [job.id, job.pageUrl]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const closeQr = useCallback(() => setQrOpen(false), []);
  const updateAppearance = useCallback((updater) => {
    setAppearance((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const accessToken = loadToken("job", job.id);
      if (!job.demo && (job.owned || accessToken)) {
        appearanceSaveQueue.current = appearanceSaveQueue.current
          .catch(() => undefined)
          .then(async () => {
            const response = await fetch(`${API_BASE}/jobs/${encodeURIComponent(job.id)}/appearance`, {
              method: "PATCH",
              headers: {"Content-Type": "application/json", ...(accessToken ? {"x-access-token": accessToken} : {})},
              body: JSON.stringify(next),
            });
            if (!response.ok) throw new Error("显示设置保存失败");
          })
          .catch(() => undefined);
      }
      return next;
    });
  }, [job.demo, job.id, job.owned]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copyShareLink = async () => {
    try {
      await copyText(shareUrl);
      setCopyState("已复制");
      playUISfx("copy");
    } catch {
      setCopyState("复制失败");
      playUISfx("error");
    }
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState(""), 1800);
  };

  return (
    <>
      <JennieExperience
        customAvatars={job.avatars}
        title={job.title}
        appearance={appearance}
        onAppearanceChange={updateAppearance}
        lookCount={9}
        onExit={onExit}
        actionContent={(
          <>
            <button type="button" className="experience-share-action" onClick={copyShareLink} data-analytics-action="link_copy" aria-label="复制作品链接">
              <CopySimple weight="bold" aria-hidden="true" />
              <span className="experience-action-label-full">{copyState || "复制链接"}</span>
              <span className="experience-action-label-short">{copyState || "复制"}</span>
            </button>
            <button type="button" className="experience-share-action" onClick={() => { setQrOpen(false); setSheetOpen(true); }} data-uisfx="open" data-analytics-action="faces_open" aria-label="打开保存图片半弹窗">
              <ImagesSquare weight="bold" aria-hidden="true" />
              <span className="experience-action-label-full">保存图片</span>
              <span className="experience-action-label-short">保存</span>
            </button>
            <button type="button" className="experience-share-action" onClick={() => { setSheetOpen(false); setQrOpen((value) => !value); }} data-uisfx="open" data-analytics-action="qr_open" aria-label="打开分享二维码">
              <QrCode weight="bold" aria-hidden="true" />
              <span className="experience-action-label-full">分享二维码</span>
              <span className="experience-action-label-short">二维码</span>
            </button>
          </>
        )}
        embedded={embedded}
        showIntro={!embedded}
      />
      <AnimatePresence>
        {sheetOpen ? (
          <SaveImagesSheet
            job={job}
            appearance={appearance}
            onClose={closeSheet}
            onRender={onRender}
          />
        ) : null}
        {qrOpen ? <QrShareBubble job={job} onClose={closeQr} /> : null}
      </AnimatePresence>
    </>
  );
}

function DemoExperience({profile, onExit, onRender, embedded = false}) {
  const demoJob = useMemo(() => demoJobForProfile(profile), [profile]);

  return (
    <SharedJobExperience
      job={demoJob}
      onExit={onExit}
      onRender={onRender}
      embedded={embedded}
    />
  );
}

function ExamplePreviewDialog({profile, onClose, onRender}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      className="example-preview-backdrop"
      initial={reduceMotion ? false : {opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        className="example-preview-dialog"
        initial={reduceMotion ? false : {opacity: 0, y: 28, scale: 0.96}}
        animate={{opacity: 1, y: 0, scale: 1}}
        exit={reduceMotion ? {opacity: 0} : {opacity: 0, y: 20, scale: 0.98}}
        transition={{type: "spring", stiffness: 330, damping: 30}}
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name}互动示例`}
      >
        <button type="button" className="example-preview-close" onClick={onClose} data-uisfx="close" data-analytics-action="example_close" aria-label="关闭互动示例"><X weight="bold" /></button>
        <div className="example-preview-stage">
          <DemoExperience profile={profile} embedded onRender={onRender} />
        </div>
      </motion.section>
    </motion.div>
  );
}

function DonationDialog({busy, error, models = fallbackDonationModels, defaultModel = "pro", onClose, onContinue}) {
  const reduceMotion = useReducedMotion();
  const [method, setMethod] = useState("wechat");
  const [wechatCopied, setWechatCopied] = useState(false);
  const [supportCopy] = useState(() => `生成图片会产生费用，不需要给太多。${donationThanksCopies[Math.floor(Math.random() * donationThanksCopies.length)]}`);
  const [selectedModelKey, setSelectedModelKey] = useState(() => (
    models.some((model) => model.key === defaultModel) ? defaultModel : models[0]?.key || "pro"
  ));
  const selectedModel = models.find((model) => model.key === selectedModelKey) || models[0] || fallbackDonationModels[0];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose]);

  return (
    <motion.div className="donation-backdrop" initial={reduceMotion ? false : {opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <motion.section className="donation-dialog" initial={reduceMotion ? false : {opacity: 0, y: 24, scale: 0.97}} animate={{opacity: 1, y: 0, scale: 1}} exit={reduceMotion ? {opacity: 0} : {opacity: 0, y: 12}} role="dialog" aria-modal="true" aria-labelledby="donation-title">
        <button type="button" className="donation-close" onClick={onClose} data-uisfx="close" data-analytics-action="donation_close" aria-label="关闭打赏说明"><X weight="bold" /></button>
        <h2 id="donation-title">选择生成模型</h2>
        <p className="donation-copy">不同模型对应不同生成成本，按需要选择即可。</p>
        <div className="donation-models" role="radiogroup" aria-label="选择生成模型">
          {models.map((model) => (
            <button
              type="button"
              role="radio"
              aria-checked={selectedModel.key === model.key}
              className={selectedModel.key === model.key ? "is-selected" : ""}
              onClick={() => setSelectedModelKey(model.key)}
              data-uisfx="select"
              data-analytics-action="donation_model"
              data-analytics-target={model.key}
              key={model.key}
            >
              <span className="donation-model-copy"><strong>{model.label}</strong><small>{model.description}</small></span>
              <span className="donation-model-price">¥{model.priceCny}</span>
            </button>
          ))}
        </div>
        <div className="donation-amount">
          <span>建议打赏</span>
          <strong>¥1 ~ ¥3</strong>
        </div>
        <p className="donation-copy donation-support-copy">
          {reduceMotion ? supportCopy : <Calligraph initial animation="smooth" drift={{x: 0, y: 10}} trend={1} stagger={0.012}>{supportCopy}</Calligraph>}
        </p>
        <div className="donation-tabs" role="tablist" aria-label="选择打赏方式">
          <button type="button" role="tab" aria-selected={method === "wechat"} className={method === "wechat" ? "is-selected wechat" : "wechat"} onClick={() => setMethod("wechat")} data-uisfx="select" data-analytics-action="donation_method" data-analytics-target="wechat"><WechatLogo weight="fill" />微信</button>
          <button type="button" role="tab" aria-selected={method === "alipay"} className={method === "alipay" ? "is-selected alipay" : "alipay"} onClick={() => setMethod("alipay")} data-uisfx="select" data-analytics-action="donation_method" data-analytics-target="alipay"><span aria-hidden="true">支</span>支付宝</button>
        </div>
        <div className="donation-qr-frame" role="tabpanel">
          <img src={`${import.meta.env.BASE_URL}donate/${method}-qr.webp`} alt={`${method === "wechat" ? "微信" : "支付宝"}打赏二维码`} />
        </div>
        <p className="donation-contact-copy">有问题或建议请联系作者：<button type="button" onClick={async () => { await copyText("yanghaoleng"); setWechatCopied(true); }} data-uisfx="copy" data-analytics-action="author_wechat_copy">{wechatCopied ? "已复制 yanghaoleng" : "复制微信号（yanghaoleng）"}</button></p>
        {error ? <p className="donation-error">{error}</p> : null}
        <button type="button" className="button-primary donation-continue" onClick={() => onContinue(selectedModel.key)} data-uisfx="start" data-analytics-action="donation_continue" data-analytics-target={selectedModel.key} disabled={busy}>{busy ? "正在开始生成" : `我已打赏，用 ${selectedModel.label.replace("Seedream ", "")} 生成`}<ArrowRight weight="bold" /></button>
      </motion.section>
    </motion.div>
  );
}

const workStatusCopy = (work) => {
  if (work.status === "ready") return "已完成";
  if (work.status === "failed") return "生成失败";
  return work.stage || "正在生成";
};

const workTimeCopy = (value) => new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(value));

function WorkHistoryDialog({onClose, onOpenWork}) {
  const reduceMotion = useReducedMotion();
  const searchInputRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState("loading");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchState, setSearchState] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    let timer;
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE}/history`, {cache: "no-store"});
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "生成记录读取失败");
        if (!active) return;
        setHistory(payload.items || []);
        setHistoryState("ready");
        setError("");
        if ((payload.items || []).some((item) => !["ready", "failed"].includes(item.status))) {
          timer = window.setTimeout(refresh, 1800);
        }
      } catch (requestError) {
        if (!active) return;
        setHistoryState("error");
        setError(requestError.message);
      }
    };
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  const searchWorks = async (event) => {
    event.preventDefault();
    const name = query.trim();
    if (!name) {
      setSearchState("error");
      setError("请输入作品的完整名字");
      searchInputRef.current?.focus();
      return;
    }
    setSearchState("loading");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/works/search?name=${encodeURIComponent(name)}`, {cache: "no-store"});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "查询失败");
      setResults(payload.items || []);
      setSearchState("ready");
      trackEvent("work_name_searched", {found: (payload.items || []).length > 0});
    } catch (requestError) {
      setSearchState("error");
      setError(requestError.message);
    }
  };

  const renderWorks = (items, emptyCopy) => items.length ? (
    <div className="work-history-list">
      {items.map((work) => (
        <button key={work.id} type="button" className="work-history-item" onClick={() => onOpenWork(work)} data-uisfx="open">
          <span className={`work-history-preview ${work.previewUrl ? "has-image" : ""}`}>
            {work.previewUrl ? <img src={work.previewUrl} alt={`${work.title}作品预览`} /> : <ClockCounterClockwise weight="bold" aria-hidden="true" />}
          </span>
          <span className="work-history-copy">
            <strong>{work.title}</strong>
            <small>{workTimeCopy(work.createdAt)}</small>
            <span className={`work-history-status is-${work.status}`}>{workStatusCopy(work)}</span>
          </span>
          <ArrowRight weight="bold" aria-hidden="true" />
        </button>
      ))}
    </div>
  ) : <div className="work-history-empty"><ClockCounterClockwise weight="bold" /><strong>{emptyCopy}</strong></div>;

  return (
    <motion.div className="work-history-backdrop" initial={reduceMotion ? false : {opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section className="work-history-dialog" initial={reduceMotion ? false : {opacity: 0, y: 20, scale: 0.98}} animate={{opacity: 1, y: 0, scale: 1}} exit={reduceMotion ? {opacity: 0} : {opacity: 0, y: 10}} role="dialog" aria-modal="true" aria-labelledby="work-history-title">
        <div className="work-history-header">
          <div><h2 id="work-history-title">生成记录</h2><p>这个浏览器创建的作品会自动出现在这里。</p></div>
          <button type="button" className="work-history-close" onClick={onClose} aria-label="关闭生成记录" data-uisfx="close"><X weight="bold" /></button>
        </div>
        <div className="work-history-section">
          <h3>我的作品</h3>
          {historyState === "loading" ? <div className="work-history-loading" aria-label="正在读取生成记录"><span /><span /><span /></div> : null}
          {historyState === "ready" ? renderWorks(history, "还没有生成记录") : null}
        </div>
        <div className="work-search-section">
          <div><h3>按名字找作品</h3><p>请输入生成时填写的完整名字。</p></div>
          <form className="work-search-form" onSubmit={searchWorks}>
            <label htmlFor="work-name-search">作品名字</label>
            <div><input ref={searchInputRef} id="work-name-search" value={query} maxLength={20} autoComplete="off" placeholder="例如：团子" onChange={(event) => { setQuery(event.target.value); setSearchState("idle"); setError(""); }} /><button type="submit" disabled={searchState === "loading"}><MagnifyingGlass weight="bold" />{searchState === "loading" ? "查询中" : "查询"}</button></div>
          </form>
          {searchState === "ready" ? renderWorks(results, "没有找到同名的已完成作品") : null}
        </div>
        {error ? <p className="work-history-error">{error}</p> : null}
      </motion.section>
    </motion.div>
  );
}

function Landing({resumeOrderId, onRenderExample, onJobCreated, onOpenWork}) {
  const reduceMotion = useReducedMotion();
  const inputRef = useRef(null);
  const nameInputRef = useRef(null);
  const uploadStarted = useRef(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [previewProfileId, setPreviewProfileId] = useState("");
  const [order, setOrder] = useState(null);
  const [donationOpen, setDonationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [headline, setHeadline] = useState(() => landingHeadlines[Math.floor(Math.random() * landingHeadlines.length)]);
  const previewProfile = exampleProfiles.find((profile) => profile.id === previewProfileId) || null;

  const showNextHeadline = () => {
    setHeadline((currentHeadline) => {
      const currentIndex = landingHeadlines.indexOf(currentHeadline);
      const offset = 1 + Math.floor(Math.random() * (landingHeadlines.length - 1));
      return landingHeadlines[(currentIndex + offset) % landingHeadlines.length];
    });
  };

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    const timer = window.setTimeout(() => nameInputRef.current?.focus({preventScroll: true}), reduceMotion ? 0 : 220);
    return () => {
      URL.revokeObjectURL(nextUrl);
      window.clearTimeout(timer);
    };
  }, [file, reduceMotion]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/health`, {cache: "no-store"}).then((response) => response.json()).then((payload) => active && setHealth(payload)).catch(() => active && setHealth({configured: false, payment: {configured: false, channels: []}}));
    return () => { active = false; };
  }, []);

  const uploadPaidOrder = useCallback(async (paidOrder) => {
    if (uploadStarted.current) return;
    uploadStarted.current = true;
    setSubmitting(true);
    try {
      const accessToken = loadToken("order", paidOrder.id);
      const draft = file ? {file} : await loadDraft(paidOrder.id);
      if (!draft?.file) throw new Error("没有找到原照片，请重新选择后继续");
      const body = new FormData();
      body.append("photo", draft.file);
      body.append("orderId", paidOrder.id);
      body.append("accessToken", accessToken);
      body.append("consent", "true");
      const response = await fetch(`${API_BASE}/jobs`, {method: "POST", body});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "生成任务创建失败");
      saveToken("job", payload.id, payload.accessToken || accessToken);
      await deleteDraft(paidOrder.id);
      trackEvent("generation_job_created", {source: paidOrder.channel || "donation"}, {jobId: payload.id});
      onJobCreated(payload);
    } catch (requestError) {
      uploadStarted.current = false;
      playUISfx("error");
      setError(requestError.message);
      setSubmitting(false);
    }
  }, [file, onJobCreated]);

  useEffect(() => {
    if (!resumeOrderId) return undefined;
    const accessToken = loadToken("order", resumeOrderId);
    if (!accessToken) { setError("没有找到本机订单凭证，请回到首页重新发起"); return undefined; }
    let active = true;
    fetch(`${API_BASE}/orders/${resumeOrderId}?token=${encodeURIComponent(accessToken)}`, {cache: "no-store"})
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "订单读取失败");
        if (!active) return;
        setOrder(payload);
        setSubjectName(payload.title || "");
        if (payload.status === "paid") await uploadPaidOrder(payload);
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [resumeOrderId, uploadPaidOrder]);

  useEffect(() => {
    if (!order?.id || order.status !== "pending") return undefined;
    let active = true;
    const accessToken = loadToken("order", order.id);
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/orders/${order.id}?token=${encodeURIComponent(accessToken)}`, {cache: "no-store"});
        const payload = await response.json();
        if (!response.ok || !active) return;
        setOrder(payload);
        if (payload.status === "paid") await uploadPaidOrder(payload);
      } catch {
        // A later poll or the provider return page can resume the order.
      }
    }, 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [order?.id, order?.status, uploadPaidOrder]);

  const acceptFile = useCallback((nextFile) => {
    if (!nextFile) return false;
    if (!allowedTypes.has(nextFile.type)) {
      playUISfx("error");
      setError("请选择 JPG、PNG 或 WebP 图片");
      return false;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      playUISfx("error");
      setError("图片不能超过 12MB");
      return false;
    }
    if (health?.configured === false) {
      playUISfx("blocked");
      setError("生成服务尚未配置完成");
      return false;
    }
    setFile(nextFile);
    setError("");
    trackEvent("interaction", {
      action: "photo_selected",
      fileType: nextFile.type,
      sizeBucket: nextFile.size < 1024 * 1024 ? "under_1mb" : nextFile.size < 5 * 1024 * 1024 ? "1_to_5mb" : "over_5mb",
    });
    return true;
  }, [health?.configured]);

  const acceptDroppedFiles = useCallback((fileList) => {
    setDragging(false);
    if (!fileList?.length) return;
    if (fileList.length > 1) {
      playUISfx("error");
      setError("一次只能上传一张照片");
      return;
    }
    if (acceptFile(fileList[0])) playUISfx("drop");
  }, [acceptFile]);

  const beginGeneration = () => {
    if (!file) {
      playUISfx("blocked");
      setError("请先上传一张照片");
      return;
    }
    if (!subjectName.trim()) {
      playUISfx("blocked");
      setError("请填写照片里对象的名字");
      nameInputRef.current?.focus();
      return;
    }
    setError("");
    playUISfx("open");
    setDonationOpen(true);
  };

  const continueAfterDonation = async (selectedModelKey) => {
    setSubmitting(true);
    setError("");
    trackEvent("generation_started", {titleLength: subjectName.trim().length, model: selectedModelKey});
    try {
      const response = await fetch(`${API_BASE}/orders/donation`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({title: subjectName.trim(), model: selectedModelKey}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "生成凭证创建失败");
      saveToken("order", payload.id, payload.accessToken);
      await saveDraft(payload.id, file);
      setOrder(payload);
      window.history.replaceState({}, "", `${import.meta.env.BASE_URL}?order=${encodeURIComponent(payload.id)}`);
      setDonationOpen(false);
      await uploadPaidOrder(payload);
    } catch (requestError) {
      playUISfx("error");
      setError(requestError.message);
      setSubmitting(false);
    }
  };

  return (
    <main className="generator-page landing-theme">
      <input ref={inputRef} className="hero-upload-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { acceptDroppedFiles(event.target.files); event.target.value = ""; }} data-analytics-action="photo_file_change" aria-label="上传一张正脸照片" />
      <nav className="generator-nav">
        <BrandButton onClick={() => window.scrollTo({top: 0, behavior: "smooth"})} />
        <div className="landing-nav-tools">
          <button type="button" className="history-trigger" onClick={() => setHistoryOpen(true)} data-uisfx="open" data-analytics-action="history_open"><ClockCounterClockwise weight="bold" /><span>生成记录</span></button>
          <UISoundToggle />
        </div>
      </nav>

      <section className="landing-composer">
        <div className="landing-heading">
          <TyperHeadline text={headline} onRequestNext={showNextHeadline} />
        </div>

        <motion.div className="photo-workbench" initial={reduceMotion ? false : {opacity: 0, y: 28}} animate={{opacity: 1, y: 0}} transition={{duration: 0.68, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}>
          <button
            type="button"
            className={`photo-dropzone ${dragging ? "is-dragging" : ""} ${file ? "has-photo" : ""}`}
            onClick={() => inputRef.current?.click()}
            data-uisfx="open"
            data-analytics-action="upload_open"
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); acceptDroppedFiles(event.dataTransfer.files); }}
            disabled={submitting || health?.configured === false}
          >
            {previewUrl ? (
              <span className="photo-preview">
                <img src={previewUrl} alt="待生成照片预览" />
                <span className="photo-replace">点击或拖入另一张照片来更换</span>
              </span>
            ) : (
              <span className="photo-empty-state">
                <UploadSimple weight="bold" aria-hidden="true" />
                <strong>{dragging ? "松开即可放入照片" : "把照片拖进来"}</strong>
                <small>也可以点击浏览，只支持一张照片</small>
              </span>
            )}
          </button>

          <AnimatePresence initial={false}>
            {file ? (
              <motion.div className="photo-details" initial={reduceMotion ? false : {opacity: 0, y: -10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -8}} transition={{duration: reduceMotion ? 0 : 0.28}}>
                <div className="subject-name-field">
                  <div className="subject-name-copy">
                    <label htmlFor="subject-name">它叫什么名字？</label>
                    <small>这个名字会显示在互动页开头。</small>
                  </div>
                  <input
                    ref={nameInputRef}
                    id="subject-name"
                    value={subjectName}
                    maxLength={20}
                    autoComplete="off"
                    placeholder="例如：团子"
                    onChange={(event) => { setSubjectName(event.target.value); if (error) setError(""); }}
                  />
                </div>
                <div className="photo-detail-actions">
                  <button type="button" className="remove-photo" onClick={() => { setFile(null); setSubjectName(""); setError(""); }} data-uisfx="delete" data-analytics-action="photo_remove">移除照片</button>
                  <button type="button" className="button-primary generate-button" onClick={beginGeneration} data-analytics-action="generation_prepare" disabled={submitting}>生成9个瞬间 <ArrowRight weight="bold" /></button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>{error && !donationOpen ? <motion.p className="hero-error" initial={{opacity: 0, y: -6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}}>{error}</motion.p> : null}</AnimatePresence>
        </motion.div>
      </section>

      <motion.section className="example-section" initial={reduceMotion ? false : {opacity: 0, y: 28}} whileInView={{opacity: 1, y: 0}} viewport={{once: true, amount: 0.18}} transition={{duration: 0.62, ease: [0.16, 1, 0.3, 1]}}>
        <div className="example-heading">
          <h2>先看看它们的可爱瞬间</h2>
          <p>点击案例，直接打开互动预览。</p>
        </div>
        <div className="example-gallery" aria-label="互动案例">
          {exampleProfiles.map((profile, index) => <ExamplePortrait key={profile.id} profile={profile} index={index} reduceMotion={reduceMotion} onOpen={setPreviewProfileId} />)}
        </div>
      </motion.section>

      <footer className="landing-footer">
        <a href="https://mikeywa.icu" target="_blank" rel="noreferrer" aria-label="打开作者主页" data-uisfx="open" data-analytics-action="author_home_open">
          <span>作者主页</span>
          <ArrowSquareOut weight="bold" aria-hidden="true" />
        </a>
      </footer>

      <AnimatePresence>{donationOpen ? <DonationDialog busy={submitting} error={error} models={health?.imageModels?.length ? health.imageModels : fallbackDonationModels} defaultModel={health?.defaultImageModel || "pro"} onClose={() => { if (!submitting) setDonationOpen(false); }} onContinue={continueAfterDonation} /> : null}</AnimatePresence>
      <AnimatePresence>{previewProfile ? <ExamplePreviewDialog profile={previewProfile} onClose={() => setPreviewProfileId("")} onRender={(appearance) => onRenderExample(previewProfile.id, appearance)} /> : null}</AnimatePresence>
      <AnimatePresence>{historyOpen ? <WorkHistoryDialog onClose={() => setHistoryOpen(false)} onOpenWork={(work) => { setHistoryOpen(false); onOpenWork(work); }} /> : null}</AnimatePresence>
    </main>
  );
}

export default function GeneratorApp() {
  const [route, setRoute] = useState(routeFromLocation);
  const [createdJob, setCreatedJob] = useState(null);
  const activeJobId = createdJob?.id || route.jobId || route.viewId;
  const {job, error, setJob} = useJob(activeJobId, createdJob);
  const accessToken = createdJob?.accessToken || loadToken("job", activeJobId);
  const local = useLocalMatting(job, accessToken, setJob);
  const activeExample = route.demo ? exampleProfiles.find((profile) => profile.id === route.demo) : null;
  const completedJob = Boolean(activeJobId && job?.id === activeJobId && job.status === "ready" && job.avatars?.length === 9);
  const analyticsContext = useMemo(() => {
    if (activeExample && route.renderProgress) return {page: "demo_video_render", jobId: `demo-${activeExample.id}`, demoId: activeExample.id};
    if (activeExample) return {page: "demo_experience", jobId: `demo-${activeExample.id}`, demoId: activeExample.id};
    if (route.viewId && route.renderProgress) return {page: "job_video_render", jobId: activeJobId || route.viewId, demoId: ""};
    if (route.viewId || completedJob) return {page: "job_experience", jobId: activeJobId || route.viewId, demoId: ""};
    if (activeJobId) return {page: "generation_status", jobId: activeJobId, demoId: ""};
    return {page: route.orderId ? "generation_resume" : "landing", jobId: "", demoId: ""};
  }, [activeExample, activeJobId, completedJob, route.orderId, route.renderProgress, route.viewId]);
  usePageAnalytics(analyticsContext);

  useEffect(() => {
    const onPopState = () => { setCreatedJob(null); setRoute(routeFromLocation()); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (activeExample || route.viewId || !activeJobId || !completedJob) return;
    window.history.replaceState({}, "", `${import.meta.env.BASE_URL}?view=${encodeURIComponent(activeJobId)}`);
    setCreatedJob(null);
    setRoute(routeFromLocation());
    window.scrollTo({top: 0});
  }, [activeExample, activeJobId, completedJob, route.viewId]);

  const navigate = (query = "") => {
    window.history.pushState({}, "", `${import.meta.env.BASE_URL}${query}`);
    setCreatedJob(null);
    setRoute(routeFromLocation());
    window.scrollTo({top: 0});
  };

  useEffect(() => {
    document.title = activeExample ? `${activeExample.name} 示例 | Tiny Moods` : route.viewId || completedJob ? "我的互动表情 | Tiny Moods" : route.jobId ? "作品工坊 | Tiny Moods" : "Tiny Moods | 一张照片生成九种可爱心情";
    if (!activeExample && !route.viewId && !completedJob) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", route.jobId ? "#f6f0ed" : "#ffffff");
  }, [activeExample, completedJob, route.jobId, route.viewId]);

  if (activeExample && route.renderProgress) {
    return <LocalVideoRenderPage job={demoJobForProfile(activeExample)} appearance={route.renderAppearance} onBack={() => navigate(`?demo=${encodeURIComponent(activeExample.id)}`)} />;
  }
  if (activeExample) {
    return <DemoExperience profile={activeExample} onExit={() => navigate()} onRender={(appearance) => navigate(renderQuery("demo", activeExample.id, appearance))} />;
  }
  if (route.viewId && job?.avatars?.length === 9 && route.renderProgress) {
    return <LocalVideoRenderPage job={job} appearance={route.renderAppearance} onBack={() => navigate(`?view=${encodeURIComponent(job.id)}`)} />;
  }
  if ((route.viewId || completedJob) && job?.avatars?.length === 9) {
    return <SharedJobExperience job={job} onExit={() => navigate()} onRender={(appearance) => navigate(renderQuery("view", job.id, appearance))} />;
  }
  if (activeJobId) return <JobStatus job={job || createdJob} statusError={error} local={local} backLabel={route.viewId ? "返回互动页" : "制作新作品"} onBack={() => route.viewId ? navigate(`?view=${activeJobId}`) : navigate()} />;
  return <Landing resumeOrderId={route.orderId} onRenderExample={(exampleId, appearance) => navigate(renderQuery("demo", exampleId, appearance))} onOpenWork={(work) => navigate(work.status === "ready" ? `?view=${encodeURIComponent(work.id)}` : `?job=${encodeURIComponent(work.id)}`)} onJobCreated={(nextJob) => { setCreatedJob(nextJob); window.history.replaceState({}, "", `${import.meta.env.BASE_URL}?job=${nextJob.id}`); setRoute(routeFromLocation()); window.scrollTo({top: 0}); }} />;
}
