import {access, readdir, rename, rm, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(projectRoot, "assets");
const decorationsRoot = path.join(projectRoot, "public", "decorations");

const pngFilesIn = async (directory) => (await readdir(directory, {withFileTypes: true}))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
  .map((entry) => path.join(directory, entry.name));

const optionalTargets = [
  path.join(projectRoot, "public", "app-icon.png"),
  path.join(projectRoot, "public", "hero.png"),
];
const existingOptionalTargets = [];
for (const target of optionalTargets) {
  try {
    await access(target);
    existingOptionalTargets.push(target);
  } catch {
    // Already converted assets are intentionally skipped.
  }
}

const targets = [
  ...await pngFilesIn(assetsRoot),
  ...await pngFilesIn(decorationsRoot),
  ...existingOptionalTargets,
];

let inputBytes = 0;
let outputBytes = 0;

for (const input of targets) {
  const output = input.replace(/\.png$/i, ".webp");
  const temporary = `${output}.tmp`;
  const sourceSize = (await stat(input)).size;
  const isArtwork = input.includes(`${path.sep}decorations${path.sep}`) || input.endsWith(`${path.sep}app-icon.png`);
  const isReference = input.endsWith(`${path.sep}sun-conure-reference.png`);

  await sharp(input)
    .ensureAlpha()
    .webp({
      quality: isReference ? 86 : 88,
      alphaQuality: 100,
      effort: 6,
      nearLossless: isArtwork,
      smartSubsample: !isArtwork,
    })
    .toFile(temporary);

  await rename(temporary, output);
  await rm(input);
  inputBytes += sourceSize;
  outputBytes += (await stat(output)).size;
  console.log(`${path.relative(projectRoot, input)} → ${path.relative(projectRoot, output)}`);
}

const saving = inputBytes ? Math.round((1 - outputBytes / inputBytes) * 100) : 0;
console.log(`静态图片：${inputBytes} bytes → ${outputBytes} bytes，减少 ${saving}%`);
