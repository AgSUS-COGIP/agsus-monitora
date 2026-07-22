import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const DATE_RE = /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g;
const HEADER_WORDS = [
  "cronograma", "atividade", "data", "período", "periodo", "página", "pagina",
  "edital", "processo seletivo", "anexo", "assinatura", "agência brasileira",
  "agencia brasileira", "saúde indígena", "saude indigena"
];

const state = {
  initialized: false,
  extracting: false,
  extractedRows: [],
  warnings: [],
  source: "",
  worker: null
};

const $ = id => document.getElementById(id);
const normalize = value => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u00a0\t]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
}[char]));

function extractorMarkup() {
  return `
    <div class="cronograma-extractor-actions">
      <button id="cronogramaExtractButton" type="button" class="btn secondary" disabled>
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        Extrair cronograma
      </button>
      <span id="cronogramaExtractHint">Selecione um PDF para iniciar a leitura.</span>
    </div>
    <div id="cronogramaExtractProgress" class="cronograma-extract-progress" hidden>
      <div class="cronograma-extract-progress-head">
        <strong id="cronogramaExtractStage">Preparando leitura...</strong>
        <span id="cronogramaExtractPercent">0%</span>
      </div>
      <div class="cronograma-extract-progress-track"><span id="cronogramaExtractProgressBar"></span></div>
      <small id="cronogramaExtractDetail">O processamento ocorre neste navegador.</small>
    </div>
    <section id="cronogramaExtractReview" class="cronograma-extract-review" hidden>
      <div class="cronograma-extract-review-head">
        <div>
          <span class="cronograma-eyebrow">Revisão obrigatória</span>
          <h5>Cronograma identificado no PDF</h5>
          <p id="cronogramaExtractSummary"></p>
        </div>
        <span id="cronogramaExtractSource" class="cronograma-extract-source"></span>
      </div>
      <div id="cronogramaExtractWarnings" class="cronograma-extract-warnings" hidden></div>
      <div class="cronograma-extract-table-wrap">
        <table class="cronograma-extract-table">
          <thead><tr><th>#</th><th>Atividade identificada</th><th>Início</th><th>Fim</th><th>Confiança</th></tr></thead>
          <tbody id="cronogramaExtractRows"></tbody>
        </table>
      </div>
      <div class="cronograma-extract-review-actions">
        <button id="cronogramaExtractCancel" type="button" class="btn outline">Descartar extração</button>
        <button id="cronogramaExtractApply" type="button" class="btn green">
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          Aplicar etapas ao cronograma
        </button>
      </div>
    </section>
  `;
}

function ensureExtractorUi() {
  const uploadBox = document.querySelector("#cronogramaEditor .cronograma-upload-box");
  if (!uploadBox || $("cronogramaExtractButton")) return;
  uploadBox.insertAdjacentHTML("beforeend", extractorMarkup());

  $("cronogramaExtractButton")?.addEventListener("click", extractSelectedPdf);
  $("cronogramaExtractCancel")?.addEventListener("click", clearReview);
  $("cronogramaExtractApply")?.addEventListener("click", applyExtractedRows);

  const input = $("cronogramaPdfInput");
  input?.addEventListener("change", syncSelectedFileState);
  syncSelectedFileState();
}

function selectedPdf() {
  return $("cronogramaPdfInput")?.files?.[0] || null;
}

function syncSelectedFileState() {
  const file = selectedPdf();
  const button = $("cronogramaExtractButton");
  const hint = $("cronogramaExtractHint");
  if (button) button.disabled = !file || state.extracting;
  if (hint) {
    hint.textContent = file
      ? `${file.name} pronto para leitura. Nenhuma etapa será salva sem revisão.`
      : "Selecione um PDF para iniciar a leitura.";
  }
  clearReview();
}

