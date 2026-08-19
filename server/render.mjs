import {spawn} from "node:child_process";
import {writeFile} from "node:fs/promises";
import path from "node:path";

export async function renderVideo({projectRoot, jobDirectory, jobId, title, avatars, publicOrigin, appearance, onProgress}) {
  if (process.env.SKIP_VIDEO_RENDER === "1") {
    return {videoUrl: null, videoStatus: "skipped"};
  }

  const propsPath = path.join(jobDirectory, "render-props.json");
  const outputPath = path.join(jobDirectory, "video.mp4");
  const lookCount = 9;
  const props = {
    title,
    brand: `${title.toUpperCase()} ${lookCount}`,
    cornerText: `made for ${title}`,
    avatarUrls: avatars.map((_avatar, index) => `${publicOrigin}/generated/${jobId}/face-${String(index + 1).padStart(2, "0")}.png`),
    themes: avatars.map(({accent, deep, bg}) => ({accent, deep, bg})),
    bgmUrl: `${publicOrigin}/jenniebgm.mp3`,
    lookCount,
    appearance,
  };
  await writeFile(propsPath, JSON.stringify(props, null, 2), "utf8");

  const remotionBinary = path.join(projectRoot, "node_modules", ".bin", "remotion");
  const args = [
    "render",
    "src/remotion/index.jsx",
    "FaceNineLooksVideo",
    outputPath,
    "--codec=h264",
    "--audio-codec=aac",
    "--crf=20",
    `--concurrency=${process.env.REMOTION_CONCURRENCY || "1"}`,
    `--props=${propsPath}`,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(remotionBinary, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let errorOutput = "";
    let lastReported = 0;

    const inspectChunk = (chunk) => {
      const output = chunk.toString();
      const matches = [...output.matchAll(/Rendered\s+(\d+)\/(\d+)/g)];
      const latest = matches.at(-1);
      if (!latest) return;
      const current = Number(latest[1]);
      const total = Number(latest[2]);
      const percent = Math.floor((current / total) * 100);
      if (percent >= lastReported + 2 || percent === 100) {
        lastReported = percent;
        void onProgress(percent);
      }
    };

    child.stdout.on("data", inspectChunk);
    child.stderr.on("data", (chunk) => {
      errorOutput = `${errorOutput}${chunk.toString()}`.slice(-6000);
      inspectChunk(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Remotion 渲染失败（退出码 ${code}）：${errorOutput}`));
    });
  });

  return {
    videoUrl: `/generated/${jobId}/video.mp4`,
    videoStatus: "ready",
    videoLookCount: lookCount,
    videoDurationSeconds: 21.2,
    appearance,
  };
}
