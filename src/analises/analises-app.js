import { getSupabaseClient } from "../lib/supabaseClient.js";

// Chave pública (anon/publishable). A proteção real depende das policies RLS e dos RPCs no Supabase.
const VIEW_NAME_ATIVOS = "vw_analises_dashboard_base";
const VIEW_NAME_TODOS = "vw_analises_dashboard_base_todos";
const ANALISES_DASHBOARD_PAYLOAD_RPC = "get_analises_dashboard_payload_v2";
const THEME_KEY = "agsus_analises_theme_v3";
const RPC_ACCESS_LOG = "registrar_evento_acesso";
const APP_VERSION = "institucional-2026-06-09";
const CACHE_KEY = "agsus_analises_cache_v1";
const CACHE_SCHEMA_VERSION = 4;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const DASHBOARD_PAYLOAD_TIMEOUT_MS = 12000;
const ACCESS_HEARTBEAT_MS = 5 * 60 * 1000;
let sb,
  session,
  profile,
  canReadAnalisesRpc = null;
let rows = [],
  editais = [],
  baseFilteredRows = [],
  panelRows = [],
  tableRows = [];
let analisesPayload = null;
let tableRowsDirty = true;
let filterOptionsSignature = "";
let dataSourceMeta = { source: "none", ts: 0 };
const multiSelectState = {};
let currentPage = 1,
  rowsPerPage = 25,
  activeKpi = "total",
  activeResponsavel = "";
let charts = {},
  expanded = new Set();
let panelBootstrapPromise = null;
let accessHeartbeatHandle = null;
let activeRefreshPromise = null;
let refreshRunCounter = 0;
let lastTrackedOpenKey = "";
let analisesDataLoadedAtLeastOnce = false;

const $ = (id) => document.getElementById(id);
const txt = (v) => String(v ?? "").trim();
const norm = (v) =>
  txt(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
const attr = (v) => esc(v).replaceAll("`", "&#096;");
const num = (v) => {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
};
const fmt = (v) => num(v).toLocaleString("pt-BR");
const fmtNum = fmt;
function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error((label || "Operação") + " excedeu o tempo limite.")),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ---- Escopo do processo seletivo: Ativo, Inativo ou Todos ----
function currentEditalScope() {
  const value = txt($("fSituacaoEdital")?.value).toLowerCase();
  return ["ativo", "inativo", "todos"].includes(value) ? value : "ativo";
}

function currentEditalScopeLabel() {
  return (
    { ativo: "Ativo", inativo: "Inativo", todos: "Todos" }[
      currentEditalScope()
    ] || "Ativo"
  );
}

function currentViewName() {
  return currentEditalScope() === "ativo" ? VIEW_NAME_ATIVOS : VIEW_NAME_TODOS;
}

function currentScopeQueryOptions() {
  return currentEditalScope() === "inativo" ? { editalAtivo: false } : {};
}

function currentCacheKey() {
  const userId = txt(session?.user?.id) || "anonymous";
  return `${CACHE_KEY}_v${CACHE_SCHEMA_VERSION}_${userId}_${currentEditalScope()}`;
}

function resetDataForScopeChange() {
  analisesPayload = null;
  rows = [];
  editais = [];
  baseFilteredRows = [];
  panelRows = [];
  tableRows = [];
  tableRowsDirty = true;
  filterOptionsSignature = "";
  dataSourceMeta = { source: "none", ts: 0 };
  expanded.clear();
  currentPage = 1;
  activeKpi = "total";
  activeResponsavel = "";
  analisesDataLoadedAtLeastOnce = false;
}

