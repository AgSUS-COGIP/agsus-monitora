import { SUPABASE_AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from "../lib/env.js";
import { createSafeAuthStorage } from "./auth-storage.js";

const state = {
  client: null,
  summary: [],
  activeFilter: "todos",
  initialized: false,
  decorating: false
};

const $ = id => document.getElementById(id);
const escMap = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" };
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => escMap[char]);
const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function client() {
  if (state.client) return state.client;
  if (!window.supabase?.createClient || !SUPABASE_URL || !SUPABASE_KEY) return null;
  state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: createSafeAuthStorage(SUPABASE_AUTH_STORAGE_KEY),
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  return state.client;
}

async function ensureSession() {
  const sb = client();
  if (!sb) throw new Error("Supabase indisponível.");
  const { data, error } = await sb.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error("Sessão expirada.");
  return sb;
}

function keyOf(unidade, edital) {
  return `${norm(unidade)}|${norm(edital)}`;
}

function alertMeta(type) {
  const map = {
    sem_cronograma: { label:"Sem cronograma", icon:"fa-calendar-xmark", tone:"danger" },
    incompleto: { label:"Cronograma incompleto", icon:"fa-triangle-exclamation", tone:"warning" },
    proxima_3d: { label:"Próxima etapa em até 3 dias", icon:"fa-bell", tone:"danger" },
    proxima_7d: { label:"Próxima etapa em até 7 dias", icon:"fa-clock", tone:"warning" },
    excepcional: { label:"Situação excepcional", icon:"fa-circle-exclamation", tone:"purple" },
    ok: { label:"Cronograma regular", icon:"fa-circle-check", tone:"success" }
  };
  return map[type] || map.ok;
}

function ensureKpis() {
  if ($("nucleoOperationalKpis")) return;
  const rows = $("nucleoRows");
  const table = rows?.closest("table");
  const anchor = table?.closest(".table-wrap, .admin-card, .details-card") || table;
  if (!anchor) return;
  anchor.insertAdjacentHTML("beforebegin", `
    <section id="nucleoOperationalKpis" class="nucleo-operational-panel">
      <div class="nucleo-operational-heading">
        <div><span>Acompanhamento operacional</span><h3>Cronogramas e alertas</h3><p>Clique nos indicadores para filtrar a fila da Equipe Núcleo.</p></div>
        <button id="nucleoOperationalRefresh" type="button" class="btn outline"><i class="fa-solid fa-rotate"></i> Atualizar</button>
      </div>
      <div id="nucleoKpiGrid" class="nucleo-kpi-grid"></div>
      <div id="nucleoActiveAlertFilter" class="nucleo-active-alert-filter" hidden></div>
    </section>`);
  $("nucleoOperationalRefresh")?.addEventListener("click", () => loadSummary(true));
}

function renderKpis() {
  ensureKpis();
  const counts = state.summary.reduce((acc, row) => {
    acc.total += 1;
    acc[row.alerta_tipo] = (acc[row.alerta_tipo] || 0) + 1;
    if (["Em andamento", "Planejado"].includes(row.status)) acc.andamento += 1;
    return acc;
  }, { total:0, andamento:0 });
  const cards = [
    { key:"todos", label:"Editais ativos", value:counts.total, icon:"fa-folder-open", tone:"blue" },
    { key:"andamento", label:"Em andamento", value:counts.andamento, icon:"fa-play", tone:"green" },
    { key:"sem_cronograma", label:"Sem cronograma", value:counts.sem_cronograma || 0, icon:"fa-calendar-xmark", tone:"red" },
    { key:"incompleto", label:"Incompletos", value:counts.incompleto || 0, icon:"fa-triangle-exclamation", tone:"amber" },
    { key:"proxima", label:"Próximos 7 dias", value:(counts.proxima_3d || 0) + (counts.proxima_7d || 0), icon:"fa-bell", tone:"cyan" },
    { key:"excepcional", label:"Excepcionais", value:counts.excepcional || 0, icon:"fa-circle-exclamation", tone:"purple" }
  ];
  const grid = $("nucleoKpiGrid");
  if (grid) grid.innerHTML = cards.map(card => `
    <button type="button" class="nucleo-kpi-card tone-${card.tone}${state.activeFilter === card.key ? " is-active" : ""}" data-alert-filter="${card.key}">
      <span class="nucleo-kpi-icon"><i class="fa-solid ${card.icon}"></i></span>
      <span><small>${esc(card.label)}</small><strong>${card.value.toLocaleString("pt-BR")}</strong></span>
    </button>`).join("");
  grid?.querySelectorAll("[data-alert-filter]").forEach(button => button.addEventListener("click", () => {
    state.activeFilter = button.dataset.alertFilter || "todos";
    renderKpis();
    decorateRows();
  }));
  const active = $("nucleoActiveAlertFilter");
  if (active) {
    active.hidden = state.activeFilter === "todos";
    active.innerHTML = state.activeFilter === "todos" ? "" : `<span>Filtro operacional ativo: <strong>${esc(cards.find(card => card.key === state.activeFilter)?.label || state.activeFilter)}</strong></span><button type="button" id="clearNucleoAlertFilter">Limpar</button>`;
    $("clearNucleoAlertFilter")?.addEventListener("click", () => { state.activeFilter = "todos"; renderKpis(); decorateRows(); });
  }
}