function setProgress(stage, percent, detail = "") {
  const box = $("cronogramaExtractProgress");
  if (box) box.hidden = false;
  if ($("cronogramaExtractStage")) $("cronogramaExtractStage").textContent = stage;
  if ($("cronogramaExtractPercent")) $("cronogramaExtractPercent").textContent = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
  if ($("cronogramaExtractProgressBar")) $("cronogramaExtractProgressBar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if ($("cronogramaExtractDetail")) $("cronogramaExtractDetail").textContent = detail || "O processamento ocorre neste navegador.";
}

function hideProgress() {
  if ($("cronogramaExtractProgress")) $("cronogramaExtractProgress").hidden = true;
}

function clearReview() {
  state.extractedRows = [];
  state.warnings = [];
  state.source = "";
  const review = $("cronogramaExtractReview");
  if (review) review.hidden = true;
}

function groupTextItems(items) {
  const positioned = items
    .filter(item => normalize(item.str))
    .map(item => ({ text: normalize(item.str), x: item.transform?.[4] || 0, y: item.transform?.[5] || 0 }))
    .sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x);

  const lines = [];
  positioned.forEach(item => {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 2.5);
    if (!line) {
      line = { y:item.y, items:[] };
      lines.push(line);
    }
    line.items.push(item);
  });

  return lines
    .sort((a, b) => b.y - a.y)
    .map(line => line.items.sort((a, b) => a.x - b.x).map(item => item.text).join(" "))
    .map(normalize)
    .filter(Boolean);
}

