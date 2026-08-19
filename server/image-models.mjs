const uniq = (items) => [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const splitList = (value) => String(value || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const proModel = () => ({
  key: "pro",
  label: "Seedream 5.0 Pro",
  description: "更高画质与复杂指令表现",
  model: process.env.SEEDREAM_PRO_MODEL || process.env.SEEDREAM_MODEL || "doubao-seedream-5-0-pro-260628",
  size: process.env.SEEDREAM_PRO_SIZE || process.env.SEEDREAM_SIZE || "2144x2144",
  priceCny: process.env.SEEDREAM_PRO_PRICE_CNY || "0.60",
});

const liteModel = () => ({
  key: "lite",
  label: "Seedream 5.0 Lite",
  description: "日常生成，成本更低",
  model: process.env.SEEDREAM_LITE_MODEL || "doubao-seedream-5-0-lite-260128",
  fallbackModels: uniq([
    process.env.SEEDREAM_LITE_MODEL,
    ...splitList(process.env.SEEDREAM_LITE_FALLBACK_MODELS),
    "doubao-seedream-5-0-lite-260128",
    "doubao-seedream-5-0-260128",
  ]),
  size: process.env.SEEDREAM_LITE_SIZE || process.env.SEEDREAM_SIZE || "2144x2144",
  priceCny: process.env.SEEDREAM_LITE_PRICE_CNY || "0.22",
});

export const imageModelOptions = () => [liteModel(), proModel()];

export const defaultImageModelKey = () => (
  process.env.SEEDREAM_DEFAULT_TIER === "pro" ? "pro" : "lite"
);

export const findImageModel = (key) => imageModelOptions().find((option) => option.key === key) || null;

export const resolveImageModel = (key) => (
  findImageModel(key) || findImageModel(defaultImageModelKey()) || liteModel()
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
