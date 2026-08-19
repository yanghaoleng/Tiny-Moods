import {mkdir, readdir, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : projectRoot;
const generatedRoot = path.join(dataRoot, "generated");

await mkdir(generatedRoot, {recursive: true});
let restored = 0;

for (const entry of await readdir(generatedRoot, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(generatedRoot, entry.name);
  for (let index = 1; index <= 9; index += 1) {
    const number = String(index).padStart(2, "0");
    const source = path.join(directory, `face-${number}.webp`);
    const output = path.join(directory, `face-${number}.png`);
    try {
      await stat(output);
      continue;
    } catch {
      // Recreate only missing PNG files when an older release needs them.
    }
    try {
      await sharp(source).ensureAlpha().png({compressionLevel: 6}).toFile(output);
      restored += 1;
    } catch {
      // Ignore incomplete jobs without a WebP source.
    }
  }
}

console.log(`Restored ${restored} PNG face assets for rollback compatibility.`);
