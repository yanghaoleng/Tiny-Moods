import {Audio} from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import avatar02 from "../../assets/image 2-1.png";
import avatar03 from "../../assets/image 3.png";
import avatar04 from "../../assets/image 3-1.png";
import avatar05 from "../../assets/image 4.png";
import avatar06 from "../../assets/image 4-1.png";
import avatar07 from "../../assets/image 4-2.png";
import avatar08 from "../../assets/image 4-3.png";
import avatar09 from "../../assets/image 5.png";
import avatar10 from "../../assets/image 5-1.png";
import avatar11 from "../../assets/image 6.png";
import {INTRO_FRAMES, LOOK_COUNT, LOOK_FRAMES} from "./config";

const defaultAvatars = [
  {src: staticFile("hero.png"), accent: "#ef6f9a", deep: "#8f2851", bg: "#ffd9e7", label: "苹果花苞 Jennie"},
  {src: avatar02, accent: "#e7587f", deep: "#7f2544", bg: "#ffcfdc", label: "波点蝴蝶结 Jennie"},
  {src: avatar03, accent: "#df8b42", deep: "#74401c", bg: "#ffe0b8", label: "嘴巴嘟嘟 Jennie"},
  {src: avatar04, accent: "#6b96c7", deep: "#25486f", bg: "#d7e9ff", label: "墨镜酷酷 Jennie"},
  {src: avatar05, accent: "#4ea7b2", deep: "#205b64", bg: "#cceff0", label: "蓝色眼线 Jennie"},
  {src: avatar06, accent: "#9a78c9", deep: "#523774", bg: "#e8dcff", label: "紫色眼线 Jennie"},
  {src: avatar07, accent: "#e75f8c", deep: "#842d51", bg: "#ffd2e3", label: "粉色眼线 Jennie"},
  {src: avatar08, accent: "#e36d4e", deep: "#7c3221", bg: "#ffd9ca", label: "橘色眼线 Jennie"},
  {src: avatar09, accent: "#db7fa6", deep: "#7c3455", bg: "#ffe0ed", label: "粉色耳机 Jennie"},
  {src: avatar10, accent: "#728ca8", deep: "#334c67", bg: "#dce8f2", label: "银色耳机 Jennie"},
  {src: avatar11, accent: "#b57868", deep: "#68382e", bg: "#f3d8cc", label: "编发 Jennie"},
];

const stickerImages = [
  "sparkle", "heart", "flower", "butterfly",
  "cherries", "music", "crown", "wand",
  "camera", "planet", "cookie", "balloon",
].map((name) => staticFile(`decorations/doodle-${name}.png`));

const scribbleImages = Array.from(
  {length: 12},
  (_, index) => staticFile(`decorations/crayon-scribble-${String(index + 1).padStart(2, "0")}.png`),
);

const decorationArt = {
  brand: scribbleImages[3],
  corner: scribbleImages[5],
};

const stickerSlots = [
  {x: 14, y: 22, size: 252, rotate: -13},
  {x: 86, y: 22, size: 152, rotate: 11},
  {x: 85, y: 84, size: 116, rotate: -7},
];

const patternNames = ["dots", "checks", "petals", "confetti"];

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

const ThemeLayer = ({avatar, pattern, appearance, className = ""}) => (
  <div
    className={`video-theme pattern-${pattern} ${appearance.backgroundMode === "white" ? "background-white" : ""} ${className}`}
    style={{
      "--video-accent": avatar.accent,
      "--video-deep": avatar.deep,
      "--video-bg": avatar.bg,
    }}
  />
);

