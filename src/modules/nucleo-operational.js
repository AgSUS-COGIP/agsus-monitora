import { getSupabaseClient } from "../lib/supabaseClient.js";
import {
  getNucleoSummary,
  invalidateNucleoSummary,
} from "./nucleo-summary-store.js";

const state = {
  summary: [],
  summaryByKey: new Map(),
  status: "idle",
  activeFilter: "todos",
  initialized: false,
  decorating: false,
  decorationQueued: false,
  loadToken: 0,
  kpiSignature: "",
  sourcePromise: null,
  pending: null,
  identity: undefined,
  rowSignatures: new WeakMap(),
  uiState: "",
};

const $ = (id) => document.getElementById(id);
const escMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => escMap[char]);
const norm = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function keyOf(unidade, edital) {
  return `${norm(unidade)}|${norm(edital)}`;
}

function isNucleoActive() {
  return document.getElementById("page-nucleo")?.classList.contains("active");
}

function rebuildSummaryIndex() {
  state.summaryByKey = new Map(
    state.summary.flatMap((item) => [
      [String(item.id), item],
      [keyOf(item.unidade, item.edital), item],
    ]),
  );
}

function alertMeta(type) {
  const map = {
    sem_cronograma: {
      label: "Sem cronograma",
      icon: "fa-calendar-xmark",
      tone: "danger",
    },
    incompleto: {
      label: "Cronograma incompleto",
      icon: "fa-triangle-exclamation",
      tone: "warning",
    },
    proxima_3d: {
      label: "Próxima etapa em até 3 dias",
      icon: "fa-bell",
      tone: "danger",
    },
    proxima_7d: {
      label: "Próxima etapa em até 7 dias",
      icon: "fa-clock",
      tone: "warning",
    },
    excepcional: {
      label: "Situação excepcional",
      icon: "fa-circle-exclamation",
      tone: "purple",
    },
    ok: {
      label: "Cronograma regular",
      icon: "fa-circle-check",
      tone: "success",
    },
  };
  return map[type] || map.ok;
}

function ensureKpis() {
  if ($("nucleoOperationalKpis")) return true;
  const rows = $("nucleoRows");
  const table = rows?.closest("table");
  const anchor =
    table?.closest(".table-wrap, .admin-card, .details-card") || table;
  if (!anchor) return false;
  anchor.insertAdjacentHTML(
    "beforebegin",
    `
    <section id="nucleoOperationalKpis" class="nucleo-operational-panel">
      <div class="nucleo-operational-heading">
        <div><h3>Cronogramas e alertas</h3></div>
        <button id="nucleoOperationalRefresh" type="button" class="btn outline"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Atualizar</button>
      </div>
      <div id="nucleoKpiGrid" class="nucleo-kpi-grid"></div>
      <div id="nucleoActiveAlertFilter" class="nucleo-active-alert-filter" role="status" hidden></div>
    </section>`,
  );
  $("nucleoOperationalRefresh")?.addEventListener("click", () => {
    void loadSummary({ force: true }).catch(() => {});
  });
  return true;
}

function cardsData() {
  const counts = state.summary.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.alerta_tipo] = (acc[row.alerta_tipo] || 0) + 1;
      if (["Em andamento", "Planejado"].includes(row.status))
        acc.andamento += 1;
      return acc;
    },
    { total: 0, andamento: 0 },
  );
  return [
    {
      key: "todos",
      label: "Editais ativos",
      value: counts.total,
      icon: "fa-folder-open",
      tone: "blue",
    },
    {
      key: "andamento",
      label: "Em andamento",
      value: counts.andamento,
      icon: "fa-play",
      tone: "green",
    },
    {
      key: "sem_cronograma",
      label: "Sem cronograma",
      value: counts.sem_cronograma || 0,
      icon: "fa-calendar-xmark",
      tone: "red",
    },
    {
      key: "incompleto",
      label: "Incompletos",
      value: counts.incompleto || 0,
      icon: "fa-triangle-exclamation",
      tone: "amber",
    },
    {
      key: "proxima",
      label: "Próximos 7 dias",
      value: (counts.proxima_3d || 0) + (counts.proxima_7d || 0),
      icon: "fa-bell",
      tone: "cyan",
    },
    {
      key: "excepcional",
      label: "Excepcionais",
      value: counts.excepcional || 0,
      icon: "fa-circle-exclamation",
      tone: "purple",
    },
  ];
}

const ESTADOS = {
  loading: {
    classe: "nucleo-summary-loading",
    icone: "fa-spinner fa-spin",
    titulo: "Carregando os alertas dos editais",
    texto: "Os indicadores aparecem assim que o resumo chegar.",
  },
  empty: {
    classe: "nucleo-summary-empty",
    icone: "fa-folder-open",
    titulo: "Nenhum edital ativo",
    texto:
      "Quando um edital for cadastrado, os indicadores e os alertas de cronograma aparecem aqui.",
  },
  error: {
    classe: "nucleo-summary-error",
    icone: "fa-triangle-exclamation",
    titulo: "Não foi possível carregar os alertas",
    texto: "Verifique a conexão e tente novamente.",
    repetir: true,
  },
};

