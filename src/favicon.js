const faviconMemoryKey = "tiny-moods:favicon-variant";

const faviconVariants = [
  {body: ["#171317"], rail: "#fffaf7", shutter: "#f6d94a", flash: "#f6d94a", status: "#25d98c", rings: ["#171317", "#2cb7ea", "#7048e8", "#f04438"]},
  {body: ["#f04438", "#edb9f3", "#25d98c", "#f6d94a", "#7048e8"], rail: "#171317", shutter: "#171317", flash: "#fffaf7", status: "#171317", rings: ["#171317", "#2b2830", "#171317", "#fffaf7"]},
  {body: ["#171317", "#fffaf7", "#edb9f3"], rail: "#171317", shutter: "#f04438", flash: "#f6d94a", status: "#f04438", rings: ["#fffaf7", "#f6d94a", "#2cb7ea", "#171317"]},
  {body: ["#fffaf7"], rail: "#171317", shutter: "#f04438", flash: "#f6d94a", status: "#f04438", rings: ["#f47c32", "#f6d94a", "#2cb7ea", "#171317"]},
  {body: ["#f04438"], rail: "#f04438", shutter: "#edb9f3", flash: "#f6d94a", status: "#edb9f3", rings: ["#f04438", "#fffaf7", "#171317", "#171317"]},
  {body: ["#25d98c"], rail: "#171317", shutter: "#7048e8", flash: "#f6d94a", status: "#7048e8", rings: ["#25d98c", "#ee5a9b", "#2cb7ea", "#171317"]},
  {body: ["#2cb7ea"], rail: "#171317", shutter: "#f6d94a", flash: "#f6d94a", status: "#25d98c", rings: ["#2cb7ea", "#f47c32", "#7048e8", "#171317"]},
  {body: ["#edb9f3", "#7048e8", "#f04438", "#25d98c", "#2cb7ea", "#f47c32"], rail: "#171317", shutter: "#171317", flash: "#f6d94a", status: "#f04438", rings: ["#171317", "#fffaf7", "#171317", "#171317"]},
  {body: ["#fffaf7", "#171317"], rail: "#fffaf7", shutter: "#171317", flash: "#f04438", status: "#25d98c", rings: ["#edb9f3", "#fffaf7", "#171317", "#171317"]},
];

const stripedFill = (colors) => {
  if (colors.length === 1) return colors[0];
  const stops = colors.map((color, index) => {
    const start = Math.round(index / colors.length * 100);
    const end = Math.round((index + 1) / colors.length * 100);
    return `<stop offset="${start}%" stop-color="${color}"/><stop offset="${end}%" stop-color="${color}"/>`;
  }).join("");
  return {definition: `<linearGradient id="favicon-body" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`, fill: "url(#favicon-body)"};
};

const faviconSvg = (variant) => {
  const palette = faviconVariants[variant - 1] || faviconVariants[0];
  const bodyFill = stripedFill(palette.body);
  const definition = typeof bodyFill === "string" ? "" : bodyFill.definition;
  const fill = typeof bodyFill === "string" ? bodyFill : bodyFill.fill;
  const circles = palette.rings.map((color, index) => `<circle cx="32" cy="39" r="${18 - index * 4}" fill="${color}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${definition}<clipPath id="favicon-body-clip"><rect x="5" y="18" width="54" height="40" rx="10"/></clipPath></defs><rect x="13" y="9" width="18" height="13" rx="4" fill="${palette.shutter}" stroke="#171317" stroke-width="2"/><g clip-path="url(#favicon-body-clip)"><rect x="5" y="18" width="54" height="40" fill="${fill}"/><rect x="5" y="18" width="54" height="10" fill="${palette.rail}"/></g><rect x="5" y="18" width="54" height="40" rx="10" fill="none" stroke="#171317" stroke-width="2"/><rect x="10" y="21" width="12" height="7" rx="2" fill="${palette.flash}"/><circle cx="51" cy="24" r="3" fill="${palette.status}"/>${circles}<circle cx="38" cy="34" r="2.3" fill="#fffaf7"/></svg>`;
};

const randomVariant = (previous) => {
  const choices = faviconVariants.map((_, index) => index + 1).filter((variant) => variant !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
};

export function installRandomFavicon() {
  const link = document.querySelector('link[rel~="icon"]');
  if (!link) return;
  let previous = 0;
  try {
    previous = Number(window.localStorage.getItem(faviconMemoryKey)) || 0;
  } catch {
    // Storage may be unavailable in private browsing.
  }
  const variant = randomVariant(previous);
  link.type = "image/svg+xml";
  link.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(variant))}`;
  link.dataset.variant = String(variant);
  document.documentElement.dataset.faviconVariant = String(variant);
  try {
    window.localStorage.setItem(faviconMemoryKey, String(variant));
  } catch {
    // A fresh random variant is still used when storage is unavailable.
  }
}
