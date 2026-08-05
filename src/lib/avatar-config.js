const OPTION_GROUPS = {
  face: ["round", "oval", "square", "soft"],
  nose: ["small", "straight", "round", "wide"],
  hair: ["short", "classic", "waves", "curls", "coils", "long", "bun", "modern"],
  eyes: ["natural", "happy", "calm", "focused", "expressive"],
  mouth: ["smile", "warm", "confident", "subtle", "serious"],
};

export const avatarOptions = {
  face: [
    ["Rosto 1", "round"],
    ["Rosto 2", "oval"],
    ["Rosto 3", "square"],
    ["Rosto 4", "soft"],
  ],
  nose: [
    ["Nariz 1", "small"],
    ["Nariz 2", "straight"],
    ["Nariz 3", "round"],
    ["Nariz 4", "wide"],
  ],
  hair: [
    ["Clássico", "classic"],
    ["Curto", "short"],
    ["Ondulado", "waves"],
    ["Cacheado", "curls"],
    ["Crespo", "coils"],
    ["Longo", "long"],
    ["Coque", "bun"],
    ["Moderno", "modern"],
  ],
  eyes: [
    ["Natural", "natural"],
    ["Alegre", "happy"],
    ["Sereno", "calm"],
    ["Atento", "focused"],
    ["Expressivo", "expressive"],
  ],
  mouth: [
    ["Sorriso", "smile"],
    ["Acolhedora", "warm"],
    ["Confiante", "confident"],
    ["Discreta", "subtle"],
    ["Séria", "serious"],
  ],
};

export const avatarColors = {
  hair: ["1f2937", "3f2d20", "6b4226", "a16207", "d4a574", "d1d5db"],
  skin: ["ffdbb4", "edb98a", "d08b5b", "ae5d29", "614335"],
  background: ["eaf7f6", "eaf2ff", "f4eeff", "fff4e5", "fdeef2", "eef2f6"],
};

export function defaultAvatarConfig(name = "") {
  return {
    version: 1,
    seed: String(name || "agsus-avatar").trim(),
    face: "round",
    nose: "small",
    hair: "short",
    eyes: "happy",
    mouth: "warm",
    glasses: false,
    beard: false,
    freckles: false,
    earrings: false,
    hairColor: "3f2d20",
    skinColor: "edb98a",
    backgroundColor: "eaf2ff",
  };
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeAvatarConfig(value, name = "") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fallback = defaultAvatarConfig(name);
  return {
    version: 1,
    seed: typeof source.seed === "string" && source.seed.trim() ? source.seed.slice(0, 120) : fallback.seed,
    face: enumValue(source.face, OPTION_GROUPS.face, fallback.face),
    nose: enumValue(source.nose, OPTION_GROUPS.nose, fallback.nose),
    hair: enumValue(source.hair, OPTION_GROUPS.hair, fallback.hair),
    eyes: enumValue(source.eyes, OPTION_GROUPS.eyes, fallback.eyes),
    mouth: enumValue(source.mouth, OPTION_GROUPS.mouth, fallback.mouth),
    glasses: source.glasses === true,
    beard: source.beard === true,
    freckles: source.freckles === true,
    earrings: source.earrings === true,
    hairColor: enumValue(source.hairColor, avatarColors.hair, fallback.hairColor),
    skinColor: enumValue(source.skinColor, avatarColors.skin, fallback.skinColor),
    backgroundColor: enumValue(source.backgroundColor, avatarColors.background, fallback.backgroundColor),
  };
}

