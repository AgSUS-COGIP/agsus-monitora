export const ACCESS_BACKGROUND_BUCKET = "platform-assets";
export const ACCESS_BACKGROUND_FOLDER = "branding";
export const ACCESS_BACKGROUND_MAX_BYTES = 6 * 1024 * 1024;
export const ACCESS_BACKGROUND_MIME_TYPES: readonly string[] = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

/** O arquivo de imagem escolhido para envio (um `File`, ou o que os testes passam). */
export interface ArquivoDeImagem {
  type: string;
  size: number;
}

export function validateAccessBackgroundFile(
  file: ArquivoDeImagem | null | undefined,
): string {
  if (!file) return "Escolha uma imagem para enviar.";
  if (!ACCESS_BACKGROUND_MIME_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WEBP.";
  }
  if (file.size > ACCESS_BACKGROUND_MAX_BYTES) {
    return "A imagem precisa ter até 6 MB.";
  }
  return "";
}

export function createAccessBackgroundPath(
  file: Partial<ArquivoDeImagem> | null | undefined,
  uuidFactory?: () => string,
): string {
  const extension = EXTENSION_BY_MIME[file?.type ?? ""] || "jpg";
  const makeUuid =
    uuidFactory ||
    (() =>
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return `${ACCESS_BACKGROUND_FOLDER}/acesso-${makeUuid()}.${extension}`;
}
