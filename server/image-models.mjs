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
  model: process.env.SEEDREAM_LITE_MODEL || "doubao-seedream-5-0-260128",
  size: process.env.SEEDREAM_LITE_SIZE || process.env.SEEDREAM_SIZE || "2144x2144",
  priceCny: process.env.SEEDREAM_LITE_PRICE_CNY || "0.22",
});

export const imageModelOptions = () => [proModel(), liteModel()];

export const defaultImageModelKey = () => (
  process.env.SEEDREAM_DEFAULT_TIER === "lite" ? "lite" : "pro"
);

export const findImageModel = (key) => imageModelOptions().find((option) => option.key === key) || null;

export const resolveImageModel = (key) => (
  findImageModel(key) || findImageModel(defaultImageModelKey()) || proModel()
);

export const publicImageModelOptions = () => imageModelOptions().map(({
  key,
  label,
  description,
  size,
  priceCny,
}) => ({key, label, description, size, priceCny}));
