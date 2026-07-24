const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;

export function sanitizeCsvCell(value) {
  const text = String(value ?? "");
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function sanitizeCsvDocument(content, delimiter = ";") {
  const text = String(content ?? "");
  return text
    .split(/(\r?\n)/)
    .map((part) => {
      if (part === "\n" || part === "\r\n") return part;
      return part.split(delimiter).map(sanitizeCsvCell).join(delimiter);
    })
    .join("");
}

export function installCsvBlobSecurityGuard() {
  if (globalThis.Blob?.__agsusCsvSecurityGuard) return false;

  const NativeBlob = globalThis.Blob;
  if (typeof NativeBlob !== "function") return false;

  class SecureBlob extends NativeBlob {
    constructor(parts = [], options = {}) {
      const type = String(options?.type || "").toLowerCase();
      const securedParts = type.includes("text/csv")
        ? parts.map((part) => typeof part === "string" ? sanitizeCsvDocument(part) : part)
        : parts;
      super(securedParts, options);
    }
  }

  Object.defineProperty(SecureBlob, "__agsusCsvSecurityGuard", { value: true });
  globalThis.Blob = SecureBlob;
  return true;
}
