const uniq = (items) => [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const liteModel = () => ({
  key: "lite",
  label: "Seedream 5.0 Lite",
  description: "轻量快速生成，适合默认体验",
  model: process.env.SEEDREAM_LITE_MODEL || "doubao-seedream-5-0-260128",
  fallbackModels: uniq([
    process.env.SEEDREAM_LITE_MODEL,
    "doubao-seedream-5-0-260128",
  ]),
  size: process.env.SEEDREAM_LITE_SIZE || "2K",
  priceCny: process.env.SEEDREAM_LITE_PRICE_CNY || "0.22",
});

export const imageModelOptions = () => [liteModel()];

export const defaultImageModelKey = () => "lite";

export const findImageModel = (key) => imageModelOptions().find((option) => option.key === key) || null;

export const resolveImageModel = (key) => (
  findImageModel(key) || liteModel()
);

export const candidateImageModelIds = (selectedModel) => {
  const configured = findImageModel(selectedModel?.key);
  return uniq([
    selectedModel?.model,
    ...(configured?.fallbackModels || []),
  ]);
};

export const imageModelApiKey = (selectedModel) => {
  const tier = String(selectedModel?.key || "").toUpperCase();
  return (
    process.env[`SEEDREAM_${tier}_API_KEY`] ||
    process.env[`ARK_${tier}_API_KEY`] ||
    process.env.SEEDREAM_API_KEY ||
    process.env.ARK_API_KEY ||
    ""
  );
};

export const imageModelEndpoint = (selectedModel) => {
  const tier = String(selectedModel?.key || "").toUpperCase();
  return (
    process.env[`SEEDREAM_${tier}_ENDPOINT`] ||
    process.env[`ARK_${tier}_IMAGE_ENDPOINT`] ||
    process.env.ARK_IMAGE_ENDPOINT ||
    "https://ark.cn-beijing.volces.com/api/v3/images/generations"
  );
};

export const publicImageModelOptions = () => imageModelOptions().map(({
  key,
  label,
  description,
  size,
  priceCny,
}) => ({key, label, description, size, priceCny}));
