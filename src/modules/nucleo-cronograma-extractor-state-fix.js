const cache = {
  rows: [],
  source: "",
  discarded: false
};

const $ = id => document.getElementById(id);

function parseDate(value) {
  const parts = String(value || "").trim().split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function captureReviewRows() {
  const review = $("cronogramaExtractReview");
  if (!review) return;

  const rows = [...review.querySelectorAll("#cronogramaExtractRows tr")].map((tr, index) => {
    const cells = tr.querySelectorAll("td");
    const activity = cells[1]?.childNodes?.[0]?.textContent?.trim() || "";
    return {
      ordem:index + 1,
      atividade:activity,
      data_inicio:parseDate(cells[2]?.textContent),
      data_fim:parseDate(cells[3]?.textContent),
      origem:$("cronogramaExtractSource")?.textContent?.includes("OCR") ? "OCR" : "PDF"
    };
  }).filter(row => row.atividade && row.data_inicio && row.data_fim);

  if (rows.length) {
    cache.rows = rows;
    cache.source = $("cronogramaExtractSource")?.textContent || "";
    cache.discarded = false;
  }
}

function removeCurrentRows() {
  [...document.querySelectorAll("#cronogramaRows .cronograma-remove")]
    .reverse()
    .forEach(button => button.click());
}

function dispatchInput(input, value) {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles:true }));
  input.dispatchEvent(new Event("change", { bubbles:true }));
}

function applyCachedRows() {
  if (!cache.rows.length) return false;
  const existing = document.querySelectorAll("#cronogramaRows tr[data-cronograma-index]").length;
  if (existing && !window.confirm("Substituir as etapas atuais pelo cronograma extraído do PDF?")) return true;

  const total = cache.rows.length;
  removeCurrentRows();
  const addButton = $("cronogramaAddRow");

  cache.rows.forEach((row, index) => {
    addButton?.click();
    const tr = document.querySelector(`#cronogramaRows tr[data-cronograma-index="${index}"]`);
    if (!tr) return;
    dispatchInput(tr.querySelector('[data-field="atividade"]'), row.atividade);
    dispatchInput(tr.querySelector('[data-field="data_inicio"]'), row.data_inicio);
    dispatchInput(tr.querySelector('[data-field="data_fim"]'), row.data_fim);
    const origin = tr.querySelector(".cronograma-origin");
    if (origin) origin.textContent = row.origem;
  });

  const review = $("cronogramaExtractReview");
  if (review) review.hidden = true;
  const status = $("cronogramaPdfStatus");
  const fileName = $("cronogramaPdfInput")?.files?.[0]?.name || "PDF";
  if (status) status.textContent = `${fileName}: ${total} etapa(s) aplicada(s). Revise antes de salvar.`;
  document.querySelector("#cronogramaRows")?.scrollIntoView({ behavior:"smooth", block:"center" });
  cache.rows = [];
  return true;
}

function restoreReviewIfNeeded() {
  const review = $("cronogramaExtractReview");
  const stage = $("cronogramaExtractStage")?.textContent || "";
  if (!review || cache.discarded || !cache.rows.length) return;
  if (review.hidden && stage.includes("Extração concluída")) review.hidden = false;
}

function installCapture() {
  const modal = $("editModal");
  if (!modal) return;

  const observer = new MutationObserver(() => {
    captureReviewRows();
    queueMicrotask(restoreReviewIfNeeded);
  });
  observer.observe(modal, { childList:true, subtree:true, attributes:true, attributeFilter:["hidden"] });

  document.addEventListener("click", event => {
    const target = event.target?.closest?.("button");
    if (!target) return;

    if (target.id === "cronogramaExtractButton") {
      cache.rows = [];
      cache.discarded = false;
      return;
    }

    if (target.id === "cronogramaExtractCancel") {
      cache.rows = [];
      cache.discarded = true;
      return;
    }

    if (target.id === "cronogramaExtractApply" && cache.rows.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyCachedRows();
    }
  }, true);

  $("cronogramaPdfInput")?.addEventListener("change", () => {
    cache.rows = [];
    cache.discarded = false;
  });
}

export function initNucleoCronogramaExtractorStateFix() {
  installCapture();
}