function summaryForRow(tr) {
  const cells = tr.querySelectorAll("td");
  const unidade = cells[0]?.textContent;
  const edital = cells[1]?.textContent;
  return state.summary.find(item => keyOf(item.unidade, item.edital) === keyOf(unidade, edital));
}

function matchesFilter(item) {
  if (state.activeFilter === "todos") return true;
  if (state.activeFilter === "andamento") return ["Em andamento", "Planejado"].includes(item?.status);
  if (state.activeFilter === "proxima") return ["proxima_3d", "proxima_7d"].includes(item?.alerta_tipo);
  return item?.alerta_tipo === state.activeFilter;
}

function decorateRows() {
  if (state.decorating) return;
  const body = $("nucleoRows");
  if (!body) return;
  state.decorating = true;
  try {
    [...body.querySelectorAll("tr")].forEach(tr => {
      const item = summaryForRow(tr);
      if (!item) return;
      tr.dataset.monitoramentoId = item.id;
      tr.dataset.alertType = item.alerta_tipo;
      tr.hidden = !matchesFilter(item);
      const cells = tr.querySelectorAll("td");
      const actions = cells[cells.length - 1];
      if (!actions) return;
      let badge = tr.querySelector(".nucleo-row-alert");
      const meta = alertMeta(item.alerta_tipo);
      if (!badge && item.alerta_tipo !== "ok") {
        badge = document.createElement("div");
        badge.className = `nucleo-row-alert tone-${meta.tone}`;
        actions.parentElement?.querySelector("td:nth-child(4)")?.appendChild(badge);
      }
      if (badge) badge.innerHTML = `<i class="fa-solid ${meta.icon}"></i><span>${esc(meta.label)}</span>`;
      if (!actions.querySelector(".nucleo-view-timeline")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn icon outline nucleo-view-timeline";
        button.title = "Ver cronograma";
        button.setAttribute("aria-label", `Ver cronograma ${item.edital || ""}`);
        button.innerHTML = '<i class="fa-solid fa-timeline"></i>';
        button.addEventListener("click", () => openTimeline(item.id));
        actions.insertBefore(button, actions.firstChild);
      }
    });
  } finally {
    state.decorating = false;
  }
}

