const OPTION_GROUPS = {
  face: ["soft", "oval", "square", "round"],
  nose: ["small", "straight", "round", "wide"],
  hair: [
    "classic",
    "short",
    "waves",
    "curls",
    "coils",
    "long",
    "bun",
    "modern",
  ],
  eyes: ["natural", "happy", "calm", "focused", "expressive"],
  mouth: ["smile", "warm", "confident", "subtle", "serious"],
  outfit: ["blazer", "shirt", "field"],
};

export const avatarOptions = {
  face: [
    ["Suave", "soft"],
    ["Alongado", "oval"],
    ["Estruturado", "square"],
    ["Arredondado", "round"],
  ],
  nose: [
    ["Delicado", "small"],
    ["Reto", "straight"],
    ["Suave", "round"],
    ["Marcante", "wide"],
  ],
  hair: [
    ["Executivo", "classic"],
    ["Curto", "short"],
    ["Ondulado", "waves"],
    ["Cacheado", "curls"],
    ["Crespo", "coils"],
    ["Longo", "long"],
    ["Coque", "bun"],
    ["Contemporâneo", "modern"],
  ],
  eyes: [
    ["Natural", "natural"],
    ["Acolhedor", "happy"],
    ["Sereno", "calm"],
    ["Atento", "focused"],
    ["Expressivo", "expressive"],
  ],
  mouth: [
    ["Sorriso leve", "smile"],
    ["Acolhedora", "warm"],
    ["Confiante", "confident"],
    ["Discreta", "subtle"],
    ["Séria", "serious"],
  ],
  outfit: [
    ["Blazer", "blazer"],
    ["Camisa", "shirt"],
    ["Colete", "field"],
  ],
};

export const avatarColors = {
  hair: ["202124", "34251f", "4c3024", "70452d", "a16b42", "c7b08a", "9ca3af"],
  skin: ["f7d7bf", "e9bd9b", "d99a72", "bd7651", "96583f", "714233", "4a2d27"],
  background: ["e9f1f6", "e6f3f0", "edf0f8", "f3eee8", "f4ecef", "eceff1"],
  outfit: ["123f5a", "0b625d", "334155", "4b5563", "6b4b63", "7c4a2d"],
};