function renderEstado(grid, chave) {
  if (state.uiState === chave && grid.firstElementChild) return;
  state.uiState = chave;
  const estado = ESTADOS[chave];
  const repetir = estado.repetir
    ? '<button type="button" class="nucleo-summary-retry" id="nucleoSummaryRetry">Tentar de novo</button>'
    : "";
  grid.innerHTML = `
    <div class="${estado.classe}" role="status">
      <i class="fa-solid ${estado.icone}" aria-hidden="true"></i>
      <span class="nucleo-summary-text"><strong>${esc(estado.titulo)}</strong>${esc(estado.texto)}</span>
      ${repetir}
    </div>`;
  if (estado.repetir)
    $("nucleoSummaryRetry")?.addEventListener("click", () => {
      void loadSummary({ force: true }).catch(() => {});
    });
}

function renderFiltroAtivo(cards) {
  const active = $("nucleoActiveAlertFilter");
  if (!active) return;
  active.hidden = !cards || state.activeFilter === "todos";
  if (active.hidden) {
    active.innerHTML = "";
    return;
  }
  const rotulo =
    cards.find((card) => card.key === state.activeFilter)?.label ||
    state.activeFilter;
  active.innerHTML = `<span>Filtro operacional ativo: <strong>${esc(rotulo)}</strong></span><button type="button" id="clearNucleoAlertFilter">Limpar</button>`;
  $("clearNucleoAlertFilter")?.addEventListener("click", () => {
    state.activeFilter = "todos";
    state.kpiSignature = "";
    renderKpis();
    queueDecoration();
  });
}

function renderKpis() {
  if (!ensureKpis()) return;
  const grid = $("nucleoKpiGrid");
  if (!grid) return;

  if (state.status === "error") {
    state.kpiSignature = "";
    renderEstado(grid, "error");
    renderFiltroAtivo(null);
    return;
  }

  if (!state.summary.length) {
    state.kpiSignature = "";
    if (state.status === "idle") grid.innerHTML = "";
    else renderEstado(grid, state.status === "loading" ? "loading" : "empty");
    renderFiltroAtivo(null);
    return;
  }

  const cards = cardsData();
  const signature = JSON.stringify({
    active: state.activeFilter,
    values: cards.map(({ key, value }) => [key, value]),
  });
  if (signature === state.kpiSignature) return;
  state.kpiSignature = signature;
  state.uiState = "cards";

  grid.innerHTML = cards
    .map(
      (card) => `
    <button type="button" class="nucleo-kpi-card tone-${card.tone}${state.activeFilter === card.key ? " is-active" : ""}" data-alert-filter="${card.key}" aria-pressed="${state.activeFilter === card.key}">
      <span class="nucleo-kpi-icon"><i class="fa-solid ${card.icon}" aria-hidden="true"></i></span>
      <span><small>${esc(card.label)}</small><strong>${card.value.toLocaleString("pt-BR")}</strong></span>
    </button>`,
    )
    .join("");

  grid.querySelectorAll("[data-alert-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.alertFilter || "todos";
      state.kpiSignature = "";
      renderKpis();
      queueDecoration();
    }),
  );
  renderFiltroAtivo(cards);
}

function summaryForRow(tr) {
  const cells = tr.querySelectorAll("td");
  return (
    state.summaryByKey.get(tr.dataset.recordId) ||
    state.summaryByKey.get(keyOf(cells[0]?.textContent, cells[1]?.textContent))
  );
}

function matchesFilter(item) {
  if (state.activeFilter === "todos") return true;
  if (state.activeFilter === "andamento")
    return ["Em andamento", "Planejado"].includes(item?.status);
  if (state.activeFilter === "proxima")
    return ["proxima_3d", "proxima_7d"].includes(item?.alerta_tipo);
  return item?.alerta_tipo === state.activeFilter;
}

