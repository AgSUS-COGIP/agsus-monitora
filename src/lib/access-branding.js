export const DEFAULT_ACCESS_BRANDING = Object.freeze({
  logoUrl: "/assets/agsus-logo.webp",
  backgroundUrl: "/assets/access-background-default.svg",
  panelColor: "#c296eb",
  greeting: "Seja bem-vindo(a) à AgSUS",
  instruction: "Acesse com sua conta institucional.",
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeAccessBackgroundUrl(value) {
  const url = String(value || "").trim();
  if (!url) return DEFAULT_ACCESS_BRANDING.backgroundUrl;
  if (url.startsWith("/") || url.startsWith("https://")) return url;
  return DEFAULT_ACCESS_BRANDING.backgroundUrl;
}

export function normalizeAccessLogoUrl(value) {
  const url = String(value || "").trim();
  if (!url) return DEFAULT_ACCESS_BRANDING.logoUrl;
  if (url.startsWith("/") || url.startsWith("https://")) return url;
  return DEFAULT_ACCESS_BRANDING.logoUrl;
}

export function normalizeAccessPanelColor(value) {
  const color = String(value || "")
    .trim()
    .toLowerCase();
  return HEX_COLOR.test(color) ? color : DEFAULT_ACCESS_BRANDING.panelColor;
}

export function needsLightForeground(color) {
  const normalized = normalizeAccessPanelColor(color).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 145;
}