async function extractTextLayer(pdf) {
  const pages = [];
  let totalChars = 0;
  let dateMatches = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setProgress("Lendo camada de texto", (pageNumber / pdf.numPages) * 40, `Página ${pageNumber} de ${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = groupTextItems(content.items || []);
    const text = lines.join("\n");
    totalChars += text.length;
    dateMatches += (text.match(DATE_RE) || []).length;
    pages.push({ pageNumber, page, lines, text });
  }

  return { pages, totalChars, dateMatches };
}

async function getOcrWorker() {
  if (state.worker) return state.worker;
  state.worker = await createWorker("por", 1, {
    logger(message) {
      if (message.status === "recognizing text") {
        const progress = 45 + (Number(message.progress || 0) * 45);
        setProgress("Executando OCR", progress, "Reconhecendo atividades e datas na página digitalizada.");
      }
    }
  });
  return state.worker;
}

async function ocrPages(pageEntries) {
  const worker = await getOcrWorker();
  const output = [];

  for (let index = 0; index < pageEntries.length; index += 1) {
    const entry = pageEntries[index];
    setProgress("Preparando página para OCR", 45 + (index / Math.max(pageEntries.length, 1)) * 40, `Página ${entry.pageNumber}`);
    const viewport = entry.page.getViewport({ scale:2.1 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently:true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await entry.page.render({ canvasContext:context, viewport }).promise;
    const result = await worker.recognize(canvas);
    const text = result?.data?.text || "";
    const confidence = Number(result?.data?.confidence || 0);
    output.push({
      pageNumber:entry.pageNumber,
      lines:text.split(/\r?\n/).map(normalize).filter(Boolean),
      text,
      confidence
    });
    canvas.width = 1;
    canvas.height = 1;
  }

  return output;
}

function isoDate(day, month, year) {
  let fullYear = Number(year);
  if (fullYear < 100) fullYear += fullYear >= 70 ? 1900 : 2000;
  const date = new Date(fullYear, Number(month) - 1, Number(day), 12);
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return null;
  return `${String(fullYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDateRange(line) {
  const normalizedLine = normalize(line).replace(/[–—]/g, "-");

  let match = normalizedLine.match(/\b(\d{1,2})\s*(?:a|até|ate|-)\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/i);
  if (match) {
    const end = isoDate(match[2], match[3], match[4]);
    const start = isoDate(match[1], match[3], match[4]);
    if (start && end) return { start, end, token:match[0] };
  }

  match = normalizedLine.match(/\b(\d{1,2})[\/.\-](\d{1,2})\s*(?:a|até|ate|-)\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/i);
  if (match) {
    const start = isoDate(match[1], match[2], match[5]);
    const end = isoDate(match[3], match[4], match[5]);
    if (start && end) return { start, end, token:match[0] };
  }

  const fullDates = [...normalizedLine.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g)];
  if (fullDates.length >= 2) {
    const start = isoDate(fullDates[0][1], fullDates[0][2], fullDates[0][3]);
    const end = isoDate(fullDates[1][1], fullDates[1][2], fullDates[1][3]);
    if (start && end) return { start, end, token:`${fullDates[0][0]} ${fullDates[1][0]}` };
  }
  if (fullDates.length === 1) {
    const date = isoDate(fullDates[0][1], fullDates[0][2], fullDates[0][3]);
    if (date) return { start:date, end:date, token:fullDates[0][0] };
  }
  return null;
}

function isNoiseLine(line) {
  const value = normalize(line).toLowerCase();
  if (!value || /^\d+$/.test(value) || value.length < 3) return true;
  if (/^p[aá]gina\s+\d+/i.test(value)) return true;
  return HEADER_WORDS.some(word => value === normalize(word).toLowerCase());
}

function cleanActivity(text, dateToken = "") {
  let value = normalize(text)
    .replace(dateToken, " ")
    .replace(DATE_RE, " ")
    .replace(/^\s*(?:item|atividade)?\s*\d{1,2}\s*[.)\-:]?\s*/i, "")
    .replace(/\s+(?:de|a|até|ate)\s*$/i, "")
    .replace(/^[|:;,.\-\s]+|[|:;,.\-\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (value.length > 220) value = value.slice(0, 220).trim();
  return value;
}

function parseSchedule(pages, source) {
  const rows = [];
  const allLines = [];
  pages.forEach(page => {
    page.lines.forEach(line => allLines.push({ line, pageNumber:page.pageNumber, confidence:page.confidence ?? 99 }));
  });

  allLines.forEach((entry, index) => {
    const range = extractDateRange(entry.line);
    if (!range) return;

    let activity = cleanActivity(entry.line, range.token);
    if (activity.length < 5 || isNoiseLine(activity)) {
      const previous = [];
      for (let cursor = index - 1; cursor >= Math.max(0, index - 3); cursor -= 1) {
        const candidate = allLines[cursor];
        if (extractDateRange(candidate.line)) break;
        if (!isNoiseLine(candidate.line)) previous.unshift(candidate.line);
      }
      activity = cleanActivity(previous.join(" "));
    }

    if (!activity || activity.length < 5 || isNoiseLine(activity)) return;
    const duplicate = rows.some(row => row.atividade.toLowerCase() === activity.toLowerCase() && row.data_inicio === range.start && row.data_fim === range.end);
    if (duplicate) return;

    rows.push({
      ordem:rows.length + 1,
      atividade:activity,
      data_inicio:range.start,
      data_fim:range.end,
      origem:source,
      confianca_extracao:Math.max(1, Math.min(99, Math.round(entry.confidence ?? (source === "PDF" ? 99 : 75)))),
      pagina:entry.pageNumber
    });
  });

  rows.sort((a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.ordem - b.ordem);
  rows.forEach((row, index) => row.ordem = index + 1);
  return rows;
}

function editalYear() {
  const match = String($("mEdital")?.value || "").match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function validateExtractedRows(rows) {
  const warnings = [];
  const year = editalYear();
  const names = new Set();

  rows.forEach((row, index) => {
    if (row.data_fim < row.data_inicio) warnings.push(`Etapa ${index + 1}: data final anterior à inicial.`);
    const key = normalize(row.atividade).toLowerCase();
    if (names.has(key)) warnings.push(`Atividade possivelmente duplicada: ${row.atividade}.`);
    names.add(key);
    if (year && Number(row.data_inicio.slice(0, 4)) !== year) warnings.push(`Etapa ${index + 1}: a data não pertence ao ano ${year} do edital.`);
    if (row.confianca_extracao < 70) warnings.push(`Etapa ${index + 1}: confiança de leitura baixa (${row.confianca_extracao}%).`);
  });

  if (!rows.some(row => normalize(row.atividade).toLowerCase().includes("resultado final"))) {
    warnings.push("Não foi identificada uma etapa de resultado final. Revise o cronograma.");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].data_inicio < rows[index - 1].data_inicio) warnings.push("A sequência cronológica precisa ser revisada.");
  }
  return [...new Set(warnings)];
}

function renderReview() {
  const review = $("cronogramaExtractReview");
  if (!review) return;
  review.hidden = false;
  if ($("cronogramaExtractSummary")) {
    $("cronogramaExtractSummary").textContent = `${state.extractedRows.length} etapa(s) identificada(s). Revise nomes e datas antes de aplicar.`;
  }
  if ($("cronogramaExtractSource")) {
    $("cronogramaExtractSource").textContent = state.source === "OCR" ? "OCR local" : "Texto do PDF";
  }
  const warningBox = $("cronogramaExtractWarnings");
  if (warningBox) {
    warningBox.hidden = !state.warnings.length;
    warningBox.innerHTML = state.warnings.length
      ? `<strong><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Pontos para revisão</strong><ul>${state.warnings.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
  }
  const body = $("cronogramaExtractRows");
  if (body) {
    body.innerHTML = state.extractedRows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.atividade)}<small>Página ${row.pagina}</small></td>
        <td>${row.data_inicio.split("-").reverse().join("/")}</td>
        <td>${row.data_fim.split("-").reverse().join("/")}</td>
        <td><span class="cronograma-confidence ${row.confianca_extracao < 70 ? "is-low" : ""}">${row.confianca_extracao}%</span></td>
      </tr>
    `).join("");
  }
}

async function extractSelectedPdf() {
  const file = selectedPdf();
  if (!file || state.extracting) return;
  state.extracting = true;
  clearReview();
  syncSelectedFileState();

  try {
    setProgress("Abrindo PDF", 3, "O arquivo permanece neste navegador durante a leitura.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data:bytes }).promise;
    if (pdf.numPages > 20) throw new Error("O PDF possui mais de 20 páginas. Separe apenas as páginas do cronograma.");

    const textResult = await extractTextLayer(pdf);
    let pages = textResult.pages.map(page => ({ ...page, confidence:99 }));
    let source = "PDF";

    const needsOcr = textResult.totalChars < 120 || textResult.dateMatches < 2;
    if (needsOcr) {
      setProgress("PDF digitalizado detectado", 44, "Executando OCR local nas páginas sem texto útil.");
      pages = await ocrPages(textResult.pages);
      source = "OCR";
    }

    setProgress("Interpretando atividades e datas", 93, "Organizando o cronograma para revisão.");
    const parsed = parseSchedule(pages, source);
    if (!parsed.length) {
      throw new Error("Não foi possível identificar atividades com datas. Use o preenchimento manual ou envie somente as páginas do cronograma.");
    }

    state.extractedRows = parsed;
    state.warnings = validateExtractedRows(parsed);
    state.source = source;
    renderReview();
    setProgress("Extração concluída", 100, "Revise o resultado e clique em Aplicar etapas ao cronograma.");
    window.setTimeout(hideProgress, 900);
  } catch (error) {
    console.error("Falha ao extrair cronograma:", error);
    setProgress("Não foi possível concluir a extração", 100, error?.message || String(error));
  } finally {
    state.extracting = false;
    syncSelectedFileState();
    if (state.extractedRows.length) renderReview();
  }
}

function removeCurrentRows() {
  const buttons = [...document.querySelectorAll("#cronogramaRows .cronograma-remove")];
  buttons.reverse().forEach(button => button.click());
}

function dispatchInput(input, value) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles:true }));
  input.dispatchEvent(new Event("change", { bubbles:true }));
}

