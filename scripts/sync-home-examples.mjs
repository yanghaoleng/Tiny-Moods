import {mkdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.env.PUBLIC_ORIGIN || "https://tinymoods.mikeywa.site";
const examples = [
  {
    id: "cec29c58067e4bdc9b6c197b540e7b74",
    folder: "jennie",
    name: "Jennie",
  },
  {
    id: "0794c461bc974ab395b539f70e52b2bf",
    folder: "yangshi-tuotuo",
    name: "羊石坨坨",
  },
];

for (const example of examples) {
  const response = await fetch(`${origin}/api/jobs/${example.id}`);
  if (!response.ok) throw new Error(`读取 ${example.name} 作品失败：${response.status}`);
  const job = await response.json();
  if (job.status !== "ready" || job.avatars?.length !== 9) {
    throw new Error(`${example.name} 作品尚未准备好九张头像`);
  }

  const targetDirectory = path.join(projectRoot, "public", "examples", example.folder);
  await mkdir(targetDirectory, {recursive: true});
  for (let index = 0; index < job.avatars.length; index += 1) {
    const avatarResponse = await fetch(new URL(job.avatars[index].src, origin));
    if (!avatarResponse.ok) throw new Error(`下载 ${example.name} 第 ${index + 1} 张头像失败`);
    const buffer = Buffer.from(await avatarResponse.arrayBuffer());
    const target = path.join(targetDirectory, `face-${String(index + 1).padStart(2, "0")}.webp`);
    await sharp(buffer)
      .ensureAlpha()
      .resize(720, 720, {
        fit: "contain",
        background: {r: 0, g: 0, b: 0, alpha: 0},
      })
      .webp({quality: 92, alphaQuality: 100, effort: 6})
      .toFile(target);
  }
  console.log(`${example.name}：已同步 9 张首页示例头像`);
}