const Sticker = ({look, index, localFrame, contentFrame, fps}) => {
  const slot = stickerSlots[index];
  const sway = Math.sin((look + 1) * (index + 2)) * 3.2;
  const x = slot.x + sway;
  const y = slot.y + Math.cos((look + 3) * (index + 1)) * 2.2;
  const rotate = slot.rotate + ((look * 7 + index * 3) % 13) - 6;
  const colorfulCount = 1 + (look % 2);
  const colorfulStart = (look * 2) % stickerSlots.length;
  const isColorful = ((index - colorfulStart + stickerSlots.length) % stickerSlots.length) < colorfulCount;
  const src = isColorful
    ? stickerImages[(look * 5 + index * 3) % stickerImages.length]
    : scribbleImages[(look * 7 + index * 5) % scribbleImages.length];
  const delay = index * 0.85;
  const burst = spring({
    frame: Math.max(0, localFrame - delay),
    fps,
    config: {stiffness: 118, damping: 13, mass: 0.76},
  });
  const floatY = Math.sin((contentFrame + index * 8) / (15 + (index % 3) * 2)) * (8 + (index % 4) * 2);
  const floatRotate = Math.sin((contentFrame + index * 11) / 24) * 2.5;
  const fromX = 50 + (x - 50) * burst;
  const fromY = 50 + (y - 50) * burst;
  const opacity = interpolate(localFrame - delay, [0, 5], [0, 1], clamp);
  const scale = interpolate(burst, [0, 1], [0.1, 1]);
  const startRotate = rotate + (index % 2 === 0 ? -42 : 42);

  return (
    <div
      className={`video-sticker video-sticker-${isColorful ? "colorful" : "scribble"}`}
      style={{
        left: `${fromX}%`,
        top: `${fromY}%`,
        width: slot.size,
        height: slot.size,
        opacity,
        transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${scale}) rotate(${interpolate(burst, [0, 1], [startRotate, rotate]) + floatRotate}deg)`,
      }}
    >
      <Img src={src} alt="" />
    </div>
  );
};

const Portrait = ({avatar, look, localFrame}) => {
  const direction = look % 2 === 0 ? -1 : 1;
  const scale = interpolate(localFrame, [0, 6, 12, 18], [1.42, 0.84, 1.08, 1], {
    ...clamp,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const rotate = interpolate(localFrame, [0, 9, 18], [24 * direction, -9 * direction, 0], clamp);
  const opacity = interpolate(localFrame, [0, 4], [0, 1], clamp);

  return (
    <div className="video-portrait-zone">
      <div className="video-halo" />
      <div
        className="video-ripple"
        style={{
          opacity: interpolate(localFrame, [0, 8, 27], [0.48, 0.34, 0], clamp),
          transform: `translate(-50%, -50%) scale(${interpolate(localFrame, [0, 27], [0.72, 2.45], clamp)})`,
        }}
      />
      <Img
        className="video-portrait"
        src={avatar.src}
        alt={avatar.label}
        style={{opacity, transform: `scale(${scale}) rotate(${rotate}deg)`}}
      />
    </div>
  );
};

const MainScene = ({frame, fps, avatars, brand, cornerText, lookCount, appearance}) => {
  const getAvatar = (look) => avatars[(look * 7) % avatars.length];
  const timelineFrame = Math.max(0, frame - INTRO_FRAMES);
  const motionFrame = Math.max(0, frame - 61);
  const look = Math.min(lookCount - 1, Math.floor(timelineFrame / LOOK_FRAMES));
  const localFrame = look === 0 ? Math.min(35, motionFrame) : timelineFrame % LOOK_FRAMES;
  const avatar = getAvatar(look);
  const previousLook = Math.max(0, look - 1);
  const previousAvatar = getAvatar(previousLook);
  const pattern = appearance.patternStyle === "auto" ? patternNames[look % patternNames.length] : appearance.patternStyle;
  const previousPattern = appearance.patternStyle === "auto" ? patternNames[previousLook % patternNames.length] : appearance.patternStyle;
  const wipeProgress = interpolate(localFrame, [0, 26], [0.001, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.16, 1),
  });
  const pageReveal = interpolate(frame, [61, 94], [0, 150], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.16, 1),
  });

  return (
    <AbsoluteFill
      className="video-stage"
      style={{
        "--video-accent": avatar.accent,
        "--video-deep": avatar.deep,
        "--video-bg": avatar.bg,
        clipPath: `circle(${pageReveal}% at 50% 50%)`,
      }}
    >
      <ThemeLayer avatar={look === 0 ? avatar : previousAvatar} pattern={look === 0 ? pattern : previousPattern} appearance={appearance} />
      {look > 0 ? (
        <div className="video-theme-wipe" style={{transform: `translate(-50%, -50%) scale(${wipeProgress})`}}>
          <ThemeLayer avatar={avatar} pattern={pattern} appearance={appearance} />
        </div>
      ) : null}

      <header className="video-topbar">
        <div className="video-brand">
          <Img src={decorationArt.brand} />
          <span>{brand}</span>
        </div>
        <div className="video-counter">
          <span>{String(look + 1).padStart(2, "0")}</span>
          <span className="video-counter-slash">/</span>
          <span>{String(lookCount).padStart(2, "0")}</span>
        </div>
      </header>

      {appearance.decorations ? <div className="video-sticker-field">
        {stickerSlots.map((_, index) => (
          <Sticker
            key={`${look}-${index}`}
            look={look}
            index={index}
            localFrame={localFrame}
            contentFrame={motionFrame}
            fps={fps}
          />
        ))}
      </div> : null}

      <Portrait avatar={avatar} look={look} localFrame={localFrame} />

      {appearance.decorations ? <div className="video-corner-note">
        <Img src={decorationArt.corner} />
        <span>{cornerText}</span>
      </div> : null}
    </AbsoluteFill>
  );
};

const Intro = ({frame, fps, title, lookCount}) => {
  const lines = [`${title.toUpperCase()}的`, `${lookCount}个`, "可爱瞬间"];
  const copyOpacity = interpolate(frame, [52, 66], [1, 0], clamp);
  const copyScale = interpolate(frame, [52, 66], [1, 1.035], clamp);

  return (
    <AbsoluteFill className="video-intro">
      <div className="video-intro-pattern" />
      <div className="video-intro-copy" style={{opacity: copyOpacity, transform: `scale(${copyScale})`}}>
        {lines.map((line, index) => {
          const progress = spring({
            frame: Math.max(0, frame - index * 8),
            fps,
            config: {stiffness: 112, damping: 12, mass: 0.75},
          });
          return (
            <div
              key={line}
              className={index === 1 ? "video-intro-accent" : ""}
              style={{
                opacity: interpolate(progress, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(progress, [0, 1], [92, 0])}px) rotate(${interpolate(progress, [0, 1], [4, 0])}deg) scale(${interpolate(progress, [0, 1], [0.84, 1])})`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const JennieVideo = ({
  title = "Jennie",
  brand = "JENNIE 100",
  cornerText = "made for Jennie",
  avatarUrls = [],
  themes = [],
  bgmUrl,
  lookCount = LOOK_COUNT,
  appearance = {backgroundMode: "color", patternStyle: "dots", decorations: true},
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const audioFrames = LOOK_FRAMES * lookCount;
  const avatars = avatarUrls.length > 0
    ? avatarUrls.map((src, index) => {
        const fallback = defaultAvatars[index % defaultAvatars.length];
        return {
          accent: themes[index]?.accent || fallback.accent,
          deep: themes[index]?.deep || fallback.deep,
          bg: themes[index]?.bg || fallback.bg,
          src,
          label: `${title} 表情 ${index + 1}`,
        };
      })
    : defaultAvatars;

  return (
    <AbsoluteFill>
      <Intro frame={frame} fps={fps} title={title} lookCount={lookCount} />
      <MainScene
        frame={frame}
        fps={fps}
        avatars={avatars}
        brand={brand}
        cornerText={cornerText}
        lookCount={lookCount}
        appearance={appearance}
      />
      <Audio
        name="Jennie BGM"
        from={INTRO_FRAMES}
        durationInFrames={audioFrames}
        loop
        src={bgmUrl || staticFile("jenniebgm.mp3")}
        volume={(audioFrame) => {
          const fadeIn = interpolate(audioFrame, [0, 24], [0, 0.82], clamp);
          const fadeOut = interpolate(audioFrame, [audioFrames - 45, audioFrames], [0.82, 0], clamp);
          return Math.min(fadeIn, fadeOut);
        }}
      />
    </AbsoluteFill>
  );
};
