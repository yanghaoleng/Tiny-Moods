import {JennieVideo} from "../remotion/JennieVideo";
import {SHORT_LOOK_COUNT, SHORT_VIDEO_FRAMES, VIDEO_FPS} from "../remotion/config";
import "../remotion/video.css";

const OUTPUT_SCALE = 2 / 3;
const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1280;

const candidates = [
  {container: "mp4", videoCodec: "h264", audioCodec: "aac", extension: "mp4", mimeType: "video/mp4"},
  {container: "webm", videoCodec: "vp9", audioCodec: "opus", extension: "webm", mimeType: "video/webm"},
  {container: "webm", videoCodec: "vp8", audioCodec: "opus", extension: "webm", mimeType: "video/webm"},
];

const absoluteUrl = (value) => new URL(value, window.location.href).href;

export async function renderVideoLocally({job, appearance, signal, onProgress}) {
  const {canRenderMediaOnWeb, renderMediaOnWeb} = await import("@remotion/web-renderer");
  let encoding = null;

  for (const candidate of candidates) {
    const support = await canRenderMediaOnWeb({
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      container: candidate.container,
      videoCodec: candidate.videoCodec,
      audioCodec: candidate.audioCodec,
      videoBitrate: "high",
      audioBitrate: "high",
    });
    if (support.canRender) {
      encoding = candidate;
      break;
    }
  }

  if (!encoding) {
    throw new Error("当前浏览器版本不支持本机视频生成，请更新 Chrome、Firefox 或 Safari 后重试");
  }

  const result = await renderMediaOnWeb({
    composition: {
      id: `nine-polaroid-${job.id}`,
      component: JennieVideo,
      durationInFrames: SHORT_VIDEO_FRAMES,
      fps: VIDEO_FPS,
      width: 1080,
      height: 1920,
    },
    inputProps: {
      title: job.title,
      brand: `${job.title.toUpperCase()} 9`,
      cornerText: `made for ${job.title}`,
      avatarUrls: job.avatars.map((avatar) => absoluteUrl(avatar.src)),
      themes: job.avatars.map(({accent, deep, bg}) => ({accent, deep, bg})),
      bgmUrl: absoluteUrl(`${import.meta.env.BASE_URL}jenniebgm.mp3`),
      lookCount: SHORT_LOOK_COUNT,
      appearance,
    },
    container: encoding.container,
    videoCodec: encoding.videoCodec,
    audioCodec: encoding.audioCodec,
    videoBitrate: "high",
    audioBitrate: "high",
    hardwareAcceleration: "prefer-hardware",
    pageResponsiveness: "medium",
    scale: OUTPUT_SCALE,
    signal,
    onProgress: ({progress, renderEstimatedTime}) => onProgress?.({
      percent: Math.max(1, Math.min(99, Math.round(progress * 100))),
      estimatedSeconds: Number.isFinite(renderEstimatedTime) ? Math.max(0, Math.ceil(renderEstimatedTime / 1000)) : null,
    }),
  });

  return {
    blob: await result.getBlob(),
    extension: encoding.extension,
    mimeType: encoding.mimeType,
  };
}
