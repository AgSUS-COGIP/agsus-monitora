import { escapeHtml } from "../lib/sanitize.js";
import { buscarParecerDaLinha } from "./analises-pareceres-sob-demanda.js";

const state = {
  opening: false,
  activeKey: "",
  lastFocus: null,
};

const txt = (value) => String(value ?? "").trim();
const norm = (value) =>
  txt(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

function encodedKey(button) {
  const match = txt(button?.getAttribute("onclick")).match(
    /toggleDetails\('([^']+)'\)/,
  );
  return match ? match[1] : "";
}

function decodedKey(encoded) {
  try {
    return decodeURIComponent(encoded || "");
  } catch {
    return encoded || "";
  }
}

function rowsPerPage() {
  const value = Number(document.getElementById("rowsPerPage")?.value || 50);
  return Number.isFinite(value) && value > 0 ? value : 50;
}

function pageForKey(encoded) {
  const parts = decodedKey(encoded).split("|");
  const globalIndex = Number(parts[parts.length - 1]);
  return Number.isFinite(globalIndex)
    ? Math.floor(globalIndex / rowsPerPage()) + 1
    : 1;
}

function findButton(key) {
  return (
    [
      ...document.querySelectorAll(
        '#tableBody button[onclick*="toggleDetails"]',
      ),
    ].find((button) => encodedKey(button) === key) || null
  );
}