export function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0]}${parts.length > 1 ? parts.at(-1)[0] : ""}`.toUpperCase();
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

function hairPath(type) {
  const paths = {
    short: "M70 115C72 57 113 36 160 45c38 7 62 34 65 72-28-22-54-30-79-28-24 2-48 11-76 26Z",
    classic: "M66 121C67 61 105 35 157 40c48 4 71 38 70 83-27-30-56-37-85-32-25 4-48 14-76 30Z",
    waves: "M61 127C61 65 99 34 151 38c53 4 81 42 78 91-17-17-31-24-47-27-19-4-30 2-44-4-24-10-45 3-77 29Z",
    curls: "M58 129c-4-53 26-92 72-99 49-8 93 21 101 76 3 19-3 36-9 50-8-26-24-35-43-32-22 4-33-9-52-7-23 2-38 19-69 12Z",
    coils: "M55 139c-9-45 7-93 49-112 48-22 105 1 126 48 11 25 8 53-2 78-17-21-33-26-51-20-20 7-34-6-53-2-23 5-37 18-69 8Z",
    long: "M64 116c3-55 40-84 91-82 49 2 79 34 80 87l-13 114h-31l8-105c-18-25-44-34-72-27-23 5-37 17-51 33l2 99H48Z",
    bun: "M66 118c1-51 37-80 86-80 48 0 78 29 80 78-25-19-50-27-77-24-28 3-55 13-89 26Zm91-80c-20 0-34-11-34-27s14-27 34-27 34 11 34 27-14 27-34 27Z",
    modern: "M65 119c1-55 35-83 85-84 53-2 80 33 80 86-23-22-50-31-79-27-25 3-47 14-67 32l-19-7Zm119-76 36-20-13 38Z",
  };
  return paths[type] || paths.short;
}

export function avatarSvg(configInput, name = "") {
  const config = normalizeAvatarConfig(configInput, name);
  const faceRx = { round: 70, oval: 62, square: 67, soft: 72 }[config.face];
  const faceRy = { round: 79, oval: 88, square: 78, soft: 82 }[config.face];
  const eyeY = config.eyes === "happy" ? 137 : 134;
  const eyeCurve = config.eyes === "happy" ? "q8 7 16 0" : "q8 -3 16 0";
  const mouth = {
    smile: "M128 183q30 25 60 0",
    warm: "M130 184q27 19 56 0",
    confident: "M132 184q25 12 52 0",
    subtle: "M136 187q20 7 42 0",
    serious: "M137 190h40",
  }[config.mouth];
  const nose = {
    small: "M158 145l-5 20 12 1",
    straight: "M158 143v25h11",
    round: "M158 145q-8 20 8 21",
    wide: "M153 146l-6 20q12 8 24 0",
  }[config.nose];
  const freckles = config.freckles
    ? '<g fill="#8b5e3c" opacity=".55"><circle cx="127" cy="158" r="2"/><circle cx="136" cy="161" r="1.8"/><circle cx="185" cy="158" r="2"/><circle cx="176" cy="161" r="1.8"/></g>'
    : "";
  const glasses = config.glasses
    ? '<g fill="none" stroke="#111827" stroke-width="5"><rect x="103" y="119" width="48" height="34" rx="13"/><rect x="169" y="119" width="48" height="34" rx="13"/><path d="M151 132h18M101 129l-18-7M219 129l18-7"/></g>'
    : "";
  const beard = config.beard
    ? `<path d="M111 171q7 65 49 71 43-7 50-71-18 31-50 33-31-2-49-33Z" fill="#${config.hairColor}" opacity=".9"/>`
    : "";
  const earrings = config.earrings
    ? '<g fill="#f2b705"><circle cx="89" cy="163" r="6"/><circle cx="231" cy="163" r="6"/></g>'
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Avatar de ${escapeXml(name)}">
  <rect width="320" height="320" rx="42" fill="#${config.backgroundColor}"/>
  <path d="M80 303q8-65 80-65t80 65" fill="#0b6791"/>
  <ellipse cx="160" cy="154" rx="${faceRx}" ry="${faceRy}" fill="#${config.skinColor}" stroke="#2d221d" stroke-width="3"/>
  <path d="${hairPath(config.hair)}" fill="#${config.hairColor}" stroke="#2d221d" stroke-width="3" stroke-linejoin="round"/>
  <path d="M112 ${eyeY}${eyeCurve}M176 ${eyeY}${eyeCurve}" fill="none" stroke="#171717" stroke-width="6" stroke-linecap="round"/>
  <path d="${nose}" fill="none" stroke="#6f442e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  ${freckles}${glasses}${beard}${earrings}
  <path d="${mouth}" fill="none" stroke="#7f1d1d" stroke-width="5" stroke-linecap="round"/>
</svg>`;
}

export function avatarDataUri(config, name = "") {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(avatarSvg(config, name))}`;
}

export function randomAvatarConfig(name = "", random = Math.random) {
  const pick = (items) => items[Math.floor(random() * items.length)];
  const base = defaultAvatarConfig(name);
  return {
    ...base,
    seed: `${base.seed}-${Date.now()}`,
    face: pick(OPTION_GROUPS.face),
    nose: pick(OPTION_GROUPS.nose),
    hair: pick(OPTION_GROUPS.hair),
    eyes: pick(OPTION_GROUPS.eyes),
    mouth: pick(OPTION_GROUPS.mouth),
    glasses: random() > 0.62,
    beard: random() > 0.75,
    freckles: random() > 0.7,
    earrings: random() > 0.65,
    hairColor: pick(avatarColors.hair),
    skinColor: pick(avatarColors.skin),
    backgroundColor: pick(avatarColors.background),
  };
}
