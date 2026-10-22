const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;

export function sanitizeCsvCell(value) {
  const text = String(value ?? "");
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

/*
  Protege cada célula do documento respeitando as aspas do CSV: uma célula
  entre aspas pode conter o delimitador e quebras de linha, que não a partem.
  Na célula entre aspas, o apóstrofo entra logo depois da aspa de abertura.
*/
export function sanitizeCsvDocument(content, delimiter = ";") {
  const text = String(content ?? "");
  let saida = "";
  let i = 0;
  let inicioDeCelula = true;
  while (i < text.length) {
    if (!inicioDeCelula) {
      const c = text[i];
      if (c === delimiter || c === "\n") inicioDeCelula = true;
      saida += c;
      i += 1;
      continue;
    }
    inicioDeCelula = false;
    if (text[i] === '"') {
      let fim = i + 1;
      while (fim < text.length) {
        if (text[fim] !== '"') fim += 1;
        else if (text[fim + 1] === '"') fim += 2;
        else break;
      }
      const bruto = text.slice(i + 1, fim);
      const valor = bruto.replaceAll('""', '"');
      saida += `"${FORMULA_PREFIX.test(valor) ? "'" : ""}${bruto}`;
      i = fim;
      continue;
    }
    let fim = i;
    while (fim < text.length && !`${delimiter}\r\n`.includes(text[fim])) {
      fim += 1;
    }
    saida += sanitizeCsvCell(text.slice(i, fim));
    i = fim;
  }
  return saida;
}

export function installCsvBlobSecurityGuard() {
  if (globalThis.Blob?.__agsusCsvSecurityGuard) return false;

  const NativeBlob = globalThis.Blob;
  if (typeof NativeBlob !== "function") return false;

  class SecureBlob extends NativeBlob {
    constructor(parts = [], options = {}) {
      const type = String(options?.type || "").toLowerCase();
      const securedParts = type.includes("text/csv")
        ? parts.map((part) =>
            typeof part === "string" ? sanitizeCsvDocument(part) : part,
          )
        : parts;
      super(securedParts, options);
    }
  }

  Object.defineProperty(SecureBlob, "__agsusCsvSecurityGuard", { value: true });
  globalThis.Blob = SecureBlob;
  return true;
}