function applyExtractedRows() {
  if (!state.extractedRows.length) return;
  const existingCount = document.querySelectorAll("#cronogramaRows tr[data-cronograma-index]").length;
  if (existingCount && !window.confirm("Substituir as etapas atuais pelo cronograma extraído do PDF?")) return;

  removeCurrentRows();
  const addButton = $("cronogramaAddRow");
  state.extractedRows.forEach((row, index) => {
    addButton?.click();
    const tr = document.querySelector(`#cronogramaRows tr[data-cronograma-index="${index}"]`);
    if (!tr) return;
    dispatchInput(tr.querySelector('[data-field="atividade"]'), row.atividade);
    dispatchInput(tr.querySelector('[data-field="data_inicio"]'), row.data_inicio);
    dispatchInput(tr.querySelector('[data-field="data_fim"]'), row.data_fim);
    const origin = tr.querySelector(".cronograma-origin");
    if (origin) origin.textContent = row.origem;
  });

  clearReview();
  const status = $("cronogramaPdfStatus");
  if (status) status.textContent = `${selectedPdf()?.name || "PDF"}: ${state.extractedRows.length} etapa(s) aplicada(s). Revise antes de salvar.`;
  document.querySelector("#cronogramaRows")?.scrollIntoView({ behavior:"smooth", block:"center" });
}

function installModalHook() {
  const observer = new MutationObserver(() => {
    if ($("cronogramaEditor")) ensureExtractorUi();
  });
  const modal = $("editModal");
  if (modal) observer.observe(modal, { childList:true, subtree:true });
  ensureExtractorUi();
}

export function initNucleoCronogramaExtractor() {
  if (state.initialized) return;
  state.initialized = true;
  installModalHook();
}
