import path from "node:path";
import sharp from "sharp";

export const FACE_ASSET_SIZE = 1080;
export const faceFilename = (directory, index, extension) => path.join(
  directory,
  `face-${String(index).padStart(2, "0")}.${extension}`,
);

export const writeFaceWebp = async (input, output) => sharp(input)
  .ensureAlpha()
  .resize(FACE_ASSET_SIZE, FACE_ASSET_SIZE, {
    fit: "contain",
    withoutEnlargement: true,
    background: {r: 0, g: 0, b: 0, alpha: 0},
  })
  .webp({quality: 88, alphaQuality: 100, effort: 4, smartSubsample: true})
  .toFile(output);

export const writeDemoOriginalSheet = async (sources, output) => {
  const cellSize = 720;
  const cells = await Promise.all(sources.map((source) => sharp(source)
    .resize(cellSize, cellSize, {fit: "contain", background: "#ffffff"})
    .flatten({background: "#ffffff"})
    .jpeg({quality: 92})
    .toBuffer()));
  return sharp({create: {width: cellSize * 3, height: cellSize * 3, channels: 3, background: "#ffffff"}})
    .composite(cells.map((input, index) => ({
      input,
      left: (index % 3) * cellSize,
      top: Math.floor(index / 3) * cellSize,
    })))
    .jpeg({quality: 92, chromaSubsampling: "4:4:4"})
    .toFile(output);
};