export function defaultAvatarConfig(name = "") {
  return {
    version: 2,
    seed: String(name || "agsus-avatar").trim(),
    face: "soft",
    nose: "straight",
    hair: "classic",
    eyes: "natural",
    mouth: "warm",
    outfit: "blazer",
    glasses: false,
    beard: false,
    freckles: false,
    earrings: false,
    hairColor: "34251f",
    skinColor: "e9bd9b",
    backgroundColor: "e9f1f6",
    outfitColor: "123f5a",
  };
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeAvatarConfig(value, name = "") {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fallback = defaultAvatarConfig(name);
  return {
    version: 2,
    seed:
      typeof source.seed === "string" && source.seed.trim()
        ? source.seed.slice(0, 120)
        : fallback.seed,
    face: enumValue(source.face, OPTION_GROUPS.face, fallback.face),
    nose: enumValue(source.nose, OPTION_GROUPS.nose, fallback.nose),
    hair: enumValue(source.hair, OPTION_GROUPS.hair, fallback.hair),
    eyes: enumValue(source.eyes, OPTION_GROUPS.eyes, fallback.eyes),
    mouth: enumValue(source.mouth, OPTION_GROUPS.mouth, fallback.mouth),
    outfit: enumValue(source.outfit, OPTION_GROUPS.outfit, fallback.outfit),
    glasses: source.glasses === true,
    beard: source.beard === true,
    freckles: source.freckles === true,
    earrings: source.earrings === true,
    hairColor: enumValue(
      source.hairColor,
      avatarColors.hair,
      fallback.hairColor,
    ),
    skinColor: enumValue(
      source.skinColor,
      avatarColors.skin,
      fallback.skinColor,
    ),
    backgroundColor: enumValue(
      source.backgroundColor,
      avatarColors.background,
      fallback.backgroundColor,
    ),
    outfitColor: enumValue(
      source.outfitColor,
      avatarColors.outfit,
      fallback.outfitColor,
    ),
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
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
}

function facePath(type) {
  const paths = {
    soft: "M180 62C224 62 250 91 250 139V171C250 222 220 254 180 254C140 254 110 222 110 171V139C110 91 136 62 180 62Z",
    oval: "M180 58C220 58 245 89 245 141V170C245 225 218 258 180 258C142 258 115 225 115 170V141C115 89 140 58 180 58Z",
    square:
      "M180 64C224 64 248 89 248 137V183C248 226 221 252 180 252C139 252 112 226 112 183V137C112 89 136 64 180 64Z",
    round:
      "M180 69C226 69 252 97 252 145V167C252 215 224 246 180 246C136 246 108 215 108 167V145C108 97 134 69 180 69Z",
  };
  return paths[type] || paths.soft;
}

function hairBackMarkup(type, color) {
  if (type === "long") {
    return `<path d="M100 135C100 76 132 42 180 42C229 42 260 77 260 139L270 287H227L224 142H136L133 287H90Z" fill="#${color}" opacity=".98"/>`;
  }
  if (type === "bun") {
    return `<circle cx="180" cy="42" r="34" fill="#${color}"/><path d="M108 143C108 78 138 48 180 48C223 48 252 80 252 143V187H108Z" fill="#${color}"/>`;
  }
  return "";
}

function hairFrontMarkup(type, color) {
  const paths = {
    short:
      "M109 134C109 79 139 51 181 51C223 51 250 80 250 132C231 107 207 96 179 97C153 97 130 108 109 134Z",
    classic:
      "M108 137C109 78 141 48 184 49C226 50 252 80 251 133C232 111 211 100 185 98C157 96 132 109 108 137Z",
    waves:
      "M105 140C103 88 127 53 168 46C211 39 247 65 254 112C257 129 254 143 249 154C234 128 216 119 196 121C174 123 160 109 140 113C125 116 116 127 105 140Z",
    curls:
      "M103 147C95 99 112 61 148 45C187 27 231 42 252 78C265 101 264 130 253 153C240 132 223 123 205 127C186 132 173 116 155 119C135 121 121 135 103 147Z",
    coils:
      "M99 151C89 104 105 62 143 41C184 18 233 32 257 72C272 98 272 129 258 157C245 136 229 128 209 132C191 136 177 122 158 124C136 126 121 141 99 151Z",
    long: "M105 137C106 78 138 47 181 47C225 47 252 79 252 134C232 110 210 99 183 98C156 97 131 110 105 137Z",
    bun: "M106 139C106 80 138 50 181 50C224 50 252 81 252 136C230 111 207 100 180 100C153 100 128 113 106 139Z",
    modern:
      "M108 142C108 83 139 51 184 50C225 49 250 78 252 126C235 110 218 101 198 98C171 94 147 106 125 127L108 142ZM198 51L251 70L224 91Z",
  };
  return `<path d="${paths[type] || paths.classic}" fill="#${color}"/>`;
}

function eyeMarkup(type, hairColor) {
  const eyebrows =
    type === "focused"
      ? `<path d="M132 133Q150 124 167 131M193 131Q210 124 228 133" fill="none" stroke="#${hairColor}" stroke-width="4" stroke-linecap="round"/>`
      : `<path d="M132 132Q150 126 168 132M192 132Q210 126 228 132" fill="none" stroke="#${hairColor}" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>`;

  if (type === "happy") {
    return `${eyebrows}<path d="M134 153Q150 164 166 153M194 153Q210 164 226 153" fill="none" stroke="#342b27" stroke-width="3" stroke-linecap="round"/>`;
  }

  if (type === "calm") {
    return `${eyebrows}<path d="M134 153Q150 147 166 153M194 153Q210 147 226 153" fill="none" stroke="#342b27" stroke-width="3" stroke-linecap="round"/><circle cx="151" cy="153" r="2.6" fill="#342b27"/><circle cx="209" cy="153" r="2.6" fill="#342b27"/>`;
  }

  const eyeRy = type === "expressive" ? 8 : 6;
  const irisRadius = type === "expressive" ? 4.3 : 3.6;
  return `${eyebrows}
    <ellipse cx="150" cy="153" rx="17" ry="${eyeRy}" fill="#fff" opacity=".94"/>
    <ellipse cx="210" cy="153" rx="17" ry="${eyeRy}" fill="#fff" opacity=".94"/>
    <circle cx="150" cy="153" r="${irisRadius}" fill="#34485a"/>
    <circle cx="210" cy="153" r="${irisRadius}" fill="#34485a"/>
    <circle cx="150" cy="153" r="1.8" fill="#171717"/>
    <circle cx="210" cy="153" r="1.8" fill="#171717"/>
    <path d="M133 153Q150 ${type === "focused" ? 145 : 143} 167 153M193 153Q210 ${type === "focused" ? 145 : 143} 227 153" fill="none" stroke="#342b27" stroke-width="2.4" stroke-linecap="round"/>`;
}

function noseMarkup(type) {
  const paths = {
    small: "M181 160C179 171 176 181 178 185C181 188 185 188 189 186",
    straight: "M182 159V184C182 188 186 190 191 188",
    round: "M181 160C178 174 175 183 179 187C184 190 190 189 194 185",
    wide: "M177 161C174 174 170 184 176 188C183 192 193 191 199 186",
  };
  return `<path d="${paths[type] || paths.straight}" fill="none" stroke="#8a5c43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
}

function mouthMarkup(type) {
  const paths = {
    smile: "M153 210Q180 226 207 210",
    warm: "M153 210Q180 222 207 210M164 219Q180 225 196 219",
    confident: "M155 213Q178 221 204 209",
    subtle: "M162 214Q180 219 198 214",
    serious: "M162 215H198",
  };
  return `<path d="${paths[type] || paths.warm}" fill="none" stroke="#98545b" stroke-width="3" stroke-linecap="round"/>`;
}

function outfitMarkup(type, color) {
  if (type === "shirt") {
    return `<path d="M72 360C78 295 119 263 180 263C241 263 282 295 288 360Z" fill="#${color}"/><path d="M150 263L180 288L210 263L221 360H139Z" fill="#f8fafc" opacity=".95"/><path d="M150 263L180 288L139 304Z" fill="#e2e8f0"/><path d="M210 263L180 288L221 304Z" fill="#e2e8f0"/>`;
  }
  if (type === "field") {
    return `<path d="M70 360C77 294 118 263 180 263C242 263 283 294 290 360Z" fill="#e7edf1"/><path d="M111 277L151 263L180 290L209 263L249 277L263 360H97Z" fill="#${color}"/><path d="M174 290H186V360H174Z" fill="#fff" opacity=".65"/><path d="M121 304H151V323H121Z" fill="#fff" opacity=".24"/><path d="M209 304H239V323H209Z" fill="#fff" opacity=".24"/>`;
  }
  return `<path d="M67 360C75 292 117 260 180 260C243 260 285 292 293 360Z" fill="#${color}"/><path d="M139 270L180 305L221 270L244 360H116Z" fill="#f8fafc"/><path d="M139 270L180 305L145 330L116 287Z" fill="#${color}" opacity=".84"/><path d="M221 270L180 305L215 330L244 287Z" fill="#${color}" opacity=".84"/><path d="M176 304H184V360H176Z" fill="#d5a84b" opacity=".9"/>`;
}

export function avatarSvg(configInput, name = "") {
  const config = normalizeAvatarConfig(configInput, name);
  const freckles = config.freckles
    ? '<g fill="#9b654b" opacity=".38"><circle cx="137" cy="178" r="1.7"/><circle cx="145" cy="181" r="1.4"/><circle cx="223" cy="178" r="1.7"/><circle cx="215" cy="181" r="1.4"/></g>'
    : "";
  const glasses = config.glasses
    ? '<g fill="none" stroke="#334155" stroke-width="3"><rect x="126" y="140" width="48" height="31" rx="12"/><rect x="186" y="140" width="48" height="31" rx="12"/><path d="M174 152H186M126 149L112 145M234 149L248 145"/></g>'
    : "";
  const beard = config.beard
    ? `<path d="M121 188C126 228 148 249 180 253C212 249 234 228 239 188C228 216 208 232 180 235C152 232 132 216 121 188Z" fill="#${config.hairColor}" opacity=".82"/>`
    : "";
  const earrings = config.earrings
    ? '<g fill="#c79a3b"><circle cx="106" cy="179" r="3.5"/><circle cx="254" cy="179" r="3.5"/></g>'
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" role="img" aria-label="Avatar de ${escapeXml(name)}" data-avatar-style="institutional-v2">
  <defs>
    <linearGradient id="avatar-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#${config.backgroundColor}"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".64"/>
    </linearGradient>
  </defs>
  <rect width="360" height="360" rx="36" fill="url(#avatar-bg)"/>
  <circle cx="300" cy="55" r="86" fill="#fff" opacity=".23"/>
  <circle cx="58" cy="305" r="105" fill="#0b625d" opacity=".055"/>
  <ellipse cx="180" cy="345" rx="116" ry="18" fill="#18324a" opacity=".12"/>
  <g>
    ${outfitMarkup(config.outfit, config.outfitColor)}
    ${hairBackMarkup(config.hair, config.hairColor)}
    <rect x="157" y="221" width="46" height="58" rx="18" fill="#${config.skinColor}"/>
    <ellipse cx="106" cy="173" rx="13" ry="23" fill="#${config.skinColor}"/>
    <ellipse cx="254" cy="173" rx="13" ry="23" fill="#${config.skinColor}"/>
    <path d="${facePath(config.face)}" fill="#${config.skinColor}" stroke="#7f5945" stroke-width="2" stroke-opacity=".28"/>
    ${hairFrontMarkup(config.hair, config.hairColor)}
    ${eyeMarkup(config.eyes, config.hairColor)}
    ${noseMarkup(config.nose)}
    ${freckles}
    ${beard}
    ${mouthMarkup(config.mouth)}
    ${glasses}
    ${earrings}
  </g>
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
    outfit: pick(OPTION_GROUPS.outfit),
    glasses: random() > 0.68,
    beard: random() > 0.8,
    freckles: random() > 0.76,
    earrings: random() > 0.72,
    hairColor: pick(avatarColors.hair),
    skinColor: pick(avatarColors.skin),
    backgroundColor: pick(avatarColors.background),
    outfitColor: pick(avatarColors.outfit),
  };
}
