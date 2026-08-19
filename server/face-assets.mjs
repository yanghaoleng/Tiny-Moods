import {rename, rm, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {zipSync} from "fflate";
import sharp from "sharp";

export const FACE_ASSET_SIZE = 1080;
export const FACE_ARCHIVE_NAME = "faces-jpg-v2.zip";

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

export const createFaceJpegBuffer = async (input) => sharp(input)
  .flatten({background: "#ffffff"})
  .jpeg({quality: 88})
  .toBuffer();

export const writeFaceDownloadArchive = async (directory, _title) => {
  const jpegEntries = await Promise.all(Array.from({length: 9}, async (_, index) => {
    const number = index + 1;
    const source = faceFilename(directory, number, "webp");
    return [
      `Tiny-Moods-face-${String(number).padStart(2, "0")}.jpg`,
      await createFaceJpegBuffer(source),
    ];
  }));
  const archive = zipSync(Object.fromEntries(jpegEntries), {level: 0});
  const output = path.join(directory, FACE_ARCHIVE_NAME);
  const temporary = `${output}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, archive);
    await rename(temporary, output);
  } finally {
    await rm(temporary, {force: true});
  }
  return output;
};

export const ensureFaceDownloadArchive = async (directory, title) => {
  const output = path.join(directory, FACE_ARCHIVE_NAME);
  try {
    await stat(output);
    return output;
  } catch {
    return writeFaceDownloadArchive(directory, title);
  }
};