function ensureDrawer() {
  let backdrop = document.getElementById("analisesDetailDrawer");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "analisesDetailDrawer";
    document.body.appendChild(backdrop);
  }

  backdrop.className = "analises-drawer-backdrop";
  if (backdrop.dataset.runtimeDetailFix !== "true") {
    backdrop.dataset.runtimeDetailFix = "true";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <aside class="analises-drawer" role="dialog" aria-modal="true" aria-labelledby="analisesDrawerTitle">
        <div class="analises-drawer-head">
          <div>
            <span class="eyebrow">Detalhamento do candidato</span>
            <h2 id="analisesDrawerTitle">Registro da análise</h2>
            <div class="analises-drawer-summary" id="analisesDrawerSummary"></div>
          </div>
          <button type="button" class="analises-drawer-close" aria-label="Fechar detalhamento"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="analises-drawer-context" id="analisesDrawerContext"></div>
        <div id="analisesDrawerBody"></div>
      </aside>`;
  }
  return backdrop;
}

function visibleValue(value) {
  const cleaned = txt(value);
  return (
    cleaned && !["-", "--", "Não informado", "Sem informação"].includes(cleaned)
  );
}

function sectionFor(label) {
  const key = norm(label);
  if (
    ["etapa", "data da analise", "validacao", "janela oficial"].includes(key)
  ) {
    return {
      key: "status",
      title: "Situação da análise",
      icon: "fa-circle-check",
    };
  }
  if (["nota final", "modalidade"].includes(key)) {
    return { key: "result", title: "Resultado", icon: "fa-chart-simple" };
  }
  return {
    key: "score",
    title: "Composição da pontuação",
    icon: "fa-list-check",
  };
}

function makeSection(definition) {
  const section = document.createElement("section");
  section.className = "analises-detail-section";
  section.dataset.section = definition.key;
  section.innerHTML = `<div class="analises-detail-section-head"><i class="fa-solid ${definition.icon}"></i><span>${definition.title}</span></div><div class="analises-detail-section-grid"></div>`;
  return section;
}

function contextItems(row, source) {
  const cells = [...(row?.querySelectorAll("td") || [])];
  return [
    ["Grupo", txt(cells[0]?.textContent)],
    ["Unidade", txt(cells[1]?.textContent)],
    ["Edital", txt(cells[2]?.textContent)],
    ["Código da vaga", txt(cells[3]?.textContent)],
    [
      "Vaga",
      txt(
        cells[4]?.querySelector(".primary-text")?.textContent ||
          cells[4]?.textContent,
      ),
    ],
    // Projetos e SEDE: onde fica a UBS móvel da vaga.
    ["Município/UF", txt(source?.dataset?.municipioUf)],
  ].filter(([, value]) => visibleValue(value));
}

function analysisSection(text) {
  const section = document.createElement("section");
  section.className = "analises-detail-section";
  section.innerHTML =
    '<div class="analises-detail-section-head"><i class="fa-solid fa-file-lines"></i><span>Parecer da análise</span></div><div class="analises-detail-analysis"></div>';
  section.querySelector(".analises-detail-analysis").textContent = text;
  return section;
}

/*
  Parecer que o payload leve não trouxe: a seção aparece com "Carregando
  parecer…" e o texto entra no mesmo lugar quando chega. Sem parecer no banco,
  a seção sai, como quando a linha já vinha sem texto.
*/
function loadPendingAnalysis(backdrop, section, id) {
  const slot = section.querySelector(".analises-detail-analysis");
  slot.setAttribute("aria-busy", "true");
  backdrop.dataset.analiseAtual = id;
  buscarParecerDaLinha(id)
    .then((text) => {
      if (backdrop.dataset.analiseAtual !== id) return;
      const cleaned = txt(text);
      if (!cleaned) {
        section.remove();
        return;
      }
      slot.textContent = cleaned;
      slot.removeAttribute("aria-busy");
    })
    .catch((error) => {
      console.warn("Não foi possível carregar o parecer da análise:", error);
      if (backdrop.dataset.analiseAtual !== id) return;
      slot.textContent =
        "Não foi possível carregar o parecer. Feche e abra o registro de novo.";
      slot.removeAttribute("aria-busy");
    });
}

function buildDrawerContent(row, detailRow) {
  const backdrop = ensureDrawer();
  const cells = [...(row?.querySelectorAll("td") || [])];
  const candidate =
    txt(
      cells[5]?.querySelector(".primary-text")?.textContent ||
        cells[5]?.textContent,
    ) || "Registro da análise";
  const responsible =
    txt(cells[5]?.querySelector(".secondary-text")?.textContent) ||
    "Sem responsável";
  const status = txt(cells[6]?.textContent) || "Pendente";
  const body = backdrop.querySelector("#analisesDrawerBody");

  backdrop.querySelector("#analisesDrawerTitle").textContent = candidate;
  // Textos lidos das células voltam como HTML: sempre escapados.
  backdrop.querySelector("#analisesDrawerSummary").innerHTML = `
    <span class="status"><i class="fa-solid fa-circle-info"></i>${escapeHtml(status)}</span>
    <span><i class="fa-solid fa-user-check"></i>${escapeHtml(responsible)}</span>`;
  const source = detailRow?.querySelector(".detail-shell");
  backdrop.dataset.analiseAtual = "";
  backdrop.querySelector("#analisesDrawerContext").innerHTML = contextItems(
    row,
    source,
  )
    .map(
      ([label, value]) =>
        `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");
  body.replaceChildren();

  if (!source) {
    body.innerHTML =
      '<div class="empty">Não foi possível montar o detalhamento deste registro.</div>';
    return;
  }

  const shell = document.createElement("div");
  shell.className = "detail-shell";
  const sections = new Map();

  [...source.querySelectorAll(":scope > .detail-grid > .kv")].forEach(
    (item) => {
      const clone = item.cloneNode(true);
      const label = txt(clone.querySelector(".kv-label")?.textContent);
      const value = txt(clone.querySelector(".kv-value")?.textContent);
      if (!visibleValue(value)) return;

      const definition = sectionFor(label);
      if (!sections.has(definition.key)) {
        const section = makeSection(definition);
        sections.set(definition.key, section);
        shell.appendChild(section);
      }
      sections
        .get(definition.key)
        .querySelector(".analises-detail-section-grid")
        .appendChild(clone);
    },
  );

  const actions = source.querySelector(".detail-actions")?.cloneNode(true);
  actions
    ?.querySelectorAll(".mini-chip")
    .forEach((element) => element.remove());
  actions?.querySelectorAll("a").forEach((link) => {
    if (!/^https?:\/\//i.test(txt(link.getAttribute("href")))) link.remove();
  });
  if (actions?.children.length) shell.insertBefore(actions, shell.firstChild);

  const analysisSource = source.querySelector(".analysis-text");
  const analysisText = txt(analysisSource?.textContent);
  if (analysisSource?.dataset.analisePendente === "true") {
    const section = analysisSection(analysisText);
    shell.appendChild(section);
    loadPendingAnalysis(
      backdrop,
      section,
      txt(analysisSource.dataset.analiseId),
    );
  } else if (analysisText && analysisText !== "Sem análise registrada.") {
    shell.appendChild(analysisSection(analysisText));
  }

  body.appendChild(shell);
}

// Até 10 s: na lista enxuta, o detalhamento vem do servidor antes de abrir.
const ESPERA_MAXIMA_DO_DETALHE = 500;

function waitForDetail(key, attempts = 0) {
  return new Promise((resolve) => {
    const check = () => {
      const button = findButton(key);
      const row = button?.closest("tr") || null;
      const detailRow = row?.nextElementSibling?.classList?.contains(
        "detail-row",
      )
        ? row.nextElementSibling
        : null;
      if (detailRow || attempts >= ESPERA_MAXIMA_DO_DETALHE) {
        resolve({ button, row, detailRow });
        return;
      }
      attempts += 1;
      window.setTimeout(check, 20);
    };
    check();
  });
}

function showDrawer() {
  const backdrop = ensureDrawer();
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  backdrop.querySelector(".analises-drawer-close")?.focus();
}

function closeDrawer() {
  const backdrop = document.getElementById("analisesDetailDrawer");
  if (!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  document.body.style.overflow = "";
  state.activeKey = "";
  if (state.lastFocus?.isConnected) state.lastFocus.focus();
  state.lastFocus = null;
}

async function openDetail(button) {
  if (state.opening) return;
  const key = encodedKey(button);
  if (!key || typeof window.toggleDetails !== "function") return;

  state.opening = true;
  state.activeKey = key;
  state.lastFocus = button;
  const originalRow = button.closest("tr")?.cloneNode(true) || null;
  const savedTable = window.analisesInfiniteTable?.snapshot?.() || null;
  const targetPage = pageForKey(key);
  let detailWasOpened = false;

  try {
    if (typeof window.goPage === "function") window.goPage(targetPage);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const renderedButton = findButton(key);
    const renderedRow = renderedButton?.closest("tr") || null;
    const renderedDetail = renderedRow?.nextElementSibling?.classList?.contains(
      "detail-row",
    )
      ? renderedRow.nextElementSibling
      : null;

    let result;
    if (renderedDetail) {
      detailWasOpened = true;
      result = {
        button: renderedButton,
        row: renderedRow,
        detailRow: renderedDetail,
      };
    } else {
      window.toggleDetails(key);
      detailWasOpened = true;
      result = await waitForDetail(key);
    }

    buildDrawerContent(result.row || originalRow, result.detailRow);
    showDrawer();
  } catch (error) {
    console.error("Falha ao abrir detalhamento de análises:", error);
    const backdrop = ensureDrawer();
    backdrop.querySelector("#analisesDrawerTitle").textContent =
      "Detalhamento indisponível";
    backdrop.querySelector("#analisesDrawerSummary").innerHTML = "";
    backdrop.querySelector("#analisesDrawerContext").innerHTML = "";
    backdrop.querySelector("#analisesDrawerBody").innerHTML =
      '<div class="empty">Não foi possível abrir este registro. Tente novamente.</div>';
    showDrawer();
  } finally {
    if (detailWasOpened) {
      const currentButton = findButton(key);
      if (currentButton?.getAttribute("aria-expanded") === "true")
        window.toggleDetails(key);
    }
    window.analisesInfiniteTable?.restore?.(savedTable);
    state.opening = false;
  }
}

window.addEventListener(
  "click",
  (event) => {
    const closeButton = event.target?.closest?.(
      "#analisesDetailDrawer .analises-drawer-close",
    );
    const backdrop = event.target?.matches?.("#analisesDetailDrawer")
      ? event.target
      : null;
    if (closeButton || backdrop) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeDrawer();
      return;
    }

    const detailButton = event.target?.closest?.(
      '#tableBody button[onclick*="toggleDetails"]',
    );
    if (!detailButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openDetail(detailButton);
  },
  true,
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});
