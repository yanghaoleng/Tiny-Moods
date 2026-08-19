import sharp from "sharp";

const isConnectedWhite = (data, offset) => {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const min = Math.min(red, green, blue);
  const max = Math.max(red, green, blue);
  return min >= 232 && max - min <= 34;
};

export async function normalizeSheet(sheetBuffer, outputPath) {
  return sharp(sheetBuffer)
    .rotate()
    .flatten({background: "#ffffff"})
    .resize(4095, 4095, {fit: "fill"})
    .jpeg({quality: 94, chromaSubsampling: "4:4:4"})
    .toFile(outputPath);
}

async function removeConnectedWhiteBackground(inputBuffer, outputPath) {
  const {data, info} = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});

  const {width, height, channels} = info;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const enqueue = (pixel) => {
    if (visited[pixel]) return;
    const offset = pixel * channels;
    if (!isConnectedWhite(data, offset)) return;
    visited[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (visited[pixel]) data[pixel * channels + 3] = 0;
  }

  return sharp(data, {raw: info})
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toFile(outputPath);
}

export async function splitAndRemoveBackground(sheetPath, jobDirectory) {
  const cellSize = 1365;
  const outputs = [];

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const index = row * 3 + column + 1;
      const filename = `face-${String(index).padStart(2, "0")}.png`;
      const outputPath = `${jobDirectory}/${filename}`;
      const cellBuffer = await sharp(sheetPath)
        .extract({left: column * cellSize, top: row * cellSize, width: cellSize, height: cellSize})
        .png()
        .toBuffer();

      await removeConnectedWhiteBackground(cellBuffer, outputPath);
      outputs.push({filename, outputPath});
    }
  }

  return outputs;
}

const toHex = (value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");

const rgbToHsl = (red, green, blue) => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return {hue: 338, saturation: 0.48, lightness};
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const rawHue = max === r
    ? (g - b) / delta + (g < b ? 6 : 0)
    : max === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4;
  return {hue: rawHue * 60, saturation, lightness};
};

const hslToHex = (hue, saturation, lightness) => {
  const h = ((hue % 360) + 360) % 360 / 360;
  const hueToRgb = (p, q, tInput) => {
    let t = tInput;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const red = hueToRgb(p, q, h + 1 / 3) * 255;
  const green = hueToRgb(p, q, h) * 255;
  const blue = hueToRgb(p, q, h - 1 / 3) * 255;
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

export async function getImageTheme(imagePath) {
  const {data, info} = await sharp(imagePath)
    .resize(72, 72, {fit: "inside"})
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const hueBins = new Float64Array(24);
  const saturationBins = new Float64Array(24);

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3] / 255;
    if (alpha < 0.28) continue;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const hsl = rgbToHsl(r, g, b);
    if (hsl.saturation < 0.14 || hsl.lightness < 0.12 || hsl.lightness > 0.94) continue;
    const bin = Math.min(23, Math.floor(hsl.hue / 15));
    const colorWeight = alpha * hsl.saturation * hsl.saturation * (0.55 + Math.min(1, (Math.max(r, g, b) - Math.min(r, g, b)) / 90));
    hueBins[bin] += colorWeight;
    saturationBins[bin] += hsl.saturation * colorWeight;
  }

  let dominantBin = 0;
  for (let index = 1; index < hueBins.length; index += 1) {
    if (hueBins[index] > hueBins[dominantBin]) dominantBin = index;
  }
  if (!hueBins[dominantBin]) return {accent: "#df668f", deep: "#7d3250", bg: "#ffd6e3"};
  const hue = dominantBin * 15 + 7.5;
  const saturation = Math.max(0.48, Math.min(0.72, (saturationBins[dominantBin] / hueBins[dominantBin]) * 1.2));
  return {
    accent: hslToHex(hue, saturation, 0.56),
    deep: hslToHex(hue, Math.max(0.38, saturation - 0.08), 0.29),
    bg: hslToHex(hue, Math.min(0.68, saturation), 0.9),
  };
}
