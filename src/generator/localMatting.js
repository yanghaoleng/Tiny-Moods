const OUTPUT_SIZE = 1080;
const CELL_INSET_RATIO = 0.006;

const canvasToWebp = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("WebP 导出失败")), "image/webp", 0.9);
});

const loadImage = async (blob) => {
  if ("createImageBitmap" in window) return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const processPixels = (worker, imageData, id) => new Promise((resolve, reject) => {
  const onMessage = (event) => {
    if (event.data.id !== id) return;
    cleanup();
    resolve(new ImageData(new Uint8ClampedArray(event.data.buffer), event.data.width, event.data.height));
  };
  const onError = () => {
    cleanup();
    reject(new Error("浏览器本地抠图失败"));
  };
  const cleanup = () => {
    worker.removeEventListener("message", onMessage);
    worker.removeEventListener("error", onError);
  };
  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onError);
  worker.postMessage({id, buffer: imageData.data.buffer, width: imageData.width, height: imageData.height}, [imageData.data.buffer]);
});

export async function splitAndMatteSheet(sheetBlob, onProgress = () => {}) {
  const source = await loadImage(sheetBlob);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const worker = new Worker(new URL("./matting.worker.js", import.meta.url), {type: "module"});
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d", {willReadFrequently: true});
  const results = [];

  try {
    for (let index = 0; index < 9; index += 1) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const cellWidth = sourceWidth / 3;
      const cellHeight = sourceHeight / 3;
      const insetX = cellWidth * CELL_INSET_RATIO;
      const insetY = cellHeight * CELL_INSET_RATIO;
      context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      context.drawImage(
        source,
        column * cellWidth + insetX,
        row * cellHeight + insetY,
        cellWidth - insetX * 2,
        cellHeight - insetY * 2,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );
      const pixels = context.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const transparent = await processPixels(worker, pixels, index);
      context.putImageData(transparent, 0, 0);
      results.push(await canvasToWebp(canvas));
      onProgress(index + 1, 9);
    }
    return results;
  } finally {
    worker.terminate();
    source.close?.();
  }
}