// ---- Validação de URL: só permite links http(s) seguros vindos da base ----
function safeUrl(value) {
  const raw = txt(value);
  if (!raw) return "";
  try {
    const u = new URL(raw, window.location.href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch (e) {
    return "";
  }
}

const dateObj = (v) => {
  if (!v) return null;
  const raw = txt(v);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Formato não reconhecido: evita interpretação ambígua MM/DD vs DD/MM.
  console.warn("Formato de data não reconhecido, ignorado:", raw);
  return null;
};
const fmtDate = (v) => {
  const d = dateObj(v);
  return d ? d.toLocaleDateString("pt-BR") : txt(v);
};
const fmtDateTime = (v) => {
  const d = dateObj(v);
  return d ? d.toLocaleString("pt-BR") : txt(v);
};
const debounce = (fn, wait = 180) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};
const rpcFirst = (data) =>
  Array.isArray(data) ? data[0] || null : data || null;

// ---- Toasts para feedback ao usuário ----
function toast(message, kind = "info", ms = 5200) {
  const host = $("toastHost");
  if (!host) return;
  const el = document.createElement("div");
  el.className =
    "toast" + (kind === "warn" ? " warn" : kind === "error" ? " error" : "");
  const icon =
    kind === "error"
      ? "fa-circle-exclamation"
      : kind === "warn"
        ? "fa-triangle-exclamation"
        : "fa-circle-info";
  el.innerHTML = `<i class="fa-solid ${icon}" style="margin-top:2px"></i><span>${esc(message)}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 220);
  }, ms);
}

function getClientSessionId() {
  try {
    const key = "agsus_analises_client_session_id";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch (e) {
    return `${Date.now()}-fallback`;
  }
}

async function trackAccess(evento, options = {}) {
  if (!sb || !session?.user?.id || !evento) return;
  try {
    await sb.rpc(RPC_ACCESS_LOG, {
      p_evento: evento,
      p_tela: options.tela ?? "analises",
      p_origem: "analises",
      p_detalhes: options.detalhes ?? {},
      p_client_session_id: getClientSessionId(),
      p_user_agent: navigator.userAgent || "",
      p_app_version: APP_VERSION,
    });
  } catch (error) {
    console.warn(
      "Falha ao registrar auditoria de acesso no painel de análises:",
      error,
    );
  }
}

function stopAccessHeartbeat() {
  if (accessHeartbeatHandle) {
    clearInterval(accessHeartbeatHandle);
    accessHeartbeatHandle = null;
  }
}
function startAccessHeartbeat() {
  stopAccessHeartbeat();
  if (!session?.user?.id) return;
  accessHeartbeatHandle = setInterval(() => {
    trackAccess("heartbeat", {
      detalhes: {
        current_page: currentPage,
        active_kpi: activeKpi,
        active_responsavel: activeResponsavel,
      },
    });
  }, ACCESS_HEARTBEAT_MS);
}

function resetPanelState() {
  session = null;
  profile = null;
  canReadAnalisesRpc = null;
  rows = [];
  editais = [];
  baseFilteredRows = [];
  panelRows = [];
  tableRows = [];
  tableRowsDirty = true;
  currentPage = 1;
  activeKpi = "total";
  activeResponsavel = "";
  analisesDataLoadedAtLeastOnce = false;
  analisesPayload = null;
  filterOptionsSignature = "";
  dataSourceMeta = { source: "none", ts: 0 };
  stopAccessHeartbeat();
  lastTrackedOpenKey = "";
}

function hideAuth() {
  $("authWarning").hidden = true;
  $("authWarning").textContent = "";
}
function currentOpenAuditKey() {
  return [session?.user?.id || "", getClientSessionId(), APP_VERSION].join("|");
}

async function bootstrapPanel(nextSession, options = {}) {
  const reloadData = options.reloadData !== false;
  const trackOpen = options.trackOpen !== false;
  session = nextSession || null;
  if (!session) {
    resetPanelState();
    showAuth(
      "Sessão não localizada. Abra este painel pelo menu do AgSUS Monitora para compartilhar a sessão do Supabase Auth.",
    );
    return false;
  }
  await loadProfile();
  await loadAnalisesPermission();
  if (!canReadAnalises()) {
    await trackAccess("acesso_negado", {
      detalhes: { motivo: "usuario_sem_permissao_analises" },
    });
    showAuth(
      "Seu usuário não possui permissão para visualizar o painel de Análises Curriculares.",
    );
    return false;
  }
  hideAuth();
  if (reloadData) await loadFromCacheOrPrompt();
  if (trackOpen) {
    const openKey = currentOpenAuditKey();
    if (openKey && openKey !== lastTrackedOpenKey) {
      await trackAccess("abertura_tela", {
        detalhes: { reload_data: reloadData },
      });
      lastTrackedOpenKey = openKey;
    }
  }
  startAccessHeartbeat();
  return true;
}

window.addEventListener("agsus:background-suspend", () => {
  stopAccessHeartbeat();
});
window.addEventListener("agsus:background-resume", () => {
  if (session?.user?.id) startAccessHeartbeat();
});

document.addEventListener("DOMContentLoaded", boot);
async function boot() {
  applyTheme();
  setupFixedTopbar();
  bindEvents();
  setProgress(6, "Preparando sessão...");
  showLoading(true);
  try {
    sb = getSupabaseClient();
    if (!sb)
      throw new Error(
        "Não foi possível iniciar a conexão segura com o Supabase.",
      );

    sb.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        resetPanelState();
        showAuth(
          "Sessão encerrada. Reabra o painel pelo menu do AgSUS Monitora.",
        );
        return;
      }
      if (event === "TOKEN_REFRESHED") {
        session = nextSession || null;
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        panelBootstrapPromise = bootstrapPanel(nextSession, {
          reloadData: true,
          trackOpen: true,
        }).catch((err) => {
          showAuth(
            "Falha ao atualizar painel: " +
              (err && err.message ? err.message : err),
          );
        });
      }
    });
    const res = await sb.auth.getSession();
    panelBootstrapPromise = bootstrapPanel(res.data && res.data.session, {
      reloadData: true,
      trackOpen: true,
    });
    await panelBootstrapPromise;
  } catch (err) {
    showAuth(
      "Falha ao iniciar painel: " + (err && err.message ? err.message : err),
    );
  } finally {
    showLoading(false);
  }
}

function bindEvents() {
  $("themeBtn").onclick = toggleTheme;
  $("fullBtn").onclick = toggleFullscreen;
  $("refreshBtn").onclick = manualRefresh;
  $("exportBtn").onclick = exportCSV;
  // A visibilidade dos filtros e o botão Mais opções pertencem apenas a
  // analises-filter-layout.js. Ter dois donos deixava o painel incoerente no
  // carregamento: o corpo abria aqui, mas o botão continuava escondido lá.
  $("applyBtn").onclick = applyFilters;
  $("clearBtn").onclick = clearFilters;
  $("fSituacaoEdital")?.addEventListener("change", () => {
    resetDataForScopeChange();
    loadFromCacheOrPrompt().catch((err) => {
      showAuth(
        "Erro ao carregar processos " +
          currentEditalScopeLabel().toLowerCase() +
          ": " +
          (err && err.message ? err.message : err),
      );
    });
  });
  [
    "fUnidade",
    "fEdital",
    "fVaga",
    "fStatus",
    "fResponsavel",
    "fCategoria",
    "fModalidade",
    "fPdf",
    "fValidacao",
  ].forEach((id) =>
    $(id)?.addEventListener("change", () => {
      currentPage = 1;
      applyFilters();
    }),
  );
  $("fBusca").addEventListener(
    "input",
    debounce(() => {
      currentPage = 1;
      applyFilters();
    }),
  );
  $("tableSearch").addEventListener(
    "input",
    debounce(() => {
      currentPage = 1;
      tableRowsDirty = true;
      renderTable();
    }),
  );
  $("rowsPerPage").addEventListener("change", () => {
    rowsPerPage = Number($("rowsPerPage").value) || 25;
    currentPage = 1;
    renderTable();
  });
  $("firstBtn").onclick = () => goPage(1);
  $("prevBtn").onclick = () => goPage(currentPage - 1);
  $("nextBtn").onclick = () => goPage(currentPage + 1);
  $("lastBtn").onclick = () =>
    goPage(Math.ceil(getTableRows().length / rowsPerPage));
  document.querySelectorAll("[data-kpi]").forEach((card) =>
    card.addEventListener("click", () => {
      activeKpi = activeKpi === card.dataset.kpi ? "total" : card.dataset.kpi;
      currentPage = 1;
      applyFilters();
    }),
  );
  document.addEventListener("click", (event) => {
    document
      .querySelectorAll(".multi-select-menu:not([hidden])")
      .forEach((menu) => {
        const root = menu.closest(".multi-select");
        if (root && !root.contains(event.target))
          closeMultiSelect(root.dataset.sourceId);
      });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document
        .querySelectorAll(".multi-select-menu:not([hidden])")
        .forEach((menu) => {
          const root = menu.closest(".multi-select");
          if (root) {
            closeMultiSelect(root.dataset.sourceId);
            const trg = $(`ms-trigger-${root.dataset.sourceId}`);
            if (trg) trg.focus();
          }
        });
    }
  });
  window.addEventListener("resize", setupFixedTopbar);
}

async function loadProfile() {
  const { data, error } = await sb.rpc("meu_usuario");
  if (error)
    throw new Error(
      "Não foi possível carregar o perfil do usuário pelo RPC meu_usuario().",
    );
  const row = rpcFirst(data);
  profile = row ? { ...row, ativo: true } : null;
  if (!profile)
    throw new Error(
      "Usuário autenticado sem perfil ativo liberado para este painel.",
    );
}
async function loadAnalisesPermission() {
  const { data, error } = await sb.rpc("usuario_pode_ler_analises");
  if (error) {
    canReadAnalisesRpc = null;
    return;
  }
  canReadAnalisesRpc = Array.isArray(data) ? Boolean(data[0]) : Boolean(data);
}
function canReadAnalisesFromProfile() {
  if (!profile || profile.ativo === false) return false;
  if (norm(profile.perfil) === "master") return true;
  return (
    profile.p_paineis === true ||
    profile.p_ind === true ||
    profile.p_config === true ||
    profile.p_admin === true
  );
}
function canReadAnalises() {
  return canReadAnalisesRpc === null
    ? canReadAnalisesFromProfile()
    : canReadAnalisesRpc;
}
function showAuth(message) {
  showLoading(false);
  $("authWarning").hidden = false;
  $("authWarning").textContent = message;
}
function showLoading(show) {
  $("loading").classList.toggle("show", !!show);
}
function setProgress(value, text) {
  $("progressBar").style.width = Math.max(0, Math.min(100, value)) + "%";
  $("loadingText").textContent = text || "";
}

function setupFixedTopbar() {
  const bar = $("topbar");
  if (!bar) return;
  document.documentElement.style.setProperty(
    "--topbar-height",
    `${bar.offsetHeight}px`,
  );
}
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(setupFixedTopbar).catch(() => {});
}
setTimeout(setupFixedTopbar, 250);

// ---------------- Multi-select (com navegação por teclado) ----------------
function ensureMultiSelect(id) {
  const select = $(id);
  if (!select || $(`ms-${id}`)) return;
  select.classList.add("filter-select-native");
  const root = document.createElement("div");
  root.className = "multi-select";
  root.id = `ms-${id}`;
  root.dataset.sourceId = id;
  root.innerHTML = `
      <button type="button" class="multi-select-trigger" id="ms-trigger-${id}" aria-haspopup="listbox" aria-expanded="false">
        <span class="multi-select-label" id="ms-label-${id}"></span>
        <span class="multi-select-count" id="ms-count-${id}" hidden>0</span>
        <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
      </button>
      <div class="multi-select-menu" id="ms-menu-${id}" hidden>
        <input type="search" class="multi-select-search" id="ms-search-${id}" placeholder="Buscar..." autocomplete="off" aria-label="Buscar opções">
        <div class="multi-select-actions"><button type="button" class="multi-select-link" id="ms-all-${id}">Selecionar visíveis</button><button type="button" class="multi-select-link" id="ms-clear-${id}">Limpar</button></div>
        <div class="multi-select-options" id="ms-options-${id}" role="listbox" aria-multiselectable="true"></div>
      </div>`;
  select.insertAdjacentElement("afterend", root);
  $(`ms-trigger-${id}`).addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMultiSelect(id);
  });
  $(`ms-trigger-${id}`).addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if ($(`ms-menu-${id}`).hidden) toggleMultiSelect(id);
      moveOptionFocus(id, 0);
    }
  });
  $(`ms-search-${id}`).addEventListener("click", (e) => e.stopPropagation());
  $(`ms-search-${id}`).addEventListener("input", (e) => {
    multiSelectState[id].search = e.target.value || "";
    renderMultiSelectOptions(id);
  });
  $(`ms-search-${id}`).addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveOptionFocus(id, 0);
    }
  });
  $(`ms-all-${id}`).addEventListener("click", (e) => {
    e.stopPropagation();
    selectVisibleOptions(id);
  });
  $(`ms-clear-${id}`).addEventListener("click", (e) => {
    e.stopPropagation();
    multiSelectState[id].selected = [];
    renderMultiSelect(id);
    currentPage = 1;
    applyFilters();
  });
}
function moveOptionFocus(id, index) {
  const opts = $(`ms-options-${id}`)?.querySelectorAll(".multi-select-option");
  if (!opts || !opts.length) return;
  const i = Math.max(0, Math.min(index, opts.length - 1));
  opts.forEach((o) => o.classList.remove("is-active"));
  opts[i].classList.add("is-active");
  opts[i].dataset.idx = i;
  const input = opts[i].querySelector("input");
  if (input) input.focus();
}
function toggleMultiSelect(id) {
  document
    .querySelectorAll(".multi-select-menu:not([hidden])")
    .forEach((menu) => {
      const root = menu.closest(".multi-select");
      if (root && root.dataset.sourceId !== id)
        closeMultiSelect(root.dataset.sourceId);
    });
  const menu = $(`ms-menu-${id}`),
    trigger = $(`ms-trigger-${id}`);
  if (!menu) return;
  const open = menu.hidden;
  menu.hidden = !open;
  if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    const search = $(`ms-search-${id}`);
    if (search) setTimeout(() => search.focus(), 0);
  }
}
function closeMultiSelect(id) {
  const menu = $(`ms-menu-${id}`),
    trigger = $(`ms-trigger-${id}`);
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}
function renderMultiSelect(id) {
  renderMultiSelectTrigger(id);
  renderMultiSelectOptions(id);
}
function renderMultiSelectTrigger(id) {
  const state = multiSelectState[id] || { selected: [], placeholder: "Todos" };
  const label = $(`ms-label-${id}`),
    count = $(`ms-count-${id}`);
  if (!label) return;
  const selected = state.selected || [];
  label.textContent = selected.length
    ? selected.length <= 2
      ? selected.map((v) => displayOptionLabel(id, v)).join(", ")
      : `${selected.length} opções selecionadas`
    : state.placeholder || "Todos";
  if (count) {
    count.hidden = !selected.length;
    count.textContent = selected.length;
  }
}
function renderMultiSelectOptions(id) {
  const state = multiSelectState[id] || {
    options: [],
    selected: [],
    search: "",
  };
  const wrap = $(`ms-options-${id}`);
  if (!wrap) return;
  const selected = new Set((state.selected || []).map(norm));
  const q = norm(state.search || "");
  const visible = (state.options || []).filter(
    (v) =>
      !q || norm(displayOptionLabel(id, v)).includes(q) || norm(v).includes(q),
  );
  if (!visible.length) {
    wrap.innerHTML = `<div class="multi-select-empty">Nenhuma opção encontrada.</div>`;
    return;
  }
  wrap.innerHTML = visible
    .map(
      (v, i) =>
        `<label class="multi-select-option" role="option" aria-selected="${selected.has(norm(v))}" data-idx="${i}" title="${attr(displayOptionLabel(id, v))}"><input type="checkbox" value="${attr(v)}" ${selected.has(norm(v)) ? "checked" : ""}><span>${esc(displayOptionLabel(id, v))}</span></label>`,
    )
    .join("");
  wrap.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const value = e.target.value;
      const current = new Map((state.selected || []).map((v) => [norm(v), v]));
      if (e.target.checked) current.set(norm(value), value);
      else current.delete(norm(value));
      state.selected = [...current.values()].sort((a, b) =>
        displayOptionLabel(id, a).localeCompare(
          displayOptionLabel(id, b),
          "pt-BR",
          { numeric: true },
        ),
      );
      renderMultiSelect(id);
      currentPage = 1;
      applyFilters();
    });
    input.addEventListener("keydown", (e) => {
      const labels = [...wrap.querySelectorAll(".multi-select-option")];
      const here = labels.indexOf(input.closest(".multi-select-option"));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveOptionFocus(id, here + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (here <= 0) {
          $(`ms-search-${id}`)?.focus();
        } else moveOptionFocus(id, here - 1);
      }
    });
  });
}
function selectVisibleOptions(id) {
  const state = multiSelectState[id];
  if (!state) return;
  const q = norm(state.search || "");
  const current = new Map((state.selected || []).map((v) => [norm(v), v]));
  (state.options || [])
    .filter(
      (v) =>
        !q ||
        norm(displayOptionLabel(id, v)).includes(q) ||
        norm(v).includes(q),
    )
    .forEach((v) => current.set(norm(v), v));
  state.selected = [...current.values()].sort((a, b) =>
    displayOptionLabel(id, a).localeCompare(
      displayOptionLabel(id, b),
      "pt-BR",
      { numeric: true },
    ),
  );
  renderMultiSelect(id);
  currentPage = 1;
  applyFilters();
}

// ---------------- Janelas de edital / validação ----------------
function hydrateRowsWithEditalWindows(sourceRows) {
  return (sourceRows || []).map((r) => {
    const row = Object.assign({}, r);
    const meta = resolveEditalMeta(row);
    if (meta) {
      if (!txt(row.data_inicio_analise))
        row.data_inicio_analise = meta.data_inicio_analise;
      if (!txt(row.data_fim_analise))
        row.data_fim_analise = meta.data_fim_analise;
      row.edital_meta_match =
        row.edital_meta_match || meta.__match || "frontend";
    }
    const validation = computeWindowValidation(row);
    row.data_validacao_status = validation.status;
    row.data_validacao_label = validation.label;
    row.fora_periodo_analise = validation.outside ? "SIM" : "NAO";
    row.__filter_search = norm(
      [
        row.grupo,
        row.unidade,
        row.edital,
        row.codigo_vaga,
        row.nome_vaga,
        row.candidato,
        row.responsavel_analise,
        row.status_consolidado,
        row.analise,
        row.categoria,
        row.modalidade_concorrencia,
      ].join(" "),
    );
    row.__table_search = norm(
      [
        row.grupo,
        row.unidade,
        row.edital,
        row.codigo_vaga,
        row.nome_vaga,
        row.candidato,
        row.status_consolidado,
        row.etapa,
        row.responsavel_analise,
        row.analise,
        row.modalidade_concorrencia,
      ].join(" "),
    );
    return row;
  });
}
function editalKey(grupo, unidade, edital) {
  return [norm(grupo), norm(unidade), norm(edital)].join("|");
}
function isActiveEdital(meta) {
  return ["sim", "s", "ativo", "1", "true", "x"].includes(
    norm(meta && meta.ativo),
  );
}
function resolveEditalMeta(row) {
  const list = editais || [];
  const fullKey = editalKey(row.grupo, row.unidade, row.edital);
  let exact = list.find(
    (e) => editalKey(e.grupo, e.unidade, e.edital) === fullKey,
  );
  if (exact) return Object.assign({ __match: "full" }, exact);
  const unitMatches = list.filter(
    (e) =>
      norm(e.unidade) === norm(row.unidade) &&
      norm(e.edital) === norm(row.edital),
  );
  if (unitMatches.length === 1)
    return Object.assign({ __match: "unit_edital" }, unitMatches[0]);
  const editalMatches = list.filter((e) => norm(e.edital) === norm(row.edital));
  const active = editalMatches.filter(isActiveEdital);
  if (active.length === 1)
    return Object.assign({ __match: "edital_ativo_unico" }, active[0]);
  if (editalMatches.length === 1)
    return Object.assign({ __match: "edital_unico" }, editalMatches[0]);
  return null;
}
function computeWindowValidation(row) {
  const analysisDate = dateObj(row.data_analise);
  const startDate = dateObj(row.data_inicio_analise);
  const endDate = dateObj(row.data_fim_analise);
  if (!analysisDate)
    return {
      outside: false,
      status: "SEM_DATA",
      label: "Sem data de análise informada",
    };
  if (!startDate && !endDate)
    return {
      outside: false,
      status: "SEM_JANELA",
      label: "Sem janela configurada no edital",
    };
  if (
    (startDate && analysisDate < startDate) ||
    (endDate && analysisDate > endDate)
  )
    return {
      outside: true,
      status: "FORA_PERIODO",
      label: "Fora do período configurado",
    };
  return {
    outside: false,
    status: "DENTRO_PERIODO",
    label: "Dentro do período configurado",
  };
}

// ---------------- Cache local (30 min) ----------------
function readCache() {
  try {
    const raw = localStorage.getItem(currentCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.version !== CACHE_SCHEMA_VERSION ||
      !parsed.ts ||
      !Array.isArray(parsed.rows)
    )
      return null;
    return parsed;
  } catch (e) {
    return null;
  }
}
function writeCache(rawRows, rawEditais, payload) {
  try {
    localStorage.setItem(
      currentCacheKey(),
      JSON.stringify({
        version: CACHE_SCHEMA_VERSION,
        ts: Date.now(),
        rows: rawRows,
        editais: rawEditais,
        payload: payload || null,
      }),
    );
  } catch (e) {
    console.warn("Não foi possível gravar o cache local:", e);
  }
}
function cacheAgeMs(cache) {
  return cache && cache.ts ? Date.now() - cache.ts : Infinity;
}
function setUpdatedFromCache(ts) {
  const label = `Cache de ${fmtDateTime(new Date(ts).toISOString())}`;
  $("updatedText").textContent = label;
  $("footerUpdated").textContent = label;
}

// Carrega do cache se válido (< 30 min). Se não houver cache, busca automaticamente no Supabase.
async function loadFromCacheOrPrompt() {
  if (analisesDataLoadedAtLeastOnce && rows.length) {
    return true;
  }
  const cache = readCache();
  if (cache && cacheAgeMs(cache) < CACHE_TTL_MS) {
    editais = Array.isArray(cache.editais) ? cache.editais : [];
    analisesPayload = cache.payload || null;
    rows = hydrateRowsWithEditalWindows(
      Array.isArray(cache.rows) ? cache.rows : [],
    );
    filterOptionsSignature = "";
    dataSourceMeta = { source: "cache", ts: cache.ts };
    hydrateFilters();
    currentPage = 1;
    applyFilters();
    analisesDataLoadedAtLeastOnce = true;
    const mins = Math.round(cacheAgeMs(cache) / 60000);
    setUpdatedFromCache(cache.ts);
    toast(
      `Dados ${currentEditalScopeLabel().toLowerCase()} carregados do cache local (${mins} min). Clique em Atualizar para buscar dados novos.`,
      "info",
      6000,
    );
    return true;
  }
  $("updatedText").textContent = "Carregando dados...";
  $("footerUpdated").textContent = "Carregando dados...";
  toast(
    `Carregando dados ${currentEditalScopeLabel().toLowerCase()} do Supabase.`,
    "info",
    4000,
  );
  return refreshData();
}

// Atualização manual: sempre busca dados novos do Supabase (ignora cache) e regrava o cache.
async function manualRefresh() {
  if (!canReadAnalises()) {
    toast("Sem permissão ou sessão para atualizar os dados.", "error", 6000);
    return;
  }
  await refreshData();
}

// ---------------- Leitura paginada do Supabase ----------------
const SUPABASE_PAGE_SIZE = 1000;
async function fetchAllSupabaseRows(
  tableName,
  columns,
  orderSpecs,
  options = {},
) {
  const allRows = [];
  let from = 0;
  const orders = Array.isArray(orderSpecs) ? orderSpecs : [];
  while (true) {
    let query = sb
      .from(tableName)
      .select(columns)
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (options.editalAtivo !== undefined) {
      query = query.eq("edital_ativo", options.editalAtivo);
    }
    orders.forEach((spec) => {
      query = query.order(spec.column, { ascending: spec.ascending !== false });
    });
    const response = await query;
    if (response.error) {
      return { data: allRows, error: response.error };
    }
    const batch = Array.isArray(response.data) ? response.data : [];
    allRows.push(...batch);
    if (batch.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
    setProgress(
      Math.min(34, 14 + Math.floor(allRows.length / 1000) * 6),
      `Carregando Supabase... ${fmtNum(allRows.length)} registros`,
    );
    if (from > 200000) {
      return {
        data: allRows,
        error: new Error(
          "Limite de segurança de 200 mil registros atingido na leitura paginada.",
        ),
      };
    }
  }
  return { data: allRows, error: null };
}

async function loadAnalisesPayload() {
  return null;
}

async function refreshData() {
  if (activeRefreshPromise) return activeRefreshPromise;
  const runId = ++refreshRunCounter;
  activeRefreshPromise = (async () => {
    showLoading(true);
    setProgress(12, "Consultando Supabase em lotes...");
    const payloadResponse = await loadAnalisesPayload();
    if (runId !== refreshRunCounter) return false;
    analisesPayload = payloadResponse || null;

    if (analisesPayload && Array.isArray(analisesPayload.rows)) {
      const rawBaseRows = analisesPayload.rows;
      editais = Array.isArray(analisesPayload.editais)
        ? analisesPayload.editais
        : [];
      setProgress(
        42,
        `Montando painel a partir do cache consolidado para ${fmtNum(rawBaseRows.length)} registros...`,
      );
      writeCache(rawBaseRows, editais, analisesPayload);
      rows = hydrateRowsWithEditalWindows(rawBaseRows);
      filterOptionsSignature = "";
      dataSourceMeta = {
        source:
          analisesPayload.cache && analisesPayload.cache.hit
            ? "supabase-cache"
            : "supabase-refresh",
        ts:
          Date.parse(
            analisesPayload.cache?.refreshed_at || analisesPayload.generated_at,
          ) || Date.now(),
      };
      analisesDataLoadedAtLeastOnce = true;
      hydrateFilters();
      setProgress(62, "Calculando indicadores...");
      currentPage = 1;
      applyFilters();
      setUpdatedAt();
      setProgress(100, `Painel pronto com ${fmtNum(rows.length)} registros.`);
      setTimeout(() => showLoading(false), 180);
      toast(
        `Dados ${currentEditalScopeLabel().toLowerCase()} atualizados pelo cache consolidado: ${fmtNum(rows.length)} registros.`,
        "info",
        5000,
      );
      return true;
    }

    setProgress(
      12,
      currentEditalScope() === "ativo"
        ? "Cache consolidado indisponível. Consultando Supabase em lotes..."
        : "Consultando Supabase em lotes...",
    );
    const [baseResponse, editaisResponse] = await Promise.all([
      fetchAllSupabaseRows(
        currentViewName(),
        "*",
        [
          { column: "unidade", ascending: true },
          { column: "edital", ascending: true },
          { column: "codigo_vaga", ascending: true },
          { column: "candidato", ascending: true },
        ],
        currentScopeQueryOptions(),
      ),
      fetchAllSupabaseRows(
        "analises_editais",
        "grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise",
        [
          { column: "unidade", ascending: true },
          { column: "edital", ascending: true },
        ],
      ),
    ]);
    if (runId !== refreshRunCounter) return false;
    if (baseResponse.error) {
      showAuth("Erro ao carregar o painel: " + baseResponse.error.message);
      return false;
    }
    if (editaisResponse.error) {
      console.warn(
        "Não foi possível carregar analises_editais:",
        editaisResponse.error.message,
      );
      toast(
        "Janelas oficiais dos editais não puderam ser carregadas. A validação de período pode ficar incompleta.",
        "warn",
        7000,
      );
    }
    setProgress(
      42,
      `Montando filtros e janelas oficiais para ${fmtNum(baseResponse.data.length)} registros...`,
    );
    editais = Array.isArray(editaisResponse.data) ? editaisResponse.data : [];
    const rawBaseRows = Array.isArray(baseResponse.data)
      ? baseResponse.data
      : [];
    writeCache(rawBaseRows, editais, analisesPayload);
    rows = hydrateRowsWithEditalWindows(rawBaseRows);
    filterOptionsSignature = "";
    dataSourceMeta = { source: "supabase", ts: Date.now() };
    analisesDataLoadedAtLeastOnce = true;
    hydrateFilters();
    setProgress(62, "Calculando indicadores...");
    currentPage = 1;
    applyFilters();
    setUpdatedAt();
    setProgress(100, `Painel pronto com ${fmtNum(rows.length)} registros.`);
    setTimeout(() => showLoading(false), 180);
    toast(
      `Dados ${currentEditalScopeLabel().toLowerCase()} atualizados: ${fmtNum(rows.length)} registros carregados.`,
      "info",
      5000,
    );
    return true;
  })();
  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
}

// ---------------- Filtros ----------------
const FILTER_CONFIG = [
  {
    id: "fUnidade",
    placeholder: "Todas as unidades",
    getValues: (row) => [txt(row.unidade)],
  },
  {
    id: "fEdital",
    placeholder: "Todos os editais",
    getValues: (row) => [txt(row.edital)],
  },
  {
    id: "fVaga",
    placeholder: "Todas as vagas",
    getValues: (row) => [txt(row.codigo_vaga)],
  },
  {
    id: "fStatus",
    placeholder: "Todos os status",
    getValues: (row) => [txt(row.status_consolidado)],
  },
  {
    id: "fResponsavel",
    placeholder: "Todos os responsáveis",
    getValues: (row) => [txt(row.responsavel_analise)],
  },
  {
    id: "fCategoria",
    placeholder: "Todas as categorias",
    getValues: (row) => [txt(row.categoria)],
  },
  {
    id: "fModalidade",
    placeholder: "Todas as modalidades",
    getValues: (row) => [txt(row.modalidade_concorrencia)],
  },
  {
    id: "fPdf",
    placeholder: "Todas",
    getValues: (row) => {
      const values = [];
      const status = txt(row.pdf_status).toUpperCase();
      values.push(txt(row.link_pdf) ? "COM_PDF" : "SEM_PDF");
      if (status === "ERRO") values.push("ERRO");
      if (status === "DESATUALIZADO") values.push("DESATUALIZADO");
      return values;
    },
  },
  {
    id: "fValidacao",
    placeholder: "Todas",
    getValues: (row) => [txt(row.data_validacao_status)],
  },
];
const FILTER_IDS = FILTER_CONFIG.map((filter) => filter.id);
const FILTER_CONFIG_MAP = Object.fromEntries(
  FILTER_CONFIG.map((filter) => [filter.id, filter]),
);

function hydrateFilters() {
  refreshFilterOptions();
}
function displayOptionLabel(id, value) {
  const maps = {
    fSituacaoEdital: { ativo: "Ativo", inativo: "Inativo", todos: "Todos" },
    fPdf: {
      COM_PDF: "Com PDF",
      SEM_PDF: "Sem PDF",
      ERRO: "PDF com erro",
      DESATUALIZADO: "PDF desatualizado",
    },
    fValidacao: {
      DENTRO_PERIODO: "Dentro do período",
      FORA_PERIODO: "Fora do período",
      SEM_DATA: "Sem data de análise",
      SEM_JANELA: "Sem janela configurada",
    },
  };
  return (maps[id] && maps[id][value]) || value;
}
function valuesForFilter(id, row) {
  const config = FILTER_CONFIG_MAP[id];
  if (!config) return [];
  return (config.getValues(row) || []).map((v) => txt(v)).filter(Boolean);
}
function optionValues(id, sourceRows) {
  const seen = new Set();
  const values = [];
  (sourceRows || []).forEach((row) => {
    valuesForFilter(id, row).forEach((value) => {
      const key = norm(value);
      if (seen.has(key)) return;
      seen.add(key);
      values.push(value);
    });
  });
  return values.sort((a, b) =>
    displayOptionLabel(id, a).localeCompare(
      displayOptionLabel(id, b),
      "pt-BR",
      { numeric: true },
    ),
  );
}
function matchesSearch(row) {
  const q = norm($("fBusca").value);
  return !q || (row.__filter_search || "").includes(q);
}
function matchConfiguredFilter(row, id, ignoreId = "") {
  if (id === ignoreId) return true;
  const selected = selectedValues(id);
  if (!selected.length) return true;
  const rowValues = valuesForFilter(id, row);
  if (!rowValues.length) return false;
  const selectedSet = new Set(selected.map(norm));
  return rowValues.some((value) => selectedSet.has(norm(value)));
}
function rowMatchesCurrentFilters(row, options = {}) {
  const ignoreId = options.ignoreId || "";
  const includeSearch = options.includeSearch !== false;
  return (
    FILTER_IDS.every((id) => matchConfiguredFilter(row, id, ignoreId)) &&
    (!includeSearch || matchesSearch(row))
  );
}
// Calcula opções de todos os filtros em UMA passada pela base, em vez de N varreduras.
function refreshFilterOptions() {
  const selectedByFilter = Object.fromEntries(
    FILTER_IDS.map((id) => [id, selectedValues(id)]),
  );
  const signature = JSON.stringify({
    rows: rows.length,
    scope: currentEditalScope(),
    selected: selectedByFilter,
    updated: rows
      .map((r) => r.updated_at || r.ultima_atualizacao)
      .filter(Boolean)
      .slice(-3),
  });
  if (signature === filterOptionsSignature) return;
  filterOptionsSignature = signature;

  const selectedSets = Object.fromEntries(
    FILTER_IDS.map((id) => [id, new Set(selectedByFilter[id].map(norm))]),
  );
  const ignoreSets = Object.fromEntries(FILTER_IDS.map((id) => [id, []]));
  rows.forEach((row) => {
    const passes = {};
    FILTER_IDS.forEach((filterId) => {
      const selectedSet = selectedSets[filterId];
      if (!selectedSet.size) {
        passes[filterId] = true;
        return;
      }
      const rowValues = valuesForFilter(filterId, row);
      passes[filterId] =
        rowValues.length > 0 &&
        rowValues.some((value) => selectedSet.has(norm(value)));
    });
    FILTER_IDS.forEach((filterId) => {
      if (
        FILTER_IDS.every((otherId) => otherId === filterId || passes[otherId])
      )
        ignoreSets[filterId].push(row);
    });
  });
  FILTER_CONFIG.forEach((filter) => {
    setOptions(
      filter.id,
      optionValues(filter.id, ignoreSets[filter.id]),
      filter.placeholder,
    );
  });
}
function setOptions(id, values, label) {
  const el = $(id);
  if (!el) return;
  const previous = selectedValues(id);
  const normalized = (values || []).map((v) => txt(v)).filter(Boolean);
  el.innerHTML =
    `<option value="">${esc(label)}</option>` +
    normalized
      .map(
        (v) =>
          `<option value="${attr(v)}">${esc(displayOptionLabel(id, v))}</option>`,
      )
      .join("");
  multiSelectState[id] = multiSelectState[id] || {
    selected: [],
    options: [],
    placeholder: label,
    search: "",
  };
  const allowed = new Set(normalized.map(norm));
  multiSelectState[id].options = normalized;
  multiSelectState[id].placeholder = label;
  multiSelectState[id].selected = previous.filter((v) => allowed.has(norm(v)));
  ensureMultiSelect(id);
  renderMultiSelect(id);
}
function clearFilters() {
  const scopeBeforeClear = currentEditalScope();
  if ($("fSituacaoEdital")) $("fSituacaoEdital").value = "ativo";
  FILTER_IDS.forEach((id) => {
    if (multiSelectState[id]) {
      multiSelectState[id].selected = [];
      multiSelectState[id].search = "";
      renderMultiSelect(id);
    }
    if ($(id)) $(id).value = "";
  });
  ["fBusca", "tableSearch"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  activeKpi = "total";
  activeResponsavel = "";
  currentPage = 1;
  filterOptionsSignature = "";
  if (scopeBeforeClear !== "ativo") {
    resetDataForScopeChange();
    loadFromCacheOrPrompt().catch((err) =>
      showAuth(
        "Erro ao limpar filtros: " + (err && err.message ? err.message : err),
      ),
    );
    return;
  }
  applyFilters();
}
function selectedValues(id) {
  if (multiSelectState[id])
    return (multiSelectState[id].selected || []).slice();
  const el = $(id);
  return el && txt(el.value) ? [txt(el.value)] : [];
}
function selected(id) {
  const vals = selectedValues(id);
  return vals[0] || "";
}
function applyFilters() {
  refreshFilterOptions();
  baseFilteredRows = rows.filter((row) => rowMatchesCurrentFilters(row));
  panelRows = applyVisualFilters(baseFilteredRows);
  tableRowsDirty = true;
  renderAll();
}
function applyVisualFilters(source) {
  const statuses = kpiStatuses(activeKpi);
  return source.filter(
    (r) =>
      (!statuses.length || statuses.includes(txt(r.status_consolidado))) &&
      (!activeResponsavel || txt(r.responsavel_analise) === activeResponsavel),
  );
}
function kpiStatuses(k) {
  const m = {
    total: [],
    analisado: ["Revisar", "Aprovado", "Reprovado"],
    pendente: ["Pendente"],
    revisar: ["Revisar"],
    aprovado: ["Aprovado"],
    reprovado: ["Reprovado"],
  };
  return m[k] || [];
}
function renderAll() {
  renderKpis();
  renderContext();
  renderWindowMeta();
  renderPdfMetrics();
  renderResponsavelChart();
  renderTrendChart();
  renderAttention();
  renderTable();
}
function canUseAnalisesPayload() {
  if (!analisesPayload) return false;
  const hasSelectFilters = FILTER_IDS.some(
    (id) => selectedValues(id).length > 0,
  );
  const hasSearch = txt($("fBusca")?.value) || txt($("tableSearch")?.value);
  return (
    !hasSelectFilters &&
    !hasSearch &&
    activeKpi === "total" &&
    !activeResponsavel
  );
}

function renderKpis() {
  if (canUseAnalisesPayload() && analisesPayload.kpis) {
    const k = analisesPayload.kpis;
    const total = num(k.total_candidatos);
    const apr = num(k.aprovados),
      rep = num(k.reprovados);
    $("kTotal").textContent = fmt(k.total_candidatos);
    $("kAnalisado").textContent = fmt(k.analisados);
    $("kPendente").textContent = fmt(k.pendentes);
    $("kRevisar").textContent = fmt(k.revisar);
    $("kAprovado").textContent = fmt(k.aprovados);
    $("kReprovado").textContent = fmt(k.reprovados);
    $("kTaxa").textContent = total
      ? Math.round(((apr + rep) / total) * 100) + "%"
      : "0%";
    document.querySelectorAll("[data-kpi]").forEach((el) => {
      el.classList.remove("is-active");
      const btn = el.querySelector("button[aria-pressed]");
      if (btn) btn.setAttribute("aria-pressed", "false");
    });
    return;
  }
  const total = panelRows.length,
    pend = panelRows.filter(
      (r) => txt(r.status_consolidado) === "Pendente",
    ).length,
    rev = panelRows.filter(
      (r) => txt(r.status_consolidado) === "Revisar",
    ).length,
    apr = panelRows.filter(
      (r) => txt(r.status_consolidado) === "Aprovado",
    ).length,
    rep = panelRows.filter(
      (r) => txt(r.status_consolidado) === "Reprovado",
    ).length,
    analisado = rev + apr + rep;
  $("kTotal").textContent = fmt(total);
  $("kAnalisado").textContent = fmt(analisado);
  $("kPendente").textContent = fmt(pend);
  $("kRevisar").textContent = fmt(rev);
  $("kAprovado").textContent = fmt(apr);
  $("kReprovado").textContent = fmt(rep);
  $("kTaxa").textContent = total
    ? Math.round(((apr + rep) / total) * 100) + "%"
    : "0%";
  document.querySelectorAll("[data-kpi]").forEach((el) => {
    const on = el.dataset.kpi === activeKpi && activeKpi !== "total";
    el.classList.toggle("is-active", on);
    const btn = el.querySelector("button[aria-pressed]");
    if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
function renderContext() {
  const parts = [`Situação do processo: ${currentEditalScopeLabel()}`];
  [
    ["fUnidade", "Unidade"],
    ["fEdital", "Edital"],
    ["fVaga", "Vaga"],
    ["fStatus", "Status"],
    ["fResponsavel", "Responsável"],
    ["fCategoria", "Categoria"],
    ["fModalidade", "Modalidade"],
    ["fPdf", "PDF"],
    ["fValidacao", "Validação"],
  ].forEach(([id, label]) => {
    const vals = selectedValues(id);
    if (vals.length)
      parts.push(
        `${label}: ${vals.map((v) => displayOptionLabel(id, v)).join(", ")}`,
      );
  });
  if (txt($("fBusca").value)) parts.push(`Busca: ${txt($("fBusca").value)}`);
  if (activeKpi !== "total") parts.push(`KPI: ${activeKpiLabel(activeKpi)}`);
  if (activeResponsavel) parts.push(`Responsável visual: ${activeResponsavel}`);
  $("contextLine").textContent = `Recorte ativo: ${parts.join(" · ")}`;
  $("filterChips").innerHTML = parts
    .map((p) => `<span class="chip-filter"><b>Filtro</b>${esc(p)}</span>`)
    .join("");
}
function activeKpiLabel(k) {
  return (
    {
      analisado: "Análises realizadas",
      pendente: "Pendentes",
      revisar: "Em revisão",
      aprovado: "Aprovados",
      reprovado: "Reprovados",
    }[k] || "Todos"
  );
}
function renderWindowMeta() {
  const map = new Map();
  panelRows.forEach((r) => {
    const s = fmtDate(r.data_inicio_analise),
      e = fmtDate(r.data_fim_analise);
    if (s || e) {
      const key = s + "|" + e;
      if (!map.has(key)) map.set(key, { s, e, c: 0 });
      map.get(key).c++;
    }
  });
  const fora = panelRows.filter(
    (r) => txt(r.data_validacao_status) === "FORA_PERIODO",
  ).length;
  const semJanela = panelRows.filter(
    (r) => txt(r.data_validacao_status) === "SEM_JANELA",
  ).length;
  let html = "";
  if (map.size === 1) {
    const w = [...map.values()][0];
    html += `<span class="meta-chip"><i class="fa-solid fa-calendar-days"></i> Janela oficial: ${esc(w.s || "--")} a ${esc(w.e || "--")}</span>`;
  } else if (map.size > 1) {
    html += `<span class="meta-chip"><i class="fa-solid fa-calendar-days"></i> ${fmt(map.size)} janelas oficiais no recorte</span>`;
  }
  html += `<span class="meta-chip ${fora ? "warning" : ""}"><i class="fa-solid ${fora ? "fa-triangle-exclamation" : "fa-circle-check"}"></i> ${fmt(fora)} análise(s) fora do período</span>`;
  if (semJanela)
    html += `<span class="meta-chip warning"><i class="fa-solid fa-circle-info"></i> ${fmt(semJanela)} sem janela configurada</span>`;
  if (dataSourceMeta.source === "cache") {
    const mins = Math.max(
      0,
      Math.round((Date.now() - dataSourceMeta.ts) / 60000),
    );
    html += `<span class="meta-chip"><i class="fa-solid fa-database"></i> Cache local: ${fmt(mins)} min</span>`;
  } else if (
    dataSourceMeta.source === "supabase-cache" ||
    dataSourceMeta.source === "supabase-refresh"
  ) {
    const mins = Math.max(
      0,
      Math.round((Date.now() - dataSourceMeta.ts) / 60000),
    );
    const label =
      dataSourceMeta.source === "supabase-cache"
        ? "Cache Supabase"
        : "Cache Supabase atualizado";
    html += `<span class="meta-chip"><i class="fa-solid fa-database"></i> ${label}: ${fmt(mins)} min</span>`;
  }
  $("windowMeta").innerHTML = html;
}
function renderPdfMetrics() {
  const com = panelRows.filter((r) => txt(r.link_pdf)).length,
    sem = panelRows.length - com,
    erro = panelRows.filter((r) => norm(r.pdf_status) === "erro").length,
    des = panelRows.filter(
      (r) => norm(r.pdf_status) === "desatualizado",
    ).length;
  $("pdfMetrics").innerHTML =
    `<span class="mini-chip"><i class="fa-solid fa-file-pdf"></i> Com PDF: ${fmt(com)}</span><span class="mini-chip"><i class="fa-regular fa-file"></i> Sem PDF: ${fmt(sem)}</span><span class="mini-chip"><i class="fa-solid fa-triangle-exclamation"></i> Erro: ${fmt(erro)}</span><span class="mini-chip"><i class="fa-solid fa-clock-rotate-left"></i> Desatualizado: ${fmt(des)}</span>`;
}

function statusClass(s) {
  const x = norm(s);
  if (x === "aprovado") return "aprovado";
  if (x === "reprovado") return "reprovado";
  if (x === "revisar") return "revisar";
  if (x === "pendente") return "pendente";
  return "neutro";
}
function palette() {
  const dark = document.documentElement.dataset.theme === "dark";
  return {
    grid: dark ? "rgba(255,255,255,.08)" : "rgba(7,59,121,.09)",
    text: dark ? "#dbe8f5" : "#526780",
    ok: "#2ca25f",
    bad: "#e45757",
    warn: "#e2a400",
    review: "#2f74c0",
    blue: "#0f5db7",
    surface: dark ? "#0f1c2e" : "#fff",
  };
}
function aggregateResponsavel(limit = 12) {
  const map = new Map();
  panelRows.forEach((r) => {
    const label = txt(r.responsavel_analise) || "Sem responsável";
    if (!map.has(label))
      map.set(label, {
        label,
        Pendente: 0,
        Revisar: 0,
        Aprovado: 0,
        Reprovado: 0,
        total: 0,
      });
    const e = map.get(label);
    const s = txt(r.status_consolidado) || "Pendente";
    if (e[s] !== undefined) e[s]++;
    else e.Pendente++;
    e.total++;
  });
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}
function aggregateResponsavelFromPayload(limit = 12) {
  if (
    !canUseAnalisesPayload() ||
    !Array.isArray(analisesPayload.por_responsavel)
  )
    return null;
  return analisesPayload.por_responsavel.slice(0, limit).map((r) => ({
    label: txt(r.responsavel_analise) || "Sem responsável",
    Pendente: num(r.pendentes),
    Revisar: num(r.revisar),
    Aprovado: num(r.aprovados),
    Reprovado: num(r.reprovados),
    total: num(r.total),
  }));
}

// Gráficos: cria uma vez, depois apenas atualiza dados (update) em vez de destruir e recriar.
let respItems = [];
function renderResponsavelChart() {
  respItems = aggregateResponsavelFromPayload() || aggregateResponsavel();
  const p = palette();
  const labels = respItems.map((x) => truncate(x.label, 22));
  const datasets = [
    {
      label: "Pendente",
      key: "Pendente",
      backgroundColor: p.warn,
      borderRadius: 7,
    },
    {
      label: "Revisar",
      key: "Revisar",
      backgroundColor: p.review,
      borderRadius: 7,
    },
    {
      label: "Aprovado",
      key: "Aprovado",
      backgroundColor: p.ok,
      borderRadius: 7,
    },
    {
      label: "Reprovado",
      key: "Reprovado",
      backgroundColor: p.bad,
      borderRadius: 7,
    },
  ].map((d) => ({ ...d, data: respItems.map((x) => x[d.key]) }));
  if (charts.resp) {
    charts.resp.data.labels = labels;
    charts.resp.data.datasets.forEach((ds, i) => {
      ds.data = datasets[i].data;
      ds.backgroundColor = datasets[i].backgroundColor;
    });
    restyleChart(charts.resp, p, true);
    charts.resp.update();
    return;
  }
  charts.resp = new Chart($("chartResponsavel"), {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 380 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { color: p.text, boxWidth: 14, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            title: (c) => respItems[c[0].dataIndex]?.label || "",
            afterBody: (c) => [
              `Total: ${fmt(respItems[c[0].dataIndex]?.total || 0)}`,
            ],
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: p.text, maxRotation: 0 },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: p.text, precision: 0 },
          grid: { color: p.grid },
        },
      },
      onClick: (_, els) => {
        if (!els.length) return;
        const item = respItems[els[0].index];
        activeResponsavel = activeResponsavel === item.label ? "" : item.label;
        currentPage = 1;
        applyFilters();
      },
    },
  });
}
function aggregateDate() {
  const map = new Map();
  panelRows.forEach((r) => {
    const key = fmtDate(r.data_analise);
    if (!key) return;
    if (!map.has(key))
      map.set(key, {
        label: key,
        value: 0,
        out: 0,
        raw: dateObj(r.data_analise),
      });
    const e = map.get(key);
    e.value++;
    if (txt(r.data_validacao_status) === "FORA_PERIODO") e.out++;
  });
  return [...map.values()].sort(
    (a, b) => (a.raw?.getTime() || 0) - (b.raw?.getTime() || 0),
  );
}
function aggregateDateFromPayload() {
  if (
    !canUseAnalisesPayload() ||
    !Array.isArray(analisesPayload.tendencia_diaria)
  )
    return null;
  return analisesPayload.tendencia_diaria
    .map((r) => ({
      label: fmtDate(r.data_analise),
      value: num(r.total_analises),
      out: num(r.fora_periodo),
      raw: dateObj(r.data_analise),
    }))
    .filter((r) => r.label);
}
let trendItems = [];
function renderTrendChart() {
  trendItems = aggregateDateFromPayload() || aggregateDate();
  const p = palette();
  const labels = trendItems.map((x) => x.label);
  const data = trendItems.map((x) => x.value);
  const pointBg = trendItems.map((x) => (x.out ? p.bad : p.blue));
  const pointR = trendItems.map((x) => (x.out ? 5 : 3));
  if (charts.trend) {
    const ds = charts.trend.data.datasets[0];
    charts.trend.data.labels = labels;
    ds.data = data;
    ds.pointBackgroundColor = pointBg;
    ds.pointRadius = pointR;
    ds.borderColor = p.blue;
    restyleChart(charts.trend, p, false);
    charts.trend.update();
    return;
  }
  charts.trend = new Chart($("chartTrend"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Análises",
          data,
          borderColor: p.blue,
          backgroundColor: "rgba(15,93,183,.08)",
          pointBackgroundColor: pointBg,
          pointRadius: pointR,
          borderWidth: 2.5,
          tension: 0.22,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 380 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => `${fmt(c.parsed.y)} análise(s)`,
            afterBody: (c) => {
              const it = trendItems[c[0].dataIndex];
              return it && it.out ? [`${fmt(it.out)} fora do período`] : [];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: p.text, maxRotation: 0 },
          grid: { color: p.grid },
        },
        y: {
          beginAtZero: true,
          ticks: { color: p.text, precision: 0 },
          grid: { color: p.grid },
        },
      },
    },
  });
}
function restyleChart(chart, p, hasLegend) {
  if (chart.options.scales?.x) {
    chart.options.scales.x.ticks.color = p.text;
    if (chart.options.scales.x.grid && chart.options.scales.x.grid.color)
      chart.options.scales.x.grid.color = p.grid;
  }
  if (chart.options.scales?.y) {
    chart.options.scales.y.ticks.color = p.text;
    chart.options.scales.y.grid.color = p.grid;
  }
  if (hasLegend && chart.options.plugins?.legend?.labels) {
    chart.options.plugins.legend.labels.color = p.text;
  }
}

function renderAttention() {
  const items = [];
  const pend = panelRows.filter(
      (r) => txt(r.status_consolidado) === "Pendente",
    ).length,
    rev = panelRows.filter(
      (r) => txt(r.status_consolidado) === "Revisar",
    ).length,
    semResp = panelRows.filter((r) => !txt(r.responsavel_analise)).length,
    semData = panelRows.filter(
      (r) => txt(r.etapa) && !txt(r.data_analise),
    ).length,
    fora = panelRows.filter(
      (r) => txt(r.data_validacao_status) === "FORA_PERIODO",
    ).length,
    erro = panelRows.filter((r) => norm(r.pdf_status) === "erro").length,
    semPdf = panelRows.filter((r) => !txt(r.link_pdf)).length;
  if (fora)
    items.push({
      t: "Data fora do período",
      d: `${fmt(fora)} análise(s) fora da janela oficial do edital.`,
      c: "high",
    });
  if (erro)
    items.push({
      t: "PDF com erro",
      d: `${fmt(erro)} espelho(s) com erro na última tentativa.`,
      c: "high",
    });
  if (semResp)
    items.push({
      t: "Sem responsável",
      d: `${fmt(semResp)} registro(s) sem responsável de análise.`,
      c: "high",
    });
  if (pend)
    items.push({
      t: "Pendentes",
      d: `${fmt(pend)} registro(s) pendentes no recorte atual.`,
      c: "medium",
    });
  if (rev)
    items.push({
      t: "Em revisão",
      d: `${fmt(rev)} registro(s) aguardando revisão.`,
      c: "medium",
    });
  if (semData)
    items.push({
      t: "Etapa sem data",
      d: `${fmt(semData)} registro(s) com etapa, mas sem data de análise.`,
      c: "medium",
    });
  if (semPdf)
    items.push({
      t: "Espelho ausente",
      d: `${fmt(semPdf)} registro(s) sem link de PDF no recorte.`,
      c: "low",
    });
  $("attentionList").innerHTML = items.length
    ? items
        .slice(0, 8)
        .map(
          (x) =>
            `<div class="attention-item ${x.c === "high" ? "high" : x.c === "low" ? "low" : ""}"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div>`,
        )
        .join("")
    : `<div class="empty">Nenhuma pendência prioritária no recorte atual.</div>`;
}

// Cache da fila pesquisada: só recalcula quando dados ou busca mudam.
function getTableRows() {
  if (!tableRowsDirty) return tableRows;
  const q = norm($("tableSearch").value);
  tableRows = panelRows.filter(
    (r) => !q || (r.__table_search || "").includes(q),
  );
  tableRowsDirty = false;
  return tableRows;
}
function renderTable() {
  const visible = getTableRows();
  const pages = Math.max(1, Math.ceil(visible.length / rowsPerPage));
  if (currentPage > pages) currentPage = pages;
  if (currentPage < 1) currentPage = 1;
  const start = (currentPage - 1) * rowsPerPage,
    end = Math.min(start + rowsPerPage, visible.length),
    page = visible.slice(start, end);
  $("tableInfo").textContent = visible.length
    ? `Mostrando ${fmt(start + 1)}-${fmt(end)} de ${fmt(visible.length)} registros pesquisados`
    : "Mostrando 0 de 0 registros";
  $("pageInfo").textContent =
    `Página ${fmt(currentPage)} de ${fmt(pages)} · Recorte atual: ${fmt(panelRows.length)} de ${fmt(rows.length)}`;
  $("tableBody").innerHTML = page.length
    ? page.map((r, i) => rowHtml(r, start + i)).join("")
    : `<tr><td colspan="8" class="empty">Nenhum registro encontrado.</td></tr>`;
  renderPagination(pages);
}
function rowKey(r, i) {
  return [r.id, r.chave_natural, r.codigo_vaga, r.candidato, i]
    .map(txt)
    .join("|");
}
function rowHtml(r, i) {
  const key = rowKey(r, i),
    isOpen = expanded.has(key);
  return `<tr><td>${esc(r.grupo || "-")}</td><td>${esc(r.unidade || "-")}</td><td>${esc(r.edital || "-")}</td><td>${esc(r.codigo_vaga || "-")}</td><td><div class="primary-text">${esc(r.nome_vaga || "-")}</div><span class="secondary-text">${esc(r.categoria || "Sem categoria")}</span></td><td><div class="primary-text">${esc(r.candidato || "-")}</div><span class="secondary-text">${esc(r.responsavel_analise || "Sem responsável")}</span></td><td><span class="badge ${statusClass(r.status_consolidado)}">${esc(r.status_consolidado || "Pendente")}</span></td><td><button class="btn secondary small" aria-expanded="${isOpen}" onclick="toggleDetails('${attr(encodeURIComponent(key))}')"><i class="fa-solid ${isOpen ? "fa-chevron-up" : "fa-chevron-down"}"></i> ${isOpen ? "Ocultar" : "Detalhes"}</button></td></tr>${isOpen ? `<tr class="detail-row"><td colspan="8">${detailHtml(r)}</td></tr>` : ""}`;
}
function detailHtml(r) {
  const origemId = txt(r.origem_arquivo_id);
  const origem = origemId
    ? safeUrl(
        `https://docs.google.com/spreadsheets/d/${encodeURIComponent(origemId)}/edit`,
      )
    : "";
  const pdf = safeUrl(r.link_pdf);
  return `<div class="detail-shell"><div class="detail-grid"><div class="kv"><div class="kv-label">Etapa</div><div class="kv-value">${esc(r.etapa || "-")}</div></div><div class="kv"><div class="kv-label">Data da análise</div><div class="kv-value">${esc(fmtDate(r.data_analise) || "-")}</div></div><div class="kv"><div class="kv-label">Nota final</div><div class="kv-value">${esc(r.nota_final_ajustada ?? "-")}</div></div><div class="kv"><div class="kv-label">Modalidade</div><div class="kv-value">${esc(r.modalidade_concorrencia || "-")}</div></div><div class="kv"><div class="kv-label">Validação</div><div class="kv-value">${esc(validationLabel(r.data_validacao_status))}</div></div><div class="kv"><div class="kv-label">Janela oficial</div><div class="kv-value">${esc(fmtDate(r.data_inicio_analise) || "--")} a ${esc(fmtDate(r.data_fim_analise) || "--")}</div></div><div class="kv"><div class="kv-label">Escolaridade</div><div class="kv-value">${esc(r.pontuacao_escolaridade ?? "-")}</div></div><div class="kv"><div class="kv-label">Cursos</div><div class="kv-value">${esc(r.pontuacao_cursos_aperfeicoamento ?? "-")}</div></div><div class="kv"><div class="kv-label">Experiência profissional</div><div class="kv-value">${esc(r.pontuacao_experiencia_profissional ?? "-")}</div></div><div class="kv"><div class="kv-label">Critério étnico</div><div class="kv-value">${esc(r.pontuacao_criterio_etnico ?? "-")}</div></div><div class="kv"><div class="kv-label">Exp. Saúde Indígena</div><div class="kv-value">${esc(r.experiencia_saude_indigena_total ?? "-")}</div></div><div class="kv"><div class="kv-label">Exp. Atenção Básica</div><div class="kv-value">${esc(r.experiencia_atencao_basica_total ?? "-")}</div></div></div><div class="detail-block"><div class="detail-actions">${origem ? `<a class="btn secondary small" href="${attr(origem)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir origem</a>` : ""}${pdf ? `<a class="btn green small" href="${attr(pdf)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-file-pdf"></i> Abrir PDF</a>` : `<span class="mini-chip"><i class="fa-regular fa-file"></i> Sem PDF</span>`}${txt(r.erro_pdf) ? `<span class="mini-chip" style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(truncate(r.erro_pdf, 80))}</span>` : ""}</div><div class="analysis-text">${esc(r.analise || "Sem análise registrada.")}</div></div></div>`;
}
function toggleDetails(encoded) {
  const key = decodeURIComponent(encoded || "");
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
  renderTable();
}
function validationLabel(v) {
  return (
    {
      DENTRO_PERIODO: "Dentro do período configurado",
      FORA_PERIODO: "Fora do período configurado",
      SEM_DATA: "Sem data de análise informada",
      SEM_JANELA: "Sem janela configurada no edital",
    }[txt(v)] ||
    txt(v) ||
    "-"
  );
}
function renderPagination(pages) {
  const wrap = $("pageNumbers");
  const list = pageWindow(currentPage, pages, 5);
  wrap.innerHTML = list
    .map((p) =>
      p === "..."
        ? `<span style="padding:8px;color:var(--muted)">...</span>`
        : `<button class="page-btn ${p === currentPage ? "active" : ""}" onclick="goPage(${p})">${p}</button>`,
    )
    .join("");
  $("firstBtn").disabled = currentPage <= 1;
  $("prevBtn").disabled = currentPage <= 1;
  $("nextBtn").disabled = currentPage >= pages;
  $("lastBtn").disabled = currentPage >= pages;
}
function pageWindow(page, total, max) {
  if (total <= max + 2) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  let start = Math.max(2, page - 2),
    end = Math.min(total - 1, page + 2);
  if (start > 2) out.push("...");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("...");
  out.push(total);
  return out;
}
function goPage(p) {
  const pages = Math.max(1, Math.ceil(getTableRows().length / rowsPerPage));
  currentPage = Math.max(1, Math.min(p, pages));
  renderTable();
}
function setUpdatedAt() {
  const latest = rows
    .map((r) => r.updated_at || r.ultima_atualizacao)
    .map((value) => ({ value, parsed: dateObj(value) }))
    .filter((item) => item.value && item.parsed)
    .sort((a, b) => a.parsed.getTime() - b.parsed.getTime())
    .pop();
  const label = latest
    ? `Atualizado em ${fmtDateTime(latest.value)}`
    : "Base carregada";
  $("updatedText").textContent = label;
  $("footerUpdated").textContent = label;
}
function truncate(v, n) {
  const s = txt(v);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function applyTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") document.documentElement.dataset.theme = "dark";
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = dark ? "" : "dark";
  if (!dark) localStorage.setItem(THEME_KEY, "dark");
  else localStorage.removeItem(THEME_KEY);
  renderResponsavelChart();
  renderTrendChart();
}
function toggleFullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}
function exportCSV() {
  const source = panelRows;
  const headers = [
    "edital_status",
    "grupo",
    "unidade",
    "edital",
    "codigo_vaga",
    "nome_vaga",
    "candidato",
    "status_consolidado",
    "etapa",
    "data_analise",
    "responsavel_analise",
    "nota_final_ajustada",
    "modalidade_concorrencia",
    "link_pdf",
    "data_validacao_status",
    "analise",
  ];
  const csv = [
    headers.join(";"),
    ...source.map((r) =>
      headers
        .map((h) =>
          String(r[h] ?? "")
            .replaceAll("\n", " ")
            .replaceAll("\r", " ")
            .replaceAll(";", " ")
            .replaceAll('"', "'"),
        )
        .join(";"),
    ),
  ].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "agsus_analises_curriculares_v3.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Exportados ${fmt(source.length)} registros do recorte atual.`, "info");
}
window.toggleDetails = toggleDetails;
window.goPage = goPage;
