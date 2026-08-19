import {mkdir} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const fallbackPalette = [
  {accent: "#e85d87", deep: "#7d2948", bg: "#ffd8e5"},
  {accent: "#e78746", deep: "#733d20", bg: "#ffe0bd"},
  {accent: "#5f91c2", deep: "#284867", bg: "#d9eaff"},
  {accent: "#4ba1ab", deep: "#245960", bg: "#cef0ef"},
  {accent: "#8a73c6", deep: "#4a3971", bg: "#e9ddff"},
  {accent: "#df668f", deep: "#7d3250", bg: "#ffd6e3"},
  {accent: "#dd7656", deep: "#753826", bg: "#ffdacb"},
  {accent: "#6c8da8", deep: "#344e66", bg: "#dce9f2"},
  {accent: "#ae7969", deep: "#603b31", bg: "#f2d9cf"},
];

export const expressionPrompt = `严格保持参考照片中同一个主体的身份特征。主体可以是人物或宠物：人物需保持脸型、五官比例、发型与年龄；宠物需保持物种、脸部结构、毛色或羽色与标志性纹理。不得改变物种，不添加第二个主体。

生成一张完整正方形的 3×3 九宫格表情素材，共九个等宽等高的单元格。九格必须从画布左上角到右下角无缝铺满，单元格边界严格位于画布宽高的 1/3 和 2/3。格与格之间必须是零间距、零沟槽、零留白缝，画布外缘也不能有页边距；不要格子线，不要边框。每个单元格本身都是相同的纯白色背景，九块白底在边界处连续相接。

每格只显示同一个主体的一颗完整头部，从头顶到下巴，像悬浮头像贴纸一样居中。必须在下巴下方结束，禁止出现脖子、肩膀、上身、衣服、手、手指、手臂或任何身体部分；即使参考照片里存在这些内容也必须全部移除。脸旁不得出现手或手指。每颗头大小一致，完整不裁切，四周留有均匀的单元格内白边，不接触单元格边缘。正面或轻微侧脸，光线柔和均匀。

九种状态依次为：开心张嘴、惊喜睁大眼、俏皮眨眼、委屈垂眼、酷酷墨镜、可爱嘟嘴或嘟喙、生气鼓脸或炸毛、害羞微笑、戴无线头戴式耳机听歌。耳机不得出现连接线。不要文字，不要水印，不要额外道具遮住面部。整体可爱、精致、真实，适合作为透明背景的纯头部贴纸素材。`;

const estimateSeedreamCost = (usage, size) => {
  const [width, height] = size.split("x").map(Number);
  const pixels = Number.isFinite(width * height) ? width * height : 0;
  const inputImages = Number(usage?.input_images || 1);
  const generatedImages = Number(usage?.generated_images || 1);
  const billableInputImages = Math.max(0, inputImages - 1);
  const outputImageRateCny = pixels > 2_610_000 ? 0.6 : 0.3;
  const totalCny = billableInputImages * 0.02 + generatedImages * outputImageRateCny;
  return {
    currency: "CNY",
    pricingBasis: "火山方舟 Seedream 5.0 Pro 按量刊例价",
    pixelTier: pixels > 2_610_000 ? "输出图>261万像素" : "输出图≤261万像素",
    inputImageRateCny: 0.02,
    freeInputImages: 1,
    billableInputImages,
    outputImageRateCny,
    generatedImages,
    estimatedTotalCny: Number(totalCny.toFixed(2)),
  };
};