function decorateRows() {
  if (state.decorating) return false;
  const body = $("nucleoRows");
  if (!body) return false;
  state.decorating = true;
  try {
    [...body.querySelectorAll("tr")].forEach((tr) => {
      const item = summaryForRow(tr);
      const signature = JSON.stringify([
        item?.id,
        item?.edital,
        item?.alerta_tipo,
        item?.status,
        state.activeFilter,
      ]);
      if (state.rowSignatures.get(tr) === signature) return;
      state.rowSignatures.set(tr, signature);
      if (!item) {
        tr.hidden = state.activeFilter !== "todos";
        delete tr.dataset.monitoramentoId;
        delete tr.dataset.alertType;
        tr.querySelector(".nucleo-row-alert")?.remove();
        tr.querySelector(".nucleo-view-timeline")?.remove();
        return;
      }
      tr.dataset.monitoramentoId = item.id;
      tr.dataset.alertType = item.alerta_tipo;
      tr.hidden = !matchesFilter(item);
      const cells = tr.querySelectorAll("td");
      const actions = cells[cells.length - 1];
      if (!actions) return;
      const meta = alertMeta(item.alerta_tipo);
      let badge = tr.querySelector(".nucleo-row-alert");
      if (!badge && item.alerta_tipo !== "ok") {
        badge = document.createElement("div");
        badge.className = `nucleo-row-alert tone-${meta.tone}`;
        tr.querySelector("td:nth-child(4)")?.appendChild(badge);
      }
      if (badge) {
        if (item.alerta_tipo === "ok") badge.remove();
        else {
          badge.className = `nucleo-row-alert tone-${meta.tone}`;
          badge.innerHTML = `<i class="fa-solid ${meta.icon}" aria-hidden="true"></i><span>${esc(meta.label)}</span>`;
        }
      }
      const actionGroup =
        actions.querySelector(".nucleo-row-actions") || actions;
      actionGroup.querySelector(".approved-no-action")?.remove();
      const existingButton = actionGroup.querySelector(".nucleo-view-timeline");
      if (existingButton)
        existingButton.setAttribute(
          "aria-label",
          `Ver cronograma ${item.edital || ""}`,
        );
      if (!existingButton) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn icon outline nucleo-view-timeline";
        button.title = "Ver cronograma";
        button.setAttribute(
          "aria-label",
          `Ver cronograma ${item.edital || ""}`,
        );
        button.innerHTML =
          '<i class="fa-solid fa-timeline" aria-hidden="true"></i>';
        button.addEventListener("click", () =>
          window.openEditModal?.(tr.dataset.monitoramentoId),
        );
        const editButton = actionGroup.querySelector(".nucleo-edit-action");
        actionGroup.insertBefore(button, editButton || null);
      }
    });
  } finally {
    state.decorating = false;
  }
  return true;
}

function queueDecoration() {
  if (state.decorationQueued) return;
  state.decorationQueued = true;
  const run = () => {
    state.decorationQueued = false;
    const started = performance.now();
    ensureKpis();
    renderKpis();
    decorateRows();
    document.dispatchEvent(
      new CustomEvent("agsus:nucleo-metric", {
        detail: {
          name: "operational-render",
          durationMs: performance.now() - started,
        },
      }),
    );
  };
  if (typeof window.requestAnimationFrame === "function")
    window.requestAnimationFrame(run);
  else queueMicrotask(run);
}

export function loadSummary({ force = false, invalidate = false } = {}) {
  ensureKpis();
  if (invalidate) invalidateNucleoSummary();
  const request = getNucleoSummary({ force });
  if (state.sourcePromise === request) return state.pending;
  state.sourcePromise = request;
  const token = ++state.loadToken;
  const started = performance.now();
  const button = $("nucleoOperationalRefresh");
  if (button) button.disabled = true;
  if (state.status !== "ready") {
    state.status = "loading";
    renderKpis();
  }
  state.pending = request
    .then((data) => {
      if (token !== state.loadToken) return data;
      if (state.summary !== data) {
        state.summary = Array.isArray(data) ? data : [];
        rebuildSummaryIndex();
      }
      state.status = "ready";
      renderKpis();
      queueDecoration();
      document.dispatchEvent(
        new CustomEvent("agsus:nucleo-metric", {
          detail: {
            name: "summary-ready",
            durationMs: performance.now() - started,
          },
        }),
      );
      return data;
    })
    .catch((error) => {
      if (token !== state.loadToken) throw error;
      console.error("Erro ao carregar resumo da Equipe Núcleo:", error);
      state.status = "error";
      state.kpiSignature = "";
      renderKpis();
      throw error;
    })
    .finally(() => {
      if (token === state.loadToken) {
        if (button) button.disabled = false;
        state.pending = null;
        state.sourcePromise = null;
      }
    });
  return state.pending;
}

function refreshWhenNucleoIsVisible() {
  if (!isNucleoActive()) return;
  void loadSummary().catch(() => {});
}

export function initNucleoOperationalSafe() {
  if (state.initialized) return;
  state.initialized = true;
  ensureKpis();

  getSupabaseClient()?.auth.onAuthStateChange((_event, session) => {
    const identity = session?.user?.id || null;
    if (identity === state.identity) return;
    if (state.identity !== undefined || !identity) {
      invalidateNucleoSummary();
      state.loadToken += 1;
      state.sourcePromise = null;
      state.pending = null;
      state.summary = [];
      state.summaryByKey.clear();
      state.status = "idle";
      state.activeFilter = "todos";
      state.kpiSignature = "";
      state.uiState = "";
      const button = $("nucleoOperationalRefresh");
      if (button) button.disabled = false;
      document.dispatchEvent(new Event("agsus:nucleo-summary-reset"));
      // No auth call inside its callback: only clear local UI/cache state.
      queueDecoration();
    }
    state.identity = identity;
  });

  document.addEventListener("agsus:nucleo-cronograma-saved", () => {
    if (isNucleoActive())
      void loadSummary({ force: true, invalidate: true }).catch(() => {});
    else invalidateNucleoSummary();
  });

  document.addEventListener(
    "agsus:nucleo-rendered",
    refreshWhenNucleoIsVisible,
  );

  queueMicrotask(refreshWhenNucleoIsVisible);
}
