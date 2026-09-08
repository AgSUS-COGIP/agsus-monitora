import { exigirSessao } from "../lib/sessao.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";

const state = {
  client: null,
  summary: [],
  activeFilter: "todos",
  initialized: false,
  decorating: false,
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

function client() {
  if (state.client) return state.client;
  state.client = getSupabaseClient();
  return state.client;
}

async function ensureSession() {
  const sb = client();
  if (!sb) throw new Error("Supabase indisponível.");
  await exigirSessao(sb);
  return sb;
}

function keyOf(unidade, edital) {
  return `${norm(unidade)}|${norm(edital)}`;
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
        <div><span>Acompanhamento operacional</span><h3>Cronogramas e alertas</h3><p>Clique nos indicadores para filtrar a fila da Equipe Núcleo.</p></div>
        <button id="nucleoOperationalRefresh" type="button" class="btn outline"><i class="fa-solid fa-rotate"></i> Atualizar</button>
      </div>
      <div id="nucleoKpiGrid" class="nucleo-kpi-grid"></div>
      <div id="nucleoActiveAlertFilter" class="nucleo-active-alert-filter" hidden></div>
    </section>`,
  );
  $("nucleoOperationalRefresh")?.addEventListener("click", () =>
    loadSummary(true),
  );
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

function renderKpis() {
  if (!ensureKpis()) return;
  const cards = cardsData();
  const grid = $("nucleoKpiGrid");
  if (grid)
    grid.innerHTML = cards
      .map(
        (card) => `
    <button type="button" class="nucleo-kpi-card tone-${card.tone}${state.activeFilter === card.key ? " is-active" : ""}" data-alert-filter="${card.key}">
      <span class="nucleo-kpi-icon"><i class="fa-solid ${card.icon}"></i></span>
      <span><small>${esc(card.label)}</small><strong>${card.value.toLocaleString("pt-BR")}</strong></span>
    </button>`,
      )
      .join("");
  grid?.querySelectorAll("[data-alert-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.alertFilter || "todos";
      renderKpis();
      decorateRows();
    }),
  );
  const active = $("nucleoActiveAlertFilter");
  if (active) {
    active.hidden = state.activeFilter === "todos";
    active.innerHTML =
      state.activeFilter === "todos"
        ? ""
        : `<span>Filtro operacional ativo: <strong>${esc(cards.find((card) => card.key === state.activeFilter)?.label || state.activeFilter)}</strong></span><button type="button" id="clearNucleoAlertFilter">Limpar</button>`;
    $("clearNucleoAlertFilter")?.addEventListener("click", () => {
      state.activeFilter = "todos";
      renderKpis();
      decorateRows();
    });
  }
}

function summaryForRow(tr) {
  const cells = tr.querySelectorAll("td");
  return state.summary.find(
    (item) =>
      keyOf(item.unidade, item.edital) ===
      keyOf(cells[0]?.textContent, cells[1]?.textContent),
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
      if (!item) return;
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
      if (badge)
        badge.innerHTML = `<i class="fa-solid ${meta.icon}"></i><span>${esc(meta.label)}</span>`;
      if (!actions.querySelector(".nucleo-view-timeline")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn icon outline nucleo-view-timeline";
        button.title = "Ver cronograma";
        button.setAttribute(
          "aria-label",
          `Ver cronograma ${item.edital || ""}`,
        );
        button.innerHTML = '<i class="fa-solid fa-timeline"></i>';
        button.addEventListener("click", () => window.openEditModal?.(item.id));
        actions.insertBefore(button, actions.firstChild);
      }
    });
  } finally {
    state.decorating = false;
  }
  return true;
}

function scheduleDecoration() {
  [0, 100, 350, 900].forEach((delay) =>
    window.setTimeout(() => {
      ensureKpis();
      renderKpis();
      decorateRows();
    }, delay),
  );
}

async function loadSummary() {
  ensureKpis();
  const button = $("nucleoOperationalRefresh");
  if (button) button.disabled = true;
  try {
    const sb = await ensureSession();
    const { data, error } = await sb.rpc("get_nucleo_cronograma_resumo");
    if (error) throw error;
    state.summary = Array.isArray(data) ? data : [];
    renderKpis();
    scheduleDecoration();
  } catch (error) {
    console.error("Erro ao carregar resumo da Equipe Núcleo:", error);
    const grid = $("nucleoKpiGrid");
    if (grid)
      grid.innerHTML = `<div class="nucleo-summary-error">Não foi possível carregar os alertas: ${esc(error?.message || error)}</div>`;
  } finally {
    if (button) button.disabled = false;
  }
}

export function initNucleoOperationalSafe() {
  if (state.initialized) return;
  state.initialized = true;
  scheduleDecoration();
  const sb = client();
  if (sb) {
    void sb.auth.getSession().then(({ data }) => {
      if (data?.session?.user) void loadSummary();
    });
    sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) void loadSummary();
    });
  }
  document.addEventListener("agsus:nucleo-cronograma-saved", () =>
    loadSummary(true),
  );
  document.addEventListener("agsus:nucleo-rendered", scheduleDecoration);
  document.addEventListener("click", (event) => {
    if (
      event.target?.closest?.(
        '[data-view="nucleo"], [onclick*="nucleo"], #nucleoOperationalRefresh',
      )
    )
      scheduleDecoration();
  });
}