export const getSeedreamBuffer = async (sourceBuffer) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error("服务尚未配置 ARK_API_KEY");
  const normalizedInput = await sharp(sourceBuffer)
    .rotate()
    .resize({width: 2048, height: 2048, fit: "inside", withoutEnlargement: true})
    .jpeg({quality: 92})
    .toBuffer();
  const body = {
    model: process.env.SEEDREAM_MODEL || "doubao-seedream-5-0-pro-260628",
    prompt: expressionPrompt,
    image: [`data:image/jpeg;base64,${normalizedInput.toString("base64")}`],
    size: process.env.SEEDREAM_SIZE || "2144x2144",
    response_format: "url",
    watermark: false,
  };
  const response = await fetch(
    process.env.ARK_IMAGE_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    {
      method: "POST",
      headers: {Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json"},
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.SEEDREAM_TIMEOUT_MS || 1_200_000)),
    },
  );
  if (!response.ok) throw new Error(`Seedream 请求失败（${response.status}）：${(await response.text()).slice(0, 1200)}`);
  const payload = await response.json();
  const item = payload.data?.[0] || payload.result?.data?.[0] || payload.result;
  const usage = payload.usage || payload.result?.usage || null;
  const requestId = response.headers.get("x-tt-logid") || response.headers.get("x-request-id") || null;
  if (item?.b64_json) return {buffer: Buffer.from(item.b64_json, "base64"), usage, requestId};
  const imageUrl = item?.url || payload.url || payload.output?.url;
  if (!imageUrl) throw new Error("Seedream 未返回可用图片");
  const imageResponse = await fetch(imageUrl, {signal: AbortSignal.timeout(120_000)});
  if (!imageResponse.ok) throw new Error(`下载 Seedream 图片失败（${imageResponse.status}）`);
  return {buffer: Buffer.from(await imageResponse.arrayBuffer()), usage, requestId};
};

export const buildAvatarManifest = (jobId, title, _publicOrigin, themes = fallbackPalette) => themes.map((theme, index) => ({
  ...theme,
  src: `/generated/${jobId}/face-${String(index + 1).padStart(2, "0")}.webp`,
  downloadSrc: `/generated/${jobId}/face-${String(index + 1).padStart(2, "0")}.png`,
  label: `${title} 表情 ${index + 1}`,
}));

async function makeDemoSheet(sourceBuffer, jobDirectory) {
  const mask = Buffer.from('<svg width="1100" height="1100"><ellipse cx="550" cy="570" rx="510" ry="530" fill="white"/></svg>');
  const portrait = await sharp(sourceBuffer)
    .resize(1100, 1100, {fit: "cover"})
    .ensureAlpha()
    .composite([{input: mask, blend: "dest-in"}])
    .png()
    .toBuffer();
  const tile = await sharp({create: {width: 1365, height: 1365, channels: 3, background: "#ffffff"}})
    .composite([{input: portrait, left: 132, top: 132}])
    .jpeg()
    .toBuffer();
  await sharp({create: {width: 4095, height: 4095, channels: 3, background: "#ffffff"}})
    .composite(Array.from({length: 9}, (_, index) => ({
      input: tile,
      left: (index % 3) * 1365,
      top: Math.floor(index / 3) * 1365,
    })))
    .jpeg({quality: 92})
    .toFile(path.join(jobDirectory, "sheet.jpg"));
}

export async function runGenerationPipeline({job, sourceBuffer, projectRoot, generatedRoot, publicOrigin, update}) {
  const jobDirectory = path.join(generatedRoot, job.id);
  await mkdir(jobDirectory, {recursive: true});

  if (process.env.GENERATOR_DEMO_MODE === "1") {
    await update({status: "generating", stage: "正在准备本地测试母图", progress: 34});
    await makeDemoSheet(sourceBuffer, jobDirectory);
    await update({
      status: "awaiting_client_processing",
      stage: "正在浏览器里拆图和抠背景",
      progress: 50,
      sheetUrl: `${publicOrigin}/api/jobs/${job.id}/sheet`,
    });
    return;
  }

  await update({status: "generating", stage: "Seedream 正在生成 4K 九宫格", progress: 12});
  const seedreamResult = await getSeedreamBuffer(sourceBuffer);
  await sharp(seedreamResult.buffer)
    .rotate()
    .flatten({background: "#ffffff"})
    .jpeg({quality: 94, chromaSubsampling: "4:4:4"})
    .toFile(path.join(jobDirectory, "sheet.jpg"));
  const generatedImageSize = process.env.SEEDREAM_SIZE || "2144x2144";
  await update({
    status: "awaiting_client_processing",
    stage: "正在浏览器里拆图和抠背景",
    progress: 50,
    sheetUrl: `${publicOrigin}/api/jobs/${job.id}/sheet`,
    seedreamUsage: seedreamResult.usage,
    seedreamRequestId: seedreamResult.requestId,
    generatedImageCount: 1,
    generatedImageSize,
    seedreamCostEstimate: estimateSeedreamCost(seedreamResult.usage, generatedImageSize),
  });
}
