const $ = (id) => document.getElementById(id);
const DATE_RE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g;
let initialized = false;

function toIso(day, month, year) {
  let y = Number(year);
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  const date = new Date(y, Number(month) - 1, Number(day), 12);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  )
    return "";
  return `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateToken(token) {
  const match = String(token || "").match(
    /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/,
  );
  return match ? toIso(match[1], match[2], match[3]) : "";
}

function parseDateLine(line) {
  const normalized = String(line || "")
    .replace(/[–—]/g, "-")
    .trim();
  const dates = [...normalized.matchAll(DATE_RE)]
    .map((match) => parseDateToken(match[0]))
    .filter(Boolean);
  if (dates.length >= 2) return { start: dates[0], end: dates[1] };
  if (dates.length === 1) return { start: dates[0], end: dates[0] };

  const shortRange = normalized.match(
    /\b(\d{1,2})\s*(?:a|até|ate|-)\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/i,
  );
  if (!shortRange) return null;
  return {
    start: toIso(shortRange[1], shortRange[3], shortRange[4]),
    end: toIso(shortRange[2], shortRange[3], shortRange[4]),
  };
}

function bulkMarkup() {
  return `
    <section id="cronogramaBulkDates" class="cronograma-bulk-dates" hidden>
      <div class="cronograma-bulk-head">
        <div>
          <span class="cronograma-eyebrow">Preenchimento recomendado</span>
          <h5>Colar datas do cronograma</h5>
          <p>Cole uma data ou intervalo por linha, seguindo a ordem das atividades do modelo.</p>
        </div>
        <button id="cronogramaBulkClose" type="button" class="btn outline">Fechar</button>
      </div>
      <textarea id="cronogramaBulkInput" rows="8" placeholder="17/06/2026\n18/06/2026 a 20/06/2026\n25/06/2026 a 03/07/2026"></textarea>
      <div id="cronogramaBulkFeedback" class="cronograma-bulk-feedback" hidden></div>
      <div class="cronograma-bulk-actions">
        <button id="cronogramaBulkApply" type="button" class="btn green"><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Aplicar datas às etapas</button>
      </div>
    </section>`;
}

function feedback(message, type = "info") {
  const box = $("cronogramaBulkFeedback");
  if (!box) return;
  box.hidden = false;
  box.className = `cronograma-bulk-feedback is-${type}`;
  box.textContent = message;
}

function dispatchDate(input, value) {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyBulkDates() {
  const rawLines = String($("cronogramaBulkInput")?.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = [
    ...document.querySelectorAll("#cronogramaRows tr[data-cronograma-index]"),
  ];
  if (!rows.length)
    return feedback(
      "Use primeiro o modelo padrão para criar as atividades.",
      "error",
    );
  if (!rawLines.length)
    return feedback("Cole pelo menos uma data ou intervalo.", "error");

  const parsed = rawLines.map(parseDateLine);
  const invalid = parsed.reduce((items, item, index) => {
    if (!item?.start || !item?.end) items.push(index + 1);
    return items;
  }, []);
  if (invalid.length)
    return feedback(
      `Não foi possível interpretar ${invalid.length === 1 ? "a linha" : "as linhas"} ${invalid.join(", ")}.`,
      "error",
    );

  const total = Math.min(rows.length, parsed.length);
  for (let index = 0; index < total; index += 1) {
    dispatchDate(
      rows[index].querySelector('[data-field="data_inicio"]'),
      parsed[index].start,
    );
    dispatchDate(
      rows[index].querySelector('[data-field="data_fim"]'),
      parsed[index].end,
    );
  }

  if (parsed.length < rows.length)
    feedback(
      `${total} datas aplicadas. Ainda faltam ${rows.length - parsed.length} etapas para preencher.`,
      "warning",
    );
  else if (parsed.length > rows.length)
    feedback(
      `${total} datas aplicadas. ${parsed.length - rows.length} linhas excedentes foram ignoradas.`,
      "warning",
    );
  else
    feedback(
      `${total} etapas preenchidas com sucesso. Revise antes de salvar.`,
      "success",
    );

  if ($("mCronogramaAutomatico")) {
    $("mCronogramaAutomatico").checked = true;
    $("mCronogramaAutomatico").dispatchEvent(
      new Event("change", { bubbles: true }),
    );
  }
  $("cronogramaRows")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function enhanceEditor() {
  const editor = $("cronogramaEditor");
  if (!editor || editor.dataset.safeEnhanced === "true") return false;
  editor.dataset.safeEnhanced = "true";

  editor.querySelector(".cronograma-upload-box")?.remove();
  editor
    .querySelector(".cronograma-source-grid")
    ?.classList.add("cronograma-manual-source-grid");
  editor
    .querySelector(".cronograma-actions-box")
    ?.classList.add("cronograma-manual-actions");

  const heading = editor.querySelector(".cronograma-heading p");
  if (heading)
    heading.textContent =
      "Cadastre as etapas manualmente ou use o modelo padrão. Status e etapa serão calculados pelas datas salvas.";

  const exampleButton = $("cronogramaExample");
  if (exampleButton) {
    exampleButton.title =
      "Criar as atividades padrão e preencher as datas em lote";
    exampleButton.innerHTML =
      '<i class="fa-solid fa-list-check" aria-hidden="true"></i> Usar modelo padrão <span class="cronograma-recommended-badge">Recomendado</span>';
    exampleButton.addEventListener("click", () =>
      window.setTimeout(() => {
        const box = $("cronogramaBulkDates");
        if (!box) return;
        box.hidden = false;
        $("cronogramaBulkInput")?.focus();
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50),
    );
  }

  const tableWrap = editor.querySelector(".cronograma-table-wrap");
  if (tableWrap && !$("cronogramaBulkDates"))
    tableWrap.insertAdjacentHTML("beforebegin", bulkMarkup());
  if (tableWrap && !editor.querySelector(".cronograma-view-hint")) {
    tableWrap.insertAdjacentHTML(
      "beforebegin",
      `<div class="cronograma-view-hint"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i><span>Este é o cronograma oficial do edital. Para consultá-lo novamente, abra o edital pelo botão <strong>Editar</strong>.</span></div>`,
    );
  }

  $("cronogramaBulkClose")?.addEventListener("click", () => {
    $("cronogramaBulkDates").hidden = true;
  });
  $("cronogramaBulkApply")?.addEventListener("click", applyBulkDates);
  return true;
}

function scheduleEnhancement() {
  [0, 50, 180].forEach((delay) => window.setTimeout(enhanceEditor, delay));
}

function wrapOpenEditModal() {
  const original = window.openEditModal;
  if (typeof original !== "function" || original.__safeEditorWrapped) return;
  const wrapped = (...args) => {
    const result = original(...args);
    scheduleEnhancement();
    return result;
  };
  wrapped.__safeEditorWrapped = true;
  wrapped.__original = original;
  window.openEditModal = wrapped;
}

export function initNucleoEditorSafe() {
  if (initialized) return;
  initialized = true;
  wrapOpenEditModal();
  scheduleEnhancement();
  document.addEventListener("agsus:nucleo-editor-ready", scheduleEnhancement);
}
