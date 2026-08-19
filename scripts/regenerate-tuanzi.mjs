import {copyFile, mkdir, readFile, rm} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import dotenv from "dotenv";
import sharp from "sharp";
import {normalizeSheet, splitAndRemoveBackground} from "../server/background.mjs";
import {getSeedreamBuffer} from "../server/pipeline.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({path: path.join(projectRoot, ".env.local")});

const sourcePath = path.join(projectRoot, "public", "examples", "tuanzi", "face-01.webp");
const outputPath = path.join(projectRoot, "output", "jennie-dingtalk-latest-seedream-sheet.jpg");
const previousPath = path.join(projectRoot, "output", "jennie-dingtalk-latest-seedream-sheet-previous.jpg");
const rawPath = path.join(projectRoot, "output", "jennie-dingtalk-latest-seedream-sheet-raw.jpg");
const splitRoot = path.join(projectRoot, "output", ".tuanzi-split");
const publicRoot = path.join(projectRoot, "public", "examples", "tuanzi");

await mkdir(path.dirname(outputPath), {recursive: true});
await mkdir(publicRoot, {recursive: true});
await copyFile(outputPath, previousPath).catch(() => {});
await rm(splitRoot, {recursive: true, force: true});
await mkdir(splitRoot, {recursive: true});

const sourceBuffer = await sharp(await readFile(sourcePath))
  .resize(1600, 1600, {fit: "contain", background: "#ffffff"})
  .flatten({background: "#ffffff"})
  .jpeg({quality: 95})
  .toBuffer();

const result = await getSeedreamBuffer(sourceBuffer);
await sharp(result.buffer).rotate().flatten({background: "#ffffff"}).jpeg({quality: 96, chromaSubsampling: "4:4:4"}).toFile(rawPath);
await normalizeSheet(result.buffer, outputPath);
const faces = await splitAndRemoveBackground(outputPath, splitRoot);

for (let index = 0; index < faces.length; index += 1) {
  let face = sharp(faces[index].outputPath)
    .resize(720, 720, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}});
  if (index === 8) {
    const headOnlyMask = Buffer.from('<svg width="720" height="720"><path d="M0 0H720V540H550V600L520 720H180V540H0Z" fill="white"/></svg>');
    face = face.composite([{input: headOnlyMask, blend: "dest-in"}]);
  }
  await face
    .webp({quality: 94, alphaQuality: 100, effort: 5})
    .toFile(path.join(publicRoot, `face-${String(index + 1).padStart(2, "0")}.webp`));
}

await rm(splitRoot, {recursive: true, force: true});
console.log(JSON.stringify({
  ok: true,
  requestId: result.requestId,
  usage: result.usage,
  outputPath,
  publicRoot,
}, null, 2));
