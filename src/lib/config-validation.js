function clean(value) {
  return String(value ?? "").trim();
}

function hasControlCharacters(value) {
  for (const char of String(value || "")) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function isValidHttpUrl(value) {
  const raw = clean(value);
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (error) {
    return false;
  }
}

export function isValidAccessAssetUrl(value) {
  const raw = clean(value);
  if (!raw) return true;

  if (
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\") &&
    !hasControlCharacters(raw)
  ) {
    return true;
  }

  try {
    const url = new URL(raw);
    return url.protocol === "https:";
  } catch (error) {
    return false;
  }
}
