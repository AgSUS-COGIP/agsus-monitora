export const REQUIRED_APPROVED_COLUMNS = Object.freeze([
  "codigo_vaga",
  "cargo",
  "classificacao",
  "nota",
  "nome",
  "modalidade",
]);

const HEADER_ALIASES = Object.freeze({
  codigo_vaga: "codigo_vaga",
  codigovaga: "codigo_vaga",
  codigo: "codigo_vaga",
  cargo: "cargo",
  classificacao: "classificacao",
  classificacao_final: "classificacao",
  nota: "nota",
  nome: "nome",
  candidato: "nome",
  modalidade: "modalidade",
});

function cleanText(value) {
  return String(value ?? "").trim();
}

function stripDiacritics(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeHeader(value) {
  const base = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return HEADER_ALIASES[base] || base;
}

export function normalizeApprovedHeaders(headers) {
  return (headers || []).map(normalizeHeader);
}

function parseBrazilianNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const raw = cleanText(value);
  if (!raw) return NaN;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

function rowIsEmpty(row) {
  return REQUIRED_APPROVED_COLUMNS.every((key) => !cleanText(row?.[key]));
}

export function validateApprovedRows(inputRows) {
  const rows = [];
  const errors = [];

  (inputRows || []).forEach((source, index) => {
    const line = index + 2;
    const row = Object.fromEntries(
      REQUIRED_APPROVED_COLUMNS.map((key) => [key, source?.[key] ?? ""]),
    );

    if (rowIsEmpty(row)) return;

    const missing = [
      "codigo_vaga",
      "cargo",
      "classificacao",
      "nota",
      "nome",
      "modalidade",
    ].filter((key) => !cleanText(row[key]));
    const classificationNumber = parseBrazilianNumber(row.classificacao);
    const scoreNumber = parseBrazilianNumber(row.nota);
    const rowErrors = [];

    if (missing.length) {
      rowErrors.push(`campos obrigatórios vazios: ${missing.join(", ")}`);
    }
    if (!Number.isInteger(classificationNumber) || classificationNumber <= 0) {
      rowErrors.push("classificacao deve ser um inteiro maior que zero");
    }
    if (!Number.isFinite(scoreNumber) || scoreNumber < 0) {
      rowErrors.push("nota deve ser numérica e maior ou igual a zero");
    }

    if (rowErrors.length) {
      errors.push(`Linha ${line}: ${rowErrors.join("; ")}.`);
      return;
    }

    rows.push({
      codigo_vaga: cleanText(row.codigo_vaga),
      cargo: cleanText(row.cargo),
      classificacao: classificationNumber,
      nota: scoreNumber,
      nome: cleanText(row.nome),
      modalidade: cleanText(row.modalidade),
    });
  });

  return { rows, errors };
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Seu navegador não oferece suporte à descompactação necessária para arquivos XLSX.",
    );
  }
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const decoder = new TextDecoder("utf-8");
  const minimumOffset = Math.max(0, bytes.length - 65557);
  let eocd = -1;

  for (let i = bytes.length - 22; i >= minimumOffset; i -= 1) {
    if (readUint32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0)
    throw new Error("O arquivo não parece ser um XLSX válido (ZIP inválido).");

  const entryCount = readUint16(view, eocd + 10);
  let offset = readUint32(view, eocd + 16);
  const files = new Map();

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (readUint32(view, offset) !== 0x02014b50) {
      throw new Error("Estrutura interna do XLSX inválida (diretório ZIP).");
    }
    const compression = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localOffset = readUint32(view, offset + 42);
    const fileName = decoder.decode(
      bytes.slice(offset + 46, offset + 46 + fileNameLength),
    );

    if (readUint32(view, localOffset) !== 0x04034b50) {
      throw new Error(
        "Estrutura interna do XLSX inválida (arquivo ZIP local).",
      );
    }
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let content;
    if (compression === 0) content = compressed;
    else if (compression === 8) content = await inflateRaw(compressed);
    else
      throw new Error(
        `Método de compactação XLSX não suportado: ${compression}.`,
      );

    files.set(fileName.replace(/^\//, ""), content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function xmlText(files, path) {
  const content = files.get(path);
  if (!content) return "";
  return new TextDecoder("utf-8").decode(content);
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const values = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
    const texts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(
      (part) => decodeXml(part[1]),
    );
    values.push(texts.join(""));
  }
  return values;
}

function firstWorksheetPath(files) {
  const workbook = xmlText(files, "xl/workbook.xml");
  const relationships = xmlText(files, "xl/_rels/workbook.xml.rels");
  const sheetMatch = workbook.match(
    /<sheet\b[^>]*\br:id=["']([^"']+)["'][^>]*>/i,
  );
  const relationshipId = sheetMatch?.[1];
  if (relationshipId && relationships) {
    const escaped = relationshipId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const relMatch = relationships.match(
      new RegExp(
        `<Relationship\\b[^>]*\\bId=["']${escaped}["'][^>]*\\bTarget=["']([^"']+)["'][^>]*/?>`,
        "i",
      ),
    );
    if (relMatch?.[1]) {
      const target = relMatch[1].replace(/^\//, "");
      return target.startsWith("xl/")
        ? target
        : `xl/${target.replace(/^\.\//, "")}`;
    }
  }
  if (files.has("xl/worksheets/sheet1.xml")) return "xl/worksheets/sheet1.xml";
  const fallback = [...files.keys()].find((path) =>
    /^xl\/worksheets\/sheet\d+\.xml$/i.test(path),
  );
  if (fallback) return fallback;
  throw new Error("Nenhuma planilha foi encontrada no XLSX.");
}

function columnIndex(reference) {
  const letters =
    String(reference || "")
      .match(/^[A-Z]+/i)?.[0]
      ?.toUpperCase() || "A";
  let result = 0;
  for (const letter of letters)
    result = result * 26 + (letter.charCodeAt(0) - 64);
  return result - 1;
}

function cellValue(cellXml, type, sharedStrings) {
  if (type === "inlineStr") {
    return [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
      .map((match) => decodeXml(match[1]))
      .join("");
  }
  const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  return decodeXml(raw);
}

function parseWorksheet(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(
      /<c\b([^>]*)>([\s\S]*?)<\/c>/gi,
    )) {
      const attrs = cellMatch[1];
      const ref = attrs.match(/\br=["']([^"']+)["']/i)?.[1] || "A1";
      const type = attrs.match(/\bt=["']([^"']+)["']/i)?.[1] || "";
      cells[columnIndex(ref)] = cellValue(cellMatch[2], type, sharedStrings);
    }
    rows.push(cells.map((value) => value ?? ""));
  }
  return rows;
}

export async function readApprovedWorkbook(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Selecione um arquivo XLSX válido.");
  }
  if (!/\.xlsx$/i.test(file.name || "")) {
    throw new Error("O arquivo deve estar no formato .xlsx.");
  }

  const files = await unzip(await file.arrayBuffer());
  const sharedStrings = parseSharedStrings(
    xmlText(files, "xl/sharedStrings.xml"),
  );
  const worksheetPath = firstWorksheetPath(files);
  const worksheet = xmlText(files, worksheetPath);
  if (!worksheet)
    throw new Error("Não foi possível ler a primeira planilha do XLSX.");

  const matrix = parseWorksheet(worksheet, sharedStrings);
  if (!matrix.length) throw new Error("A planilha está vazia.");

  const headers = normalizeApprovedHeaders(matrix[0]);
  const missingColumns = REQUIRED_APPROVED_COLUMNS.filter(
    (column) => !headers.includes(column),
  );
  if (missingColumns.length) {
    throw new Error(
      `Colunas obrigatórias ausentes: ${missingColumns.join(", ")}.`,
    );
  }

  const dataRows = matrix.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      if (header) row[header] = values[index] ?? "";
    });
    return row;
  });
  const validated = validateApprovedRows(dataRows);
  if (validated.errors.length) {
    const preview = validated.errors.slice(0, 12).join("\n");
    const suffix =
      validated.errors.length > 12
        ? `\n... e mais ${validated.errors.length - 12} erro(s).`
        : "";
    throw new Error(`${preview}${suffix}`);
  }
  if (!validated.rows.length)
    throw new Error("Nenhum candidato válido foi encontrado no XLSX.");
  return validated.rows;
}