function ensureTimelineModal() {
  if ($("nucleoTimelineModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="nucleoTimelineModal" class="modal nucleo-timeline-modal" aria-hidden="true">
      <div class="modal-card nucleo-timeline-card" role="dialog" aria-modal="true" aria-labelledby="nucleoTimelineTitle">
        <div class="modal-header"><div><span class="nucleo-timeline-eyebrow">Acompanhamento do edital</span><h3 id="nucleoTimelineTitle">Cronograma</h3><p id="nucleoTimelineSubtitle"></p></div><button type="button" id="closeNucleoTimeline" class="btn outline">Fechar</button></div>
        <div id="nucleoTimelineContent" class="nucleo-timeline-content"></div>
      </div>
    </div>`);
  $("closeNucleoTimeline")?.addEventListener("click", closeTimeline);
  $("nucleoTimelineModal")?.addEventListener("click", event => { if (event.target === $("nucleoTimelineModal")) closeTimeline(); });
}

function closeTimeline() {
  const modal = $("nucleoTimelineModal");
  modal?.classList.remove("show");
  modal?.setAttribute("aria-hidden", "true");
}

function todayIsoSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
}

function stageState(row, index, rows, today) {
  if (today > row.data_fim) return "done";
  if (today >= row.data_inicio && today <= row.data_fim) return "current";
  const firstFuture = rows.findIndex(item => item.data_inicio > today);
  if (index === firstFuture) return "next";
  return "future";
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function renderTimeline(data) {
  const monitor = data?.monitoramento || {};
  const estado = data?.estado || {};
  const rows = Array.isArray(data?.etapas) ? data.etapas : [];
  const history = Array.isArray(data?.historico) ? data.historico : [];
  $("nucleoTimelineTitle").textContent = monitor.edital || "Cronograma do edital";
  $("nucleoTimelineSubtitle").textContent = monitor.unidade || "";
  const today = todayIsoSaoPaulo();
  const content = $("nucleoTimelineContent");
  content.innerHTML = `
    <div class="nucleo-timeline-summary">
      <div><span>Status</span><strong>${esc(estado.status || "Cronograma pendente")}</strong></div>
      <div><span>Etapa atual</span><strong>${esc(estado.etapa || "-")}</strong></div>
      <div><span>Próxima atividade</span><strong>${esc(estado.proxima_atividade || "-")}</strong></div>
      <div><span>Progresso</span><strong>${Number(estado.percentual || 0)}%</strong></div>
    </div>
    ${monitor.status_override ? `<div class="nucleo-timeline-exception"><i class="fa-solid fa-circle-exclamation"></i><div><strong>${esc(monitor.status_override)}</strong><p>${esc(monitor.status_override_motivo || "Motivo não informado")}</p><small>Decisão: ${formatDate(monitor.status_override_data)}${monitor.status_override_previsao_retomada ? ` · Retomada prevista: ${formatDate(monitor.status_override_previsao_retomada)}` : ""}</small></div></div>` : ""}
    <section class="nucleo-timeline-section"><div class="nucleo-timeline-section-title"><span>Linha do tempo</span><strong>${rows.length} etapa(s)</strong></div>
      <div class="nucleo-timeline-list">${rows.length ? rows.map((row, index) => {
        const status = stageState(row, index, rows, today);
        const labels = { done:"Concluída", current:"Em andamento", next:"Próxima", future:"Futura" };
        return `<article class="nucleo-timeline-item is-${status}"><span class="nucleo-timeline-dot"><i class="fa-solid ${status === "done" ? "fa-check" : status === "current" ? "fa-play" : status === "next" ? "fa-clock" : "fa-circle"}"></i></span><div><div><strong>${esc(row.atividade)}</strong><span>${labels[status]}</span></div><p>${formatDate(row.data_inicio)}${row.data_fim !== row.data_inicio ? ` a ${formatDate(row.data_fim)}` : ""}</p>${row.observacao ? `<small>${esc(row.observacao)}</small>` : ""}</div></article>`;
      }).join("") : '<div class="nucleo-timeline-empty">Nenhuma etapa cadastrada.</div>'}</div>
    </section>
    <section class="nucleo-timeline-section"><div class="nucleo-timeline-section-title"><span>Histórico e erratas</span><strong>${history.length} registro(s)</strong></div>
      <div class="nucleo-timeline-history">${history.length ? history.map(item => `<article><i class="fa-solid ${item.acao === "errata" ? "fa-file-pen" : "fa-clock-rotate-left"}"></i><div><div><strong>${esc(item.numero_errata || (item.acao === "errata" ? "Errata" : "Alteração"))}</strong><span>${new Date(item.created_at).toLocaleString("pt-BR", { timeZone:"America/Sao_Paulo" })}</span></div><p>${esc(item.motivo)}</p><small>${esc(item.created_by_email || "Usuário autenticado")} · ${Number(item.total_alteracoes || 0)} alteração(ões)</small></div></article>`).join("") : '<div class="nucleo-timeline-empty">Nenhuma alteração auditada.</div>'}</div>
    </section>`;
}

async function openTimeline(id) {
  ensureTimelineModal();
  const modal = $("nucleoTimelineModal");
  const content = $("nucleoTimelineContent");
  modal?.classList.add("show");
  modal?.setAttribute("aria-hidden", "false");
  if (content) content.innerHTML = '<div class="nucleo-timeline-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando cronograma...</div>';
  try {
    const sb = await ensureSession();
    const { data, error } = await sb.rpc("get_monitoramento_cronograma", { p_monitoramento_id:id });
    if (error) throw error;
    renderTimeline(data);
  } catch (error) {
    if (content) content.innerHTML = `<div class="nucleo-timeline-error">Erro ao carregar cronograma: ${esc(error?.message || error)}</div>`;
  }
}

async function loadSummary(force = false) {
  ensureKpis();
  const button = $("nucleoOperationalRefresh");
  if (button) button.disabled = true;
  try {
    const sb = await ensureSession();
    const { data, error } = await sb.rpc("get_nucleo_cronograma_resumo");
    if (error) throw error;
    state.summary = Array.isArray(data) ? data : [];
    renderKpis();
    decorateRows();
  } catch (error) {
    console.error("Erro ao carregar resumo da Equipe Núcleo:", error);
    const grid = $("nucleoKpiGrid");
    if (grid) grid.innerHTML = `<div class="nucleo-summary-error">Não foi possível carregar os alertas: ${esc(error?.message || error)}</div>`;
  } finally {
    if (button) button.disabled = false;
  }
}

function installScopedObserver() {
  const body = $("nucleoRows");
  if (!body) return;
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled || state.decorating) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; decorateRows(); });
  });
  observer.observe(body, { childList:true });
}

export function initNucleoOperationalEnhancements() {
  if (state.initialized) return;
  state.initialized = true;
  ensureKpis();
  ensureTimelineModal();
  installScopedObserver();
  loadSummary();
  document.addEventListener("agsus:nucleo-cronograma-saved", () => loadSummary(true));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && $("nucleoTimelineModal")?.classList.contains("show")) closeTimeline(); });
}
