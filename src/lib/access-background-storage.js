export const ACCESS_BACKGROUND_BUCKET = "platform-assets";
export const ACCESS_BACKGROUND_FOLDER = "branding";
export const ACCESS_BACKGROUND_MAX_BYTES = 2 * 1024 * 1024;
export const ACCESS_BACKGROUND_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSION_BY_MIME = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

export function validateAccessBackgroundFile(file) {
  if (!file) return "Escolha uma imagem para enviar.";
  if (!ACCESS_BACKGROUND_MIME_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WEBP.";
  }
  if (file.size > ACCESS_BACKGROUND_MAX_BYTES) {
    return "A imagem precisa ter até 2 MB.";
  }
  return "";
}

export function createAccessBackgroundPath(file, uuidFactory) {
  const extension = EXTENSION_BY_MIME[file?.type] || "jpg";
  const makeUuid =
    uuidFactory ||
    (() =>
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return `${ACCESS_BACKGROUND_FOLDER}/acesso-${makeUuid()}.${extension}`;
}
