import { renderNucleoTable } from "../lib/nucleo-table-render.js";
import { SUPABASE_KEY, SUPABASE_URL } from "../lib/env.js";
import { updateAraraGuide } from "./arara-guide.js";
import {
  getOAuthCallbackUrl,
  isUsableSession,
  LOGIN_POPUP_MESSAGE,
  openLoginPopup,
} from "../lib/auth-flow.js";
import {
  getSupabaseAuthStorage,
  getSupabaseClient,
} from "../lib/supabaseClient.js";
import {
  accessRequestStatusMessage,
  renderAccessRequestAdminItemHTML,
  renderAccessUserAdminItemHTML,
} from "./access-request-ui.js";
import { collectPanelRows, renderPanelAdminHTML } from "./config-ui.js";
import { createAccessDashboard } from "./access-dashboard.js";
import {
  isAllowedInstitutionalEmail,
  normalizeAllowedDomains,
  normalizePlatformContext,
  profileDisplayName,
} from "../lib/platform-context.js";
import {
  DEFAULT_ACCESS_BRANDING,
  needsLightForeground,
  normalizeAccessBackgroundUrl,
  normalizeAccessLogoUrl,
  normalizeAccessPanelColor,
} from "../lib/access-branding.js";
import { normalizeOnlinePresenceList } from "../lib/online-presence.js";
import { reconciliarDsei } from "../lib/reconciliacao-unidades.js";
import {
  agruparCoincidentes,
  agruparPorCelula,
  criarRegistroDeDescarte,
  grupoCoincidente,
  posicoesSpiderfy,
  raioDaBolha,
} from "../lib/mapa-render.js";
import {
  ACCESS_BACKGROUND_BUCKET,
  ACCESS_BACKGROUND_FOLDER,
  createAccessBackgroundPath,
  validateAccessBackgroundFile,
} from "../lib/access-background-storage.js";
import { guardarMarca } from "../lib/access-branding-cache.js";
import {
  SAIDA_DESCONHECIDA,
  SAIDA_MANUAL,
  SAIDA_REVOGADA,
  causaDaSaida,
  declararSaida,
  encerrarTransicaoDeSaida,
  mensagemDaSaida,
  reivindicarSaida,
} from "../lib/estado-de-saida.js";
import { avisoGlobal } from "../lib/aviso-global.js";
import { aplicarCorDoPainel } from "../lib/access-branding-boot.js";
import { normalizarModo } from "../lib/contraste.js";
import {
  aplicarFaviconDaMarca,
  definirPaginaDaAba,
  definirSistemaDaAba,
} from "../lib/identidade-da-aba.js";
import {
  linhasDeConfiguracaoDaSidebar,
  reaplicarSidebarAposSalvar,
} from "./sidebar-branding.js";
import { classificarVinculoTerritorial } from "../lib/uf-ibge.js";
import {
  ESTILO_DA_LINHA,
  TOOLTIP_DA_LINHA,
  classificarRegistros,
  htmlDoMarcador,
  registrosExternos,
  registrosLocais,
  textoDoChip,
  tooltipDoRegistro,
} from "./vinculos-territoriais.js";
import {
  SESSAO_ATIVA,
  ehFalhaTransitoria,
  ehSessaoEncerrada,
  estadoDaSessao,
} from "../lib/sessao.js";
import {
  canViewCore,
  canManageEditais,
  canManageSettings,
  canImportApprovedList,
  isOwnAccessProfile,
  normalizeRole,
  roleLabel,
} from "../lib/access-roles.js";

// ============================================================
// AgSUS Monitora Web V2.9.35
// Melhorias aplicadas nesta versão:
//   - CSS consolidado: 9 blocos → 1 bloco limpo sem conflitos
//   - Debounce na busca: elimina re-renders a cada keystroke
//   - Renderização granular: mapa só re-renderiza quando UF muda
//   - Segurança: grants anon removidos (ver script SQL 03)
//   - Recuperação automática de senha removida; redefinição via administrador
// ============================================================

const APP_VERSION_FALLBACK = "";

const RPC_SAVE_MONITORAMENTO = "salvar_monitoramento_indigena";
const RPC_SAVE_CONFIG = "salvar_configuracoes_e_paineis";
const RPC_ACCESS_LOG = "registrar_evento_acesso";
const RPC_APPROVE_ACCESS_REQUEST = "aprovar_solicitacao_acesso";
const RPC_DENY_ACCESS_REQUEST = "recusar_solicitacao_acesso";
const RPC_UPDATE_USER_ACCESS = "atualizar_acesso_usuario";
const RPC_DEACTIVATE_USER_ACCESS = "desativar_acesso_usuario";
const RPC_PLATFORM_CONTEXT = "obter_contexto_monitora";
const RPC_REGISTER_ONLINE_PRESENCE = "registrar_presenca_monitora";
const RPC_LIST_ONLINE_PRESENCE = "listar_presenca_online_monitora";
const MONITORAMENTO_DASHBOARD_PAYLOAD_RPC =
  "get_monitoramento_dashboard_payload";
const MAPA_CONFIG_TABLE = "mapa_saude_indigena_config";
const DEFAULT_ACCESS_HEARTBEAT_MINUTES = 5;
const DETAILS_TABLE_SOURCE_MODE = "client";
const PASSWORD_RESET_ADMIN_MESSAGE_FALLBACK = "";

const DEFAULT_CONFIG = {
  monit_id: "",
  app_title: "",
  app_slogan: "",
  app_subtitle: "",
  footer_text: "",
  app_version_current: APP_VERSION_FALLBACK,
  page_title: "",
  page_subtitle: "",
  login_eyebrow: "",
  login_email_label: "",
  login_email_placeholder: "",
  login_password_label: "",
  login_password_placeholder: "",
  login_button_text: "",
  password_reset_message: PASSWORD_RESET_ADMIN_MESSAGE_FALLBACK,
  sidebar_user_label: "",
  sidebar_version_label: "",
  logout_text: "",
  filter_title: "",
  filter_subtitle: "",
  filter_toggle_show: "",
  filter_toggle_hide: "",
  feature_realtime_monitoramento: "true",
  access_heartbeat_minutos: String(DEFAULT_ACCESS_HEARTBEAT_MINUTES),
  password_reset_flow: "admin",
  login_bg_url: "",
  login_logo_url: "",
  cogip_nome: "",
  cogip_logo_url: "",
  cogip_funcao: "",
  cogip_versao: "",
  cogip_dept: "",
  broadcast_msg: "",
  broadcast_type: "info",
  loader_initial_title: "",
  loader_initial_subtitle: "",
  loader_environment_title: "",
  loader_environment_subtitle: "",
  loader_config_title: "",
  loader_config_subtitle: "",
  loader_panels_title: "",
  loader_panels_subtitle: "",
  loader_map_title: "",
  loader_map_subtitle: "",
  loader_units_title: "",
  loader_units_subtitle: "",
  loader_data_title: "",
  loader_data_subtitle: "",
  loader_finish_title: "",
  loader_finish_subtitle: "",
  offline_message: "",
  skip_link_text: "",
  password_toggle_label: "",
  sidebar_toggle_label: "",
  external_back_text: "Voltar ao sistema",
  dark_mode_label: "",
  action_export_text: "",
  action_more_label: "",
  action_fullscreen_text: "",
  action_refresh_text: "",
  action_export_pdf_text: "",
  dashboard_section_processos: "",
  kpi_processos_label: "",
  kpi_vagas_label: "",
  kpi_contratados_label: "",
  kpi_ociosas_label: "",
  kpi_criticos_label: "",
  kpi_criticos_chip: "",
  kpi_inscritos_label: "",
  panel_status_summary_title: "",
  panel_operational_status_title: "",
  panel_attention_title: "",
  details_title: "",
  table_search_placeholder: "",
  hide_closed_show: "",
  hide_closed_hide: "",
  columns_button_text: "",
  columns_menu_title: "",
  keyboard_hint: "",
  external_default_title: "",
  external_refresh_text: "",
  external_open_text: "",
  external_placeholder: "",
  maintenance_title: "",
  maintenance_message: "",
  config_nav_title: "",
  config_page_subtitle: "",
  nucleo_nav_title: "",
  nucleo_page_subtitle: "",
  permissions_empty_text: "",
  auth_google_enabled: "true",
  auth_google_button_text: "",
  auth_google_domain_hint: "",
  auth_google_allowed_domains: "agenciasus.org.br,agsus.org.br",
  auth_access_background_url: DEFAULT_ACCESS_BRANDING.backgroundUrl,
  auth_access_background_path: "",
  auth_access_logo_url: DEFAULT_ACCESS_BRANDING.logoUrl,
  auth_access_panel_color: DEFAULT_ACCESS_BRANDING.panelColor,
  auth_access_greeting: DEFAULT_ACCESS_BRANDING.greeting,
  auth_access_instruction: DEFAULT_ACCESS_BRANDING.instruction,
};

const DEFAULT_PANELS = [];

let sb = null;
let authStorage = null;
let currentUser = null;
let profile = null;
let appConfig = {};
let loadedConfigKeys = new Set();
let configLoadOk = false;
let rows = [];
let filtered = [];
let monitoramentoPayload = null;
let unidadesCatalog = [];
let tableSort = { field: "", direction: "" };
const VIEW_STORAGE_KEY = "agsus_monitora_current_view_v268";
const FILTER_CONFIG = [
  { id: "filterUnidade", field: "unidade", label: "Unidade", all: "Todas" },
  { id: "filterEdital", field: "edital", label: "Edital", all: "Todos" },
  { id: "filterEtapa", field: "etapa", label: "Etapa", all: "Todas" },
  { id: "filterStatus", field: "status", label: "Status", all: "Todos" },
  { id: "filterRisco", field: "risco", label: "Risco", all: "Todos" },
  { id: "filterUf", field: "uf", label: "UF", all: "Todas" },
];
const FILTER_ID_TO_FIELD = Object.fromEntries(
  FILTER_CONFIG.map((f) => [f.id, f.field]),
);
let filterState = Object.fromEntries(
  FILTER_CONFIG.map((f) => [f.field, new Set()]),
);
const FILTER_STORAGE_KEY = "agsus_monitora_filters_v1";
function saveFilterState() {
  try {
    const plain = {};
    FILTER_CONFIG.forEach((f) => {
      plain[f.field] = Array.from(filterState[f.field] || []);
    });
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(plain));
  } catch (e) {}
}
function loadFilterState() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return;
    const plain = JSON.parse(raw);
    FILTER_CONFIG.forEach((f) => {
      if (Array.isArray(plain[f.field]))
        filterState[f.field] = new Set(plain[f.field]);
    });
  } catch (e) {}
}
let panels = [...DEFAULT_PANELS];
let allowedPanelIds = new Set();
let platformContextLoaded = false;
let accessRequests = [];
let accessProfiles = [];
let mapConfigLoadOk = false;
let currentPanel = null;
let currentView = "dashboard";
let statusChart = null;
let chartsReady = false;
let dataLoadedAtLeastOnce = false;
let externalPanelsWarmed = false;
/*
  Dono único da transição para o estado deslogado.

  Antes eram dois — `logout()` e o listener de `onAuthStateChange` — e um
  booleano consumido no primeiro evento. `reivindicarSaida()` garante que a
  transição só é aplicada uma vez; a causa, essa, dura até um novo `SIGNED_IN`.
*/
function aplicarSaida(opcoes = {}) {
  if (opcoes.causa) declararSaida(opcoes.causa);
  if (!reivindicarSaida()) return;
  const mensagem =
    opcoes.mensagem !== undefined ? opcoes.mensagem : mensagemDaSaida();
  resetSignedOutState(mensagem, opcoes.tipo || "warn");
}

/** Há uma saída em curso? Enquanto houver, um `SIGNED_IN` não reabre o sistema. */
function saidaEmCurso() {
  return causaDaSaida() !== SAIDA_DESCONHECIDA;
}
let accessHeartbeatHandle = null;
let onlinePresenceHandle = null;
let activeSessionLoadPromise = null;
let oauthExchangeInProgress = false;
let sessionBootstrappedUserId = "";
let lastSignedInEventAt = 0;
let activeLoadDataPromise = null;
let loadDataRunCounter = 0;
let activeRefreshDataPromise = null;
const SIDEBAR_MOBILE_BREAKPOINT = 900;
const SIDEBAR_FORCE_LOCK_VIEWS = new Set([]);

// Marcador de verificação em produção.
// No console do navegador, rode:
// window.__AGSUS_MONITORA_APPS_SCRIPT_FIX__
// Se retornar undefined, o Vercel ainda está servindo código antigo.
try {
  window.__AGSUS_MONITORA_APPS_SCRIPT_FIX__ = "allowall-iframe-2026-07-09";
} catch (e) {}

// ── Renderização granular: rastreia último conjunto de UFs para evitar
//    re-render do mapa quando apenas texto da busca muda ──────────────
let lastMapUfKey = null;
// Detecta se há qualquer filtro (dropdowns) ou busca de texto ativos.
// Usado para o mapa focar só nas unidades filtradas e dar zoom.
function hasActiveFilter() {
  const anySelect =
    typeof FILTER_CONFIG !== "undefined" &&
    FILTER_CONFIG.some((cfg) => (filterState[cfg.field] || new Set()).size > 0);
  const qt = ($("tableSearch")?.value || "").trim();
  return anySelect || qt.length > 0;
}
let hideClosed = false; // toggle "Ocultar encerrados" da tabela de detalhes
function toggleHideClosed() {
  hideClosed = !hideClosed;
  try {
    localStorage.setItem("agsus_hide_closed_v1", hideClosed ? "1" : "0");
  } catch (e) {}
  syncHideClosedBtn();
  applyFilters();
  toast(
    hideClosed
      ? "Ocultando processos cancelados e concluídos."
      : "Mostrando todos os processos.",
  );
}
function syncHideClosedBtn() {
  const btn = $("hideClosedBtn");
  const lbl = $("hideClosedLabel");
  if (!btn) return;
  btn.setAttribute("aria-pressed", hideClosed ? "true" : "false");
  const ic = btn.querySelector("i");
  if (ic)
    ic.className = hideClosed ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  if (lbl)
    lbl.textContent = hideClosed
      ? cfgValue("hide_closed_show")
      : cfgValue("hide_closed_hide");
  btn.classList.toggle("outline", hideClosed);
}

// ── Debounce na busca da tabela (300ms) ─────────────────────────────
let searchDebounceTimer = null;
function debouncedSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => applyFilters(), 300);
}

// Correção visual da busca: em alguns navegadores/modos de contraste,
// o texto digitado no campo da tabela herdava branco sobre fundo branco.
function ensureSearchInputTextColor() {
  const styleId = "agsus-search-input-text-color-fix";
  if (!document.getElementById(styleId)) {
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = `
        #tableSearch,
        #tableSearch:focus,
        #tableSearch:active,
        #searchModalInput,
        #searchModalInput:focus,
        #searchModalInput:active {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #0f172a !important;
          background-color: #ffffff !important;
        }
        #tableSearch::placeholder,
        #searchModalInput::placeholder {
          color: #64748b !important;
          -webkit-text-fill-color: #64748b !important;
          opacity: .72 !important;
        }
        #tableSearch:-webkit-autofill,
        #searchModalInput:-webkit-autofill {
          -webkit-text-fill-color: #0f172a !important;
          box-shadow: 0 0 0 1000px #ffffff inset !important;
        }
      `;
    document.head.appendChild(st);
  }
  ["tableSearch", "searchModalInput"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.style.color = "#0f172a";
    el.style.webkitTextFillColor = "#0f172a";
    el.style.caretColor = "#0f172a";
  });
}

function $(id) {
  return document.getElementById(id);
}
function n(v) {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
}
function txt(v) {
  return String(v ?? "").trim();
}
function low(v) {
  return txt(v).toLowerCase();
}
function cfgValue(key) {
  return loadedConfigKeys.has(key)
    ? (appConfig[key] ?? "")
    : DEFAULT_CONFIG[key] || "";
}
function cfgBool(key, fallback = false) {
  const value = low(cfgValue(key));
  if (["true", "1", "sim", "yes", "on"].includes(value)) return true;
  if (["false", "0", "nao", "não", "no", "off"].includes(value)) return false;
  return fallback;
}
function cfgInt(key, fallback = 0) {
  const value = parseInt(cfgValue(key), 10);
  return Number.isFinite(value) ? value : fallback;
}
function appVersion() {
  return cfgValue("app_version_current") || APP_VERSION_FALLBACK;
}
function passwordResetMessage() {
  return (
    cfgValue("password_reset_message") || PASSWORD_RESET_ADMIN_MESSAGE_FALLBACK
  );
}
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value || "";
}
function setAttr(id, name, value) {
  const el = $(id);
  if (el) el.setAttribute(name, value || "");
}
function setImg(id, url, alt = "") {
  const el = $(id);
  if (!el) return;
  if (url) {
    el.src = url;
    el.alt = alt || "";
    el.style.display = "";
  } else {
    el.removeAttribute("src");
    el.alt = alt || "";
    el.style.display = "none";
  }
}
function setLoginButtonReady() {
  const btn = $("loginBtn");
  if (!btn) return;
  btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Iniciar sessão`;
}
function fmt(v) {
  return n(v).toLocaleString("pt-BR");
}
const ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}
function attr(v) {
  return esc(v).replaceAll("`", "&#096;");
}
// Sanitiza URLs vindas do banco: só permite http(s). Bloqueia javascript:, data:, etc.
function safeUrl(v) {
  const s = txt(v);
  if (!s) return "";
  try {
    const u = new URL(s, window.location.origin);
    return u.protocol === "http:" || u.protocol === "https:" ? s : "";
  } catch (e) {
    return "";
  }
}
function isInternalPanelUrl(v) {
  const s = txt(v);
  if (!s) return false;
  try {
    const u = new URL(s, window.location.origin);
    return u.origin === window.location.origin;
  } catch (e) {
    return false;
  }
}
function isSystemShellUrl(v) {
  const s = txt(v);
  if (!s) return false;
  try {
    const u = new URL(s, window.location.origin);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path === "/" || path.endsWith("/index.html");
  } catch (e) {
    return false;
  }
}
function isGoogleAppsScriptUrl(v) {
  const s = txt(v);
  if (!s) return false;
  try {
    const u = new URL(s, window.location.origin);
    const host = u.hostname.toLowerCase();
    return (
      host === "script.google.com" ||
      host === "script.googleusercontent.com" ||
      host.endsWith(".googleusercontent.com")
    );
  } catch (e) {
    return false;
  }
}
function rpcFirst(data) {
  return Array.isArray(data) ? data[0] || null : data || null;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtDate(v) {
  if (!v) return "";
  const s = txt(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const accessDashboard = createAccessDashboard({
  getSupabase: () => sb,
  isMasterProfile,
  getCurrentView: () => currentView,
  $,
  n,
  txt,
  esc,
  fmt,
  fmtDate,
  friendlyError,
});

function previewImg(inputId, imgId) {
  const url = txt($(inputId)?.value);
  const img = $(imgId);
  if (!img) return;
  if (!url) {
    img.style.display = "none";
    img.src = "";
    return;
  }
  img.src = url;
  img.style.display = "block";
  img.onerror = () => {
    img.style.display = "none";
  };
}

function toggleMoreActions() {
  const menu = $("moreActionsMenu");
  const btn = $("moreActionsBtn");
  if (!menu) return;
  const opening = menu.hidden;
  menu.hidden = !opening;
  if (btn) btn.setAttribute("aria-expanded", opening ? "true" : "false");
  if (opening) {
    const close = (e) => {
      if (!e.target.closest("#moreActionsWrap")) {
        closeMoreActions();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }
}

function closeMoreActions() {
  const menu = $("moreActionsMenu");
  const btn = $("moreActionsBtn");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function toast(message, type = "ok") {
  const box = $("toastBox");
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = `<div>${esc(message)}</div><button onclick="this.parentElement.remove()">×</button>`;
  box.appendChild(el);
  setTimeout(() => {
    try {
      el.remove();
    } catch (e) {}
  }, 4500);
}

function loader(show, title = "Carregando", sub = "Aguarde...", pct = 0) {
  if (show && document.body.classList.contains("config-loading")) return;
  $("loader").classList.toggle("show", !!show);
  $("loaderTitle").textContent = title;
  $("loaderSub").textContent = sub;
  $("loaderPct").textContent = Math.round(pct) + "%";
  $("loaderBar").style.width = Math.max(0, Math.min(100, pct)) + "%";
}

function showAlert(id, msg, type = "") {
  const el = $(id);
  el.textContent = msg || "";
  el.className = "alert " + type;
  el.classList.toggle("hidden", !msg);
}

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_KEY.includes("COLE_AQUI")) {
    showAlert(
      "configMsg",
      "Configure SUPABASE_URL e SUPABASE_KEY no arquivo index.html.",
      "error",
    );
    return false;
  }
  authStorage = getSupabaseAuthStorage();
  sb = getSupabaseClient();
  if (sb) return true;
  showAlert(
    "configMsg",
    "Não foi possível iniciar a conexão segura com o Supabase.",
    "error",
  );
  return false;
}

function can(perm) {
  if (!profile) return false;
  const role = normalizeRole(profile);
  if (role) {
    if (["ind", "cores", "paineis"].includes(perm)) return canViewCore(profile);
    if (["config", "admin"].includes(perm)) return canManageSettings(profile);
  }
  return profile["p_" + perm] === true;
}

function isMasterProfile() {
  return canManageSettings(profile);
}

function getClientSessionId() {
  try {
    const key = "agsus_monitora_client_session_id";
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
  if (!sb || !currentUser?.id || !evento) return;
  try {
    await sb.rpc(RPC_ACCESS_LOG, {
      p_evento: evento,
      p_tela: options.tela ?? currentView ?? null,
      p_origem: "index",
      p_detalhes: options.detalhes ?? {},
      p_client_session_id: getClientSessionId(),
      p_user_agent: navigator.userAgent || "",
      p_app_version: appVersion(),
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria:", error);
  }
}

function stopAccessHeartbeat() {
  if (accessHeartbeatHandle) {
    clearInterval(accessHeartbeatHandle);
    accessHeartbeatHandle = null;
  }
}

function canViewOnlinePresence() {
  return isMasterProfile() || can("config") || can("admin");
}

function onlinePresenceAvatar(person) {
  if (person.avatarUrl) {
    return `<img src="${attr(person.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  return `<span aria-hidden="true">${esc(person.initials)}</span>`;
}

function renderOnlinePresence(people, synchronized = true) {
  const root = $("onlinePresence");
  const label = $("onlinePresenceLabel");
  const dot = $("onlinePresenceDot");
  const list = $("onlinePresenceList");
  if (!root || !label || !dot || !list) return;
  root.classList.toggle("hidden", !canViewOnlinePresence());
  dot.classList.toggle("is-online", synchronized);
  label.textContent = synchronized
    ? `${people.length} ${people.length === 1 ? "online" : "online"}`
    : "Sincronizando";
  list.innerHTML = people.length
    ? people
        .map(
          (person) => `<div class="online-presence-person">
            <span class="online-presence-avatar">${onlinePresenceAvatar(person)}<i aria-hidden="true"></i></span>
            <span><strong>${esc(person.fullName)}</strong><small>${esc(person.profileLabel)}${person.currentView ? ` · ${esc(person.currentView)}` : ""}</small></span>
          </div>`,
        )
        .join("")
    : `<p>${synchronized ? "Ninguém mais com a plataforma aberta agora." : "Sincronizando presença…"}</p>`;
}

async function syncOnlinePresence() {
  if (!sb || !currentUser?.id || document.visibilityState !== "visible") return;
  try {
    const beat = await sb.rpc(RPC_REGISTER_ONLINE_PRESENCE, {
      p_current_view: currentView || null,
    });
    if (beat.error) throw beat.error;
    if (!canViewOnlinePresence()) return;
    const result = await sb.rpc(RPC_LIST_ONLINE_PRESENCE);
    if (result.error) throw result.error;
    renderOnlinePresence(normalizeOnlinePresenceList(result.data), true);
  } catch (_) {
    if (canViewOnlinePresence()) renderOnlinePresence([], false);
  }
}

function stopOnlinePresence() {
  if (onlinePresenceHandle) clearInterval(onlinePresenceHandle);
  onlinePresenceHandle = null;
  $("onlinePresence")?.classList.add("hidden");
  const popover = $("onlinePresencePopover");
  if (popover) popover.hidden = true;
}

function startOnlinePresence() {
  stopOnlinePresence();
  if (!currentUser?.id) return;
  void syncOnlinePresence();
  onlinePresenceHandle = setInterval(syncOnlinePresence, 45_000);
}

function toggleOnlinePresence() {
  const popover = $("onlinePresencePopover");
  const button = $("onlinePresenceBtn");
  if (!popover || !button) return;
  popover.hidden = !popover.hidden;
  button.setAttribute("aria-expanded", popover.hidden ? "false" : "true");
  if (!popover.hidden) void syncOnlinePresence();
}
function startAccessHeartbeat() {
  stopAccessHeartbeat();
  if (!currentUser?.id) return;
  const minutes = Math.max(
    1,
    cfgInt("access_heartbeat_minutos", DEFAULT_ACCESS_HEARTBEAT_MINUTES),
  );
  accessHeartbeatHandle = setInterval(
    () =>
      trackAccess("heartbeat", {
        detalhes: { current_view: currentView, page_title: document.title },
      }),
    minutes * 60 * 1000,
  );
}

function stopAccessDashboardRefresh() {
  accessDashboard.stopRefresh();
}
function startAccessDashboardRefresh() {
  accessDashboard.startRefresh();
}
function loadAccessDashboard(force = false) {
  return accessDashboard.load(force);
}
function renderAccessDashboard(payload = null) {
  return accessDashboard.render(payload);
}

function resetSignedOutState(message = "", type = "warn") {
  currentUser = null;
  profile = null;
  rows = [];
  filtered = [];
  dataLoadedAtLeastOnce = false;
  sessionBootstrappedUserId = "";
  lastSignedInEventAt = 0;
  allowedPanelIds = new Set();
  platformContextLoaded = false;
  accessRequests = [];
  accessProfiles = [];
  stopAccessHeartbeat();
  stopOnlinePresence();
  stopAccessDashboardRefresh();
  clearExternalPanelCache();
  document.body.classList.remove("access-request-mode");
  $("appScreen").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  const loginPassword = $("loginPassword");
  if (loginPassword) loginPassword.value = "";
  const accessCard = $("accessRequestCard");
  if (accessCard) accessCard.classList.add("hidden");
  const accessStatus = $("accessRequestStatus");
  if (accessStatus) accessStatus.classList.add("hidden");
  const accessBtn = $("accessRequestBtn");
  if (accessBtn) accessBtn.disabled = false;
  resetGoogleLoginButton();
  if (message) showAlert("loginMsg", message, type);
}
async function clearLocalAuthState() {
  currentUser = null;
  profile = null;
  activeSessionLoadPromise = null;
  sessionBootstrappedUserId = "";
  lastSignedInEventAt = 0;
  try {
    authStorage?.clearAuthState?.();
  } catch (e) {}
  try {
    sessionStorage.removeItem("agsus_oauth_callback_ok");
  } catch (e) {}
  try {
    await sb?.auth?.signOut({ scope: "local" });
  } catch (e) {}
  clearOAuthUrl();
}
async function returnToLogin() {
  await clearLocalAuthState();
  declararSaida(SAIDA_MANUAL);
  if (sb) await sb.auth.signOut();
  aplicarSaida({ mensagem: "" });
  const emailInput = $("loginEmail");
  if (emailInput) emailInput.value = "";
  const passwordInput = $("loginPassword");
  if (passwordInput) passwordInput.value = "";
  showAlert("loginMsg", "Sessão limpa. Escolha como deseja entrar.", "ok");
}

async function refreshProfileAfterSessionUpdate(nextSession) {
  currentUser = nextSession?.user || null;
  if (!currentUser || $("appScreen").classList.contains("hidden")) return;
  try {
    const ok = await loadProfile();
    if (!ok) {
      await showAccessRequestState();
      return;
    }
    await loadPanelPermissions();
    buildNav();
    if (!isViewAllowed(currentView)) navigate(startView());
  } catch (error) {
    console.error("Falha ao atualizar perfil:", error);
  }
}

function appAlreadyLoadedForSession(session) {
  const uid = session?.user?.id || "";
  return (
    !!uid &&
    currentUser?.id === uid &&
    sessionBootstrappedUserId === uid &&
    dataLoadedAtLeastOnce &&
    !$("appScreen")?.classList.contains("hidden")
  );
}

async function handleSignedInSession(nextSession, source = "auth") {
  if (!isUsableSession(nextSession) || saidaEmCurso()) return;

  const allowedDomains = normalizeAllowedDomains(
    cfgValue("auth_google_allowed_domains"),
  );
  if (!isAllowedInstitutionalEmail(nextSession.user?.email, allowedDomains)) {
    declararSaida(SAIDA_REVOGADA);
    try {
      await sb.auth.signOut({ scope: "local" });
    } catch (e) {}
    aplicarSaida({
      mensagem: `Use uma conta institucional (${allowedDomains.map((domain) => `@${domain}`).join(" ou ")}).`,
      tipo: "error",
    });
    const googleBtn = $("googleLoginBtn");
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.removeAttribute("aria-busy");
    }
    return;
  }

  // O Supabase pode emitir SIGNED_IN novamente quando a aba volta ao foco
  // ou quando a sessão é sincronizada entre abas. Se o app já está aberto
  // para o mesmo usuário, não reinicia todo o AgSUS Monitora.
  if (appAlreadyLoadedForSession(nextSession)) {
    currentUser = nextSession.user;
    return;
  }

  if (activeSessionLoadPromise) return activeSessionLoadPromise;
  currentUser = nextSession.user;
  activeSessionLoadPromise = (async () => {
    const ready = await loadInitialData();
    if (ready) {
      sessionBootstrappedUserId = nextSession.user.id;
      await trackAccess(
        source === "boot" ? "sessao_restaurada" : "login_google",
        { tela: source },
      );
      startAccessHeartbeat();
      startOnlinePresence();
      startRealtime();
    }
  })();
  try {
    await activeSessionLoadPromise;
  } catch (error) {
    console.error("Falha ao finalizar login:", error);
    forceAccessRequestFallback(
      "Seu e-mail entrou com Google, mas ainda precisa ser liberado por um administrador.",
    );
  } finally {
    clearOAuthUrl();
    activeSessionLoadPromise = null;
    loader(false);
    document.body.classList.remove("config-loading");
    const googleBtn = $("googleLoginBtn");
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.removeAttribute("aria-busy");
    }
  }
}

async function handleOAuthCodeCallback() {
  const qs = new URLSearchParams(window.location.search || "");
  const code = qs.get("code");
  if (!code) return false;
  loader(true, "Autenticando com Google", "Finalizando acesso seguro...", 18);
  oauthExchangeInProgress = true;
  try {
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const session = isUsableSession(data?.session)
      ? data.session
      : await waitForAuthSession(data?.user?.id || "");
    if (isUsableSession(session)) {
      await handleSignedInSession(session, "oauth_callback");
      return true;
    }
    throw new Error("Sessão não encontrada após retorno do Google.");
  } catch (error) {
    console.error("Falha no callback OAuth:", error);
    clearOAuthUrl();
    loader(false);
    document.body.classList.remove("config-loading");
    resetSignedOutState(
      "Não foi possível finalizar o login Google. Tente novamente escolhendo a conta.",
      "error",
    );
    return true;
  } finally {
    oauthExchangeInProgress = false;
  }
}

async function waitForAuthSession(expectedUserId = "", maxWaitMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const { data } = await sb.auth.getSession();
    if (isUsableSession(data?.session, expectedUserId)) return data.session;
    await sleep(150);
  }
  const { data } = await sb.auth.getSession();
  return isUsableSession(data?.session, expectedUserId) ? data.session : null;
}

async function boot() {
  if (!initSupabase()) return;
  loader(true, "Carregando", "", 5);
  applyStoredSidebarState();
  applyStoredDisplayModes();
  ensureSearchInputTextColor();
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      currentUser = null;
      if (sb) sb.auth.signOut();
      clearRecoveryUrl();
      // Causa manual: o `SIGNED_OUT` que vem a seguir não é expiração.
      aplicarSaida({
        causa: SAIDA_MANUAL,
        mensagem: passwordResetMessage(),
        tipo: "warn",
      });
      return;
    }
    if (event === "SIGNED_OUT") {
      /*
        A causa não é consumida aqui. Antes era: o booleano zerava no primeiro
        evento, e um segundo `SIGNED_OUT` — que o Supabase emite em mais de uma
        situação — passava a ser lido como expiração. Era essa a mensagem
        amarela que aparecia depois de sair pelo botão.
      */
      aplicarSaida();
      return;
    }
    if (event === "TOKEN_REFRESHED") {
      currentUser = session?.user || currentUser;
      return;
    }
    if (event === "USER_UPDATED") {
      setTimeout(() => refreshProfileAfterSessionUpdate(session), 0);
    }
    if (event === "SIGNED_IN") {
      // Entrar encerra a transição: daqui em diante um SIGNED_OUT é evento novo.
      encerrarTransicaoDeSaida();
      if (oauthExchangeInProgress) return;
      const uid = session?.user?.id || "";
      const now = Date.now();

      if (appAlreadyLoadedForSession(session)) {
        currentUser = session.user;
        return;
      }

      if (uid && currentUser?.id === uid && now - lastSignedInEventAt < 1500) {
        return;
      }

      lastSignedInEventAt = now;
      setTimeout(() => handleSignedInSession(session, "oauth"), 0);
    }
  });
  await loadConfig({ silent: true });
  const handledOAuth = await handleOAuthCodeCallback();
  if (handledOAuth) return;
  const qs = new URLSearchParams(window.location.search || "");
  const authError = qs.get("auth_error");
  const authOk = qs.get("auth") === "google";
  const sessionFromCallback = authOk ? await waitForAuthSession() : null;
  const { data } = sessionFromCallback
    ? { data: { session: sessionFromCallback } }
    : await sb.auth.getSession();
  if (hasPasswordRecoveryParams()) {
    currentUser = null;
    if (sb) await sb.auth.signOut();
    clearRecoveryUrl();
    aplicarSaida({
      causa: SAIDA_MANUAL,
      mensagem: passwordResetMessage(),
      tipo: "warn",
    });
    return;
  }
  if (isUsableSession(data?.session)) {
    await handleSignedInSession(data.session, "boot");
  } else {
    loader(false);
    document.body.classList.remove("config-loading");
    if (authError) {
      showAlert(
        "loginMsg",
        "Não foi possível finalizar o login Google. Tente novamente escolhendo a conta.",
        "error",
      );
      clearOAuthUrl();
    } else if (data?.session) {
      resetSignedOutState(
        "A sessão não foi concluída. Entre novamente com sua conta Google.",
        "warn",
      );
    }
  }
}

function hasPasswordRecoveryParams() {
  const qs = new URLSearchParams(window.location.search || "");
  const hash = new URLSearchParams(
    String(window.location.hash || "").replace(/^#/, ""),
  );
  // OAuth com Google tambem volta com ?code=...; isso nao e recuperacao de senha.
  // So trate como recovery quando o tipo vier explicitamente como recovery ou reset=1.
  return (
    qs.get("reset") === "1" ||
    qs.get("type") === "recovery" ||
    hash.get("type") === "recovery"
  );
}

function clearRecoveryUrl() {
  history.replaceState({}, document.title, window.location.pathname);
}
function clearOAuthUrl() {
  const qs = new URLSearchParams(window.location.search || "");
  const hash = new URLSearchParams(
    String(window.location.hash || "").replace(/^#/, ""),
  );
  if (
    qs.has("code") ||
    qs.has("auth") ||
    qs.has("auth_error") ||
    hash.has("access_token") ||
    hash.has("refresh_token")
  ) {
    history.replaceState({}, document.title, window.location.pathname);
  }
}

function applyStoredSidebarState() {
  if (isSidebarLockedViewport()) return;
  try {
    const saved = localStorage.getItem("agsus_monitora_sidebar_collapsed_v1");
    if (saved === "0") document.body.classList.remove("sidebar-collapsed");
    if (saved === "1") document.body.classList.add("sidebar-collapsed");
  } catch (e) {}
  syncSidebarToggle();
}
function togglePassword() {
  const p = $("loginPassword");
  if (!p) return;
  p.type = p.type === "password" ? "text" : "password";
}

async function login() {
  showAlert(
    "loginMsg",
    "Use o login com Google institucional para acessar.",
    "warn",
  );
  return loginWithGoogle();
}

async function loginWithGoogle() {
  if (!sb && !initSupabase()) return;
  if (!cfgBool("auth_google_enabled", true)) {
    showAlert(
      "loginMsg",
      "Login Google está desativado nas configurações do sistema.",
      "error",
    );
    return;
  }
  const btn = $("googleLoginBtn");
  const btnText = $("googleLoginText");
  if (btn) {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
  }
  if (btnText) btnText.textContent = "Entrando no sistema...";
  showAlert(
    "loginMsg",
    "Escolha sua conta institucional na janela do Google.",
    "warn",
  );
  // Como no SIGAV, a janela vazia nasce no próprio clique para não ser
  // bloqueada pelo navegador enquanto aguardamos a URL segura do Supabase.
  const popup = openLoginPopup(window);
  // Para testes e troca de perfil, limpe a sessao local antes do OAuth.
  // O Google ainda pode ter conta ativa no navegador; prompt=select_account
  // forca a tela de escolha de conta.
  await clearLocalAuthState();
  const redirectTo = getOAuthCallbackUrl(window.location);
  const domainHint = txt(cfgValue("auth_google_domain_hint"));
  const queryParams = { prompt: "select_account" };
  if (domainHint) queryParams.hd = domainHint;
  const options = {
    redirectTo,
    queryParams,
    ...(popup ? { skipBrowserRedirect: true } : {}),
  };
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options,
  });
  if (error) {
    try {
      popup?.close();
    } catch (_) {}
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
    if (btnText) btnText.textContent = "Entrar com Google institucional";
    showAlert(
      "loginMsg",
      "Falha ao iniciar login Google: " + error.message,
      "error",
    );
    return;
  }
  if (popup && data?.url) {
    popup.location.replace(data.url);
    monitorLoginPopup(popup);
  }
}

function resetGoogleLoginButton() {
  const btn = $("googleLoginBtn");
  if (btn) {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
  }
  setText("googleLoginText", "Entrar com Google institucional");
}

/*
  Devolve o botão de acesso quando a pessoa volta do Google sem concluir.

  Abaixo de 768 px não há popup — `supportsLoginPopup` exige essa largura — e o
  login é um redirecionamento de página inteira. Se a pessoa cancela ou usa o
  botão Voltar, o navegador restaura esta página, muitas vezes do bfcache, com o
  DOM exatamente como ficou: botão `disabled` e "Entrando no sistema…".

  Nada o restaurava. `resetGoogleLoginButton()` só era chamado ao deslogar, no
  monitor do popup e na mensagem do callback — nenhum deles dispara nesse
  retorno. O botão ficava travado até um recarregamento forçado.

  O listener é registado uma única vez, no carregamento do módulo, e só age
  quando não há sessão: se o login deu certo, quem manda é o fluxo autenticado.
*/
window.addEventListener("pageshow", (event) => {
  const restauradaDoCache = event.persisted;
  const veioDoHistorico =
    performance.getEntriesByType?.("navigation")?.[0]?.type === "back_forward";
  if (!restauradaDoCache && !veioDoHistorico) return;

  const botao = $("googleLoginBtn");
  if (!botao?.disabled) return;

  void (async () => {
    const { estado } = await estadoDaSessao(sb);
    if (estado === SESSAO_ATIVA) return;
    resetGoogleLoginButton();
  })();
});

function monitorLoginPopup(popup) {
  const timer = window.setInterval(async () => {
    if (!popup.closed) return;
    window.clearInterval(timer);
    const session = await waitForAuthSession("", 1400);
    if (isUsableSession(session)) {
      await handleSignedInSession(session, "oauth_popup");
      return;
    }
    resetGoogleLoginButton();
    showAlert(
      "loginMsg",
      "A janela do Google foi fechada antes de concluir o acesso.",
      "warn",
    );
  }, 400);
}

window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== LOGIN_POPUP_MESSAGE) return;
  const session = await waitForAuthSession("", 5000);
  if (isUsableSession(session)) {
    await handleSignedInSession(session, "oauth_popup");
  } else {
    resetGoogleLoginButton();
    showAlert(
      "loginMsg",
      "Não foi possível concluir o acesso Google.",
      "error",
    );
  }
});

/*
  Saída voluntária. Declara a causa e pede o `signOut()`; quem transforma a
  aplicação em estado deslogado é o listener de `onAuthStateChange`, dono único
  dessa transição. A chamada final é rede de segurança, não segundo dono: só
  age se o evento não tiver chegado, e nunca mostra mensagem.
*/
async function logout() {
  await trackAccess("logout", { detalhes: { current_view: currentView } });
  stopRealtime();
  declararSaida(SAIDA_MANUAL);
  if (sb) await sb.auth.signOut();
  aplicarSaida();
}

function openApp(user) {
  document.body.classList.remove("access-request-mode");
  $("loginScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
  setText("userName", profileDisplayName(profile, user));
  setText("topUserPopoverName", profileDisplayName(profile, user));
  setText("userEmail", user?.email || "-");
}

async function loadInitialData() {
  loader(
    true,
    cfgValue("loader_environment_title"),
    cfgValue("loader_environment_subtitle"),
    22,
  );
  const profileOk = await loadProfile();
  if (!profileOk) {
    loader(
      true,
      cfgValue("loader_panels_title"),
      cfgValue("loader_panels_subtitle"),
      35,
    );
    try {
      await loadPanels();
    } catch (error) {
      console.warn("Falha ao carregar paineis para solicitacao:", error);
      panels = [...DEFAULT_PANELS];
    }
    try {
      await showAccessRequestState();
    } catch (error) {
      console.error("Falha ao exibir solicitacao de acesso:", error);
      forceAccessRequestFallback(
        "Seu e-mail entrou com Google, mas ainda precisa ser liberado por um administrador.",
      );
    }
    loader(false);
    return false;
  }
  loader(
    true,
    cfgValue("loader_config_title"),
    cfgValue("loader_config_subtitle"),
    34,
  );
  await loadConfig();
  loader(
    true,
    cfgValue("loader_panels_title"),
    cfgValue("loader_panels_subtitle"),
    48,
  );
  await loadPanels();
  await loadPanelPermissions();
  buildNav();
  warmExternalPanels();
  await sleep(180);
  loader(
    true,
    cfgValue("loader_map_title"),
    cfgValue("loader_map_subtitle"),
    52,
  );
  await loadMapaConfig();
  loader(
    true,
    cfgValue("loader_units_title"),
    cfgValue("loader_units_subtitle"),
    55,
  );
  await loadUnidades();
  loader(
    true,
    cfgValue("loader_data_title"),
    cfgValue("loader_data_subtitle"),
    62,
  );
  const dataOk = await loadData({ showLoader: false });
  if (!dataOk) {
    loader(false);
    return;
  }
  loader(
    true,
    cfgValue("loader_finish_title"),
    cfgValue("loader_finish_subtitle"),
    88,
  );
  openApp(currentUser);
  navigate(startView());
  loader(false);
  return true;
}

function isViewAllowed(view) {
  if (!view) return false;
  if (view === "dashboard") return can("ind");
  if (view === "nucleo") return can("cores");
  if (view === "approved") return canViewCore(profile);
  if (view === "config") return can("config");
  if (view.startsWith("panel:")) {
    const code = view.split(":")[1];
    return canAccessPanelCode(code);
  }
  return false;
}
function rememberView(view) {
  if (!view) return;
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch (e) {}
}
function storedView() {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) || "";
  } catch (e) {
    return "";
  }
}
function systemHomeView() {
  // Tela inicial do SISTEMA (nunca um painel externo).
  if (can("ind")) return "dashboard";
  if (can("cores")) return "nucleo";
  if (can("config")) return "config";
  const firstPanel = panels.find(panelAllowed);
  if (firstPanel) return "panel:" + firstPanel.codigo;
  return "dashboard";
}
function startView() {
  // Restaura a última tela — EXCETO painéis externos, para o app nunca abrir
  // "preso" num painel externo (sem menu para voltar) ao recarregar.
  const stored = storedView();
  if (stored && !stored.startsWith("panel:") && isViewAllowed(stored))
    return stored;
  return systemHomeView();
}

async function loadProfile() {
  if (!currentUser?.id) return false;
  const { data: contextData, error: contextError } =
    await sb.rpc(RPC_PLATFORM_CONTEXT);
  const context = !contextError ? normalizePlatformContext(contextData) : null;
  if (context) {
    profile = context.profile;
    allowedPanelIds = new Set(context.panelIds);
    platformContextLoaded = true;
  } else {
    if (contextError)
      console.info(
        "Contexto unificado ainda não aplicado; usando contrato compatível.",
        contextError.message || contextError,
      );
    const { data, error } = await sb.rpc("meu_usuario");
    if (error) {
      console.warn("Perfil indisponivel para o usuario atual:", error);
      profile = null;
      platformContextLoaded = false;
      return false;
    }
    const row = rpcFirst(data);
    if (!row) {
      profile = null;
      platformContextLoaded = false;
      return false;
    }
    profile = { ...row, ativo: true };
    platformContextLoaded = false;
  }
  setText("userName", profileDisplayName(profile, currentUser));
  setText("topUserPopoverName", profileDisplayName(profile, currentUser));
  setText("userEmail", currentUser?.email || profile?.email || "-");
  const badge = $("userProfileBadge");
  if (badge && profile.perfil) {
    const label = roleLabel(profile);
    badge.textContent = label;
    badge.style.display = "inline-block";
    setText("topUserPopoverProfile", label);
  }
  const newEditalButton = $("newEditalBtn");
  if (newEditalButton)
    newEditalButton.classList.toggle("hidden", !canManageEditais(profile));
  return true;
}

function userDisplayName() {
  const meta = currentUser?.user_metadata || {};
  return txt(
    meta.full_name ||
      meta.name ||
      meta.nome ||
      currentUser?.email?.split("@")[0] ||
      "",
  );
}

async function showAccessRequestState() {
  stopRealtime();
  stopAccessHeartbeat();
  loader(false);
  document.body.classList.remove("config-loading");
  $("appScreen").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  document.body.classList.add("access-request-mode");
  const emailInput = $("loginEmail");
  if (emailInput) emailInput.value = currentUser?.email || "";
  setText("accessReqEmail", currentUser?.email || "-");
  const loginPassword = $("loginPassword");
  if (loginPassword) loginPassword.value = "";
  showAlert("loginMsg", "", "");
  const card = $("accessRequestCard");
  if (card) card.classList.remove("hidden");
  const nome = $("accessReqNome");
  if (nome && !txt(nome.value)) nome.value = userDisplayName();
  try {
    await loadMyAccessRequest();
  } catch (error) {
    console.warn("Nao foi possivel consultar solicitacao anterior:", error);
    const status = $("accessRequestStatus");
    if (status) {
      status.classList.remove("hidden");
      status.textContent =
        "Preencha e envie a solicitação. Não foi possível consultar solicitações anteriores neste momento.";
    }
    const btn = $("accessRequestBtn");
    if (btn) btn.disabled = false;
  }
}

function forceAccessRequestFallback(message) {
  stopRealtime();
  stopAccessHeartbeat();
  loader(false);
  document.body.classList.remove("config-loading");
  $("appScreen")?.classList.add("hidden");
  $("loginScreen")?.classList.remove("hidden");
  document.body.classList.add("access-request-mode");
  const emailInput = $("loginEmail");
  if (emailInput) emailInput.value = currentUser?.email || "";
  setText("accessReqEmail", currentUser?.email || "-");
  const pass = $("loginPassword");
  if (pass) pass.value = "";
  showAlert("loginMsg", message || "", message ? "warn" : "");
  $("accessRequestCard")?.classList.remove("hidden");
  const nome = $("accessReqNome");
  if (nome && !txt(nome.value)) nome.value = userDisplayName();
  const btn = $("accessRequestBtn");
  if (btn) btn.disabled = false;
}


function setAccessRequestFormLocked(locked) {
  ["accessReqNome", "accessReqSetor", "accessReqJustificativa"].forEach(
    (id) => {
      const el = $(id);
      if (el) el.disabled = !!locked;
    },
  );
}

async function loadMyAccessRequest() {
  if (!currentUser?.id) return null;
  const { data, error } = await sb
    .from("solicitacoes_acesso")
.select("id,status,observacao_admin,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const status = $("accessRequestStatus");
  const btn = $("accessRequestBtn");
  if (error) {
    if (status) {
      status.classList.remove("hidden");
      status.textContent =
        "Não foi possível consultar sua solicitação anterior: " +
        friendlyError(error);
    }
    if (btn) btn.disabled = false;
    return null;
  }
  const req = Array.isArray(data) ? data[0] : null;
  if (!req) {
    if (status) status.classList.add("hidden");
    if (btn) btn.disabled = false;
    setAccessRequestFormLocked(false);
    return null;
  }
  if (status) {
    status.classList.remove("hidden");
    status.classList.toggle("success", req.status === "aprovado");
    status.classList.toggle("warn", req.status === "pendente");
    status.textContent = accessRequestStatusMessage(req);
  }
  if (btn)
    btn.disabled = req.status === "pendente" || req.status === "aprovado";
  setAccessRequestFormLocked(
    req.status === "pendente" || req.status === "aprovado",
  );
  return req;
}

async function submitAccessRequest() {
  if (!sb || !currentUser?.id)
    return showAlert(
      "loginMsg",
      "Faça login com Google antes de solicitar acesso.",
      "warn",
    );
  const btn = $("accessRequestBtn");
  if (btn) btn.disabled = true;
  const nome = txt($("accessReqNome")?.value) || userDisplayName();
  const setor = txt($("accessReqSetor")?.value);
  const justificativa = txt($("accessReqJustificativa")?.value);
  if (!nome || !justificativa) {
    if (btn) btn.disabled = false;
    return showAlert(
      "loginMsg",
      "Informe seu nome e uma justificativa breve.",
      "warn",
    );
  }
  const { data, error } = await sb
    .from("solicitacoes_acesso")
    .insert({
      user_id: currentUser.id,
      email: currentUser.email,
      nome,
      setor,
      justificativa,
      perfil_solicitado: "usuario",
      status: "pendente",
    })
    .select("id")
    .single();
  if (error) {
    if (btn) btn.disabled = false;
    return showAlert(
      "loginMsg",
      "Não foi possível enviar a solicitação: " + friendlyError(error),
      "error",
    );
  }
  showAlert(
    "loginMsg",
    "Solicitação enviada. Um administrador poderá liberar seu acesso.",
    "success",
  );
  await loadMyAccessRequest();
}

async function loadConfig(options = {}) {
  const silent = options.silent === true;
  appConfig = {};
  loadedConfigKeys = new Set();
  configLoadOk = false;
  const { data, error } = await sb
    .from("configuracoes")
    .select("chave,valor,descricao");
  if (error) {
    if (!silent)
      toast("Erro ao carregar configurações: " + friendlyError(error), "error");
    applyConfigToUi();
    renderConfigForm();
    document.body.classList.remove("config-loading");
    return false;
  }
  if (Array.isArray(data))
    data.forEach((r) => {
      if (r.chave) {
        loadedConfigKeys.add(r.chave);
        appConfig[r.chave] = r.valor ?? "";
      }
    });
  configLoadOk = true;
  applyConfigToUi();
  renderConfigForm();
  document.body.classList.remove("config-loading");
  return true;
}

/*
  Aviso global — a mensagem de topo definida em Configurações.

  O cartão "Aviso global" existia inteiro: os dois campos, a gravação e a
  releitura de volta para o formulário. Faltava a última etapa. Quem escrevesse
  um aviso e salvasse via "Configurações salvas.", reabrisse a tela e encontrasse
  o texto lá — e mesmo assim nada aparecia em lugar nenhum do sistema, porque não
  havia elemento no HTML para recebê-lo.

  A decisão de aparência está em `lib/aviso-global.js`; aqui só a escrita no DOM.
*/
function aplicarAvisoGlobal() {
  const barra = $("broadcastBar");
  if (!barra) return;
  const aviso = avisoGlobal({
    mensagem: cfgValue("broadcast_msg"),
    tipo: cfgValue("broadcast_type"),
  });
  // `textContent`, não `innerHTML`: o texto vem do banco e não é marcação.
  barra.textContent = aviso.mensagem;
  barra.className = aviso.classe;
  barra.hidden = !aviso.visivel;
}

function applyConfigToUi() {
  /*
    O nome da aba não é mais escrito aqui.

    Esta linha fazia `document.title = appVersion()` — a **versão publicada**,
    algo como "AgSUS Monitora Web V2.9.35" — e apagava o nome da página que
    `setPageTitle()` acabara de compor. Era o motivo de o título "voltar" em vez
    de acompanhar a aba.

    Agora entra só a metade que a configuração de facto conhece: o nome do
    sistema. A metade da página fica com quem navega, e o módulo recompõe as
    duas.
  */
  definirSistemaDaAba(cfgValue("app_title") || "AgSUS Monitora");
  void aplicarFaviconDaMarca(
    normalizeAccessLogoUrl(cfgValue("auth_access_logo_url")),
  );
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc)
    metaDesc.setAttribute(
      "content",
      "AgSUS Monitora - Monitoramento de Processos Seletivos",
    );
  setText("skipLink", cfgValue("skip_link_text"));
  setText("offlineBar", cfgValue("offline_message"));
  setLoginButtonReady();
  /*
    A identidade da tela de acesso só é tocada quando veio do banco.

    Antes, esta secção corria sempre — inclusive pelo caminho de erro de
    `loadConfig()`, que chama `applyConfigToUi()` com `appConfig` vazio. Os
    normalizadores devolviam os valores padrão, e `guardarMarca()` gravava-os no
    cache como se fossem a identidade da instituição. Bastava uma visita não
    autenticada para contaminar a próxima inicialização: a tela abria com a arte
    antiga, e só depois do login — quando a configuração real finalmente
    carregava — é que a identidade correta aparecia.

    Agora exige-se prova dupla: a configuração carregou (`configLoadOk`) **e** a
    chave em questão veio mesmo na resposta (`loadedConfigKeys`). Sem isso, a
    tela fica como o arranque a deixou — a última marca válida, se existir, ou
    neutra. Nunca a identidade antiga apresentada como institucional.
  */
  const marcaDoBanco = (chave) =>
    configLoadOk && loadedConfigKeys.has(chave) ? cfgValue(chave) : null;

  const fundoDoBanco = marcaDoBanco("auth_access_background_url");
  const painelDoBanco = marcaDoBanco("auth_access_panel_color");
  const logoDoBanco = marcaDoBanco("auth_access_logo_url");
  const saudacaoDoBanco = marcaDoBanco("auth_access_greeting");
  const instrucaoDoBanco = marcaDoBanco("auth_access_instruction");

  const loginScreen = $("loginScreen");
  const marcaParaGuardar = {};

  if (loginScreen && fundoDoBanco !== null) {
    const url = normalizeAccessBackgroundUrl(fundoDoBanco);
    loginScreen.style.setProperty(
      "--login-background-image",
      `url("${url.replace(/["\\]/g, "")}")`,
    );
    marcaParaGuardar.backgroundUrl = url;
  }

  if (loginScreen && painelDoBanco !== null) {
    const cor = normalizeAccessPanelColor(painelDoBanco);
    const modo = normalizarModo(cfgValue("auth_access_texto_modo"));
    // Cor, modo e contraste juntos, pela mesma função que o arranque usa.
    aplicarCorDoPainel(loginScreen, cor, modo);
    marcaParaGuardar.panelColor = cor;
    marcaParaGuardar.textoModo = modo;
  }

  if (logoDoBanco !== null) {
    const logo = normalizeAccessLogoUrl(logoDoBanco);
    setImg("loginLogo", logo, "AgSUS");
    marcaParaGuardar.logoUrl = logo;
  }

  if (saudacaoDoBanco !== null) {
    const saudacao = saudacaoDoBanco || DEFAULT_ACCESS_BRANDING.greeting;
    setText("loginGreeting", saudacao);
    marcaParaGuardar.greeting = saudacao;
  }

  if (instrucaoDoBanco !== null) {
    const instrucao = instrucaoDoBanco || DEFAULT_ACCESS_BRANDING.instruction;
    setText("loginDescription", instrucao);
    marcaParaGuardar.instruction = instrucao;
  }

  /*
    Guarda os cinco campos juntos, e só os que vieram do banco. Guardar apenas
    fundo e cor — como antes — produzia tela híbrida: arte de uma configuração
    com saudação de outra.
  */
  if (Object.keys(marcaParaGuardar).length) guardarMarca(marcaParaGuardar);
  const googleBtn = $("googleLoginBtn");
  if (googleBtn) {
    const enabled = cfgBool("auth_google_enabled", true);
    googleBtn.style.display = enabled ? "flex" : "none";
    setText(
      "googleLoginText",
      cfgValue("auth_google_button_text") || "Entrar com Google institucional",
    );
  }
  setText("sidebarUserLabel", cfgValue("sidebar_user_label"));
  setText("sidebarVersionLabel", cfgValue("sidebar_version_label"));
  setText("sidebarVersion", appVersion());
  setText("logoutText", cfgValue("logout_text"));
  setText("pageTitle", cfgValue("page_title"));
  setText("pageSubtitle", cfgValue("page_subtitle"));
  setText("filterTitle", cfgValue("filter_title"));
  setText("filterSubtitle", cfgValue("filter_subtitle"));
  setText("externalBackText", cfgValue("external_back_text"));
  setText("darkModeLabel", cfgValue("dark_mode_label"));
  setText("exportCsvText", cfgValue("action_export_text"));
  setText("fullscreenActionText", cfgValue("action_fullscreen_text"));
  setText("refreshActionText", cfgValue("action_refresh_text"));
  setText("exportPdfActionText", cfgValue("action_export_pdf_text"));
  setText("dashboardSectionProcessos", cfgValue("dashboard_section_processos"));
  setText("kpiProcessosLabel", cfgValue("kpi_processos_label"));
  setText("kpiVagasLabel", cfgValue("kpi_vagas_label"));
  setText("kpiContratadosLabel", cfgValue("kpi_contratados_label"));
  setText("kpiOciosasLabel", cfgValue("kpi_ociosas_label"));
  setText("kpiCriticosLabel", cfgValue("kpi_criticos_label"));
  setText("panicChip", cfgValue("kpi_criticos_chip"));
  setText("kpiInscritosLabel", cfgValue("kpi_inscritos_label"));
  setText("statusSummaryTitle", cfgValue("panel_status_summary_title"));
  setText("operationalStatusTitle", cfgValue("panel_operational_status_title"));
  setText("attentionTitle", cfgValue("panel_attention_title"));
  setText("detailsTitle", cfgValue("details_title"));
  setText("columnsButtonText", cfgValue("columns_button_text"));
  setText("columnsMenuTitle", cfgValue("columns_menu_title"));
  setText("keyboardHint", cfgValue("keyboard_hint"));
  setText("externalTitle", cfgValue("external_default_title"));
  setText("externalRefreshText", cfgValue("external_refresh_text"));
  setText("externalOpen", cfgValue("external_open_text"));
  const externalMount = $("externalMount");
  if (externalMount && externalMount.classList.contains("external-placeholder"))
    externalMount.textContent = cfgValue("external_placeholder");
  if ($("tableSearch")) {
    $("tableSearch").placeholder = cfgValue("table_search_placeholder");
    $("tableSearch").setAttribute(
      "aria-label",
      cfgValue("table_search_placeholder"),
    );
    ensureSearchInputTextColor();
  }
  ["globalSidebarToggle", "hambToggle"].forEach((id) => {
    setAttr(id, "title", cfgValue("sidebar_toggle_label"));
    setAttr(id, "aria-label", cfgValue("sidebar_toggle_label"));
  });
  ["externalBackBtn"].forEach((id) => {
    setAttr(id, "title", cfgValue("external_back_text"));
    setAttr(id, "aria-label", cfgValue("external_back_text"));
  });
  setAttr("moreActionsBtn", "title", cfgValue("action_more_label"));
  setAttr("moreActionsBtn", "aria-label", cfgValue("action_more_label"));
  syncFilterToggleText();
  syncHideClosedBtn();
  aplicarAvisoGlobal();
  // COGIP rodapé
  const cogipBlock = document.querySelector(".login-cogip");
  const cogipParts = [
    cfgValue("cogip_nome"),
    cfgValue("cogip_funcao"),
    cfgValue("cogip_versao"),
    cfgValue("cogip_dept"),
    cfgValue("cogip_logo_url"),
  ].filter(Boolean);
  if (cogipBlock)
    cogipBlock.style.display = cogipParts.length ? "flex" : "none";
  const foot = $("loginFoot");
  if (foot)
    foot.textContent = cfgValue("cogip_dept") || cfgValue("footer_text");
  const cogipName = $("loginCogipName");
  if (cogipName) cogipName.textContent = cfgValue("cogip_nome");
  const roleParts = [cfgValue("cogip_funcao"), cfgValue("cogip_versao")].filter(
    Boolean,
  );
  const cogipRole = $("loginCogipRole");
  if (cogipRole) cogipRole.textContent = roleParts.join(" · ");
  const cogipVer = $("loginVersion");
  if (cogipVer) cogipVer.textContent = cfgValue("cogip_versao");
  setImg("loginCogipLogo", cfgValue("cogip_logo_url"), cfgValue("cogip_nome"));
  /*
    `#sideLogo` não entra mais aqui. A logo da barra lateral tem chave própria
    (`ui_sidebar_logo_url`) e um único dono: `sidebar-branding.js`. Enquanto esta
    função a sobrescrevia com `auth_access_logo_url` — a marca da tela de
    **login** —, escolher uma logo para a barra lateral não sobrevivia ao
    carregamento das configurações.
  */
}

function normalizeUnitName(value) {
  return low(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function sortUnits(a, b) {
  const ta = txt(a.tipo),
    tb = txt(b.tipo);
  if (ta !== tb) return ta.localeCompare(tb, "pt-BR", { numeric: true });
  return txt(a.nome_oficial || a.unidade || a.nome).localeCompare(
    txt(b.nome_oficial || b.unidade || b.nome),
    "pt-BR",
    { numeric: true },
  );
}

async function loadUnidades() {
  if (!sb) {
    unidadesCatalog = [];
    populateModalUnidades();
    return false;
  }
  const { data, error } = await sb
    .from("dim_unidades")
    .select("id_unidade,sigla,nome_oficial,tipo,uf_sede,ativo")
    .eq("ativo", true)
    .order("tipo", { ascending: true })
    .order("nome_oficial", { ascending: true });
  if (error) {
    unidadesCatalog = [];
    populateModalUnidades();
    toast("Catálogo dim_unidades não disponível.", "warn");
    return false;
  }
  unidadesCatalog = Array.isArray(data)
    ? data.filter((u) => txt(u.nome_oficial)).sort(sortUnits)
    : [];
  populateModalUnidades();
  return true;
}

function fallbackUnitsFromRows() {
  const map = new Map();
  rows.forEach((r) => {
    const nome = txt(r.unidade);
    if (!nome || map.has(normalizeUnitName(nome))) return;
    map.set(normalizeUnitName(nome), {
      id_unidade: txt(r.id_unidade) || "",
      sigla: txt(r.sigla_unidade) || "",
      nome_oficial: nome,
      tipo:
        txt(r.tipo_unidade) ||
        (nome.toUpperCase().startsWith("CASAI") ? "CASAI" : "DSEI"),
      uf_sede: txt(r.uf).toUpperCase(),
      ativo: true,
      fallback: true,
    });
  });
  return Array.from(map.values()).sort(sortUnits);
}

function unidadesForModal() {
  const primary = unidadesCatalog.length ? unidadesCatalog : [];
  const byName = new Map(
    primary.map((u) => [normalizeUnitName(u.nome_oficial), u]),
  );
  fallbackUnitsFromRows().forEach((u) => {
    if (!byName.has(normalizeUnitName(u.nome_oficial)))
      byName.set(normalizeUnitName(u.nome_oficial), u);
  });
  return Array.from(byName.values()).sort(sortUnits);
}

function unidadeOptionValue(unit) {
  return txt(unit.id_unidade) || txt(unit.nome_oficial);
}
function findUnitByValue(value) {
  const clean = txt(value);
  if (!clean) return null;
  return (
    unidadesForModal().find(
      (u) =>
        unidadeOptionValue(u) === clean ||
        txt(u.id_unidade) === clean ||
        txt(u.nome_oficial) === clean,
    ) || null
  );
}
function findUnitForRow(row) {
  if (!row) return null;
  const byId = txt(row.id_unidade);
  if (byId) {
    const found = unidadesForModal().find((u) => txt(u.id_unidade) === byId);
    if (found) return found;
  }
  const rowName = normalizeUnitName(row.unidade);
  if (rowName) {
    const found = unidadesForModal().find(
      (u) => normalizeUnitName(u.nome_oficial) === rowName,
    );
    if (found) return found;
  }
  return null;
}

function populateModalUnidades(selectedValue = "") {
  const select = $("mUnidade");
  if (!select) return;
  const current = selectedValue || select.value;
  const units = unidadesForModal();
  select.innerHTML =
    `<option value="">Selecione a unidade</option>` +
    units
      .map((u) => {
        const value = unidadeOptionValue(u);
        const label = `${txt(u.nome_oficial)}${txt(u.uf_sede) ? " — " + txt(u.uf_sede).toUpperCase() : ""}`;
        return `<option value="${attr(value)}" data-id="${attr(u.id_unidade)}" data-sigla="${attr(u.sigla)}" data-tipo="${attr(u.tipo)}" data-uf="${attr(u.uf_sede)}" data-nome="${attr(u.nome_oficial)}">${esc(label)}</option>`;
      })
      .join("");
  if (current && Array.from(select.options).some((o) => o.value === current))
    select.value = current;
}

function selectedModalUnidade() {
  const select = $("mUnidade");
  if (!select) return null;
  const unit = findUnitByValue(select.value);
  if (unit) return unit;
  const opt = select.options[select.selectedIndex];
  if (!opt || !txt(opt.value)) return null;
  return {
    id_unidade: opt.dataset.id || "",
    sigla: opt.dataset.sigla || "",
    nome_oficial: opt.dataset.nome || opt.textContent || "",
    tipo: opt.dataset.tipo || "",
    uf_sede: opt.dataset.uf || "",
  };
}

function onModalUnidadeChange() {
  const unit = selectedModalUnidade();
  setFieldValue("mIdUnidade", unit?.id_unidade || "");
  setFieldValue("mSiglaUnidade", unit?.sigla || "");
  setFieldValue("mTipoUnidade", unit?.tipo || "");
  setFieldValue("mUf", txt(unit?.uf_sede).toUpperCase());
}

async function loadPanels() {
  const { data, error } = await sb
    .from("paineis_externos")
    .select(
      "id,codigo,titulo,icone,url,ordem,ativo,em_manutencao,tipo_abertura",
    )
    .order("ordem", { ascending: true });
  if (!error && Array.isArray(data) && data.length) panels = data;
  else panels = [...DEFAULT_PANELS];
  renderPanelAdmin();
}

async function loadPanelPermissions() {
  if (!profile?.id || !can("paineis")) return true;
  allowedPanelIds = new Set();
  panels
    .filter((panel) => panel.ativo !== false)
    .forEach((panel) => {
      if (panel.id) allowedPanelIds.add(panel.id);
    });
  return true;
}

function panelAllowed(panel) {
  return !!panel && panel.ativo !== false && can("paineis");
}

function canAccessPanelCode(code) {
  return panels.some((p) => p.codigo === code && panelAllowed(p));
}

async function saveMapaConfigToSupabase(options = {}) {
  if (!sb || !can("config")) return false;
  const silent = options.silent === true;
  const rowsToSave = [
    {
      chave: "lmap",
      payload: LMAP,
      descricao: "Mapa dos DSEIs e polos base usado pelo dashboard",
    },
    {
      chave: "rede_cnes",
      payload: REDE_CNES,
      descricao: "Rede assistencial CNES/UBSI/CASAI usada pelo mapa",
    },
  ];
  const { error } = await sb
    .from(MAPA_CONFIG_TABLE)
    .upsert(rowsToSave, { onConflict: "chave" });
  if (error) {
    if (!silent)
      toast(
        "Erro ao salvar mapa/rede no Supabase: " + friendlyError(error),
        "error",
      );
    return false;
  }
  mapConfigLoadOk = true;
  if (!silent) toast("Mapa e rede assistencial salvos no Supabase.");
  return true;
}

async function loadMapaConfig() {
  mapConfigLoadOk = false;
  if (!sb) return false;
  const { data, error } = await sb
    .from(MAPA_CONFIG_TABLE)
    .select("chave,payload")
    .in("chave", ["lmap", "rede_cnes"]);
  if (error) {
    console.warn("Mapa/rede do Supabase indisponível:", error);
    if (can("config"))
      toast(
        "Mapa/rede do Supabase indisponível. Verifique a tabela de configuração do mapa.",
        "warn",
      );
    return false;
  }
  const byKey = Object.fromEntries(
    (data || []).map((r) => [r.chave, r.payload]),
  );
  if (byKey.lmap && Array.isArray(byKey.lmap.dsei)) LMAP = byKey.lmap;
  if (byKey.rede_cnes && byKey.rede_cnes.rede) REDE_CNES = byKey.rede_cnes;
  rebuildDseiIndex();
  mapConfigLoadOk = !!(byKey.lmap && byKey.rede_cnes);
  if (!mapConfigLoadOk && can("config"))
    toast("Configuração do mapa incompleta no Supabase.", "warn");
  return mapConfigLoadOk;
}

async function loadMonitoramentoPayload() {
  if (!sb) return null;
  const { data, error } = await sb.rpc(MONITORAMENTO_DASHBOARD_PAYLOAD_RPC);
  if (error) {
    console.warn(
      "Payload consolidado de monitoramento indisponível; usando carregamento legado:",
      error,
    );
    return null;
  }
  return data || null;
}

async function loadData(options = {}) {
  if (activeLoadDataPromise) return activeLoadDataPromise;
  const showOwnLoader = options.showLoader !== false;
  const runId = ++loadDataRunCounter;
  activeLoadDataPromise = (async () => {
    if (!can("ind") && !can("cores")) {
      rows = [];
      filtered = [];
      buildNav();
      return true;
    }
    if (showOwnLoader)
      loader(true, "Atualizando", "Sincronizando dados...", 62);
    const [payloadResponse, tableResponse] = await Promise.all([
      loadMonitoramentoPayload(),
      sb
        .from("monitoramento_indigena")
        /*
          As seis colunas `cronograma_*` entram aqui de proposito.
        
          `health-status-details.js` fazia uma **segunda leitura completa** da
          mesma view so para obte-las: 21 colunas, das quais 15 eram copia exata
          desta requisicao. Enquanto essa segunda chamada nao voltava, cada linha
          ficava com "Carregando cronograma...", porque o badge so existe quando
          o dado do cronograma chega. Uma requisicao, um conjunto de linhas.
        */
        .select(
          "aprovados_analise,aprovados_prova,aptos_analise,ativo,cancelados,cargos,ciclo,contratados,cronograma_atividade_atual,cronograma_automatico,cronograma_dias_para_proxima,cronograma_percentual,cronograma_proxima_atividade,cronograma_proxima_data,data_fim,data_inicio,edital,eliminados_nota,entrevistados,etapa,id,id_unidade,inscritos,link_edital,observacoes,observacoes_internas,processo,reprovados_analise,responsavel,risco,sigla_unidade,status,tipo_unidade,total_eliminados,uf,unidade,vagas_ociosas,vagas_total",
        )
        .eq("ativo", true)
        .order("unidade", { ascending: true })
        .order("edital", { ascending: true }),
    ]);
    if (runId !== loadDataRunCounter) return false;
    monitoramentoPayload = payloadResponse || null;
    const { data, error } = tableResponse;
    if (error) {
      if (showOwnLoader) loader(false);
      toast("Erro ao carregar dados: " + friendlyError(error), "error");
      return false;
    }
    rows = Array.isArray(data) ? data : [];
    dataLoadedAtLeastOnce = true;
    /*
      Quem precisa destas linhas escuta, em vez de ir buscá-las de novo. O
      evento carrega os dados: sem ele, `health-status-details.js` repetia a
      leitura inteira da view para obter seis colunas.
    */
    window.dispatchEvent(
      new CustomEvent("agsus:monitoramento-carregado", { detail: { rows } }),
    );
    lastMapUfKey = null; // invalida cache do mapa ao recarregar dados
    populateModalUnidades();
    populateFilters();
    applyFilters();
    setUpdated();
    if (showOwnLoader) loader(false);
    return true;
  })();
  try {
    return await activeLoadDataPromise;
  } finally {
    activeLoadDataPromise = null;
  }
}

function setUpdated() {
  // O horário técnico foi removido do cabeçalho: ocupava espaço sem ajudar a
  // leitura operacional. A atualização continua registrada internamente.
}

async function refreshData() {
  if (activeRefreshDataPromise) return activeRefreshDataPromise;
  const previousView = currentView;
  const previousPanelCode =
    previousView && previousView.startsWith("panel:")
      ? previousView.split(":")[1]
      : "";
  activeRefreshDataPromise = (async () => {
    loader(
      true,
      "Atualizando configurações",
      "Buscando parâmetros e painéis...",
      24,
    );
    await loadConfig();
    await loadPanels();
    await loadPanelPermissions();
    await loadMapaConfig();
    buildNav();
    loader(true, "Atualizando painéis", "Reconstruindo cache...", 48);
    warmExternalPanels(true);
    await sleep(180);
    loader(
      true,
      "Atualizando unidades",
      "Atualizando catálogo DSEI/CASAI...",
      58,
    );
    await loadUnidades();
    loader(true, "Atualizando dados", "Sincronizando monitoramento...", 68);
    const dataOk = await loadData({ showLoader: false });
    if (!dataOk) {
      loader(false);
      return false;
    }
    if (previousPanelCode) {
      const activePanel = panels.find(
        (p) => p.codigo === previousPanelCode && panelAllowed(p),
      );
      if (activePanel) {
        currentPanel = activePanel;
        openPanel(previousPanelCode);
      } else {
        currentPanel = null;
        navigate(startView());
      }
    } else if (isViewAllowed(previousView)) navigate(previousView);
    else navigate(startView());
    loader(false);
    toast("Dados atualizados.");
    return true;
  })();
  try {
    return await activeRefreshDataPromise;
  } finally {
    activeRefreshDataPromise = null;
  }
}

function buildNav() {
  const nav = $("nav");
  const principal = [];
  const external = [];
  const administration = [];
  if (can("ind"))
    principal.push(
      navButton("dashboard", cfgValue("page_title"), "fa-chart-line"),
    );
  if (can("cores"))
    principal.push(
      navButton("nucleo", cfgValue("nucleo_nav_title"), "fa-people-group"),
    );
  if (canViewCore(profile))
    principal.push(
      navButton("approved", "Lista de Aprovados", "fa-user-check"),
    );
  if (can("paineis"))
    panels
      .filter(panelAllowed)
      .sort((a, b) => n(a.ordem) - n(b.ordem))
      .forEach((p) => {
        external.push(
          navButton(
            "panel:" + p.codigo,
            p.titulo,
            p.icone || "fa-arrow-up-right-from-square",
          ),
        );
      });
  if (can("config"))
    administration.push(
      navButton("config", cfgValue("config_nav_title"), "fa-gear"),
    );
  const html = [
    navGroup("Principal", principal),
    navGroup("Painéis", external),
    navGroup("Administração", administration),
  ].join("");
  nav.innerHTML =
    html ||
    `<div class="alert warn">${esc(cfgValue("permissions_empty_text"))}</div>`;
  setActiveNav(currentView);
}

function navGroup(title, items) {
  return items.length
    ? `<section class="nav-group"><p>${esc(title)}</p><div>${items.join("")}</div></section>`
    : "";
}
function navIconHTML(ico) {
  return `<i class="fa-solid ${attr(/^fa-/.test(String(ico || "")) ? ico : "fa-circle")}" aria-hidden="true"></i>`;
}
function navButton(view, label, ico) {
  return `<button data-view="${attr(view)}" onclick="navigate('${attr(view)}')" aria-label="${attr(label)}" title="${attr(label)}"><span class="nav-ico">${navIconHTML(ico)}</span><span class="nav-text">${esc(label)}</span></button>`;
}
function setActiveNav(view) {
  document
    .querySelectorAll("#nav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
}

function navigate(view) {
  const previousView = currentView;
  const requestedView = txt(view) || startView();

  // Valida permissão antes de alterar currentView e antes de esconder páginas.
  // A versão anterior mudava o estado primeiro; se a permissão falhasse,
  // o painel podia ficar sem página ativa.
  if (requestedView === "dashboard" && !can("ind")) {
    toast("Sem permissão para Saúde Indígena.", "warn");
    return;
  }
  if (requestedView === "nucleo" && !can("cores")) {
    toast("Sem permissão para Equipe Núcleo.", "warn");
    return;
  }
  if (requestedView === "approved" && !canViewCore(profile)) {
    toast("Sem permissão para Lista de Aprovados.", "warn");
    return;
  }
  if (requestedView === "config" && !can("config")) {
    toast("Sem permissão para Configurações.", "warn");
    return;
  }
  if (requestedView.startsWith("panel:")) {
    const code = requestedView.split(":")[1];
    const panelOk = canAccessPanelCode(code);
    if (!panelOk) {
      toast(
        "Sem permissão para este painel externo ou painel inativo.",
        "warn",
      );
      return;
    }
  }

  document.body.classList.remove("external-clean");
  document.body.classList.remove("external-panel-mode");
  currentView = requestedView;
  rememberView(requestedView);
  if (!requestedView.startsWith("panel:")) currentPanel = null;
  if (requestedView !== "config") stopAccessDashboardRefresh();
  enforceResponsiveSidebar();
  setActiveNav(requestedView);
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));

  if (requestedView === "dashboard") {
    $("page-dashboard").classList.add("active");
    setPageTitle(cfgValue("page_title"), cfgValue("page_subtitle"));
    renderAll();
    if (previousView !== requestedView)
      trackAccess("abertura_tela", { tela: requestedView });
    return;
  }
  if (requestedView === "nucleo") {
    $("page-nucleo").classList.add("active");
    setPageTitle(
      cfgValue("nucleo_nav_title"),
      cfgValue("nucleo_page_subtitle"),
    );
    renderNucleo();
    if (previousView !== requestedView)
      trackAccess("abertura_tela", { tela: requestedView });
    return;
  }
  if (requestedView === "approved") {
    $("page-approved").classList.add("active");
    setPageTitle("Lista de Aprovados", "Acompanhe candidatos, contratações e situações dos editais.");
    void window.aprovadosController?.render();
    if (previousView !== requestedView)
      trackAccess("abertura_tela", { tela: requestedView });
    return;
  }
  if (requestedView === "config") {
    $("page-config").classList.add("active");
    setPageTitle(
      cfgValue("config_nav_title"),
      cfgValue("config_page_subtitle"),
    );
    renderConfigForm();
    startAccessDashboardRefresh();
    if (previousView !== requestedView)
      trackAccess("abertura_tela", { tela: requestedView });
    return;
  }
  if (requestedView.startsWith("panel:")) {
    openPanel(requestedView.split(":")[1]);
    if (previousView !== requestedView)
      trackAccess("abertura_tela", { tela: requestedView });
  }
  void syncOnlinePresence();
}

function setPageTitle(title, sub) {
  $("pageTitle").textContent = title;
  $("pageSubtitle").textContent = sub;
  // O nome da aba tem um dono só; aqui entra apenas a metade da página.
  definirPaginaDaAba(title);
  updateAraraGuide(
    currentView,
    title,
    document.getElementById("araraGuideHost"),
  );
}

function isSidebarLockedViewport() {
  return window.matchMedia(`(max-width:${SIDEBAR_MOBILE_BREAKPOINT}px)`)
    .matches;
}
function shouldLockSidebar() {
  return SIDEBAR_FORCE_LOCK_VIEWS.has(currentView);
}
function enforceResponsiveSidebar() {
  const locked = shouldLockSidebar();
  document.body.classList.toggle("sidebar-locked", locked);
  if (
    locked ||
    (isSidebarLockedViewport() &&
      !document.body.classList.contains("sidebar-open"))
  )
    document.body.classList.add("sidebar-collapsed");
  syncSidebarToggle();
}

function syncSidebarToggle() {
  const button = $("globalSidebarToggle");
  const icon = button?.querySelector("i");
  if (!button || !icon) return;
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  const label = collapsed ? "Expandir menu lateral" : "Recolher menu lateral";
  icon.className = "fa-solid fa-bars";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function toggleSidebar() {
  if (isSidebarLockedViewport()) {
    const opening =
      document.body.classList.contains("sidebar-collapsed") &&
      !document.body.classList.contains("sidebar-open");
    document.body.classList.toggle("sidebar-open", opening);
    document.body.classList.toggle("sidebar-collapsed", !opening);
    syncSidebarToggle();
    window.dispatchEvent(new Event("resize"));
    return;
  }
  enforceResponsiveSidebar();
  if (shouldLockSidebar()) {
    document.body.classList.add("sidebar-collapsed");
    syncSidebarToggle();
    if (currentView === "dashboard") scheduleMapResize(240);
    return;
  }
  document.body.classList.toggle("sidebar-collapsed");
  syncSidebarToggle();
  try {
    localStorage.setItem(
      "agsus_monitora_sidebar_collapsed_v1",
      document.body.classList.contains("sidebar-collapsed") ? "1" : "0",
    );
  } catch (e) {}
  if (currentView === "dashboard") scheduleMapResize(240);
}

function syncFilterToggleText() {
  const btn = $("filterToggleBtn");
  const body = $("filterBody");
  if (!btn || !body) return;
  btn.textContent = body.classList.contains("hidden")
    ? cfgValue("filter_toggle_show")
    : cfgValue("filter_toggle_hide");
}
function toggleFilters() {
  $("filterBody").classList.toggle("hidden");
  syncFilterToggleText();
}

function selectedValues(field) {
  return Array.from(filterState[field] || []);
}
function rowValue(r, field) {
  return txt(r[field]);
}
function rowMatchesFilterState(r, ignoreField = "") {
  if (hideClosed && isEncerrado(r)) return false; // toggle "Ocultar encerrados"
  return FILTER_CONFIG.every((cfg) => {
    if (cfg.field === ignoreField) return true;
    const selected = filterState[cfg.field];
    if (!selected || selected.size === 0) return true;
    return selected.has(rowValue(r, cfg.field));
  });
}
function normalizeForSort(value) {
  return txt(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function editalSortParts(value) {
  const m = txt(value).match(/^(\d{1,3})\s*\/\s*(\d{4})/);
  if (!m) return null;
  return { numero: Number(m[1]), ano: Number(m[2]) };
}
function rankFromList(value, list) {
  const key = normalizeForSort(value);
  const idx = list.map(normalizeForSort).indexOf(key);
  return idx >= 0 ? idx : 999;
}
function compareFilterValues(field, a, b) {
  if (field === "edital") {
    const ea = editalSortParts(a),
      eb = editalSortParts(b);
    if (ea && eb) {
      if (ea.ano !== eb.ano) return ea.ano - eb.ano;
      if (ea.numero !== eb.numero) return ea.numero - eb.numero;
    }
    if (ea && !eb) return -1;
    if (!ea && eb) return 1;
  }
  if (field === "etapa") {
    const ordem = [
      "Elaboração do Edital",
      "Impugnação do Edital",
      "Período de inscrição",
      "Análise Curricular",
      "Resultado Preliminar",
      "Abertura do Prazo de Recurso",
      "Entrevistas",
      "Resultado final do Processo Seletivo",
    ];
    const ra = rankFromList(a, ordem),
      rb = rankFromList(b, ordem);
    if (ra !== rb) return ra - rb;
  }
  if (field === "status") {
    const ordem = [
      "Em Andamento",
      "Andamento",
      "Concluído",
      "Concluido",
      "Cancelado",
      "Cancelada",
    ];
    const ra = rankFromList(a, ordem),
      rb = rankFromList(b, ordem);
    if (ra !== rb) return ra - rb;
  }
  if (field === "risco") {
    const ordem = ["Alto", "Médio", "Medio", "Baixo"];
    const ra = rankFromList(a, ordem),
      rb = rankFromList(b, ordem);
    if (ra !== rb) return ra - rb;
  }
  return txt(a).localeCompare(txt(b), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}
function optionValuesFor(field) {
  const values = new Set();
  rows.forEach((r) => {
    if (rowMatchesFilterState(r, field)) {
      const value = rowValue(r, field);
      if (value) values.add(value);
    }
  });
  return Array.from(values).sort((a, b) => compareFilterValues(field, a, b));
}
function pruneFilterSelections() {
  let changed = false;
  FILTER_CONFIG.forEach((cfg) => {
    const allowed = new Set(optionValuesFor(cfg.field));
    const selected = filterState[cfg.field] || new Set();
    Array.from(selected).forEach((value) => {
      if (!allowed.has(value)) {
        selected.delete(value);
        changed = true;
      }
    });
  });
  return changed;
}
function filterLabel(cfg) {
  const selected = selectedValues(cfg.field);
  if (!selected.length) return cfg.all;
  if (selected.length === 1) return selected[0];
  return `${selected.length} selecionados`;
}

function renderFilterControls() {
  FILTER_CONFIG.forEach((cfg) => {
    const el = $(cfg.id);
    if (!el) return;
    const values = optionValuesFor(cfg.field);
    const selected = filterState[cfg.field] || new Set();
    const label = filterLabel(cfg);
    const options = values.length
      ? values
          .map(
            (value) =>
              `<label class="multi-option" title="${attr(value)}"><input type="checkbox" data-filter-field="${attr(cfg.field)}" data-filter-value="${attr(value)}" ${selected.has(value) ? "checked" : ""}><span>${esc(value)}</span></label>`,
          )
          .join("")
      : `<div class="multi-option empty">Nenhuma opção disponível</div>`;
    el.innerHTML = `<button type="button" class="multi-select-toggle" onclick="toggleFilterMenu('${attr(cfg.id)}')" title="${attr(label)}"><span class="multi-label">${esc(label)}</span><span class="multi-caret">▾</span></button><div class="multi-select-menu"><div class="multi-select-actions"><button type="button" class="multi-mini-btn" data-filter-action="select-all" data-filter-field="${attr(cfg.field)}">Selecionar visíveis</button><button type="button" class="multi-mini-btn" data-filter-action="clear" data-filter-field="${attr(cfg.field)}">Limpar</button></div><div class="multi-options">${options}</div><div class="multi-hint">${values.length} opção(ões) disponível(is).</div></div>`;
  });
}

function closeFilterMenus(exceptId = "") {
  document.querySelectorAll(".multi-select.open").forEach((el) => {
    if (!exceptId || el.id !== exceptId) el.classList.remove("open");
  });
}
function toggleFilterMenu(id) {
  const el = $(id);
  if (!el) return;
  const opening = !el.classList.contains("open");
  closeFilterMenus(id);
  el.classList.toggle("open", opening);
}
function applyFilterStateChange(options = {}) {
  const openId = options.keepOpen
    ? document.querySelector(".multi-select.open")?.id
    : "";
  pruneFilterSelections();
  saveFilterState();
  renderFilterControls();
  if (openId) $(openId)?.classList.add("open");
  applyFilters();
}
function toggleFilterValue(field, value, options = {}) {
  const selected = filterState[field] || new Set();
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
  filterState[field] = selected;
  applyFilterStateChange(options);
}
function selectAllFilterValues(field) {
  filterState[field] = new Set(optionValuesFor(field));
  applyFilterStateChange({ keepOpen: true });
}
function clearFilterField(field) {
  filterState[field] = new Set();
  applyFilterStateChange({ keepOpen: true });
}
function initFilterControls() {
  document.addEventListener("click", (ev) => {
    const actionBtn = ev.target.closest?.("[data-filter-action]");
    if (actionBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      const field = actionBtn.dataset.filterField;
      if (actionBtn.dataset.filterAction === "select-all")
        selectAllFilterValues(field);
      if (actionBtn.dataset.filterAction === "clear") clearFilterField(field);
      return;
    }
    if (!ev.target.closest || !ev.target.closest(".multi-select"))
      closeFilterMenus();
  });
  document.addEventListener("change", (ev) => {
    const input = ev.target.closest?.("input[data-filter-field]");
    if (!input) return;
    ev.stopPropagation();
    toggleFilterValue(input.dataset.filterField, input.dataset.filterValue, {
      keepOpen: true,
    });
  });
}
function populateFilters() {
  loadFilterState();
  try {
    hideClosed = localStorage.getItem("agsus_hide_closed_v1") === "1";
  } catch (e) {}
  try {
    syncMapLevelUI();
  } catch (e) {}
  syncHideClosedBtn();
  pruneFilterSelections();
  renderFilterControls();
}
function clearFilters() {
  hideClosed = false;
  try {
    localStorage.setItem("agsus_hide_closed_v1", "0");
  } catch (e) {}
  syncHideClosedBtn();
  filterState = Object.fromEntries(
    FILTER_CONFIG.map((f) => [f.field, new Set()]),
  );
  ["tableSearch"].forEach((id) => {
    const el = $(id);
    if (el) el.value = "";
  });
  saveFilterState();
  renderFilterControls();
  applyFilters();
  // mapa volta à visão Brasil (sem polos nem estado destacado)
  if (_leaflet) {
    if (_layerPolos) _layerPolos.clearLayers();
    if (_layerUF) _layerUF.clearLayers();
    $("drillBackBtn") && ($("drillBackBtn").style.display = "none");
    drawDSEIBubbles();
  }
}

function applyFilters() {
  ensureSearchInputTextColor();
  const qt = normalizeForSort($("tableSearch")?.value);
  filtered = rows
    .filter((r) => {
      const hay = [
        r.processo,
        r.edital,
        r.unidade,
        r.ciclo,
        r.uf,
        r.status,
        r.etapa,
        r.responsavel,
        r.cargos,
        r.risco,
        r.observacoes,
        r.observacoes_internas,
        r.link_edital,
      ]
        .map(normalizeForSort)
        .join(" | ");
      return rowMatchesFilterState(r) && (!qt || hay.includes(qt));
    })
    .sort(compareRowsForTable);

  // A chave do mapa precisa considerar UF e quantidade.
  // Antes era apenas a lista de UFs; quando a busca mudava a quantidade,
  // mas mantinha as mesmas UFs, o mapa ficava visualmente desatualizado.
  const mapCounts = {};
  filtered.forEach((r) => {
    const k = dseiKey(r.unidade);
    if (k) mapCounts[k] = (mapCounts[k] || 0) + 1;
  });
  const newUfKey =
    (hasActiveFilter() ? "F|" : "A|") +
    Object.entries(mapCounts)
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([k, count]) => `${k}:${count}`)
      .join("|");
  const mapChanged = newUfKey !== lastMapUfKey;
  lastMapUfKey = newUfKey;

  renderKpis();
  renderMultiUnits();
  renderStatusSummary();
  renderChart();
  if (mapChanged) renderMap();
  renderRisks();
  renderActiveFilters();
  renderTable();
  if (currentView === "nucleo") renderNucleo();
}

function toggleSelectFilter(selectId, value, label) {
  const field = FILTER_ID_TO_FIELD[selectId];
  if (field) {
    const cleanValue = txt(value);
    const selected = filterState[field] || new Set();
    const removing = selected.size === 1 && selected.has(cleanValue);
    filterState[field] = removing ? new Set() : new Set([cleanValue]);
    applyFilterStateChange();
    toast(removing ? `${label} removido.` : `${label}: ${cleanValue}`);
    return;
  }
  const el = $(selectId);
  if (!el) return;
  const cleanValue = txt(value);
  const removing = txt(el.value) === cleanValue;
  el.value = removing ? "" : cleanValue;
  applyFilters();
  toast(removing ? `${label} removido.` : `${label}: ${cleanValue}`);
}

// Processo encerrado (concluído ou cancelado) não é risco ativo a monitorar.
function isEncerrado(r) {
  return ["concluído", "concluido", "cancelado", "cancelada"].includes(
    low(r.status),
  );
}
function isRiscoAtivo(r) {
  return !isEncerrado(r) && ["alto", "médio", "medio"].includes(low(r.risco));
}
function criticalRiskValues() {
  const values = optionValuesFor("risco").filter((v) =>
    ["alto", "médio", "medio"].includes(low(v)),
  );
  return values.length ? values : ["Alto", "Médio"];
}
function isCriticalRiskFilterActive() {
  const sel = Array.from(filterState.risco || []);
  return (
    sel.length > 0 &&
    sel.every((v) => ["alto", "médio", "medio"].includes(low(v)))
  );
}
function toggleCriticalRiskFilter() {
  const active = isCriticalRiskFilterActive();
  filterState.risco = active ? new Set() : new Set(criticalRiskValues());
  applyFilterStateChange();
  toast(
    active ? "Filtro de risco removido." : "Filtro aplicado: risco Médio/Alto.",
  );
}

function riskRank(value) {
  const rank = { alto: 0, médio: 1, medio: 1, baixo: 2 };
  return rank[low(value)] ?? 9;
}
function compareRows(a, b) {
  const ar = riskRank(a.risco),
    br = riskRank(b.risco);
  if (ar !== br) return ar - br;
  return n(b.vagas_ociosas) - n(a.vagas_ociosas);
}
function sortValue(row, field) {
  if (["vagas_total", "contratados", "vagas_ociosas"].includes(field))
    return n(row[field]);
  if (field === "risco") return riskRank(row.risco);
  if (field === "data_inicio" || field === "data_fim") {
    const v = txt(row[field]);
    const t = v ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? t : 0;
  }
  return txt(row[field]).toLocaleLowerCase("pt-BR");
}
function compareRowsForTable(a, b) {
  if (!tableSort.field || !tableSort.direction) return compareRows(a, b);
  const av = sortValue(a, tableSort.field),
    bv = sortValue(b, tableSort.field);
  let result = 0;
  if (typeof av === "number" && typeof bv === "number") result = av - bv;
  else
    result = String(av).localeCompare(String(bv), "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
  if (result === 0) result = compareRows(a, b);
  return tableSort.direction === "desc" ? -result : result;
}
function sortDetails(field) {
  if (tableSort.field !== field) tableSort = { field, direction: "asc" };
  else if (tableSort.direction === "asc")
    tableSort = { field, direction: "desc" };
  else tableSort = { field: "", direction: "" };
  applyFilters();
}
function renderSortIndicators() {
  document
    .querySelectorAll(".details-table th[data-sort-field]")
    .forEach((th) => {
      const field = th.getAttribute("data-sort-field");
      th.classList.toggle(
        "sorted-asc",
        tableSort.field === field && tableSort.direction === "asc",
      );
      th.classList.toggle(
        "sorted-desc",
        tableSort.field === field && tableSort.direction === "desc",
      );
      const icon = th.querySelector(".sort-icon");
      if (icon && tableSort.field !== field) icon.textContent = "↕";
    });
}

function sum(field) {
  return filtered.reduce((acc, r) => acc + n(r[field]), 0);
}
function renderAll() {
  renderKpis();
  renderMultiUnits();
  renderStatusSummary();
  renderChart();
  renderMap();
  renderRisks();
  renderTable();
  if (currentView === "nucleo") renderNucleo();
}
function canUseMonitoramentoPayload() {
  return !!monitoramentoPayload && !hasActiveFilter() && !hideClosed;
}

function renderKpis() {
  const payloadKpis = canUseMonitoramentoPayload()
    ? monitoramentoPayload.kpis
    : null;
  const vagas = payloadKpis ? n(payloadKpis.vagas_total) : sum("vagas_total");
  const contrat = payloadKpis ? n(payloadKpis.contratados) : sum("contratados");
  const ociosas = payloadKpis
    ? n(payloadKpis.vagas_ociosas)
    : sum("vagas_ociosas");
  const inscritos = payloadKpis ? n(payloadKpis.inscritos) : sum("inscritos");
  const processos = payloadKpis
    ? n(payloadKpis.processos_ativos)
    : filtered.length;
  const kProcessos = $("kProcessos");
  const kVagas = $("kVagas");
  const kContratados = $("kContratados");
  const kOciosas = $("kOciosas");
  const kCriticos = $("kCriticos");
  const kInscritos = $("kInscritos");

  if (kProcessos) kProcessos.textContent = fmt(processos);
  if (kVagas) kVagas.textContent = fmt(vagas);
  if (kContratados) kContratados.textContent = fmt(contrat);
  if (kOciosas) kOciosas.textContent = fmt(ociosas);
  if (kCriticos)
    kCriticos.textContent = fmt(filtered.filter(isRiscoAtivo).length);
  if (kInscritos) kInscritos.textContent = fmt(inscritos);

  // Taxa de preenchimento: o alvo correto é o card .kpi, não o <b>.
  // Na versão anterior a barra era injetada dentro do número do KPI,
  // quebrando a semântica visual e podendo deixar barras antigas.
  function setRate(valueElementId, pct, color) {
    const valueEl = $(valueElementId);
    const card = valueEl?.closest(".kpi");
    if (!card) return;
    let bar = card.querySelector(".kpi-rate");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "kpi-rate";
      bar.innerHTML = `<div class="kpi-rate-bar"><div class="kpi-rate-fill"></div></div><span class="kpi-rate-pct"></span>`;
      card.appendChild(bar);
    }
    const safePct = Math.max(
      0,
      Math.min(100, Number.isFinite(Number(pct)) ? Number(pct) : 0),
    );
    const fill = bar.querySelector(".kpi-rate-fill");
    const label = bar.querySelector(".kpi-rate-pct");
    if (fill) fill.style.cssText = `width:${safePct}%;background:${color}`;
    if (label) label.textContent = `${safePct}% das vagas`;
  }
  function clearRate(valueElementId) {
    const card = $(valueElementId)?.closest(".kpi");
    card?.querySelector(".kpi-rate")?.remove();
  }

  if (vagas) {
    setRate("kContratados", Math.round((contrat / vagas) * 100), "#0b8f58");
    setRate("kOciosas", Math.round((ociosas / vagas) * 100), "#d92d3a");
  } else {
    clearRate("kContratados");
    clearRate("kOciosas");
  }

  const criticalActive = isCriticalRiskFilterActive();
  const criticalCard = $("kpiCriticosCard");
  if (criticalCard)
    criticalCard.classList.toggle("active-filter", criticalActive);
  if ($("panicChip"))
    $("panicChip").textContent = criticalActive ? "FILTRO ATIVO" : "MÉDIO/ALTO";
}

function group(field) {
  const out = {};
  filtered.forEach((r) => {
    const k = txt(r[field]) || "Não informado";
    out[k] = (out[k] || 0) + 1;
  });
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}
function etapaChipClass(etapa) {
  const l = low(etapa);
  if (l.includes("conclu")) return "green";
  if (l.includes("entrevista")) return "blue";
  if (l.includes("análise") || l.includes("analise")) return "cyan";
  if (l.includes("resultado")) return "yellow";
  if (l.includes("cancel")) return "red";
  return "gray";
}
function renderStatusSummary() {
  const entries = group("etapa");
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!entries.length) {
    $("statusSummary").innerHTML = `<div class="alert">Sem dados.</div>`;
    return;
  }
  $("statusSummary").innerHTML = entries
    .map(([k, v]) => {
      const cls = etapaChipClass(k);
      const pct = total ? Math.round((v / total) * 100) : 0;
      const barColor =
        cls === "green"
          ? "#0b8f58"
          : cls === "blue"
            ? "#0d6efd"
            : cls === "cyan"
              ? "#00a8d6"
              : cls === "yellow"
                ? "#f2b705"
                : cls === "red"
                  ? "#d92d3a"
                  : "#60758f";
      return `<div data-etapa-toggle="true" onclick="toggleSelectFilter('filterEtapa','${attr(k)}','Filtro de etapa')" title="Clique para filtrar" style="border-bottom:1px solid var(--line);padding:10px 0;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;">
          <b style="font-size:13px;font-weight:700;color:#10243e">${esc(k)}</b>
          <div style="display:flex;align-items:center;gap:7px;flex-shrink:0;">
            <span style="font-size:12px;color:#60758f;font-weight:700">${pct}%</span>
            <span class="chip ${cls}">${fmt(v)}</span>
          </div>
        </div>
        <div style="height:5px;background:#e8f0f8;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width .4s ease;"></div>
        </div>
      </div>`;
    })
    .join("");
}

function renderMultiUnits() {
  const card = $("multiUnitsCard");
  if (!card) return;
  const counts = {};
  filtered.forEach((r) => {
    const unidade = txt(r.unidade) || "Não informada";
    counts[unidade] = (counts[unidade] || 0) + 1;
  });
  const units = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, 8);
  if (!units.length) {
    card.classList.add("hidden");
    card.innerHTML = "";
    return;
  }
  card.classList.remove("hidden");
  card.innerHTML = `<div class="multi-units-title"><i class="fa-solid fa-layer-group"></i> Unidades com mais de um processo seletivo</div><div class="multi-units-list">${units.map(([unit, count]) => `<button type="button" class="multi-unit-chip" data-unit="${attr(unit)}" title="Filtrar por ${attr(unit)}">${esc(unit)} <span class="chip blue">${fmt(count)}</span></button>`).join("")}</div>`;
  card
    .querySelectorAll(".multi-unit-chip")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        toggleSelectFilter(
          "filterUnidade",
          btn.dataset.unit,
          "Filtro de unidade",
        ),
      ),
    );
}

function renderChart() {
  const canvas = $("statusChart");
  if (!canvas || !window.Chart) return;
  const entries = group("status");
  const labels = entries.map((x) => x[0]);
  const values = entries.map((x) => x[1]);
  const colors = labels.map((label) => {
    const l = low(label);
    if (l.includes("conclu")) return "#0ea76b";
    if (l.includes("andamento")) return "#0d6efd";
    if (l.includes("elabora")) return "#00b8d9";
    if (l.includes("cancel")) return "#e4323b";
    return "#7d8da5";
  });
  // Atualiza in-place se o gráfico já existe (mais rápido, sem flash visual)
  if (statusChart) {
    statusChart.data.labels = labels;
    statusChart.data.datasets[0].data = values;
    statusChart.data.datasets[0].backgroundColor = colors;
    statusChart.update();
    return;
  }
  statusChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            font: { weight: "bold" },
          },
        },
      },
      onClick: (evt, items) => {
        if (!items.length) return;
        toggleSelectFilter(
          "filterStatus",
          statusChart.data.labels[items[0].index],
          "Filtro de status",
        );
      },
    },
  });
}

// ── Mapa do Brasil (SVG coroplético autônomo, sem dependência de API externa) ──
// ===== MAPA LEAFLET (fundo real OpenStreetMap) =====
let LMAP = { dsei: [], casai: [] };
const UF_GEO = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { uf: "AC" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-73.8, -7.11],
            [-72.66, -7.62],
            [-70.58, -8.1],
            [-66.63, -9.93],
            [-67.05, -10.28],
            [-67.41, -10.38],
            [-67.71, -10.71],
            [-68.05, -10.67],
            [-68.26, -10.97],
            [-68.54, -11.11],
            [-68.71, -11.13],
            [-68.8, -10.99],
            [-69.42, -10.93],
            [-69.74, -10.97],
            [-69.94, -10.92],
            [-70.31, -11.07],
            [-70.52, -10.94],
            [-70.62, -11.0],
            [-70.62, -9.82],
            [-70.53, -9.71],
            [-70.6, -9.56],
            [-70.49, -9.43],
            [-71.23, -9.97],
            [-72.06, -10.0],
            [-72.18, -9.99],
            [-72.15, -9.8],
            [-72.27, -9.75],
            [-72.25, -9.61],
            [-72.37, -9.49],
            [-73.21, -9.41],
            [-72.95, -9.13],
            [-72.94, -8.99],
            [-73.13, -8.71],
            [-73.29, -8.62],
            [-73.28, -8.47],
            [-73.54, -8.35],
            [-73.63, -8.02],
            [-73.77, -7.9],
            [-73.69, -7.78],
            [-73.99, -7.55],
            [-73.92, -7.46],
            [-73.96, -7.35],
            [-73.7, -7.3],
            [-73.8, -7.11],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "AL" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-35.47, -8.82],
            [-35.15, -8.92],
            [-35.3, -9.18],
            [-35.37, -9.27],
            [-36.27, -10.28],
            [-36.39, -10.5],
            [-36.46, -10.41],
            [-36.55, -10.42],
            [-36.63, -10.26],
            [-36.84, -10.2],
            [-36.99, -9.98],
            [-37.78, -9.64],
            [-38.2, -9.42],
            [-38.24, -9.33],
            [-37.98, -9.15],
            [-37.76, -8.86],
            [-37.7, -8.99],
            [-37.49, -8.96],
            [-37.23, -9.24],
            [-37.08, -9.25],
            [-36.95, -9.38],
            [-36.87, -9.27],
            [-36.6, -9.34],
            [-36.24, -9.17],
            [-36.27, -9.11],
            [-36.06, -8.91],
            [-35.47, -8.82],
          ],
          [
            [-35.29, -9.15],
            [-35.29, -9.15],
            [-35.29, -9.15],
            [-35.29, -9.15],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "AM" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-67.41, 2.25],
            [-67.28, 1.88],
            [-67.15, 1.84],
            [-67.1, 1.73],
            [-67.08, 1.18],
            [-66.86, 1.23],
            [-66.32, 0.76],
            [-66.12, 0.75],
            [-65.74, 1.0],
            [-65.58, 1.0],
            [-65.49, 0.88],
            [-65.58, 0.74],
            [-65.55, 0.66],
            [-65.43, 0.7],
            [-65.32, 0.93],
            [-65.18, 0.92],
            [-65.1, 1.16],
            [-65.02, 1.12],
            [-64.8, 1.31],
            [-64.73, 1.24],
            [-64.4, 1.52],
            [-64.35, 1.5],
            [-64.4, 1.4],
            [-64.33, 1.37],
            [-64.11, 1.59],
            [-64.0, 1.98],
            [-63.66, 2.02],
            [-63.38, 2.21],
            [-63.14, 2.17],
            [-63.07, 2.04],
            [-62.71, 1.94],
            [-62.8, 1.6],
            [-62.62, 1.4],
            [-62.44, 0.97],
            [-62.53, 0.5],
            [-62.42, 0.08],
            [-62.19, -0.33],
            [-62.31, -0.51],
            [-62.3, -0.65],
            [-62.39, -0.72],
            [-62.49, -0.68],
            [-62.5, -0.77],
            [-62.04, -1.12],
            [-61.9, -1.4],
            [-61.6, -1.45],
            [-61.48, -1.58],
            [-61.63, -1.3],
            [-61.55, -0.81],
            [-61.21, -0.5],
            [-60.92, -0.56],
            [-60.67, -0.89],
            [-60.31, -0.72],
            [-60.4, -0.51],
            [-60.04, 0.26],
            [-59.19, 0.26],
            [-58.9, -0.01],
            [-58.87, -0.34],
            [-58.73, -0.43],
            [-58.7, -0.68],
            [-58.44, -0.88],
            [-58.32, -1.14],
            [-58.16, -1.23],
            [-58.02, -1.11],
            [-57.95, -1.41],
            [-57.39, -1.72],
            [-57.16, -1.72],
            [-57.03, -1.91],
            [-56.73, -2.02],
            [-56.77, -2.14],
            [-56.7, -2.2],
            [-56.41, -2.18],
            [-56.1, -2.03],
            [-56.47, -2.42],
            [-56.43, -2.52],
            [-58.27, -6.47],
            [-58.47, -6.67],
            [-58.43, -6.91],
            [-58.2, -7.14],
            [-58.14, -7.36],
            [-58.2, -7.62],
            [-58.38, -7.85],
            [-58.29, -8.13],
            [-58.44, -8.7],
            [-58.33, -8.72],
            [-58.5, -8.8],
            [-61.58, -8.8],
            [-61.71, -8.69],
            [-61.98, -8.87],
            [-62.12, -8.8],
            [-62.19, -8.59],
            [-62.34, -8.6],
            [-62.36, -8.4],
            [-62.52, -8.38],
            [-62.84, -7.99],
            [-63.55, -7.97],
            [-63.78, -8.33],
            [-63.93, -8.32],
            [-63.92, -8.57],
            [-64.13, -8.72],
            [-64.14, -8.95],
            [-64.82, -8.99],
            [-64.92, -9.05],
            [-64.92, -9.23],
            [-65.09, -9.43],
            [-65.18, -9.43],
            [-65.25, -9.26],
            [-65.44, -9.31],
            [-65.43, -9.46],
            [-65.6, -9.41],
            [-65.79, -9.59],
            [-65.97, -9.41],
            [-66.41, -9.41],
            [-66.5, -9.63],
            [-66.81, -9.81],
            [-68.73, -9.0],
            [-70.58, -8.1],
            [-72.66, -7.62],
            [-73.8, -7.12],
            [-73.64, -6.75],
            [-73.14, -6.5],
            [-73.24, -6.03],
            [-72.96, -5.65],
            [-72.88, -5.17],
            [-72.81, -5.11],
            [-71.89, -4.52],
            [-71.63, -4.47],
            [-71.61, -4.53],
            [-71.27, -4.38],
            [-70.95, -4.38],
            [-70.81, -4.18],
            [-70.69, -4.2],
            [-70.65, -4.13],
            [-70.61, -4.19],
            [-70.33, -4.15],
            [-70.2, -4.36],
            [-70.11, -4.26],
            [-70.04, -4.35],
            [-69.96, -4.3],
            [-69.4, -1.13],
            [-69.62, -0.75],
            [-69.61, -0.51],
            [-70.05, -0.19],
            [-70.03, 0.56],
            [-69.8, 0.58],
            [-69.68, 0.67],
            [-69.61, 0.63],
            [-69.48, 0.74],
            [-69.36, 0.61],
            [-69.12, 0.64],
            [-69.19, 0.75],
            [-69.14, 0.89],
            [-69.25, 1.05],
            [-69.84, 1.09],
            [-69.84, 1.58],
            [-69.83, 1.72],
            [-69.55, 1.79],
            [-69.38, 1.73],
            [-68.16, 1.74],
            [-68.27, 1.83],
            [-68.18, 1.98],
            [-67.93, 1.83],
            [-67.77, 2.04],
            [-67.62, 2.02],
            [-67.41, 2.25],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "AP" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-51.25, 4.19],
            [-51.08, 3.88],
            [-51.01, 3.04],
            [-50.7, 2.14],
            [-50.45, 2.2],
            [-50.23, 1.8],
            [-49.91, 1.7],
            [-49.9, 1.19],
            [-50.06, 0.8],
            [-50.41, 0.62],
            [-50.6, 0.25],
            [-51.33, -0.27],
            [-51.68, -0.79],
            [-51.7, -1.07],
            [-51.89, -1.17],
            [-51.98, -1.12],
            [-52.05, -1.23],
            [-52.43, -1.05],
            [-52.4, -0.88],
            [-52.53, -0.84],
            [-52.53, -0.58],
            [-52.67, -0.54],
            [-52.68, -0.31],
            [-52.93, -0.14],
            [-53.09, 0.2],
            [-53.17, 0.38],
            [-53.1, 0.68],
            [-53.41, 0.95],
            [-53.43, 1.24],
            [-53.54, 1.21],
            [-53.55, 1.35],
            [-53.65, 1.34],
            [-53.65, 1.41],
            [-53.85, 1.39],
            [-54.09, 1.49],
            [-54.15, 1.64],
            [-54.3, 1.74],
            [-54.75, 1.79],
            [-54.81, 2.06],
            [-54.76, 2.2],
            [-54.88, 2.43],
            [-54.69, 2.44],
            [-54.66, 2.33],
            [-54.44, 2.21],
            [-54.19, 2.18],
            [-53.76, 2.38],
            [-53.75, 2.31],
            [-53.53, 2.26],
            [-53.34, 2.35],
            [-53.23, 2.27],
            [-53.28, 2.22],
            [-53.27, 2.17],
            [-52.95, 2.17],
            [-52.55, 2.52],
            [-52.33, 3.17],
            [-51.97, 3.72],
            [-51.65, 4.04],
            [-51.54, 4.43],
            [-51.25, 4.19],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "BA" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-39.29, -8.56],
            [-39.22, -8.71],
            [-38.8, -8.79],
            [-38.64, -8.99],
            [-38.51, -8.83],
            [-38.5, -8.98],
            [-38.29, -9.04],
            [-38.32, -9.14],
            [-38.2, -9.42],
            [-38.01, -9.48],
            [-38.0, -9.91],
            [-37.82, -10.02],
            [-37.74, -10.33],
            [-37.85, -10.41],
            [-37.81, -10.69],
            [-38.0, -10.76],
            [-38.21, -10.71],
            [-38.23, -10.91],
            [-37.98, -11.19],
            [-37.98, -11.39],
            [-37.8, -11.52],
            [-37.52, -11.55],
            [-37.34, -11.44],
            [-38.05, -12.63],
            [-38.35, -12.95],
            [-38.49, -13.01],
            [-38.61, -12.93],
            [-38.97, -13.28],
            [-38.89, -13.64],
            [-39.0, -13.74],
            [-38.93, -13.94],
            [-39.06, -14.71],
            [-38.86, -15.85],
            [-39.21, -17.17],
            [-39.13, -17.69],
            [-39.49, -18.0],
            [-39.66, -18.34],
            [-40.22, -17.98],
            [-40.22, -17.73],
            [-40.61, -17.42],
            [-40.49, -16.88],
            [-40.28, -16.9],
            [-40.26, -16.82],
            [-40.34, -16.79],
            [-40.29, -16.6],
            [-40.16, -16.58],
            [-39.86, -16.11],
            [-40.23, -15.8],
            [-40.56, -15.8],
            [-40.83, -15.65],
            [-41.13, -15.77],
            [-41.33, -15.74],
            [-41.36, -15.5],
            [-41.79, -15.11],
            [-42.09, -15.19],
            [-42.17, -15.09],
            [-42.44, -15.06],
            [-42.95, -14.71],
            [-43.19, -14.65],
            [-43.53, -14.81],
            [-43.88, -14.65],
            [-43.78, -14.34],
            [-44.22, -14.23],
            [-44.58, -14.35],
            [-45.09, -14.75],
            [-45.17, -14.73],
            [-45.45, -14.95],
            [-45.57, -14.94],
            [-45.72, -15.11],
            [-45.95, -15.14],
            [-46.09, -15.25],
            [-45.97, -14.99],
            [-46.05, -14.83],
            [-46.02, -14.42],
            [-45.91, -14.35],
            [-46.27, -14.1],
            [-46.21, -14.02],
            [-46.26, -13.69],
            [-46.16, -13.59],
            [-46.23, -13.56],
            [-46.24, -13.43],
            [-46.04, -13.27],
            [-46.28, -13.35],
            [-46.33, -13.25],
            [-46.27, -13.02],
            [-46.11, -12.92],
            [-46.3, -12.95],
            [-46.29, -12.63],
            [-46.16, -12.47],
            [-46.25, -12.49],
            [-46.35, -12.34],
            [-46.4, -12.03],
            [-46.17, -11.9],
            [-46.37, -11.87],
            [-46.31, -11.63],
            [-46.08, -11.64],
            [-46.48, -11.52],
            [-46.62, -11.29],
            [-46.28, -10.91],
            [-46.19, -10.63],
            [-45.83, -10.44],
            [-45.7, -10.27],
            [-45.72, -10.15],
            [-45.6, -10.11],
            [-45.4, -10.45],
            [-45.43, -10.63],
            [-45.25, -10.82],
            [-44.91, -10.91],
            [-44.58, -10.63],
            [-44.34, -10.55],
            [-44.13, -10.63],
            [-43.66, -10.0],
            [-43.65, -9.84],
            [-43.78, -9.76],
            [-43.85, -9.55],
            [-43.49, -9.27],
            [-43.28, -9.42],
            [-42.98, -9.4],
            [-42.95, -9.51],
            [-42.77, -9.62],
            [-42.23, -9.29],
            [-41.84, -9.24],
            [-41.72, -9.01],
            [-41.54, -8.96],
            [-41.38, -8.71],
            [-41.11, -8.7],
            [-41.03, -8.84],
            [-40.92, -8.84],
            [-40.81, -9.08],
            [-40.67, -9.16],
            [-40.77, -9.45],
            [-40.59, -9.47],
            [-40.34, -9.35],
            [-40.25, -9.06],
            [-39.96, -9.05],
            [-39.89, -8.83],
            [-39.67, -8.78],
            [-39.69, -8.66],
            [-39.41, -8.54],
            [-39.29, -8.56],
          ],
          [
            [-39.58, -18.09],
            [-39.57, -18.08],
            [-39.58, -18.08],
            [-39.58, -18.09],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "CE" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-40.02, -2.84],
              [-39.26, -3.22],
              [-38.65, -3.68],
              [-38.47, -3.71],
              [-38.01, -4.25],
              [-37.59, -4.62],
              [-37.33, -4.7],
              [-37.25, -4.83],
              [-37.64, -4.93],
              [-37.9, -5.5],
              [-38.08, -5.67],
              [-38.16, -5.95],
              [-38.29, -6.07],
              [-38.45, -6.08],
              [-38.58, -6.28],
              [-38.6, -6.39],
              [-38.52, -6.41],
              [-38.67, -6.7],
              [-38.62, -6.79],
              [-38.77, -6.99],
              [-38.67, -7.05],
              [-38.69, -7.19],
              [-38.53, -7.29],
              [-38.66, -7.57],
              [-38.97, -7.84],
              [-39.1, -7.85],
              [-39.15, -7.72],
              [-39.31, -7.67],
              [-39.32, -7.54],
              [-39.66, -7.31],
              [-40.15, -7.41],
              [-40.55, -7.39],
              [-40.37, -6.8],
              [-40.73, -6.65],
              [-40.91, -6.04],
              [-40.93, -5.17],
              [-41.24, -4.86],
              [-41.17, -4.67],
              [-41.24, -4.57],
              [-41.09, -4.17],
              [-41.12, -4.04],
              [-41.25, -4.04],
              [-41.22, -3.94],
              [-41.3, -3.83],
              [-41.24, -3.71],
              [-41.34, -3.68],
              [-41.37, -3.57],
              [-41.3, -3.49],
              [-41.42, -3.37],
              [-41.26, -3.08],
              [-41.32, -2.92],
              [-40.51, -2.79],
              [-40.02, -2.84],
            ],
          ],
          [
            [
              [-40.02, -2.83],
              [-40.03, -2.84],
              [-40.02, -2.83],
              [-40.02, -2.83],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "ES" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-40.72, -20.84],
              [-40.96, -21.3],
              [-41.72, -21.12],
              [-41.71, -20.87],
              [-41.88, -20.76],
              [-41.8, -20.48],
              [-41.85, -20.36],
              [-41.75, -20.21],
              [-41.38, -20.19],
              [-41.3, -19.94],
              [-41.18, -19.89],
              [-41.17, -19.67],
              [-40.95, -19.47],
              [-40.92, -19.26],
              [-41.06, -19.05],
              [-41.02, -18.98],
              [-41.24, -18.84],
              [-40.92, -18.8],
              [-40.94, -18.69],
              [-41.05, -18.63],
              [-41.02, -18.46],
              [-41.18, -18.44],
              [-41.16, -18.31],
              [-41.06, -18.17],
              [-40.77, -18.16],
              [-40.9, -17.98],
              [-40.67, -18.01],
              [-40.53, -17.89],
              [-40.22, -17.98],
              [-39.67, -18.33],
              [-39.75, -18.79],
              [-39.69, -19.31],
              [-39.81, -19.65],
              [-39.99, -19.75],
              [-40.14, -19.95],
              [-40.42, -20.64],
              [-40.46, -20.62],
              [-40.63, -20.84],
              [-40.65, -20.79],
              [-40.72, -20.84],
            ],
            [
              [-40.52, -20.66],
              [-40.52, -20.67],
              [-40.51, -20.67],
              [-40.52, -20.66],
            ],
            [
              [-40.54, -20.67],
              [-40.52, -20.69],
              [-40.53, -20.68],
              [-40.54, -20.67],
            ],
          ],
          [
            [
              [-40.48, -20.66],
              [-40.47, -20.65],
              [-40.47, -20.66],
              [-40.48, -20.66],
            ],
          ],
          [
            [
              [-40.72, -20.85],
              [-40.72, -20.84],
              [-40.72, -20.85],
              [-40.72, -20.85],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "GO" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-50.16, -12.41],
            [-50.3, -12.68],
            [-50.29, -12.84],
            [-49.37, -13.27],
            [-49.34, -13.07],
            [-49.12, -12.79],
            [-48.98, -12.96],
            [-48.85, -12.81],
            [-48.6, -13.06],
            [-48.58, -13.31],
            [-48.51, -13.13],
            [-48.44, -13.29],
            [-48.17, -13.15],
            [-48.16, -13.3],
            [-48.06, -13.24],
            [-47.8, -13.33],
            [-47.68, -13.46],
            [-47.63, -13.1],
            [-47.43, -13.29],
            [-46.82, -13.0],
            [-46.45, -12.96],
            [-46.42, -12.82],
            [-46.36, -12.99],
            [-46.12, -12.93],
            [-46.32, -13.1],
            [-46.27, -13.35],
            [-46.04, -13.28],
            [-46.24, -13.44],
            [-46.24, -13.55],
            [-46.16, -13.59],
            [-46.28, -13.8],
            [-46.21, -14.01],
            [-46.26, -14.1],
            [-45.91, -14.35],
            [-46.01, -14.41],
            [-46.06, -14.91],
            [-46.29, -14.93],
            [-46.32, -14.81],
            [-46.5, -14.71],
            [-46.56, -14.8],
            [-46.5, -15.05],
            [-46.92, -15.06],
            [-46.85, -15.37],
            [-46.95, -15.56],
            [-46.85, -15.62],
            [-46.82, -15.88],
            [-47.32, -16.04],
            [-47.38, -15.9],
            [-47.32, -15.59],
            [-47.42, -15.51],
            [-48.2, -15.5],
            [-48.27, -16.05],
            [-47.3, -16.06],
            [-47.45, -16.5],
            [-47.26, -16.66],
            [-47.13, -17.01],
            [-47.45, -17.35],
            [-47.51, -17.33],
            [-47.54, -17.45],
            [-47.27, -17.61],
            [-47.37, -17.84],
            [-47.28, -18.06],
            [-47.95, -18.5],
            [-48.26, -18.33],
            [-48.82, -18.38],
            [-48.92, -18.3],
            [-49.2, -18.41],
            [-49.38, -18.64],
            [-49.53, -18.49],
            [-49.79, -18.64],
            [-50.02, -18.6],
            [-50.31, -18.7],
            [-50.51, -18.94],
            [-50.54, -19.1],
            [-50.82, -19.29],
            [-50.84, -19.5],
            [-51.09, -19.31],
            [-52.32, -18.83],
            [-52.45, -18.69],
            [-52.91, -18.64],
            [-52.96, -18.55],
            [-52.76, -18.35],
            [-53.1, -18.31],
            [-53.14, -18.08],
            [-53.08, -17.97],
            [-53.24, -17.71],
            [-53.24, -17.5],
            [-53.01, -16.86],
            [-52.78, -16.74],
            [-52.74, -16.59],
            [-52.63, -16.53],
            [-52.68, -16.3],
            [-52.35, -16.08],
            [-52.25, -15.89],
            [-51.88, -15.83],
            [-51.7, -15.5],
            [-51.65, -15.18],
            [-51.53, -15.07],
            [-51.34, -14.97],
            [-51.27, -15.04],
            [-51.08, -14.91],
            [-50.96, -14.25],
            [-50.83, -14.07],
            [-50.87, -13.73],
            [-50.61, -13.31],
            [-50.61, -13.06],
            [-50.48, -12.71],
            [-50.16, -12.41],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "MA" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-47.07, -9.06],
              [-46.9, -8.81],
              [-46.85, -8.48],
              [-46.78, -8.37],
              [-46.55, -8.32],
              [-46.47, -8.08],
              [-46.63, -7.9],
              [-47.04, -8.05],
              [-47.5, -7.44],
              [-47.59, -7.44],
              [-47.48, -7.32],
              [-47.65, -7.3],
              [-47.75, -7.19],
              [-47.53, -6.98],
              [-47.38, -6.25],
              [-47.5, -5.53],
              [-47.84, -5.38],
              [-47.88, -5.26],
              [-48.18, -5.26],
              [-48.36, -5.17],
              [-48.74, -5.35],
              [-47.79, -4.58],
              [-47.62, -4.57],
              [-47.37, -4.24],
              [-47.33, -4.06],
              [-47.09, -3.86],
              [-47.04, -3.56],
              [-46.68, -3.09],
              [-46.68, -2.88],
              [-46.58, -2.84],
              [-46.66, -2.69],
              [-46.41, -2.52],
              [-46.43, -2.25],
              [-46.28, -2.15],
              [-46.21, -1.83],
              [-46.32, -1.76],
              [-46.15, -1.68],
              [-46.11, -1.33],
              [-46.16, -1.28],
              [-46.02, -1.07],
              [-45.97, -1.05],
              [-45.96, -1.23],
              [-45.84, -1.05],
              [-45.91, -1.18],
              [-45.86, -1.15],
              [-45.86, -1.28],
              [-45.81, -1.17],
              [-45.8, -1.22],
              [-45.84, -1.28],
              [-45.78, -1.27],
              [-45.69, -1.13],
              [-45.75, -1.24],
              [-45.72, -1.4],
              [-45.64, -1.37],
              [-45.59, -1.26],
              [-45.59, -1.31],
              [-45.53, -1.27],
              [-45.55, -1.29],
              [-45.56, -1.33],
              [-45.55, -1.35],
              [-45.5, -1.29],
              [-45.52, -1.36],
              [-45.53, -1.4],
              [-45.52, -1.41],
              [-45.41, -1.29],
              [-45.48, -1.54],
              [-45.32, -1.32],
              [-45.29, -1.37],
              [-45.3, -1.43],
              [-45.39, -1.48],
              [-45.38, -1.55],
              [-45.3, -1.49],
              [-45.35, -1.74],
              [-45.31, -1.6],
              [-45.25, -1.62],
              [-45.15, -1.47],
              [-45.13, -1.53],
              [-45.13, -1.46],
              [-45.1, -1.42],
              [-45.1, -1.36],
              [-45.1, -1.38],
              [-45.1, -1.49],
              [-45.09, -1.51],
              [-45.1, -1.48],
              [-45.08, -1.49],
              [-45.07, -1.47],
              [-45.07, -1.45],
              [-44.94, -1.52],
              [-44.82, -1.42],
              [-44.9, -1.61],
              [-44.82, -1.58],
              [-44.79, -1.61],
              [-44.78, -1.65],
              [-44.7, -1.56],
              [-44.72, -1.61],
              [-44.65, -1.62],
              [-44.79, -1.68],
              [-44.79, -1.74],
              [-44.7, -1.73],
              [-44.8, -1.81],
              [-44.66, -1.74],
              [-44.66, -1.8],
              [-44.65, -1.72],
              [-44.59, -1.75],
              [-44.63, -1.79],
              [-44.63, -1.83],
              [-44.6, -1.85],
              [-44.64, -1.86],
              [-44.59, -1.85],
              [-44.57, -1.8],
              [-44.58, -1.86],
              [-44.53, -1.84],
              [-44.59, -1.9],
              [-44.49, -1.93],
              [-44.49, -2.14],
              [-44.36, -2.33],
              [-44.41, -2.41],
              [-44.31, -2.5],
              [-44.02, -2.4],
              [-44.1, -2.46],
              [-43.97, -2.47],
              [-43.98, -2.57],
              [-43.62, -2.22],
              [-43.5, -2.37],
              [-43.17, -2.38],
              [-42.48, -2.71],
              [-41.82, -2.72],
              [-41.87, -2.88],
              [-41.8, -2.97],
              [-41.94, -3.19],
              [-42.12, -3.26],
              [-42.2, -3.44],
              [-42.5, -3.45],
              [-42.67, -3.67],
              [-42.73, -3.91],
              [-42.98, -4.22],
              [-42.96, -4.38],
              [-42.85, -4.48],
              [-42.95, -4.77],
              [-42.8, -5.18],
              [-42.83, -5.35],
              [-43.1, -5.63],
              [-43.08, -6.04],
              [-42.83, -6.34],
              [-42.95, -6.71],
              [-43.42, -6.84],
              [-43.71, -6.7],
              [-44.03, -6.76],
              [-44.31, -7.12],
              [-44.56, -7.23],
              [-44.7, -7.39],
              [-44.82, -7.36],
              [-44.93, -7.47],
              [-45.46, -7.67],
              [-45.78, -8.62],
              [-45.99, -8.93],
              [-45.79, -9.48],
              [-45.95, -10.26],
              [-46.04, -10.18],
              [-46.37, -10.17],
              [-46.51, -9.8],
              [-46.65, -9.73],
              [-46.56, -9.49],
              [-46.67, -9.39],
              [-46.76, -9.41],
              [-46.92, -9.07],
              [-47.07, -9.06],
            ],
            [
              [-44.81, -1.8],
              [-44.81, -1.8],
              [-44.81, -1.8],
              [-44.81, -1.8],
            ],
            [
              [-44.57, -1.92],
              [-44.57, -1.92],
              [-44.57, -1.92],
              [-44.57, -1.92],
            ],
            [
              [-45.75, -1.37],
              [-45.74, -1.37],
              [-45.75, -1.37],
              [-45.75, -1.37],
            ],
            [
              [-45.89, -1.18],
              [-45.88, -1.18],
              [-45.89, -1.18],
              [-45.89, -1.18],
            ],
            [
              [-45.82, -1.31],
              [-45.82, -1.3],
              [-45.82, -1.3],
              [-45.82, -1.31],
            ],
            [
              [-44.69, -1.82],
              [-44.69, -1.81],
              [-44.69, -1.82],
              [-44.69, -1.82],
            ],
            [
              [-45.39, -1.69],
              [-45.39, -1.69],
              [-45.39, -1.69],
              [-45.39, -1.69],
            ],
            [
              [-44.8, -1.63],
              [-44.79, -1.62],
              [-44.8, -1.63],
              [-44.8, -1.63],
            ],
            [
              [-45.13, -1.54],
              [-45.11, -1.54],
              [-45.13, -1.54],
              [-45.13, -1.54],
            ],
            [
              [-45.82, -1.25],
              [-45.82, -1.24],
              [-45.82, -1.25],
              [-45.82, -1.25],
            ],
            [
              [-45.58, -1.34],
              [-45.57, -1.33],
              [-45.58, -1.34],
              [-45.58, -1.34],
            ],
            [
              [-45.8, -1.33],
              [-45.8, -1.34],
              [-45.8, -1.32],
              [-45.8, -1.33],
            ],
            [
              [-44.83, -1.82],
              [-44.82, -1.82],
              [-44.83, -1.82],
              [-44.83, -1.82],
            ],
            [
              [-45.37, -1.44],
              [-45.36, -1.43],
              [-45.37, -1.43],
              [-45.37, -1.44],
            ],
            [
              [-45.9, -1.24],
              [-45.91, -1.25],
              [-45.9, -1.26],
              [-45.9, -1.24],
            ],
            [
              [-45.59, -1.34],
              [-45.59, -1.32],
              [-45.59, -1.32],
              [-45.59, -1.34],
            ],
            [
              [-45.39, -1.56],
              [-45.38, -1.54],
              [-45.39, -1.54],
              [-45.39, -1.56],
            ],
          ],
          [
            [
              [-45.02, -1.33],
              [-44.96, -1.28],
              [-44.84, -1.33],
              [-44.9, -1.33],
              [-44.98, -1.41],
              [-45.02, -1.33],
            ],
            [
              [-44.92, -1.34],
              [-44.92, -1.34],
              [-44.92, -1.34],
              [-44.92, -1.34],
            ],
            [
              [-44.9, -1.31],
              [-44.9, -1.31],
              [-44.92, -1.3],
              [-44.9, -1.31],
            ],
          ],
          [
            [
              [-45.68, -1.3],
              [-45.64, -1.29],
              [-45.62, -1.12],
              [-45.6, -1.18],
              [-45.63, -1.22],
              [-45.62, -1.24],
              [-45.64, -1.3],
              [-45.64, -1.33],
              [-45.63, -1.34],
              [-45.63, -1.35],
              [-45.7, -1.36],
              [-45.68, -1.35],
              [-45.68, -1.32],
              [-45.67, -1.32],
              [-45.68, -1.3],
            ],
            [
              [-45.66, -1.3],
              [-45.66, -1.31],
              [-45.65, -1.31],
              [-45.66, -1.3],
            ],
          ],
          [
            [
              [-44.8, -1.53],
              [-44.8, -1.56],
              [-44.83, -1.54],
              [-44.76, -1.48],
              [-44.8, -1.53],
            ],
          ],
          [
            [
              [-44.74, -1.51],
              [-44.76, -1.49],
              [-44.76, -1.48],
              [-44.77, -1.46],
              [-44.75, -1.46],
              [-44.74, -1.51],
            ],
          ],
          [
            [
              [-45.7, -1.22],
              [-45.66, -1.22],
              [-45.68, -1.26],
              [-45.7, -1.22],
            ],
          ],
          [
            [
              [-45.57, -1.19],
              [-45.53, -1.23],
              [-45.59, -1.25],
              [-45.57, -1.19],
            ],
          ],
          [
            [
              [-44.6, -1.82],
              [-44.59, -1.77],
              [-44.58, -1.78],
              [-44.6, -1.82],
            ],
          ],
          [
            [
              [-44.73, -1.56],
              [-44.76, -1.58],
              [-44.74, -1.54],
              [-44.73, -1.56],
            ],
          ],
          [
            [
              [-45.82, -1.12],
              [-45.8, -1.15],
              [-45.82, -1.15],
              [-45.82, -1.12],
            ],
          ],
          [
            [
              [-45.8, -1.21],
              [-45.78, -1.21],
              [-45.79, -1.22],
              [-45.8, -1.21],
            ],
          ],
          [
            [
              [-45.53, -1.32],
              [-45.55, -1.31],
              [-45.53, -1.3],
              [-45.53, -1.32],
            ],
          ],
          [
            [
              [-45.07, -1.39],
              [-45.09, -1.43],
              [-45.07, -1.37],
              [-45.07, -1.39],
            ],
          ],
          [
            [
              [-45.1, -1.47],
              [-45.07, -1.46],
              [-45.07, -1.48],
              [-45.1, -1.47],
            ],
          ],
          [
            [
              [-45.04, -1.35],
              [-45.05, -1.36],
              [-45.05, -1.34],
              [-45.04, -1.35],
            ],
          ],
          [
            [
              [-44.75, -1.69],
              [-44.73, -1.69],
              [-44.74, -1.7],
              [-44.75, -1.69],
            ],
          ],
          [
            [
              [-45.69, -1.3],
              [-45.68, -1.31],
              [-45.69, -1.29],
              [-45.69, -1.3],
            ],
          ],
          [
            [
              [-44.47, -2.08],
              [-44.48, -2.08],
              [-44.45, -2.07],
              [-44.47, -2.08],
            ],
          ],
          [
            [
              [-44.48, -2.11],
              [-44.46, -2.1],
              [-44.47, -2.12],
              [-44.48, -2.11],
            ],
          ],
          [
            [
              [-45.41, -1.41],
              [-45.4, -1.41],
              [-45.41, -1.41],
              [-45.41, -1.41],
            ],
          ],
          [
            [
              [-45.06, -1.44],
              [-45.08, -1.44],
              [-45.06, -1.43],
              [-45.06, -1.44],
            ],
          ],
          [
            [
              [-44.72, -1.66],
              [-44.72, -1.68],
              [-44.74, -1.67],
              [-44.72, -1.66],
            ],
          ],
          [
            [
              [-44.45, -2.02],
              [-44.45, -2.02],
              [-44.44, -2.01],
              [-44.45, -2.02],
            ],
          ],
          [
            [
              [-44.62, -1.8],
              [-44.62, -1.81],
              [-44.63, -1.79],
              [-44.62, -1.8],
            ],
          ],
          [
            [
              [-45.09, -1.43],
              [-45.08, -1.42],
              [-45.08, -1.44],
              [-45.09, -1.43],
            ],
          ],
          [
            [
              [-45.51, -1.4],
              [-45.52, -1.4],
              [-45.51, -1.39],
              [-45.51, -1.4],
            ],
          ],
          [
            [
              [-45.05, -1.33],
              [-45.04, -1.34],
              [-45.05, -1.33],
              [-45.05, -1.33],
            ],
          ],
          [
            [
              [-45.79, -1.25],
              [-45.8, -1.24],
              [-45.79, -1.24],
              [-45.79, -1.25],
            ],
          ],
          [
            [
              [-45.0, -1.4],
              [-45.0, -1.41],
              [-45.02, -1.4],
              [-45.0, -1.4],
            ],
          ],
          [
            [
              [-44.61, -1.83],
              [-44.61, -1.82],
              [-44.6, -1.83],
              [-44.61, -1.83],
            ],
          ],
          [
            [
              [-45.63, -1.32],
              [-45.62, -1.32],
              [-45.63, -1.34],
              [-45.63, -1.32],
            ],
          ],
          [
            [
              [-44.83, -1.56],
              [-44.82, -1.56],
              [-44.82, -1.57],
              [-44.83, -1.56],
            ],
          ],
          [
            [
              [-45.56, -1.26],
              [-45.56, -1.26],
              [-45.57, -1.27],
              [-45.56, -1.26],
            ],
          ],
          [
            [
              [-42.76, -2.55],
              [-42.75, -2.55],
              [-42.76, -2.56],
              [-42.76, -2.55],
            ],
          ],
          [
            [
              [-44.01, -2.4],
              [-44.0, -2.39],
              [-44.0, -2.4],
              [-44.01, -2.4],
            ],
          ],
          [
            [
              [-44.61, -1.78],
              [-44.62, -1.78],
              [-44.61, -1.77],
              [-44.61, -1.78],
            ],
          ],
          [
            [
              [-45.64, -1.31],
              [-45.64, -1.3],
              [-45.64, -1.32],
              [-45.64, -1.31],
            ],
          ],
          [
            [
              [-45.65, -1.36],
              [-45.64, -1.36],
              [-45.65, -1.36],
              [-45.65, -1.36],
            ],
          ],
          [
            [
              [-45.64, -1.25],
              [-45.65, -1.25],
              [-45.64, -1.25],
              [-45.64, -1.25],
            ],
          ],
          [
            [
              [-44.02, -2.4],
              [-44.01, -2.4],
              [-44.02, -2.41],
              [-44.02, -2.4],
            ],
          ],
          [
            [
              [-45.14, -1.47],
              [-45.13, -1.47],
              [-45.14, -1.48],
              [-45.14, -1.47],
            ],
          ],
          [
            [
              [-44.78, -1.57],
              [-44.78, -1.57],
              [-44.78, -1.57],
              [-44.78, -1.57],
            ],
          ],
          [
            [
              [-44.88, -1.34],
              [-44.88, -1.34],
              [-44.88, -1.34],
              [-44.88, -1.34],
            ],
          ],
          [
            [
              [-45.04, -1.39],
              [-45.04, -1.4],
              [-45.04, -1.39],
              [-45.04, -1.39],
            ],
          ],
          [
            [
              [-45.14, -1.49],
              [-45.13, -1.49],
              [-45.14, -1.49],
              [-45.14, -1.49],
            ],
          ],
          [
            [
              [-44.46, -2.13],
              [-44.45, -2.13],
              [-44.46, -2.13],
              [-44.46, -2.13],
            ],
          ],
          [
            [
              [-45.82, -1.26],
              [-45.81, -1.26],
              [-45.82, -1.26],
              [-45.82, -1.26],
            ],
          ],
          [
            [
              [-47.03, -8.98],
              [-47.03, -8.98],
              [-47.03, -8.98],
              [-47.03, -8.98],
            ],
          ],
          [
            [
              [-45.11, -1.4],
              [-45.11, -1.41],
              [-45.11, -1.4],
              [-45.11, -1.4],
            ],
          ],
          [
            [
              [-45.11, -1.39],
              [-45.11, -1.4],
              [-45.11, -1.39],
              [-45.11, -1.39],
            ],
          ],
          [
            [
              [-45.56, -1.26],
              [-45.55, -1.26],
              [-45.56, -1.26],
              [-45.56, -1.26],
            ],
          ],
          [
            [
              [-44.76, -1.59],
              [-44.75, -1.59],
              [-44.76, -1.59],
              [-44.76, -1.59],
            ],
          ],
          [
            [
              [-45.76, -1.19],
              [-45.76, -1.19],
              [-45.76, -1.19],
              [-45.76, -1.19],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "MG" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-44.21, -14.24],
            [-43.78, -14.34],
            [-43.88, -14.65],
            [-43.53, -14.81],
            [-43.19, -14.65],
            [-42.95, -14.71],
            [-42.44, -15.06],
            [-42.17, -15.09],
            [-42.09, -15.19],
            [-41.81, -15.1],
            [-41.36, -15.5],
            [-41.33, -15.74],
            [-40.7, -15.67],
            [-40.56, -15.8],
            [-40.23, -15.8],
            [-39.86, -16.11],
            [-40.16, -16.58],
            [-40.29, -16.6],
            [-40.34, -16.79],
            [-40.26, -16.82],
            [-40.28, -16.9],
            [-40.49, -16.88],
            [-40.57, -17.06],
            [-40.61, -17.42],
            [-40.22, -17.73],
            [-40.22, -17.98],
            [-40.53, -17.89],
            [-40.67, -18.01],
            [-40.83, -17.95],
            [-40.9, -17.99],
            [-40.77, -18.16],
            [-41.06, -18.17],
            [-41.16, -18.31],
            [-41.18, -18.44],
            [-41.02, -18.46],
            [-41.05, -18.63],
            [-40.94, -18.69],
            [-40.92, -18.8],
            [-41.24, -18.84],
            [-41.02, -18.98],
            [-41.06, -19.05],
            [-40.92, -19.26],
            [-40.95, -19.47],
            [-41.17, -19.67],
            [-41.18, -19.89],
            [-41.3, -19.94],
            [-41.38, -20.19],
            [-41.75, -20.21],
            [-41.85, -20.33],
            [-41.81, -20.64],
            [-41.98, -20.93],
            [-42.15, -20.97],
            [-42.08, -21.03],
            [-42.37, -21.62],
            [-42.27, -21.71],
            [-43.07, -22.09],
            [-43.25, -22.01],
            [-43.77, -22.06],
            [-44.23, -22.27],
            [-44.46, -22.26],
            [-45.09, -22.48],
            [-45.4, -22.65],
            [-45.47, -22.59],
            [-45.66, -22.65],
            [-45.72, -22.58],
            [-45.69, -22.65],
            [-45.81, -22.71],
            [-45.71, -22.76],
            [-45.77, -22.85],
            [-46.35, -22.9],
            [-46.33, -22.77],
            [-46.48, -22.68],
            [-46.39, -22.66],
            [-46.41, -22.54],
            [-46.65, -22.42],
            [-46.72, -22.31],
            [-46.6, -22.14],
            [-46.72, -22.08],
            [-46.61, -22.01],
            [-46.68, -21.82],
            [-46.52, -21.61],
            [-46.51, -21.48],
            [-46.66, -21.36],
            [-47.01, -21.42],
            [-47.22, -20.91],
            [-47.1, -20.66],
            [-47.15, -20.52],
            [-47.29, -20.45],
            [-47.26, -20.16],
            [-47.47, -19.96],
            [-47.64, -20.05],
            [-47.86, -19.99],
            [-47.89, -20.12],
            [-47.98, -20.04],
            [-48.11, -20.14],
            [-48.24, -20.03],
            [-48.25, -20.14],
            [-48.82, -20.16],
            [-48.9, -20.44],
            [-48.97, -20.39],
            [-48.99, -20.17],
            [-49.07, -20.15],
            [-49.22, -20.3],
            [-49.31, -20.1],
            [-49.25, -19.97],
            [-49.55, -19.91],
            [-49.88, -19.94],
            [-50.49, -19.79],
            [-51.0, -20.09],
            [-51.05, -19.73],
            [-50.93, -19.59],
            [-50.96, -19.48],
            [-50.83, -19.49],
            [-50.82, -19.29],
            [-50.54, -19.1],
            [-50.51, -18.94],
            [-50.31, -18.7],
            [-50.02, -18.6],
            [-49.79, -18.64],
            [-49.53, -18.49],
            [-49.38, -18.64],
            [-49.2, -18.41],
            [-48.92, -18.3],
            [-48.82, -18.38],
            [-48.26, -18.33],
            [-47.95, -18.5],
            [-47.28, -18.06],
            [-47.37, -17.84],
            [-47.27, -17.61],
            [-47.32, -17.53],
            [-47.49, -17.53],
            [-47.54, -17.39],
            [-47.13, -16.98],
            [-47.26, -16.66],
            [-47.45, -16.47],
            [-47.3, -16.02],
            [-46.81, -15.87],
            [-46.85, -15.62],
            [-46.95, -15.56],
            [-46.85, -15.37],
            [-46.92, -15.06],
            [-46.5, -15.05],
            [-46.56, -14.8],
            [-46.47, -14.71],
            [-46.29, -14.93],
            [-46.02, -14.88],
            [-45.97, -14.96],
            [-46.12, -15.2],
            [-46.08, -15.26],
            [-45.2, -14.74],
            [-45.08, -14.75],
            [-44.56, -14.34],
            [-44.21, -14.24],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "MS" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-53.95, -17.92],
              [-53.69, -18.01],
              [-53.08, -18.04],
              [-53.14, -18.07],
              [-53.07, -18.34],
              [-52.76, -18.35],
              [-52.96, -18.54],
              [-52.92, -18.64],
              [-52.53, -18.66],
              [-52.02, -18.98],
              [-51.05, -19.34],
              [-50.92, -19.58],
              [-51.05, -19.74],
              [-51.0, -20.1],
              [-51.07, -20.25],
              [-51.32, -20.34],
              [-51.59, -20.64],
              [-51.62, -20.93],
              [-51.88, -21.15],
              [-51.86, -21.34],
              [-51.97, -21.5],
              [-52.08, -21.52],
              [-52.05, -21.66],
              [-52.41, -22.14],
              [-53.61, -22.95],
              [-53.73, -23.32],
              [-53.98, -23.46],
              [-54.11, -23.96],
              [-54.29, -24.06],
              [-54.67, -23.81],
              [-54.94, -23.96],
              [-55.35, -23.99],
              [-55.53, -23.63],
              [-55.53, -23.19],
              [-55.66, -22.88],
              [-55.61, -22.66],
              [-55.85, -22.28],
              [-56.21, -22.27],
              [-56.39, -22.08],
              [-56.5, -22.09],
              [-56.63, -22.26],
              [-56.7, -22.22],
              [-56.84, -22.3],
              [-57.58, -22.17],
              [-57.61, -22.09],
              [-57.8, -22.15],
              [-57.99, -22.09],
              [-57.88, -21.69],
              [-57.97, -21.52],
              [-57.85, -21.34],
              [-57.92, -21.28],
              [-57.85, -21.22],
              [-57.82, -20.94],
              [-57.93, -20.89],
              [-57.86, -20.83],
              [-57.95, -20.78],
              [-57.86, -20.75],
              [-57.92, -20.66],
              [-57.98, -20.7],
              [-58.0, -20.43],
              [-58.17, -20.17],
              [-57.86, -19.98],
              [-58.13, -19.76],
              [-57.78, -19.03],
              [-57.7, -19.02],
              [-57.56, -18.24],
              [-57.46, -18.23],
              [-57.72, -17.83],
              [-57.8, -17.56],
              [-57.71, -17.54],
              [-57.68, -17.71],
              [-57.45, -17.9],
              [-57.04, -17.73],
              [-56.73, -17.31],
              [-56.44, -17.33],
              [-56.11, -17.17],
              [-55.64, -17.34],
              [-55.52, -17.48],
              [-55.13, -17.65],
              [-54.86, -17.62],
              [-54.58, -17.47],
              [-54.3, -17.66],
              [-54.08, -17.62],
              [-54.03, -17.48],
              [-53.71, -17.23],
              [-53.72, -17.67],
              [-53.88, -17.74],
              [-53.95, -17.92],
            ],
          ],
          [
            [
              [-53.87, -17.92],
              [-53.88, -17.92],
              [-53.87, -17.92],
              [-53.87, -17.92],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "MT" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-60.39, -13.45],
              [-60.28, -13.09],
              [-60.09, -12.9],
              [-60.06, -12.6],
              [-59.85, -12.47],
              [-59.79, -12.35],
              [-59.89, -12.24],
              [-59.98, -11.91],
              [-60.1, -11.84],
              [-60.11, -11.58],
              [-59.92, -11.4],
              [-59.98, -11.12],
              [-60.35, -11.11],
              [-60.46, -10.99],
              [-61.55, -10.98],
              [-61.46, -10.42],
              [-61.6, -10.15],
              [-61.51, -9.89],
              [-61.57, -9.73],
              [-61.48, -9.64],
              [-61.63, -9.28],
              [-61.53, -9.25],
              [-61.48, -8.91],
              [-61.58, -8.8],
              [-58.41, -8.79],
              [-58.33, -8.72],
              [-58.44, -8.7],
              [-58.29, -8.13],
              [-58.38, -7.85],
              [-58.2, -7.62],
              [-58.14, -7.35],
              [-57.97, -7.53],
              [-57.83, -7.97],
              [-57.64, -8.22],
              [-57.69, -8.41],
              [-57.59, -8.76],
              [-57.2, -8.92],
              [-57.06, -9.06],
              [-57.06, -9.18],
              [-56.82, -9.25],
              [-56.76, -9.4],
              [-50.23, -9.84],
              [-50.6, -10.66],
              [-50.61, -11.07],
              [-50.74, -11.45],
              [-50.64, -11.89],
              [-50.69, -12.2],
              [-50.62, -12.45],
              [-50.71, -12.61],
              [-50.62, -12.82],
              [-50.5, -12.87],
              [-50.61, -13.06],
              [-50.61, -13.31],
              [-50.87, -13.73],
              [-50.83, -14.07],
              [-50.96, -14.25],
              [-51.08, -14.91],
              [-51.27, -15.04],
              [-51.34, -14.97],
              [-51.53, -15.07],
              [-51.65, -15.18],
              [-51.7, -15.5],
              [-51.88, -15.83],
              [-52.25, -15.89],
              [-52.35, -16.08],
              [-52.68, -16.3],
              [-52.63, -16.55],
              [-52.74, -16.59],
              [-52.78, -16.74],
              [-53.01, -16.86],
              [-53.22, -17.3],
              [-53.24, -17.67],
              [-53.07, -18.04],
              [-53.77, -18.0],
              [-53.95, -17.92],
              [-53.84, -17.69],
              [-53.72, -17.67],
              [-53.71, -17.23],
              [-54.03, -17.48],
              [-54.08, -17.62],
              [-54.34, -17.66],
              [-54.58, -17.47],
              [-54.86, -17.62],
              [-55.13, -17.65],
              [-55.52, -17.48],
              [-55.64, -17.34],
              [-56.11, -17.17],
              [-56.44, -17.33],
              [-56.73, -17.31],
              [-57.04, -17.73],
              [-57.45, -17.9],
              [-57.68, -17.71],
              [-57.71, -17.54],
              [-57.88, -17.45],
              [-58.04, -17.49],
              [-58.4, -17.18],
              [-58.47, -16.75],
              [-58.33, -16.49],
              [-58.33, -16.27],
              [-58.43, -16.32],
              [-60.17, -16.27],
              [-60.24, -15.47],
              [-60.56, -15.12],
              [-60.27, -14.62],
              [-60.49, -14.19],
              [-60.38, -13.99],
              [-60.47, -13.8],
              [-60.72, -13.68],
              [-60.39, -13.45],
            ],
          ],
          [
            [
              [-60.36, -13.3],
              [-60.36, -13.3],
              [-60.36, -13.3],
              [-60.36, -13.3],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "PA" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-46.95, -0.73],
              [-46.98, -0.78],
              [-46.95, -0.86],
              [-46.84, -0.73],
              [-46.85, -0.85],
              [-46.79, -0.9],
              [-46.77, -0.82],
              [-46.74, -0.92],
              [-46.72, -0.83],
              [-46.64, -0.79],
              [-46.67, -0.98],
              [-46.55, -0.9],
              [-46.54, -0.98],
              [-46.43, -0.86],
              [-46.49, -0.97],
              [-46.42, -1.06],
              [-46.39, -0.99],
              [-46.38, -1.05],
              [-46.34, -1.0],
              [-46.35, -1.07],
              [-46.3, -1.08],
              [-46.33, -1.07],
              [-46.27, -1.0],
              [-46.27, -0.92],
              [-46.19, -0.89],
              [-46.25, -1.0],
              [-46.21, -1.04],
              [-46.28, -1.17],
              [-46.17, -0.99],
              [-46.2, -1.13],
              [-46.17, -1.16],
              [-46.16, -1.08],
              [-46.15, -1.14],
              [-46.15, -1.07],
              [-46.07, -1.02],
              [-46.09, -1.05],
              [-46.1, -1.2],
              [-46.16, -1.28],
              [-46.11, -1.33],
              [-46.15, -1.68],
              [-46.32, -1.76],
              [-46.21, -1.83],
              [-46.28, -2.15],
              [-46.43, -2.25],
              [-46.41, -2.52],
              [-46.66, -2.69],
              [-46.58, -2.84],
              [-46.68, -2.88],
              [-46.68, -3.09],
              [-46.94, -3.37],
              [-47.08, -3.84],
              [-47.33, -4.06],
              [-47.37, -4.24],
              [-47.62, -4.57],
              [-47.79, -4.58],
              [-48.75, -5.36],
              [-48.38, -5.39],
              [-48.13, -5.64],
              [-48.29, -5.76],
              [-48.23, -5.93],
              [-48.34, -6.02],
              [-48.3, -6.11],
              [-48.43, -6.18],
              [-48.38, -6.38],
              [-48.5, -6.35],
              [-48.63, -6.48],
              [-48.66, -6.66],
              [-49.21, -6.93],
              [-49.19, -7.24],
              [-49.38, -7.54],
              [-49.15, -7.81],
              [-49.22, -8.19],
              [-49.57, -8.81],
              [-49.74, -8.9],
              [-50.04, -9.3],
              [-50.22, -9.84],
              [-56.75, -9.41],
              [-56.81, -9.26],
              [-57.05, -9.19],
              [-57.04, -9.1],
              [-57.19, -8.93],
              [-57.6, -8.75],
              [-57.69, -8.41],
              [-57.64, -8.21],
              [-58.21, -7.13],
              [-58.41, -6.94],
              [-58.48, -6.7],
              [-58.26, -6.47],
              [-56.4, -2.46],
              [-56.46, -2.43],
              [-56.41, -2.32],
              [-56.1, -2.03],
              [-56.68, -2.21],
              [-56.77, -2.17],
              [-56.73, -2.03],
              [-57.04, -1.91],
              [-57.16, -1.73],
              [-57.4, -1.71],
              [-57.96, -1.4],
              [-58.03, -1.1],
              [-58.16, -1.23],
              [-58.43, -1.03],
              [-58.43, -0.89],
              [-58.7, -0.67],
              [-58.73, -0.44],
              [-58.87, -0.3],
              [-58.9, 1.23],
              [-58.82, 1.17],
              [-58.7, 1.29],
              [-58.5, 1.27],
              [-58.51, 1.46],
              [-58.38, 1.47],
              [-58.32, 1.6],
              [-58.0, 1.5],
              [-57.99, 1.66],
              [-57.77, 1.73],
              [-57.54, 1.7],
              [-57.31, 2.0],
              [-57.23, 1.94],
              [-57.09, 2.03],
              [-57.01, 1.92],
              [-56.79, 1.85],
              [-56.45, 1.96],
              [-55.98, 1.84],
              [-55.9, 2.03],
              [-56.14, 2.27],
              [-56.09, 2.38],
              [-56.02, 2.34],
              [-55.99, 2.52],
              [-55.71, 2.4],
              [-55.34, 2.45],
              [-55.32, 2.52],
              [-55.0, 2.59],
              [-54.79, 2.31],
              [-54.75, 1.79],
              [-54.3, 1.74],
              [-54.15, 1.64],
              [-54.09, 1.49],
              [-53.85, 1.39],
              [-53.65, 1.41],
              [-53.65, 1.34],
              [-53.55, 1.35],
              [-53.54, 1.21],
              [-53.43, 1.24],
              [-53.41, 0.95],
              [-53.1, 0.68],
              [-53.17, 0.38],
              [-52.93, -0.14],
              [-52.68, -0.31],
              [-52.63, -0.59],
              [-52.53, -0.58],
              [-52.53, -0.84],
              [-52.4, -0.88],
              [-52.43, -1.05],
              [-52.12, -1.15],
              [-52.1, -1.23],
              [-51.98, -1.12],
              [-51.89, -1.17],
              [-51.7, -1.07],
              [-51.68, -0.79],
              [-51.27, -0.2],
              [-50.6, 0.25],
              [-50.41, 0.62],
              [-50.16, 0.7],
              [-50.04, 0.57],
              [-50.02, 0.33],
              [-49.65, 0.35],
              [-49.39, 0.01],
              [-48.91, -0.23],
              [-48.41, -0.26],
              [-48.47, -0.5],
              [-47.99, -0.71],
              [-47.9, -0.55],
              [-47.84, -0.68],
              [-47.8, -0.55],
              [-47.77, -0.63],
              [-47.72, -0.54],
              [-47.63, -0.69],
              [-47.56, -0.59],
              [-47.49, -0.77],
              [-47.42, -0.59],
              [-47.43, -0.65],
              [-47.32, -0.59],
              [-47.22, -0.64],
              [-47.25, -0.7],
              [-47.16, -0.67],
              [-47.18, -0.75],
              [-47.17, -0.77],
              [-47.09, -0.66],
              [-47.06, -0.81],
              [-47.04, -0.73],
              [-46.95, -0.73],
            ],
          ],
          [
            [
              [-46.41, -0.93],
              [-46.41, -0.97],
              [-46.44, -0.98],
              [-46.41, -0.93],
            ],
          ],
          [
            [
              [-46.09, -1.06],
              [-46.06, -1.09],
              [-46.07, -1.1],
              [-46.09, -1.06],
            ],
          ],
          [
            [
              [-47.03, -0.71],
              [-47.03, -0.69],
              [-47.01, -0.7],
              [-47.03, -0.71],
            ],
          ],
          [
            [
              [-46.38, -1.0],
              [-46.38, -1.01],
              [-46.38, -1.01],
              [-46.38, -1.0],
            ],
          ],
          [
            [
              [-47.84, -0.66],
              [-47.83, -0.65],
              [-47.84, -0.67],
              [-47.84, -0.66],
            ],
          ],
          [
            [
              [-46.44, -1.01],
              [-46.45, -1.01],
              [-46.44, -1.0],
              [-46.44, -1.01],
            ],
          ],
          [
            [
              [-46.33, -0.95],
              [-46.32, -0.95],
              [-46.32, -0.95],
              [-46.33, -0.95],
            ],
          ],
          [
            [
              [-46.61, -0.83],
              [-46.6, -0.83],
              [-46.6, -0.83],
              [-46.61, -0.83],
            ],
          ],
          [
            [
              [-46.61, -0.86],
              [-46.6, -0.85],
              [-46.61, -0.86],
              [-46.61, -0.86],
            ],
          ],
          [
            [
              [-47.03, -0.72],
              [-47.04, -0.72],
              [-47.04, -0.72],
              [-47.03, -0.72],
            ],
          ],
          [
            [
              [-46.47, -0.96],
              [-46.47, -0.96],
              [-46.47, -0.96],
              [-46.47, -0.96],
            ],
          ],
          [
            [
              [-46.21, -0.94],
              [-46.2, -0.94],
              [-46.21, -0.94],
              [-46.21, -0.94],
            ],
          ],
          [
            [
              [-46.95, -0.74],
              [-46.95, -0.74],
              [-46.95, -0.74],
              [-46.95, -0.74],
            ],
          ],
          [
            [
              [-47.02, -0.71],
              [-47.02, -0.72],
              [-47.02, -0.71],
              [-47.02, -0.71],
            ],
          ],
          [
            [
              [-46.27, -0.93],
              [-46.27, -0.94],
              [-46.27, -0.93],
              [-46.27, -0.93],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "PB" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-37.23, -6.04],
              [-37.16, -6.15],
              [-37.38, -6.34],
              [-37.48, -6.71],
              [-37.28, -6.69],
              [-37.23, -6.82],
              [-36.99, -6.71],
              [-36.96, -6.79],
              [-36.79, -6.77],
              [-36.72, -6.98],
              [-36.51, -6.82],
              [-36.52, -6.6],
              [-36.44, -6.63],
              [-36.53, -6.45],
              [-36.39, -6.29],
              [-36.31, -6.28],
              [-36.25, -6.44],
              [-36.07, -6.41],
              [-36.01, -6.48],
              [-35.66, -6.45],
              [-35.17, -6.56],
              [-34.97, -6.49],
              [-34.94, -6.75],
              [-34.86, -7.03],
              [-34.83, -6.98],
              [-34.79, -7.15],
              [-34.83, -7.55],
              [-34.95, -7.54],
              [-35.08, -7.4],
              [-35.48, -7.45],
              [-35.51, -7.64],
              [-36.0, -7.81],
              [-36.41, -7.81],
              [-36.45, -7.92],
              [-36.62, -7.96],
              [-36.64, -8.12],
              [-36.99, -8.3],
              [-37.16, -8.17],
              [-37.19, -7.96],
              [-37.35, -7.97],
              [-37.15, -7.78],
              [-37.17, -7.59],
              [-36.98, -7.48],
              [-37.23, -7.28],
              [-37.47, -7.36],
              [-37.75, -7.66],
              [-37.86, -7.65],
              [-38.07, -7.82],
              [-38.28, -7.83],
              [-38.36, -7.68],
              [-38.59, -7.75],
              [-38.72, -7.61],
              [-38.53, -7.29],
              [-38.69, -7.19],
              [-38.67, -7.05],
              [-38.77, -6.99],
              [-38.62, -6.79],
              [-38.67, -6.7],
              [-38.52, -6.41],
              [-38.6, -6.39],
              [-38.46, -6.33],
              [-38.49, -6.4],
              [-38.12, -6.52],
              [-37.76, -6.29],
              [-37.75, -6.2],
              [-37.23, -6.04],
            ],
          ],
          [
            [
              [-34.87, -7.0],
              [-34.85, -6.98],
              [-34.85, -7.01],
              [-34.87, -7.0],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "PE" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-37.26, -7.27],
              [-36.98, -7.48],
              [-37.17, -7.59],
              [-37.15, -7.78],
              [-37.35, -7.97],
              [-37.19, -7.96],
              [-37.16, -8.17],
              [-36.99, -8.3],
              [-36.64, -8.12],
              [-36.62, -7.96],
              [-36.45, -7.92],
              [-36.41, -7.81],
              [-36.0, -7.81],
              [-35.51, -7.64],
              [-35.48, -7.45],
              [-35.08, -7.4],
              [-34.95, -7.54],
              [-34.83, -7.55],
              [-34.84, -8.01],
              [-35.15, -8.91],
              [-35.46, -8.82],
              [-35.75, -8.91],
              [-35.9, -8.85],
              [-36.13, -8.97],
              [-36.27, -9.1],
              [-36.22, -9.17],
              [-36.6, -9.34],
              [-36.87, -9.27],
              [-36.94, -9.38],
              [-37.11, -9.24],
              [-37.23, -9.23],
              [-37.49, -8.97],
              [-37.69, -9.0],
              [-37.78, -8.87],
              [-37.98, -9.15],
              [-38.23, -9.32],
              [-38.29, -9.04],
              [-38.5, -8.98],
              [-38.51, -8.83],
              [-38.64, -8.99],
              [-38.8, -8.79],
              [-39.22, -8.71],
              [-39.29, -8.56],
              [-39.38, -8.53],
              [-39.69, -8.67],
              [-39.67, -8.79],
              [-39.89, -8.83],
              [-39.87, -8.93],
              [-39.98, -9.05],
              [-40.13, -9.11],
              [-40.24, -9.06],
              [-40.36, -9.38],
              [-40.62, -9.48],
              [-40.78, -9.45],
              [-40.67, -9.17],
              [-40.82, -9.08],
              [-40.92, -8.84],
              [-41.02, -8.84],
              [-41.11, -8.71],
              [-41.36, -8.71],
              [-40.59, -8.14],
              [-40.54, -7.83],
              [-40.67, -7.76],
              [-40.64, -7.61],
              [-40.71, -7.49],
              [-40.65, -7.43],
              [-39.66, -7.32],
              [-39.33, -7.53],
              [-39.31, -7.66],
              [-39.13, -7.72],
              [-39.09, -7.86],
              [-38.96, -7.84],
              [-38.72, -7.62],
              [-38.59, -7.75],
              [-38.36, -7.69],
              [-38.29, -7.83],
              [-38.08, -7.83],
              [-37.85, -7.65],
              [-37.74, -7.66],
              [-37.5, -7.37],
              [-37.26, -7.27],
            ],
          ],
          [
            [
              [-32.44, -3.85],
              [-32.42, -3.88],
              [-32.47, -3.88],
              [-32.44, -3.85],
            ],
          ],
          [
            [
              [-32.4, -3.84],
              [-32.4, -3.83],
              [-32.4, -3.84],
              [-32.4, -3.84],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "PI" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-41.82, -2.75],
            [-41.6, -2.9],
            [-41.33, -2.92],
            [-41.26, -3.0],
            [-41.42, -3.37],
            [-41.3, -3.49],
            [-41.34, -3.68],
            [-41.24, -3.71],
            [-41.3, -3.83],
            [-41.22, -3.94],
            [-41.25, -4.04],
            [-41.11, -4.04],
            [-41.09, -4.17],
            [-41.24, -4.57],
            [-41.19, -4.66],
            [-41.25, -4.87],
            [-40.92, -5.18],
            [-40.91, -6.05],
            [-40.78, -6.33],
            [-40.79, -6.52],
            [-40.71, -6.68],
            [-40.37, -6.81],
            [-40.52, -7.31],
            [-40.71, -7.47],
            [-40.67, -7.76],
            [-40.54, -7.83],
            [-40.59, -8.14],
            [-40.93, -8.45],
            [-41.0, -8.4],
            [-41.21, -8.64],
            [-41.38, -8.71],
            [-41.56, -8.97],
            [-41.73, -9.02],
            [-41.85, -9.24],
            [-42.24, -9.29],
            [-42.76, -9.61],
            [-42.95, -9.52],
            [-42.97, -9.41],
            [-43.28, -9.42],
            [-43.48, -9.27],
            [-43.85, -9.55],
            [-43.77, -9.77],
            [-43.65, -9.85],
            [-43.67, -10.03],
            [-44.13, -10.64],
            [-44.34, -10.55],
            [-44.58, -10.63],
            [-44.93, -10.93],
            [-45.25, -10.82],
            [-45.44, -10.62],
            [-45.4, -10.46],
            [-45.59, -10.11],
            [-45.79, -10.27],
            [-45.95, -10.25],
            [-45.78, -9.48],
            [-45.89, -9.34],
            [-45.99, -8.94],
            [-45.77, -8.61],
            [-45.49, -7.73],
            [-45.32, -7.57],
            [-44.92, -7.47],
            [-44.82, -7.37],
            [-44.69, -7.39],
            [-44.56, -7.23],
            [-44.31, -7.12],
            [-44.04, -6.77],
            [-43.72, -6.7],
            [-43.46, -6.85],
            [-43.03, -6.76],
            [-42.92, -6.67],
            [-42.83, -6.34],
            [-43.08, -6.05],
            [-43.09, -5.61],
            [-42.83, -5.35],
            [-42.8, -5.19],
            [-42.95, -4.79],
            [-42.85, -4.49],
            [-42.99, -4.23],
            [-42.73, -3.92],
            [-42.68, -3.68],
            [-42.5, -3.45],
            [-42.2, -3.42],
            [-42.13, -3.28],
            [-42.0, -3.24],
            [-41.83, -3.03],
            [-41.82, -2.75],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "PR" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-52.13, -22.53],
            [-51.71, -22.67],
            [-51.28, -22.67],
            [-50.89, -22.8],
            [-50.73, -22.96],
            [-50.65, -22.9],
            [-50.23, -22.95],
            [-49.99, -22.9],
            [-49.91, -23.05],
            [-49.73, -23.11],
            [-49.57, -23.43],
            [-49.63, -23.51],
            [-49.55, -23.7],
            [-49.61, -23.85],
            [-49.2, -24.34],
            [-49.3, -24.67],
            [-48.58, -24.67],
            [-48.5, -24.74],
            [-48.6, -25.0],
            [-48.56, -25.08],
            [-48.41, -24.98],
            [-48.33, -25.07],
            [-48.24, -24.99],
            [-48.18, -25.21],
            [-48.02, -25.23],
            [-48.44, -25.65],
            [-48.59, -25.98],
            [-49.17, -26.0],
            [-49.56, -26.23],
            [-49.94, -26.01],
            [-50.18, -26.08],
            [-50.25, -26.03],
            [-50.33, -26.13],
            [-50.56, -26.01],
            [-50.73, -26.25],
            [-50.9, -26.29],
            [-51.08, -26.23],
            [-51.21, -26.3],
            [-51.3, -26.42],
            [-51.24, -26.63],
            [-51.4, -26.71],
            [-51.49, -26.59],
            [-51.88, -26.6],
            [-52.19, -26.45],
            [-52.74, -26.34],
            [-53.11, -26.38],
            [-53.28, -26.25],
            [-53.54, -26.29],
            [-53.83, -25.97],
            [-53.89, -25.62],
            [-54.08, -25.56],
            [-54.1, -25.62],
            [-54.1, -25.5],
            [-54.17, -25.58],
            [-54.39, -25.6],
            [-54.43, -25.7],
            [-54.59, -25.59],
            [-54.62, -25.46],
            [-54.43, -25.15],
            [-54.44, -24.95],
            [-54.26, -24.36],
            [-54.34, -24.13],
            [-54.1, -23.95],
            [-53.98, -23.46],
            [-53.73, -23.32],
            [-53.61, -22.95],
            [-52.98, -22.57],
            [-52.7, -22.63],
            [-52.58, -22.57],
            [-52.22, -22.67],
            [-52.13, -22.53],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "RJ" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-44.51, -23.29],
              [-44.72, -23.37],
              [-44.83, -23.29],
              [-44.89, -23.22],
              [-44.8, -23.0],
              [-44.49, -22.85],
              [-44.27, -22.83],
              [-44.16, -22.68],
              [-44.39, -22.57],
              [-44.63, -22.61],
              [-44.79, -22.39],
              [-43.77, -22.07],
              [-43.56, -22.09],
              [-43.35, -22.0],
              [-43.07, -22.09],
              [-42.31, -21.73],
              [-42.27, -21.68],
              [-42.37, -21.62],
              [-42.25, -21.49],
              [-42.21, -21.18],
              [-42.08, -21.04],
              [-42.15, -20.98],
              [-41.97, -20.92],
              [-41.88, -20.77],
              [-41.75, -20.81],
              [-41.7, -21.13],
              [-41.09, -21.22],
              [-40.96, -21.3],
              [-41.07, -21.52],
              [-40.99, -22.0],
              [-41.69, -22.3],
              [-41.96, -22.53],
              [-41.98, -22.72],
              [-41.87, -22.76],
              [-41.97, -22.82],
              [-42.03, -22.9],
              [-42.01, -23.0],
              [-42.38, -22.93],
              [-43.05, -22.98],
              [-43.13, -22.94],
              [-43.03, -22.74],
              [-43.09, -22.68],
              [-43.27, -22.78],
              [-43.29, -22.81],
              [-43.24, -22.88],
              [-43.16, -22.9],
              [-43.15, -22.95],
              [-43.29, -23.02],
              [-43.71, -23.05],
              [-43.58, -23.04],
              [-43.85, -22.9],
              [-44.19, -23.05],
              [-44.36, -23.02],
              [-44.3, -22.96],
              [-44.35, -22.92],
              [-44.44, -23.02],
              [-44.67, -23.06],
              [-44.72, -23.19],
              [-44.71, -23.23],
              [-44.64, -23.18],
              [-44.69, -23.25],
              [-44.62, -23.25],
              [-44.66, -23.3],
              [-44.56, -23.23],
              [-44.51, -23.29],
            ],
            [
              [-43.41, -22.99],
              [-43.32, -23.0],
              [-43.31, -23.01],
              [-43.41, -22.99],
            ],
          ],
          [
            [
              [-44.23, -23.09],
              [-44.09, -23.18],
              [-44.35, -23.21],
              [-44.37, -23.17],
              [-44.23, -23.09],
            ],
          ],
          [
            [
              [-43.9, -23.03],
              [-43.79, -23.06],
              [-44.01, -23.08],
              [-43.9, -23.03],
            ],
          ],
          [
            [
              [-43.19, -22.79],
              [-43.17, -22.83],
              [-43.26, -22.81],
              [-43.19, -22.79],
            ],
          ],
          [
            [
              [-43.91, -22.96],
              [-43.88, -22.92],
              [-43.87, -22.93],
              [-43.91, -22.96],
            ],
          ],
          [
            [
              [-43.21, -22.87],
              [-43.24, -22.84],
              [-43.23, -22.84],
              [-43.21, -22.87],
            ],
          ],
          [
            [
              [-43.92, -23.0],
              [-43.94, -23.0],
              [-43.92, -22.99],
              [-43.92, -23.0],
            ],
          ],
          [
            [
              [-44.6, -23.21],
              [-44.6, -23.22],
              [-44.62, -23.22],
              [-44.6, -23.21],
            ],
          ],
          [
            [
              [-44.05, -23.01],
              [-44.03, -23.0],
              [-44.03, -23.01],
              [-44.05, -23.01],
            ],
          ],
          [
            [
              [-44.68, -23.16],
              [-44.7, -23.16],
              [-44.69, -23.15],
              [-44.68, -23.16],
            ],
          ],
          [
            [
              [-41.69, -22.41],
              [-41.7, -22.42],
              [-41.7, -22.41],
              [-41.69, -22.41],
            ],
          ],
          [
            [
              [-44.51, -23.29],
              [-44.5, -23.3],
              [-44.51, -23.29],
              [-44.51, -23.29],
            ],
          ],
          [
            [
              [-43.11, -22.76],
              [-43.1, -22.76],
              [-43.11, -22.77],
              [-43.11, -22.76],
            ],
          ],
          [
            [
              [-43.11, -22.76],
              [-43.11, -22.75],
              [-43.1, -22.75],
              [-43.11, -22.76],
            ],
          ],
          [
            [
              [-43.18, -22.9],
              [-43.17, -22.89],
              [-43.18, -22.9],
              [-43.18, -22.9],
            ],
          ],
          [
            [
              [-44.65, -23.07],
              [-44.64, -23.07],
              [-44.64, -23.07],
              [-44.65, -23.07],
            ],
          ],
          [
            [
              [-43.86, -22.95],
              [-43.86, -22.95],
              [-43.86, -22.95],
              [-43.86, -22.95],
            ],
          ],
          [
            [
              [-41.69, -22.4],
              [-41.69, -22.4],
              [-41.69, -22.4],
              [-41.69, -22.4],
            ],
          ],
          [
            [
              [-44.58, -23.2],
              [-44.58, -23.2],
              [-44.58, -23.2],
              [-44.58, -23.2],
            ],
          ],
          [
            [
              [-44.58, -23.19],
              [-44.57, -23.19],
              [-44.58, -23.19],
              [-44.58, -23.19],
            ],
          ],
          [
            [
              [-43.91, -22.98],
              [-43.91, -22.98],
              [-43.91, -22.98],
              [-43.91, -22.98],
            ],
          ],
          [
            [
              [-44.65, -23.23],
              [-44.65, -23.23],
              [-44.65, -23.23],
              [-44.65, -23.23],
            ],
          ],
          [
            [
              [-41.89, -22.78],
              [-41.88, -22.78],
              [-41.88, -22.78],
              [-41.89, -22.78],
            ],
          ],
          [
            [
              [-44.13, -23.04],
              [-44.13, -23.04],
              [-44.13, -23.04],
              [-44.13, -23.04],
            ],
          ],
          [
            [
              [-43.92, -22.94],
              [-43.92, -22.94],
              [-43.92, -22.94],
              [-43.92, -22.94],
            ],
          ],
          [
            [
              [-43.51, -23.07],
              [-43.51, -23.07],
              [-43.51, -23.07],
              [-43.51, -23.07],
            ],
          ],
          [
            [
              [-43.15, -23.06],
              [-43.15, -23.07],
              [-43.15, -23.06],
              [-43.15, -23.06],
            ],
          ],
          [
            [
              [-44.64, -23.23],
              [-44.63, -23.23],
              [-44.64, -23.23],
              [-44.64, -23.23],
            ],
          ],
          [
            [
              [-43.94, -23.02],
              [-43.94, -23.02],
              [-43.94, -23.02],
              [-43.94, -23.02],
            ],
          ],
          [
            [
              [-44.69, -23.21],
              [-44.69, -23.22],
              [-44.69, -23.21],
              [-44.69, -23.21],
            ],
          ],
          [
            [
              [-43.95, -23.0],
              [-43.95, -23.01],
              [-43.95, -23.0],
              [-43.95, -23.0],
            ],
          ],
          [
            [
              [-43.21, -23.04],
              [-43.2, -23.04],
              [-43.21, -23.04],
              [-43.21, -23.04],
            ],
          ],
          [
            [
              [-44.67, -23.1],
              [-44.67, -23.1],
              [-44.67, -23.1],
              [-44.67, -23.1],
            ],
          ],
          [
            [
              [-43.95, -23.02],
              [-43.95, -23.02],
              [-43.95, -23.02],
              [-43.95, -23.02],
            ],
          ],
          [
            [
              [-43.86, -22.95],
              [-43.86, -22.95],
              [-43.86, -22.95],
              [-43.86, -22.95],
            ],
          ],
          [
            [
              [-44.67, -23.11],
              [-44.67, -23.11],
              [-44.67, -23.11],
              [-44.67, -23.11],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "RN" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-37.15, -4.93],
            [-36.96, -4.92],
            [-36.69, -5.09],
            [-35.95, -5.04],
            [-35.49, -5.16],
            [-35.26, -5.48],
            [-34.97, -6.48],
            [-35.17, -6.56],
            [-35.66, -6.45],
            [-36.01, -6.48],
            [-36.07, -6.41],
            [-36.25, -6.44],
            [-36.31, -6.28],
            [-36.39, -6.29],
            [-36.53, -6.45],
            [-36.44, -6.63],
            [-36.52, -6.6],
            [-36.51, -6.82],
            [-36.72, -6.98],
            [-36.79, -6.77],
            [-36.96, -6.79],
            [-36.99, -6.71],
            [-37.23, -6.82],
            [-37.28, -6.69],
            [-37.48, -6.71],
            [-37.38, -6.34],
            [-37.16, -6.15],
            [-37.2, -6.04],
            [-37.75, -6.2],
            [-37.76, -6.29],
            [-38.12, -6.52],
            [-38.49, -6.4],
            [-38.46, -6.33],
            [-38.58, -6.35],
            [-38.45, -6.08],
            [-38.29, -6.07],
            [-38.16, -5.95],
            [-38.08, -5.67],
            [-37.9, -5.5],
            [-37.64, -4.93],
            [-37.25, -4.83],
            [-37.15, -4.93],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "RO" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-66.46, -9.88],
              [-66.81, -9.81],
              [-66.5, -9.63],
              [-66.41, -9.41],
              [-65.97, -9.41],
              [-65.79, -9.59],
              [-65.6, -9.41],
              [-65.43, -9.46],
              [-65.44, -9.31],
              [-65.25, -9.26],
              [-65.18, -9.43],
              [-65.09, -9.43],
              [-64.92, -9.23],
              [-64.87, -9.01],
              [-64.14, -8.95],
              [-64.13, -8.72],
              [-63.92, -8.57],
              [-63.93, -8.32],
              [-63.78, -8.33],
              [-63.63, -8.02],
              [-62.87, -7.97],
              [-62.69, -8.1],
              [-62.52, -8.38],
              [-62.36, -8.4],
              [-62.34, -8.6],
              [-62.19, -8.59],
              [-62.12, -8.8],
              [-61.92, -8.88],
              [-61.71, -8.69],
              [-61.48, -8.91],
              [-61.53, -9.25],
              [-61.63, -9.28],
              [-61.48, -9.64],
              [-61.57, -9.73],
              [-61.51, -9.89],
              [-61.6, -10.15],
              [-61.46, -10.42],
              [-61.55, -10.98],
              [-60.46, -10.99],
              [-60.35, -11.11],
              [-59.98, -11.12],
              [-59.92, -11.4],
              [-60.11, -11.58],
              [-60.1, -11.84],
              [-59.98, -11.91],
              [-59.89, -12.24],
              [-59.79, -12.35],
              [-59.85, -12.47],
              [-60.06, -12.6],
              [-60.08, -12.88],
              [-60.28, -13.09],
              [-60.39, -13.45],
              [-60.72, -13.69],
              [-61.04, -13.48],
              [-61.84, -13.55],
              [-62.17, -13.12],
              [-62.41, -13.13],
              [-62.65, -12.97],
              [-62.78, -13.01],
              [-63.15, -12.62],
              [-63.29, -12.68],
              [-63.79, -12.43],
              [-63.95, -12.53],
              [-64.29, -12.5],
              [-64.5, -12.37],
              [-64.51, -12.22],
              [-64.69, -12.19],
              [-64.71, -12.09],
              [-64.75, -12.16],
              [-64.78, -12.09],
              [-64.83, -12.12],
              [-64.84, -12.01],
              [-65.03, -11.99],
              [-65.09, -11.71],
              [-65.25, -11.71],
              [-65.21, -11.53],
              [-65.31, -11.49],
              [-65.29, -11.32],
              [-65.36, -11.25],
              [-65.25, -10.99],
              [-65.42, -10.62],
              [-65.43, -10.48],
              [-65.29, -10.22],
              [-65.29, -9.85],
              [-65.39, -9.69],
              [-65.56, -9.84],
              [-65.77, -9.73],
              [-65.79, -9.79],
              [-65.92, -9.75],
              [-66.46, -9.88],
            ],
          ],
          [
            [
              [-66.46, -9.88],
              [-66.46, -9.88],
              [-66.46, -9.88],
              [-66.46, -9.88],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "RR" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-59.81, 3.37],
            [-59.99, 2.69],
            [-59.9, 2.37],
            [-59.72, 2.28],
            [-59.75, 1.86],
            [-59.66, 1.87],
            [-59.69, 1.76],
            [-59.53, 1.72],
            [-59.25, 1.39],
            [-58.92, 1.32],
            [-58.9, 0.61],
            [-59.19, 0.26],
            [-60.04, 0.26],
            [-60.4, -0.51],
            [-60.3, -0.71],
            [-60.48, -0.77],
            [-60.53, -0.88],
            [-60.75, -0.86],
            [-60.92, -0.56],
            [-61.09, -0.5],
            [-61.46, -0.66],
            [-61.55, -0.81],
            [-61.63, -1.3],
            [-61.48, -1.58],
            [-61.6, -1.45],
            [-61.9, -1.4],
            [-62.04, -1.12],
            [-62.5, -0.77],
            [-62.49, -0.68],
            [-62.39, -0.72],
            [-62.3, -0.65],
            [-62.31, -0.51],
            [-62.19, -0.33],
            [-62.42, 0.08],
            [-62.53, 0.5],
            [-62.47, 1.09],
            [-62.53, 1.09],
            [-62.64, 1.44],
            [-62.8, 1.6],
            [-62.71, 1.94],
            [-63.07, 2.04],
            [-63.14, 2.17],
            [-63.36, 2.2],
            [-63.42, 2.44],
            [-63.72, 2.38],
            [-64.03, 2.47],
            [-63.99, 2.77],
            [-64.23, 3.12],
            [-64.25, 3.41],
            [-64.19, 3.56],
            [-64.48, 3.79],
            [-64.82, 4.24],
            [-64.69, 4.25],
            [-64.59, 4.11],
            [-64.17, 4.13],
            [-63.96, 3.87],
            [-63.86, 3.95],
            [-63.67, 3.91],
            [-63.68, 4.01],
            [-63.5, 3.84],
            [-63.43, 3.98],
            [-63.21, 3.95],
            [-63.22, 3.83],
            [-62.96, 3.61],
            [-62.84, 3.73],
            [-62.74, 3.67],
            [-62.75, 4.04],
            [-62.56, 4.02],
            [-62.44, 4.18],
            [-62.15, 4.08],
            [-61.98, 4.18],
            [-61.93, 4.11],
            [-61.77, 4.25],
            [-61.56, 4.25],
            [-61.51, 4.4],
            [-61.28, 4.47],
            [-61.32, 4.54],
            [-61.0, 4.52],
            [-60.91, 4.71],
            [-60.74, 4.76],
            [-60.59, 4.93],
            [-60.72, 5.22],
            [-60.43, 5.18],
            [-60.21, 5.27],
            [-60.0, 5.09],
            [-59.99, 4.97],
            [-60.03, 4.7],
            [-60.16, 4.51],
            [-59.79, 4.47],
            [-59.68, 4.38],
            [-59.72, 4.18],
            [-59.52, 3.94],
            [-59.67, 3.7],
            [-59.86, 3.58],
            [-59.81, 3.37],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "RS" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-52.03, -31.7],
              [-52.04, -31.57],
              [-52.06, -31.56],
              [-52.11, -31.56],
              [-52.07, -31.68],
              [-52.23, -31.75],
              [-52.26, -31.85],
              [-52.07, -32.03],
              [-52.1, -32.16],
              [-52.34, -32.43],
              [-52.62, -33.11],
              [-53.4, -33.75],
              [-53.53, -33.65],
              [-53.43, -33.5],
              [-53.43, -33.16],
              [-53.32, -33.05],
              [-53.26, -33.1],
              [-53.12, -32.79],
              [-53.07, -32.83],
              [-52.98, -32.73],
              [-52.9, -32.89],
              [-52.76, -32.87],
              [-52.59, -32.52],
              [-52.69, -32.32],
              [-52.62, -32.15],
              [-52.8, -32.27],
              [-52.74, -32.4],
              [-52.96, -32.49],
              [-53.07, -32.65],
              [-53.4, -32.58],
              [-53.63, -32.39],
              [-53.74, -32.08],
              [-53.98, -31.92],
              [-54.1, -31.93],
              [-54.58, -31.46],
              [-54.84, -31.44],
              [-55.01, -31.27],
              [-55.07, -31.33],
              [-55.24, -31.26],
              [-55.35, -31.04],
              [-55.58, -30.84],
              [-55.87, -31.07],
              [-56.01, -31.07],
              [-56.02, -30.79],
              [-56.82, -30.1],
              [-57.07, -30.09],
              [-57.22, -30.29],
              [-57.52, -30.29],
              [-57.64, -30.19],
              [-57.34, -29.99],
              [-57.29, -29.82],
              [-56.97, -29.64],
              [-56.59, -29.12],
              [-56.42, -29.07],
              [-56.29, -28.79],
              [-56.0, -28.6],
              [-56.02, -28.51],
              [-55.89, -28.48],
              [-55.87, -28.36],
              [-55.7, -28.43],
              [-55.67, -28.33],
              [-55.77, -28.24],
              [-55.44, -28.09],
              [-55.2, -27.86],
              [-55.03, -27.86],
              [-55.08, -27.79],
              [-54.94, -27.77],
              [-54.81, -27.53],
              [-54.68, -27.57],
              [-54.58, -27.45],
              [-54.53, -27.5],
              [-54.41, -27.41],
              [-54.28, -27.45],
              [-54.18, -27.27],
              [-54.08, -27.3],
              [-53.87, -27.13],
              [-53.64, -27.22],
              [-53.37, -27.09],
              [-53.29, -27.13],
              [-53.31, -27.22],
              [-53.02, -27.08],
              [-52.99, -27.22],
              [-52.85, -27.17],
              [-52.69, -27.28],
              [-52.45, -27.22],
              [-52.21, -27.33],
              [-52.17, -27.27],
              [-51.95, -27.38],
              [-52.01, -27.4],
              [-51.88, -27.52],
              [-51.63, -27.49],
              [-51.08, -27.83],
              [-50.62, -28.39],
              [-50.16, -28.5],
              [-50.13, -28.43],
              [-49.77, -28.46],
              [-49.69, -28.62],
              [-49.92, -28.72],
              [-49.96, -29.1],
              [-50.16, -29.25],
              [-50.04, -29.35],
              [-50.11, -29.26],
              [-49.91, -29.21],
              [-49.72, -29.34],
              [-50.04, -29.81],
              [-50.33, -30.49],
              [-50.7, -31.01],
              [-51.25, -31.57],
              [-52.08, -32.16],
              [-52.01, -31.94],
              [-52.1, -31.84],
              [-51.85, -31.87],
              [-51.79, -31.81],
              [-51.86, -31.8],
              [-51.66, -31.77],
              [-51.48, -31.57],
              [-51.44, -31.62],
              [-51.43, -31.48],
              [-51.36, -31.53],
              [-51.24, -31.46],
              [-51.17, -31.07],
              [-50.99, -31.05],
              [-50.97, -30.9],
              [-50.7, -30.75],
              [-50.72, -30.35],
              [-50.65, -30.39],
              [-50.63, -30.34],
              [-50.65, -30.44],
              [-50.57, -30.47],
              [-50.54, -30.27],
              [-50.6, -30.19],
              [-50.66, -30.29],
              [-50.91, -30.32],
              [-50.92, -30.44],
              [-51.05, -30.39],
              [-51.03, -30.28],
              [-51.24, -30.19],
              [-51.23, -30.06],
              [-51.29, -30.0],
              [-51.33, -30.22],
              [-51.29, -30.3],
              [-51.09, -30.37],
              [-51.26, -30.47],
              [-51.29, -30.74],
              [-51.33, -30.63],
              [-51.39, -30.66],
              [-51.37, -30.87],
              [-51.5, -30.91],
              [-51.45, -31.09],
              [-51.62, -31.14],
              [-51.62, -31.27],
              [-51.92, -31.31],
              [-52.03, -31.7],
            ],
          ],
          [
            [
              [-51.32, -30.78],
              [-51.28, -30.8],
              [-51.3, -30.82],
              [-51.32, -30.78],
            ],
          ],
          [
            [
              [-50.1, -29.24],
              [-50.09, -29.21],
              [-50.08, -29.23],
              [-50.1, -29.24],
            ],
          ],
          [
            [
              [-51.15, -30.47],
              [-51.15, -30.5],
              [-51.15, -30.47],
              [-51.15, -30.47],
            ],
          ],
          [
            [
              [-49.96, -29.07],
              [-49.95, -29.05],
              [-49.94, -29.06],
              [-49.96, -29.07],
            ],
          ],
          [
            [
              [-51.3, -30.05],
              [-51.27, -30.05],
              [-51.3, -30.05],
              [-51.3, -30.05],
            ],
          ],
          [
            [
              [-52.1, -31.8],
              [-52.11, -31.79],
              [-52.1, -31.8],
              [-52.1, -31.8],
            ],
          ],
          [
            [
              [-53.41, -33.12],
              [-53.41, -33.11],
              [-53.41, -33.11],
              [-53.41, -33.12],
            ],
          ],
          [
            [
              [-49.97, -29.12],
              [-49.96, -29.11],
              [-49.97, -29.12],
              [-49.97, -29.12],
            ],
          ],
          [
            [
              [-51.47, -31.55],
              [-51.46, -31.55],
              [-51.47, -31.55],
              [-51.47, -31.55],
            ],
          ],
          [
            [
              [-51.17, -30.26],
              [-51.16, -30.27],
              [-51.17, -30.26],
              [-51.17, -30.26],
            ],
          ],
          [
            [
              [-51.1, -30.26],
              [-51.1, -30.26],
              [-51.1, -30.26],
              [-51.1, -30.26],
            ],
          ],
          [
            [
              [-52.04, -31.57],
              [-52.05, -31.57],
              [-52.04, -31.57],
              [-52.04, -31.57],
            ],
          ],
          [
            [
              [-51.19, -30.23],
              [-51.19, -30.24],
              [-51.19, -30.23],
              [-51.19, -30.23],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "SC" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-53.75, -26.71],
              [-53.64, -26.25],
              [-53.29, -26.25],
              [-53.09, -26.39],
              [-52.74, -26.34],
              [-52.19, -26.45],
              [-51.87, -26.6],
              [-51.51, -26.58],
              [-51.41, -26.72],
              [-51.23, -26.62],
              [-51.29, -26.44],
              [-51.24, -26.32],
              [-51.08, -26.23],
              [-50.9, -26.29],
              [-50.72, -26.24],
              [-50.57, -26.0],
              [-50.34, -26.13],
              [-50.25, -26.03],
              [-50.18, -26.08],
              [-49.94, -26.01],
              [-49.55, -26.24],
              [-49.17, -26.0],
              [-48.6, -25.98],
              [-48.58, -26.16],
              [-48.49, -26.22],
              [-48.69, -26.68],
              [-48.59, -26.78],
              [-48.6, -27.12],
              [-48.47, -27.14],
              [-48.62, -27.25],
              [-48.52, -27.33],
              [-48.65, -27.48],
              [-48.57, -27.6],
              [-48.64, -27.64],
              [-48.57, -27.89],
              [-48.74, -28.51],
              [-49.33, -28.91],
              [-49.71, -29.32],
              [-49.96, -29.2],
              [-50.11, -29.26],
              [-50.1, -29.28],
              [-50.06, -29.31],
              [-50.04, -29.35],
              [-50.15, -29.29],
              [-50.14, -29.19],
              [-50.09, -29.24],
              [-50.1, -29.16],
              [-49.96, -29.11],
              [-49.94, -28.73],
              [-49.69, -28.62],
              [-49.77, -28.46],
              [-50.1, -28.48],
              [-50.13, -28.43],
              [-50.16, -28.5],
              [-50.25, -28.43],
              [-50.54, -28.43],
              [-51.08, -27.84],
              [-51.63, -27.49],
              [-51.89, -27.52],
              [-52.01, -27.4],
              [-51.96, -27.38],
              [-52.17, -27.27],
              [-52.21, -27.33],
              [-52.29, -27.26],
              [-52.3, -27.32],
              [-52.44, -27.22],
              [-52.7, -27.28],
              [-52.85, -27.17],
              [-52.98, -27.22],
              [-53.03, -27.08],
              [-53.31, -27.22],
              [-53.36, -27.09],
              [-53.51, -27.2],
              [-53.83, -27.17],
              [-53.67, -26.94],
              [-53.75, -26.71],
            ],
          ],
          [
            [
              [-48.41, -27.39],
              [-48.36, -27.45],
              [-48.49, -27.79],
              [-48.57, -27.84],
              [-48.55, -27.46],
              [-48.41, -27.39],
            ],
          ],
          [
            [
              [-48.56, -27.48],
              [-48.56, -27.48],
              [-48.56, -27.48],
              [-48.56, -27.48],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "SE" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-37.96, -9.53],
            [-36.97, -9.99],
            [-36.91, -10.14],
            [-36.62, -10.26],
            [-36.56, -10.42],
            [-36.46, -10.41],
            [-36.39, -10.5],
            [-36.85, -10.74],
            [-37.33, -11.43],
            [-37.55, -11.55],
            [-37.7, -11.56],
            [-37.94, -11.42],
            [-37.97, -11.2],
            [-38.24, -10.86],
            [-38.21, -10.71],
            [-38.0, -10.76],
            [-37.84, -10.7],
            [-37.86, -10.43],
            [-37.74, -10.32],
            [-37.83, -10.0],
            [-38.0, -9.92],
            [-38.04, -9.57],
            [-37.96, -9.53],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "SP" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-46.14, -23.86],
              [-46.18, -23.99],
              [-46.29, -24.04],
              [-46.38, -23.97],
              [-46.94, -24.28],
              [-47.02, -24.42],
              [-47.77, -24.91],
              [-47.91, -25.16],
              [-48.1, -25.31],
              [-48.02, -25.23],
              [-48.18, -25.21],
              [-48.24, -24.99],
              [-48.33, -25.07],
              [-48.41, -24.98],
              [-48.56, -25.08],
              [-48.6, -25.0],
              [-48.5, -24.74],
              [-48.58, -24.67],
              [-49.3, -24.67],
              [-49.2, -24.34],
              [-49.61, -23.85],
              [-49.55, -23.7],
              [-49.63, -23.51],
              [-49.57, -23.43],
              [-49.68, -23.16],
              [-49.91, -23.05],
              [-49.99, -22.9],
              [-50.18, -22.95],
              [-50.65, -22.9],
              [-50.73, -22.96],
              [-50.89, -22.8],
              [-51.28, -22.67],
              [-51.71, -22.67],
              [-52.1, -22.52],
              [-52.22, -22.67],
              [-52.58, -22.57],
              [-53.11, -22.61],
              [-52.34, -22.06],
              [-52.05, -21.66],
              [-52.08, -21.52],
              [-51.97, -21.5],
              [-51.86, -21.34],
              [-51.88, -21.15],
              [-51.62, -20.93],
              [-51.59, -20.64],
              [-51.35, -20.36],
              [-51.13, -20.29],
              [-50.93, -20.01],
              [-50.58, -19.82],
              [-49.26, -19.96],
              [-49.3, -20.12],
              [-49.24, -20.29],
              [-48.99, -20.16],
              [-48.9, -20.44],
              [-48.84, -20.17],
              [-48.22, -20.13],
              [-48.23, -20.03],
              [-48.09, -20.15],
              [-47.98, -20.04],
              [-47.9, -20.12],
              [-47.85, -19.99],
              [-47.63, -20.04],
              [-47.47, -19.96],
              [-47.26, -20.17],
              [-47.29, -20.43],
              [-47.1, -20.64],
              [-47.24, -20.89],
              [-47.14, -20.98],
              [-47.01, -21.42],
              [-46.66, -21.36],
              [-46.51, -21.47],
              [-46.52, -21.61],
              [-46.69, -21.84],
              [-46.61, -22.02],
              [-46.72, -22.08],
              [-46.6, -22.13],
              [-46.72, -22.31],
              [-46.67, -22.41],
              [-46.41, -22.54],
              [-46.39, -22.66],
              [-46.48, -22.7],
              [-46.34, -22.76],
              [-46.35, -22.9],
              [-46.14, -22.86],
              [-46.14, -22.92],
              [-45.91, -22.82],
              [-45.79, -22.86],
              [-45.71, -22.81],
              [-45.73, -22.72],
              [-45.82, -22.72],
              [-45.7, -22.65],
              [-45.72, -22.58],
              [-45.67, -22.65],
              [-45.47, -22.59],
              [-45.4, -22.65],
              [-44.81, -22.41],
              [-44.63, -22.61],
              [-44.39, -22.57],
              [-44.16, -22.68],
              [-44.27, -22.83],
              [-44.79, -22.98],
              [-44.89, -23.22],
              [-44.72, -23.37],
              [-44.91, -23.34],
              [-45.06, -23.42],
              [-45.08, -23.52],
              [-45.16, -23.49],
              [-45.21, -23.58],
              [-45.31, -23.57],
              [-45.41, -23.62],
              [-45.41, -23.82],
              [-45.84, -23.76],
              [-46.14, -23.86],
            ],
          ],
          [
            [
              [-45.29, -23.91],
              [-45.46, -23.9],
              [-45.32, -23.72],
              [-45.23, -23.78],
              [-45.29, -23.87],
              [-45.23, -23.91],
              [-45.26, -23.96],
              [-45.29, -23.91],
            ],
          ],
          [
            [
              [-45.08, -23.56],
              [-45.06, -23.53],
              [-45.04, -23.53],
              [-45.08, -23.56],
            ],
          ],
          [
            [
              [-45.14, -23.8],
              [-45.12, -23.81],
              [-45.16, -23.81],
              [-45.14, -23.8],
            ],
          ],
          [
            [
              [-45.16, -23.57],
              [-45.15, -23.56],
              [-45.15, -23.57],
              [-45.16, -23.57],
            ],
          ],
          [
            [
              [-45.02, -23.76],
              [-45.01, -23.75],
              [-45.01, -23.76],
              [-45.02, -23.76],
            ],
          ],
          [
            [
              [-45.77, -23.86],
              [-45.79, -23.87],
              [-45.78, -23.86],
              [-45.77, -23.86],
            ],
          ],
          [
            [
              [-45.3, -23.6],
              [-45.29, -23.59],
              [-45.28, -23.6],
              [-45.3, -23.6],
            ],
          ],
          [
            [
              [-45.02, -23.75],
              [-45.02, -23.74],
              [-45.02, -23.75],
              [-45.02, -23.75],
            ],
          ],
          [
            [
              [-45.73, -23.8],
              [-45.72, -23.8],
              [-45.72, -23.8],
              [-45.73, -23.8],
            ],
          ],
          [
            [
              [-45.53, -23.85],
              [-45.52, -23.85],
              [-45.52, -23.85],
              [-45.53, -23.85],
            ],
          ],
          [
            [
              [-46.91, -24.39],
              [-46.9, -24.39],
              [-46.91, -24.39],
              [-46.91, -24.39],
            ],
          ],
          [
            [
              [-46.91, -24.37],
              [-46.9, -24.38],
              [-46.91, -24.38],
              [-46.91, -24.37],
            ],
          ],
          [
            [
              [-45.03, -23.55],
              [-45.02, -23.54],
              [-45.03, -23.55],
              [-45.03, -23.55],
            ],
          ],
          [
            [
              [-44.85, -23.4],
              [-44.85, -23.4],
              [-44.85, -23.4],
              [-44.85, -23.4],
            ],
          ],
          [
            [
              [-44.95, -23.39],
              [-44.94, -23.38],
              [-44.95, -23.39],
              [-44.95, -23.39],
            ],
          ],
          [
            [
              [-46.98, -24.37],
              [-46.98, -24.37],
              [-46.98, -24.37],
              [-46.98, -24.37],
            ],
          ],
          [
            [
              [-47.91, -25.17],
              [-47.91, -25.17],
              [-47.91, -25.17],
              [-47.91, -25.17],
            ],
          ],
          [
            [
              [-45.23, -23.81],
              [-45.23, -23.82],
              [-45.23, -23.81],
              [-45.23, -23.81],
            ],
          ],
          [
            [
              [-45.33, -23.92],
              [-45.32, -23.92],
              [-45.33, -23.92],
              [-45.33, -23.92],
            ],
          ],
          [
            [
              [-45.71, -23.79],
              [-45.71, -23.79],
              [-45.71, -23.79],
              [-45.71, -23.79],
            ],
          ],
          [
            [
              [-45.28, -23.85],
              [-45.28, -23.85],
              [-45.28, -23.85],
              [-45.28, -23.85],
            ],
          ],
          [
            [
              [-45.3, -23.92],
              [-45.29, -23.92],
              [-45.3, -23.92],
              [-45.3, -23.92],
            ],
          ],
          [
            [
              [-45.16, -23.83],
              [-45.15, -23.83],
              [-45.16, -23.83],
              [-45.16, -23.83],
            ],
          ],
          [
            [
              [-45.67, -23.8],
              [-45.67, -23.8],
              [-45.67, -23.8],
              [-45.67, -23.8],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "TO" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-46.92, -8.86],
            [-47.07, -9.06],
            [-46.91, -9.08],
            [-46.77, -9.4],
            [-46.56, -9.48],
            [-46.64, -9.74],
            [-46.49, -9.83],
            [-46.36, -10.17],
            [-46.03, -10.18],
            [-46.0, -10.26],
            [-45.79, -10.27],
            [-45.7, -10.17],
            [-45.83, -10.44],
            [-46.21, -10.65],
            [-46.28, -10.9],
            [-46.62, -11.3],
            [-46.47, -11.52],
            [-46.09, -11.62],
            [-46.3, -11.62],
            [-46.37, -11.88],
            [-46.17, -11.91],
            [-46.4, -12.04],
            [-46.37, -12.29],
            [-46.25, -12.49],
            [-46.15, -12.48],
            [-46.28, -12.58],
            [-46.3, -12.91],
            [-46.12, -12.93],
            [-46.36, -12.99],
            [-46.42, -12.82],
            [-46.45, -12.96],
            [-46.82, -13.0],
            [-47.43, -13.29],
            [-47.63, -13.1],
            [-47.68, -13.46],
            [-47.8, -13.33],
            [-48.06, -13.24],
            [-48.16, -13.3],
            [-48.17, -13.15],
            [-48.44, -13.29],
            [-48.51, -13.13],
            [-48.58, -13.31],
            [-48.6, -13.06],
            [-48.86, -12.8],
            [-48.98, -12.96],
            [-49.12, -12.79],
            [-49.24, -12.88],
            [-49.37, -13.27],
            [-50.29, -12.84],
            [-50.3, -12.68],
            [-50.2, -12.55],
            [-50.22, -12.53],
            [-50.16, -12.44],
            [-50.17, -12.41],
            [-50.36, -12.54],
            [-50.51, -12.86],
            [-50.62, -12.82],
            [-50.7, -12.61],
            [-50.62, -12.43],
            [-50.69, -12.04],
            [-50.64, -11.88],
            [-50.72, -11.74],
            [-50.66, -11.6],
            [-50.74, -11.45],
            [-50.61, -11.07],
            [-50.6, -10.66],
            [-50.11, -9.59],
            [-50.04, -9.3],
            [-49.74, -8.9],
            [-49.59, -8.83],
            [-49.27, -8.34],
            [-49.15, -7.81],
            [-49.38, -7.54],
            [-49.19, -7.24],
            [-49.21, -6.93],
            [-48.66, -6.66],
            [-48.63, -6.48],
            [-48.5, -6.35],
            [-48.38, -6.38],
            [-48.43, -6.18],
            [-48.3, -6.11],
            [-48.34, -6.02],
            [-48.23, -5.93],
            [-48.29, -5.76],
            [-48.17, -5.71],
            [-48.14, -5.6],
            [-48.38, -5.39],
            [-48.74, -5.37],
            [-48.61, -5.34],
            [-48.52, -5.19],
            [-47.94, -5.24],
            [-47.84, -5.38],
            [-47.5, -5.53],
            [-47.38, -6.25],
            [-47.53, -6.98],
            [-47.75, -7.19],
            [-47.65, -7.3],
            [-47.48, -7.32],
            [-47.59, -7.44],
            [-47.5, -7.44],
            [-47.04, -8.05],
            [-46.63, -7.9],
            [-46.49, -7.98],
            [-46.51, -8.27],
            [-46.78, -8.37],
            [-46.92, -8.6],
            [-46.92, -8.86],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { uf: "DF" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-47.37, -15.96],
            [-47.32, -16.05],
            [-48.27, -16.05],
            [-48.2, -15.5],
            [-47.42, -15.51],
            [-47.32, -15.59],
            [-47.37, -15.96],
          ],
        ],
      },
    },
  ],
};
const BR_OUTLINE = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [-32.47, -3.88],
        [-32.44, -3.85],
        [-32.42, -3.88],
        [-32.42, -3.88],
        [-32.47, -3.88],
      ],
    ],
    [
      [
        [-73.99, -7.55],
        [-73.92, -7.46],
        [-73.96, -7.35],
        [-73.71, -7.3],
        [-73.8, -7.11],
        [-73.64, -6.75],
        [-73.14, -6.5],
        [-73.24, -6.03],
        [-72.96, -5.65],
        [-72.88, -5.17],
        [-72.81, -5.11],
        [-71.89, -4.52],
        [-71.63, -4.47],
        [-71.6, -4.53],
        [-71.27, -4.38],
        [-70.95, -4.38],
        [-70.81, -4.18],
        [-70.69, -4.2],
        [-70.65, -4.13],
        [-70.61, -4.19],
        [-70.33, -4.15],
        [-70.2, -4.35],
        [-70.11, -4.26],
        [-70.04, -4.35],
        [-69.96, -4.3],
        [-69.4, -1.13],
        [-69.62, -0.75],
        [-69.61, -0.51],
        [-70.05, -0.19],
        [-70.03, 0.56],
        [-69.8, 0.58],
        [-69.68, 0.67],
        [-69.61, 0.63],
        [-69.48, 0.74],
        [-69.36, 0.61],
        [-69.13, 0.65],
        [-69.19, 0.75],
        [-69.14, 0.89],
        [-69.25, 1.05],
        [-69.84, 1.09],
        [-69.83, 1.72],
        [-69.55, 1.79],
        [-69.38, 1.73],
        [-68.19, 1.74],
        [-68.27, 1.83],
        [-68.18, 1.98],
        [-67.93, 1.83],
        [-67.77, 2.04],
        [-67.62, 2.02],
        [-67.41, 2.25],
        [-67.28, 1.88],
        [-67.15, 1.84],
        [-67.1, 1.73],
        [-67.08, 1.18],
        [-66.86, 1.23],
        [-66.32, 0.76],
        [-66.12, 0.75],
        [-65.74, 1.0],
        [-65.58, 1.0],
        [-65.49, 0.88],
        [-65.58, 0.74],
        [-65.55, 0.67],
        [-65.43, 0.7],
        [-65.32, 0.93],
        [-65.18, 0.92],
        [-65.1, 1.16],
        [-65.02, 1.12],
        [-64.8, 1.31],
        [-64.72, 1.24],
        [-64.4, 1.52],
        [-64.35, 1.5],
        [-64.4, 1.4],
        [-64.33, 1.37],
        [-64.11, 1.59],
        [-64.0, 1.98],
        [-63.66, 2.02],
        [-63.37, 2.22],
        [-63.42, 2.44],
        [-63.72, 2.38],
        [-64.03, 2.47],
        [-63.99, 2.77],
        [-64.23, 3.12],
        [-64.25, 3.41],
        [-64.19, 3.56],
        [-64.48, 3.79],
        [-64.82, 4.24],
        [-64.69, 4.25],
        [-64.59, 4.11],
        [-64.17, 4.13],
        [-63.96, 3.87],
        [-63.86, 3.95],
        [-63.68, 3.91],
        [-63.68, 4.01],
        [-63.5, 3.85],
        [-63.43, 3.98],
        [-63.21, 3.95],
        [-63.22, 3.83],
        [-62.96, 3.61],
        [-62.84, 3.73],
        [-62.74, 3.68],
        [-62.75, 4.04],
        [-62.56, 4.02],
        [-62.44, 4.18],
        [-62.15, 4.08],
        [-61.98, 4.18],
        [-61.93, 4.12],
        [-61.77, 4.25],
        [-61.56, 4.25],
        [-61.51, 4.4],
        [-61.29, 4.47],
        [-61.32, 4.54],
        [-61.0, 4.52],
        [-60.91, 4.71],
        [-60.74, 4.76],
        [-60.59, 4.93],
        [-60.72, 5.22],
        [-60.43, 5.18],
        [-60.21, 5.27],
        [-60.0, 5.09],
        [-59.99, 4.97],
        [-60.03, 4.7],
        [-60.15, 4.51],
        [-59.79, 4.47],
        [-59.68, 4.38],
        [-59.72, 4.18],
        [-59.52, 3.94],
        [-59.67, 3.7],
        [-59.86, 3.58],
        [-59.81, 3.37],
        [-59.99, 2.69],
        [-59.9, 2.37],
        [-59.72, 2.28],
        [-59.75, 1.87],
        [-59.66, 1.87],
        [-59.69, 1.76],
        [-59.53, 1.72],
        [-59.25, 1.39],
        [-58.92, 1.32],
        [-58.92, 1.23],
        [-58.83, 1.17],
        [-58.7, 1.29],
        [-58.5, 1.27],
        [-58.51, 1.46],
        [-58.38, 1.47],
        [-58.32, 1.6],
        [-58.01, 1.5],
        [-57.99, 1.66],
        [-57.77, 1.73],
        [-57.54, 1.7],
        [-57.31, 2.0],
        [-57.23, 1.94],
        [-57.09, 2.03],
        [-57.01, 1.92],
        [-56.79, 1.85],
        [-56.45, 1.96],
        [-55.98, 1.84],
        [-55.9, 2.03],
        [-56.14, 2.27],
        [-56.09, 2.38],
        [-56.02, 2.35],
        [-55.99, 2.52],
        [-55.71, 2.4],
        [-55.35, 2.45],
        [-55.32, 2.52],
        [-55.0, 2.59],
        [-54.88, 2.43],
        [-54.69, 2.44],
        [-54.66, 2.33],
        [-54.44, 2.21],
        [-54.19, 2.18],
        [-53.76, 2.38],
        [-53.75, 2.31],
        [-53.53, 2.26],
        [-53.34, 2.35],
        [-53.23, 2.27],
        [-53.26, 2.17],
        [-52.95, 2.17],
        [-52.55, 2.52],
        [-52.33, 3.17],
        [-51.97, 3.72],
        [-51.65, 4.04],
        [-51.54, 4.43],
        [-51.25, 4.19],
        [-51.08, 3.88],
        [-51.01, 3.04],
        [-50.7, 2.15],
        [-50.45, 2.2],
        [-50.23, 1.8],
        [-49.91, 1.7],
        [-49.9, 1.19],
        [-50.06, 0.8],
        [-50.31, 0.67],
        [-50.16, 0.7],
        [-50.04, 0.57],
        [-50.02, 0.33],
        [-49.65, 0.35],
        [-49.39, 0.01],
        [-48.91, -0.23],
        [-48.41, -0.26],
        [-48.47, -0.5],
        [-48.0, -0.71],
        [-47.9, -0.55],
        [-47.84, -0.66],
        [-47.8, -0.55],
        [-47.77, -0.62],
        [-47.72, -0.54],
        [-47.63, -0.68],
        [-47.56, -0.59],
        [-47.49, -0.75],
        [-47.42, -0.59],
        [-47.42, -0.64],
        [-47.32, -0.59],
        [-47.22, -0.64],
        [-47.23, -0.69],
        [-47.16, -0.67],
        [-47.17, -0.76],
        [-47.09, -0.66],
        [-47.06, -0.77],
        [-46.95, -0.73],
        [-46.95, -0.85],
        [-46.84, -0.73],
        [-46.8, -0.89],
        [-46.77, -0.82],
        [-46.74, -0.89],
        [-46.64, -0.79],
        [-46.66, -0.97],
        [-46.55, -0.9],
        [-46.53, -0.97],
        [-46.43, -0.86],
        [-46.49, -0.97],
        [-46.42, -1.05],
        [-46.34, -1.0],
        [-46.34, -1.07],
        [-46.27, -0.92],
        [-46.19, -0.89],
        [-46.25, -1.0],
        [-46.2, -1.04],
        [-46.17, -0.99],
        [-46.18, -1.15],
        [-46.07, -1.02],
        [-46.09, -1.16],
        [-45.97, -1.05],
        [-45.95, -1.21],
        [-45.84, -1.05],
        [-45.89, -1.15],
        [-45.85, -1.24],
        [-45.81, -1.17],
        [-45.78, -1.21],
        [-45.82, -1.28],
        [-45.69, -1.13],
        [-45.75, -1.24],
        [-45.71, -1.4],
        [-45.64, -1.37],
        [-45.7, -1.36],
        [-45.62, -1.12],
        [-45.64, -1.32],
        [-45.53, -1.27],
        [-45.51, -1.39],
        [-45.41, -1.29],
        [-45.46, -1.5],
        [-45.32, -1.32],
        [-45.3, -1.43],
        [-45.38, -1.53],
        [-45.3, -1.49],
        [-45.32, -1.59],
        [-45.26, -1.62],
        [-45.07, -1.37],
        [-45.06, -1.45],
        [-44.94, -1.52],
        [-44.82, -1.42],
        [-44.89, -1.6],
        [-44.82, -1.58],
        [-44.77, -1.64],
        [-44.7, -1.56],
        [-44.71, -1.61],
        [-44.65, -1.62],
        [-44.79, -1.68],
        [-44.79, -1.73],
        [-44.7, -1.73],
        [-44.72, -1.77],
        [-44.65, -1.72],
        [-44.53, -1.84],
        [-44.58, -1.9],
        [-44.49, -1.93],
        [-44.49, -2.14],
        [-44.36, -2.33],
        [-44.41, -2.41],
        [-44.31, -2.5],
        [-44.0, -2.39],
        [-44.08, -2.45],
        [-43.97, -2.47],
        [-43.96, -2.55],
        [-43.62, -2.22],
        [-43.5, -2.37],
        [-43.17, -2.38],
        [-42.48, -2.71],
        [-41.82, -2.72],
        [-41.6, -2.9],
        [-41.32, -2.92],
        [-40.51, -2.79],
        [-40.02, -2.84],
        [-39.26, -3.22],
        [-38.65, -3.68],
        [-38.47, -3.71],
        [-38.01, -4.25],
        [-37.59, -4.62],
        [-37.33, -4.7],
        [-37.15, -4.93],
        [-36.96, -4.92],
        [-36.69, -5.09],
        [-35.95, -5.04],
        [-35.49, -5.16],
        [-35.26, -5.48],
        [-34.79, -7.15],
        [-34.84, -8.01],
        [-35.15, -8.92],
        [-35.3, -9.18],
        [-36.27, -10.28],
        [-36.39, -10.5],
        [-36.85, -10.74],
        [-38.05, -12.63],
        [-38.35, -12.95],
        [-38.49, -13.01],
        [-38.61, -12.93],
        [-38.97, -13.28],
        [-38.89, -13.64],
        [-39.0, -13.74],
        [-38.93, -13.94],
        [-39.06, -14.71],
        [-38.86, -15.85],
        [-39.21, -17.17],
        [-39.13, -17.69],
        [-39.49, -18.0],
        [-39.67, -18.35],
        [-39.75, -18.79],
        [-39.69, -19.31],
        [-39.81, -19.65],
        [-39.99, -19.75],
        [-40.14, -19.95],
        [-40.42, -20.64],
        [-40.46, -20.63],
        [-40.63, -20.84],
        [-40.65, -20.8],
        [-40.72, -20.84],
        [-41.07, -21.52],
        [-40.99, -22.0],
        [-41.69, -22.3],
        [-41.96, -22.53],
        [-41.98, -22.72],
        [-41.87, -22.76],
        [-42.03, -22.9],
        [-42.01, -23.0],
        [-42.38, -22.93],
        [-43.05, -22.98],
        [-43.13, -22.94],
        [-43.03, -22.74],
        [-43.09, -22.68],
        [-43.29, -22.81],
        [-43.15, -22.95],
        [-43.29, -23.02],
        [-43.71, -23.05],
        [-43.61, -23.03],
        [-43.85, -22.9],
        [-44.19, -23.05],
        [-44.36, -23.02],
        [-44.31, -22.96],
        [-44.35, -22.92],
        [-44.44, -23.02],
        [-44.67, -23.07],
        [-44.71, -23.22],
        [-44.64, -23.18],
        [-44.68, -23.25],
        [-44.56, -23.23],
        [-44.51, -23.29],
        [-44.72, -23.37],
        [-44.91, -23.34],
        [-45.06, -23.42],
        [-45.08, -23.52],
        [-45.16, -23.49],
        [-45.21, -23.58],
        [-45.31, -23.57],
        [-45.41, -23.62],
        [-45.41, -23.81],
        [-45.32, -23.72],
        [-45.23, -23.78],
        [-45.29, -23.87],
        [-45.23, -23.91],
        [-45.26, -23.96],
        [-45.46, -23.9],
        [-45.41, -23.82],
        [-45.84, -23.76],
        [-46.14, -23.86],
        [-46.18, -23.99],
        [-46.29, -24.04],
        [-46.38, -23.97],
        [-46.94, -24.28],
        [-47.02, -24.42],
        [-47.77, -24.91],
        [-47.91, -25.16],
        [-48.44, -25.65],
        [-48.6, -25.99],
        [-48.58, -26.16],
        [-48.49, -26.22],
        [-48.69, -26.68],
        [-48.59, -26.78],
        [-48.6, -27.12],
        [-48.47, -27.14],
        [-48.61, -27.25],
        [-48.52, -27.33],
        [-48.65, -27.48],
        [-48.57, -27.6],
        [-48.55, -27.46],
        [-48.41, -27.39],
        [-48.36, -27.45],
        [-48.49, -27.79],
        [-48.58, -27.85],
        [-48.74, -28.51],
        [-49.33, -28.91],
        [-49.74, -29.32],
        [-50.04, -29.81],
        [-50.33, -30.49],
        [-50.7, -31.01],
        [-51.25, -31.57],
        [-52.08, -32.16],
        [-52.01, -31.94],
        [-52.1, -31.84],
        [-51.85, -31.87],
        [-51.8, -31.82],
        [-51.86, -31.8],
        [-51.66, -31.77],
        [-51.48, -31.57],
        [-51.44, -31.6],
        [-51.43, -31.48],
        [-51.36, -31.53],
        [-51.24, -31.46],
        [-51.17, -31.07],
        [-50.99, -31.05],
        [-50.97, -30.9],
        [-50.7, -30.75],
        [-50.72, -30.35],
        [-50.65, -30.39],
        [-50.63, -30.34],
        [-50.65, -30.44],
        [-50.57, -30.46],
        [-50.54, -30.27],
        [-50.59, -30.2],
        [-50.66, -30.29],
        [-50.91, -30.32],
        [-50.92, -30.44],
        [-51.05, -30.39],
        [-51.03, -30.28],
        [-51.24, -30.19],
        [-51.23, -30.06],
        [-51.29, -30.01],
        [-51.29, -30.3],
        [-51.09, -30.37],
        [-51.26, -30.47],
        [-51.29, -30.74],
        [-51.33, -30.64],
        [-51.39, -30.66],
        [-51.37, -30.87],
        [-51.5, -30.92],
        [-51.45, -31.09],
        [-51.62, -31.14],
        [-51.62, -31.27],
        [-51.92, -31.31],
        [-52.03, -31.7],
        [-52.04, -31.57],
        [-52.1, -31.56],
        [-52.07, -31.68],
        [-52.23, -31.75],
        [-52.26, -31.85],
        [-52.07, -32.03],
        [-52.1, -32.15],
        [-52.34, -32.43],
        [-52.62, -33.11],
        [-53.4, -33.75],
        [-53.53, -33.65],
        [-53.43, -33.5],
        [-53.43, -33.16],
        [-53.32, -33.05],
        [-53.26, -33.09],
        [-53.12, -32.79],
        [-53.07, -32.83],
        [-52.98, -32.73],
        [-52.9, -32.89],
        [-52.76, -32.87],
        [-52.59, -32.52],
        [-52.69, -32.32],
        [-52.64, -32.17],
        [-52.8, -32.27],
        [-52.74, -32.4],
        [-52.96, -32.49],
        [-53.07, -32.65],
        [-53.4, -32.58],
        [-53.63, -32.39],
        [-53.74, -32.08],
        [-53.98, -31.92],
        [-54.1, -31.93],
        [-54.58, -31.46],
        [-54.84, -31.44],
        [-55.01, -31.27],
        [-55.07, -31.33],
        [-55.24, -31.26],
        [-55.35, -31.04],
        [-55.58, -30.84],
        [-55.87, -31.07],
        [-56.01, -31.07],
        [-56.02, -30.79],
        [-56.82, -30.1],
        [-57.07, -30.09],
        [-57.22, -30.29],
        [-57.52, -30.29],
        [-57.64, -30.19],
        [-57.34, -29.99],
        [-57.29, -29.82],
        [-56.97, -29.64],
        [-56.59, -29.12],
        [-56.42, -29.07],
        [-56.29, -28.79],
        [-56.0, -28.6],
        [-56.02, -28.51],
        [-55.89, -28.48],
        [-55.87, -28.36],
        [-55.7, -28.42],
        [-55.67, -28.33],
        [-55.77, -28.24],
        [-55.44, -28.09],
        [-55.2, -27.86],
        [-55.04, -27.86],
        [-55.08, -27.79],
        [-54.94, -27.77],
        [-54.81, -27.53],
        [-54.68, -27.57],
        [-54.58, -27.45],
        [-54.53, -27.5],
        [-54.41, -27.41],
        [-54.28, -27.45],
        [-54.18, -27.27],
        [-54.08, -27.3],
        [-53.87, -27.13],
        [-53.81, -27.15],
        [-53.67, -26.94],
        [-53.75, -26.71],
        [-53.64, -26.25],
        [-53.59, -26.24],
        [-53.83, -25.97],
        [-53.89, -25.62],
        [-54.07, -25.56],
        [-54.1, -25.62],
        [-54.11, -25.52],
        [-54.17, -25.58],
        [-54.39, -25.6],
        [-54.43, -25.7],
        [-54.59, -25.59],
        [-54.62, -25.46],
        [-54.43, -25.15],
        [-54.44, -24.95],
        [-54.26, -24.36],
        [-54.34, -24.13],
        [-54.24, -24.04],
        [-54.67, -23.81],
        [-54.94, -23.96],
        [-55.35, -23.99],
        [-55.53, -23.63],
        [-55.53, -23.19],
        [-55.66, -22.88],
        [-55.61, -22.66],
        [-55.85, -22.28],
        [-56.21, -22.27],
        [-56.39, -22.08],
        [-56.5, -22.09],
        [-56.63, -22.26],
        [-56.7, -22.22],
        [-56.84, -22.3],
        [-57.58, -22.17],
        [-57.61, -22.09],
        [-57.8, -22.15],
        [-57.99, -22.09],
        [-57.88, -21.69],
        [-57.97, -21.52],
        [-57.85, -21.34],
        [-57.92, -21.28],
        [-57.85, -21.22],
        [-57.82, -20.95],
        [-57.93, -20.89],
        [-57.87, -20.83],
        [-57.95, -20.78],
        [-57.87, -20.74],
        [-57.92, -20.66],
        [-57.98, -20.7],
        [-58.0, -20.43],
        [-58.17, -20.17],
        [-57.87, -19.98],
        [-58.13, -19.76],
        [-57.78, -19.03],
        [-57.7, -19.01],
        [-57.56, -18.24],
        [-57.47, -18.22],
        [-57.72, -17.83],
        [-57.8, -17.56],
        [-57.73, -17.53],
        [-57.88, -17.45],
        [-58.04, -17.49],
        [-58.4, -17.18],
        [-58.47, -16.75],
        [-58.33, -16.49],
        [-58.33, -16.28],
        [-58.43, -16.32],
        [-60.17, -16.27],
        [-60.24, -15.47],
        [-60.56, -15.12],
        [-60.27, -14.62],
        [-60.49, -14.19],
        [-60.38, -13.99],
        [-60.47, -13.8],
        [-61.04, -13.48],
        [-61.84, -13.55],
        [-62.17, -13.12],
        [-62.41, -13.13],
        [-62.65, -12.97],
        [-62.78, -13.01],
        [-63.15, -12.62],
        [-63.29, -12.68],
        [-63.79, -12.43],
        [-63.95, -12.53],
        [-64.29, -12.5],
        [-64.5, -12.37],
        [-64.51, -12.22],
        [-64.69, -12.19],
        [-64.71, -12.11],
        [-64.75, -12.16],
        [-64.78, -12.1],
        [-64.83, -12.12],
        [-64.85, -12.01],
        [-65.03, -11.99],
        [-65.09, -11.71],
        [-65.25, -11.71],
        [-65.21, -11.53],
        [-65.31, -11.49],
        [-65.29, -11.32],
        [-65.36, -11.25],
        [-65.25, -10.99],
        [-65.42, -10.62],
        [-65.43, -10.48],
        [-65.29, -10.22],
        [-65.29, -9.85],
        [-65.39, -9.7],
        [-65.56, -9.84],
        [-65.76, -9.73],
        [-65.79, -9.79],
        [-65.92, -9.75],
        [-66.46, -9.88],
        [-67.17, -9.66],
        [-66.63, -9.93],
        [-67.05, -10.28],
        [-67.41, -10.38],
        [-67.71, -10.71],
        [-68.05, -10.67],
        [-68.26, -10.97],
        [-68.54, -11.11],
        [-68.71, -11.13],
        [-68.8, -10.99],
        [-69.42, -10.93],
        [-69.74, -10.97],
        [-69.94, -10.92],
        [-70.31, -11.07],
        [-70.52, -10.94],
        [-70.62, -11.0],
        [-70.62, -9.82],
        [-70.53, -9.71],
        [-70.6, -9.56],
        [-70.54, -9.48],
        [-71.23, -9.97],
        [-72.18, -9.99],
        [-72.15, -9.8],
        [-72.27, -9.75],
        [-72.25, -9.61],
        [-72.37, -9.49],
        [-73.21, -9.41],
        [-72.95, -9.13],
        [-72.94, -8.99],
        [-73.13, -8.71],
        [-73.29, -8.62],
        [-73.28, -8.47],
        [-73.54, -8.35],
        [-73.63, -8.02],
        [-73.77, -7.9],
        [-73.69, -7.78],
        [-73.99, -7.55],
      ],
      [
        [-35.87, -8.88],
        [-35.9, -8.85],
        [-35.95, -8.88],
        [-35.94, -8.89],
        [-35.87, -8.88],
      ],
      [
        [-36.89, -10.13],
        [-36.92, -10.12],
        [-36.9, -10.14],
        [-36.89, -10.13],
      ],
      [
        [-37.19, -6.07],
        [-37.22, -6.05],
        [-37.2, -6.08],
        [-37.19, -6.07],
      ],
      [
        [-37.96, -11.27],
        [-37.98, -11.39],
        [-37.95, -11.41],
        [-37.94, -11.4],
        [-37.96, -11.27],
      ],
      [
        [-38.01, -9.54],
        [-37.99, -9.53],
        [-38.0, -9.53],
        [-38.01, -9.54],
      ],
      [
        [-38.23, -10.91],
        [-38.18, -10.94],
        [-38.22, -10.89],
        [-38.23, -10.91],
      ],
      [
        [-38.28, -9.08],
        [-38.32, -9.14],
        [-38.25, -9.29],
        [-38.24, -9.28],
        [-38.28, -9.08],
      ],
      [
        [-38.58, -6.28],
        [-38.57, -6.33],
        [-38.52, -6.21],
        [-38.58, -6.28],
      ],
      [
        [-38.59, -6.35],
        [-38.58, -6.38],
        [-38.53, -6.35],
        [-38.59, -6.35],
      ],
      [
        [-40.55, -7.34],
        [-40.63, -7.43],
        [-40.49, -7.4],
        [-40.55, -7.34],
      ],
      [
        [-40.52, -16.97],
        [-40.59, -17.24],
        [-40.58, -17.25],
        [-40.52, -16.97],
      ],
      [
        [-40.68, -7.7],
        [-40.64, -7.61],
        [-40.69, -7.53],
        [-40.7, -7.55],
        [-40.68, -7.7],
      ],
      [
        [-40.75, -17.98],
        [-40.86, -17.98],
        [-40.75, -17.99],
        [-40.75, -17.98],
      ],
      [
        [-40.79, -6.51],
        [-40.77, -6.53],
        [-40.77, -6.51],
        [-40.79, -6.51],
      ],
      [
        [-40.88, -15.69],
        [-40.83, -15.65],
        [-40.89, -15.68],
        [-40.88, -15.69],
      ],
      [
        [-41.0, -8.4],
        [-41.04, -8.47],
        [-40.98, -8.42],
        [-41.0, -8.4],
      ],
      [
        [-41.19, -4.66],
        [-41.18, -4.7],
        [-41.18, -4.66],
        [-41.19, -4.66],
      ],
      [
        [-41.32, -3.19],
        [-41.28, -3.06],
        [-41.33, -3.19],
        [-41.32, -3.19],
      ],
      [
        [-41.73, -20.93],
        [-41.71, -20.88],
        [-41.73, -20.86],
        [-41.74, -20.87],
        [-41.73, -20.93],
      ],
      [
        [-41.83, -20.45],
        [-41.8, -20.48],
        [-41.82, -20.44],
        [-41.83, -20.45],
      ],
      [
        [-41.82, -2.79],
        [-41.87, -2.88],
        [-41.84, -2.92],
        [-41.83, -2.91],
        [-41.82, -2.79],
      ],
      [
        [-42.0, -3.21],
        [-42.07, -3.26],
        [-41.99, -3.22],
        [-42.0, -3.21],
      ],
      [
        [-42.34, -21.56],
        [-42.25, -21.49],
        [-42.24, -21.39],
        [-42.26, -21.39],
        [-42.34, -21.56],
      ],
      [
        [-42.29, -21.68],
        [-42.28, -21.69],
        [-42.28, -21.68],
        [-42.29, -21.68],
      ],
      [
        [-42.96, -4.3],
        [-42.9, -4.43],
        [-42.89, -4.43],
        [-42.96, -4.3],
      ],
      [
        [-43.02, -6.73],
        [-43.14, -6.78],
        [-43.01, -6.74],
        [-43.02, -6.73],
      ],
      [
        [-43.23, -22.02],
        [-43.26, -22.02],
        [-43.24, -22.03],
        [-43.23, -22.02],
      ],
      [
        [-43.44, -6.83],
        [-43.54, -6.81],
        [-43.44, -6.84],
        [-43.44, -6.83],
      ],
      [
        [-43.72, -22.06],
        [-43.56, -22.09],
        [-43.46, -22.04],
        [-43.47, -22.03],
        [-43.72, -22.06],
      ],
      [
        [-44.46, -22.26],
        [-44.61, -22.33],
        [-44.43, -22.27],
        [-44.46, -22.26],
      ],
      [
        [-44.6, -1.81],
        [-44.59, -1.85],
        [-44.58, -1.81],
        [-44.6, -1.81],
      ],
      [
        [-44.62, -1.79],
        [-44.6, -1.81],
        [-44.6, -1.78],
        [-44.62, -1.79],
      ],
      [
        [-44.81, -22.41],
        [-44.74, -22.47],
        [-44.8, -22.38],
        [-45.25, -22.58],
        [-44.81, -22.41],
      ],
      [
        [-45.07, -1.46],
        [-45.1, -1.44],
        [-45.1, -1.46],
        [-45.07, -1.46],
      ],
      [
        [-45.44, -7.67],
        [-45.46, -7.68],
        [-45.45, -7.69],
        [-45.44, -7.67],
      ],
      [
        [-45.55, -1.34],
        [-45.54, -1.32],
        [-45.56, -1.32],
        [-45.55, -1.34],
      ],
      [
        [-45.79, -10.35],
        [-45.7, -10.27],
        [-45.71, -10.22],
        [-45.73, -10.22],
        [-45.79, -10.35],
      ],
      [
        [-45.71, -22.81],
        [-45.73, -22.79],
        [-45.74, -22.82],
        [-45.71, -22.81],
      ],
      [
        [-45.73, -22.72],
        [-45.76, -22.74],
        [-45.73, -22.74],
        [-45.73, -22.72],
      ],
      [
        [-45.95, -15.14],
        [-46.04, -15.24],
        [-45.89, -15.14],
        [-45.95, -15.14],
      ],
      [
        [-46.0, -10.26],
        [-45.97, -10.25],
        [-46.01, -10.22],
        [-46.0, -10.26],
      ],
      [
        [-46.12, -15.19],
        [-46.08, -15.23],
        [-45.99, -15.01],
        [-46.0, -15.01],
        [-46.12, -15.19],
      ],
      [
        [-46.04, -14.85],
        [-46.05, -14.88],
        [-46.03, -14.87],
        [-46.04, -14.85],
      ],
      [
        [-46.09, -22.9],
        [-46.13, -22.88],
        [-46.14, -22.91],
        [-46.13, -22.91],
        [-46.09, -22.9],
      ],
      [
        [-46.25, -13.77],
        [-46.25, -13.89],
        [-46.24, -13.9],
        [-46.25, -13.77],
      ],
      [
        [-46.26, -12.57],
        [-46.27, -12.6],
        [-46.25, -12.58],
        [-46.26, -12.57],
      ],
      [
        [-46.29, -13.09],
        [-46.32, -13.12],
        [-46.3, -13.13],
        [-46.29, -13.09],
      ],
      [
        [-46.32, -14.81],
        [-46.41, -14.78],
        [-46.3, -14.9],
        [-46.32, -14.81],
      ],
      [
        [-46.48, -8.11],
        [-46.49, -8.07],
        [-46.5, -8.11],
        [-46.48, -8.11],
      ],
      [
        [-46.64, -8.34],
        [-46.55, -8.29],
        [-46.65, -8.33],
        [-46.64, -8.34],
      ],
      [
        [-46.62, -9.44],
        [-46.72, -9.41],
        [-46.62, -9.45],
        [-46.62, -9.44],
      ],
      [
        [-46.94, -3.37],
        [-46.94, -3.42],
        [-46.81, -3.24],
        [-46.94, -3.37],
      ],
      [
        [-46.92, -8.6],
        [-46.9, -8.81],
        [-46.87, -8.52],
        [-46.92, -8.6],
      ],
      [
        [-47.14, -20.59],
        [-47.21, -20.49],
        [-47.22, -20.5],
        [-47.14, -20.59],
      ],
      [
        [-47.24, -20.88],
        [-47.21, -20.9],
        [-47.18, -20.79],
        [-47.24, -20.88],
      ],
      [
        [-47.3, -17.59],
        [-47.37, -17.53],
        [-47.38, -17.54],
        [-47.3, -17.59],
      ],
      [
        [-47.45, -16.5],
        [-47.42, -16.5],
        [-47.44, -16.49],
        [-47.45, -16.5],
      ],
      [
        [-47.86, -5.32],
        [-47.92, -5.27],
        [-47.87, -5.33],
        [-47.86, -5.32],
      ],
      [
        [-48.16, -5.61],
        [-48.16, -5.59],
        [-48.17, -5.59],
        [-48.16, -5.61],
      ],
      [
        [-48.22, -5.73],
        [-48.17, -5.68],
        [-48.23, -5.72],
        [-48.22, -5.73],
      ],
      [
        [-48.22, -20.12],
        [-48.24, -20.08],
        [-48.24, -20.13],
        [-48.22, -20.12],
      ],
      [
        [-48.32, -5.19],
        [-48.39, -5.2],
        [-48.32, -5.2],
        [-48.32, -5.19],
      ],
      [
        [-48.56, -27.61],
        [-48.64, -27.64],
        [-48.58, -27.83],
        [-48.57, -27.82],
        [-48.56, -27.61],
      ],
      [
        [-48.73, -5.34],
        [-48.61, -5.34],
        [-48.58, -5.29],
        [-48.6, -5.28],
        [-48.73, -5.34],
      ],
      [
        [-49.02, -20.17],
        [-49.13, -20.21],
        [-49.13, -20.23],
        [-49.02, -20.17],
      ],
      [
        [-49.18, -12.84],
        [-49.25, -12.95],
        [-49.17, -12.84],
        [-49.18, -12.84],
      ],
      [
        [-49.36, -8.47],
        [-49.27, -8.29],
        [-49.37, -8.48],
        [-49.36, -8.47],
      ],
      [
        [-49.67, -23.19],
        [-49.7, -23.17],
        [-49.68, -23.2],
        [-49.67, -23.19],
      ],
      [
        [-49.97, -29.22],
        [-49.95, -29.2],
        [-49.98, -29.21],
        [-49.97, -29.22],
      ],
      [
        [-50.15, -9.64],
        [-50.1, -9.53],
        [-50.1, -9.52],
        [-50.15, -9.64],
      ],
      [
        [-50.2, -28.49],
        [-50.37, -28.43],
        [-50.38, -28.44],
        [-50.2, -28.49],
      ],
      [
        [-50.2, -12.56],
        [-50.23, -12.54],
        [-50.24, -12.59],
        [-50.2, -12.56],
      ],
      [
        [-50.23, -12.47],
        [-50.36, -12.54],
        [-50.38, -12.61],
        [-50.37, -12.61],
        [-50.23, -12.47],
      ],
      [
        [-50.35, -19.82],
        [-50.52, -19.82],
        [-50.34, -19.84],
        [-50.35, -19.82],
      ],
      [
        [-50.62, -28.39],
        [-50.59, -28.38],
        [-50.76, -28.2],
        [-50.62, -28.39],
      ],
      [
        [-50.69, -12.2],
        [-50.65, -12.28],
        [-50.68, -12.17],
        [-50.69, -12.2],
      ],
      [
        [-50.66, -11.6],
        [-50.72, -11.52],
        [-50.69, -11.65],
        [-50.66, -11.6],
      ],
      [
        [-50.98, -19.48],
        [-50.88, -19.48],
        [-51.02, -19.37],
        [-51.03, -19.38],
        [-50.98, -19.48],
      ],
      [
        [-52.02, -18.98],
        [-51.41, -19.18],
        [-52.07, -18.94],
        [-52.02, -18.98],
      ],
      [
        [-52.26, -27.29],
        [-52.29, -27.29],
        [-52.26, -27.3],
        [-52.26, -27.29],
      ],
      [
        [-52.63, -0.59],
        [-52.58, -0.57],
        [-52.63, -0.56],
        [-52.63, -0.59],
      ],
      [
        [-52.7, -22.63],
        [-52.63, -22.57],
        [-52.82, -22.6],
        [-52.7, -22.63],
      ],
      [
        [-52.99, -18.32],
        [-53.06, -18.34],
        [-52.99, -18.33],
        [-52.99, -18.32],
      ],
      [
        [-53.07, -22.62],
        [-53.29, -22.73],
        [-53.29, -22.74],
        [-53.07, -22.62],
      ],
      [
        [-53.1, -17.04],
        [-53.22, -17.41],
        [-53.08, -17.04],
        [-53.1, -17.04],
      ],
      [
        [-53.64, -27.22],
        [-53.62, -27.19],
        [-53.69, -27.19],
        [-53.64, -27.22],
      ],
      [
        [-54.78, 2.19],
        [-54.77, 2.21],
        [-54.78, 2.2],
        [-54.78, 2.19],
      ],
      [
        [-56.56, -2.18],
        [-56.22, -2.09],
        [-56.22, -2.07],
        [-56.56, -2.18],
      ],
      [
        [-56.4, -2.46],
        [-56.46, -2.45],
        [-56.43, -2.51],
        [-56.4, -2.46],
      ],
      [
        [-57.87, -7.77],
        [-57.83, -7.97],
        [-57.68, -8.15],
        [-57.68, -8.14],
        [-57.87, -7.77],
      ],
      [
        [-58.17, -7.25],
        [-58.07, -7.41],
        [-58.16, -7.23],
        [-58.17, -7.25],
      ],
      [
        [-58.31, -1.12],
        [-58.3, -1.15],
        [-58.28, -1.15],
        [-58.31, -1.12],
      ],
      [
        [-58.44, -8.78],
        [-58.38, -8.77],
        [-58.38, -8.75],
        [-58.44, -8.78],
      ],
      [
        [-58.82, -0.35],
        [-58.87, -0.34],
        [-58.83, -0.36],
        [-58.82, -0.35],
      ],
      [
        [-59.19, 0.26],
        [-58.88, -0.08],
        [-58.9, 0.61],
        [-59.19, 0.26],
      ],
      [
        [-60.47, -0.8],
        [-60.42, -0.75],
        [-60.49, -0.79],
        [-60.47, -0.8],
      ],
      [
        [-61.06, -0.51],
        [-61.1, -0.52],
        [-61.05, -0.53],
        [-61.06, -0.51],
      ],
      [
        [-61.36, -0.63],
        [-61.52, -0.75],
        [-61.51, -0.77],
        [-61.36, -0.63],
      ],
      [
        [-61.95, -8.85],
        [-61.81, -8.78],
        [-61.81, -8.77],
        [-61.95, -8.85],
      ],
      [
        [-63.29, -8.0],
        [-63.55, -7.97],
        [-63.57, -8.01],
        [-63.56, -8.02],
        [-63.29, -8.0],
      ],
      [
        [-64.88, -9.04],
        [-64.92, -9.05],
        [-64.91, -9.15],
        [-64.9, -9.14],
        [-64.88, -9.04],
      ],
    ],
    [
      [
        [-45.29, -23.59],
        [-45.28, -23.6],
        [-45.3, -23.6],
        [-45.29, -23.59],
      ],
    ],
    [
      [
        [-45.53, -1.23],
        [-45.59, -1.25],
        [-45.57, -1.19],
        [-45.53, -1.23],
      ],
    ],
    [
      [
        [-44.74, -1.51],
        [-44.83, -1.54],
        [-44.75, -1.46],
        [-44.74, -1.51],
      ],
    ],
    [
      [
        [-42.76, -2.56],
        [-42.76, -2.55],
        [-42.75, -2.55],
        [-42.76, -2.56],
      ],
    ],
    [
      [
        [-43.23, -22.84],
        [-43.21, -22.87],
        [-43.24, -22.84],
        [-43.23, -22.84],
      ],
    ],
    [
      [
        [-41.7, -22.42],
        [-41.7, -22.41],
        [-41.69, -22.41],
        [-41.7, -22.42],
      ],
    ],
    [
      [
        [-43.11, -22.77],
        [-43.1, -22.75],
        [-43.11, -22.77],
        [-43.11, -22.77],
      ],
    ],
    [
      [
        [-43.26, -22.81],
        [-43.19, -22.79],
        [-43.17, -22.83],
        [-43.17, -22.83],
        [-43.26, -22.81],
      ],
    ],
    [
      [
        [-44.01, -23.08],
        [-43.9, -23.03],
        [-43.79, -23.06],
        [-43.79, -23.06],
        [-44.01, -23.08],
      ],
    ],
    [
      [
        [-43.92, -23.0],
        [-43.92, -22.99],
        [-43.92, -22.99],
        [-43.92, -23.0],
      ],
    ],
    [
      [
        [-44.37, -23.17],
        [-44.23, -23.09],
        [-44.09, -23.18],
        [-44.35, -23.21],
        [-44.37, -23.17],
      ],
    ],
    [
      [
        [-44.6, -23.22],
        [-44.6, -23.21],
        [-44.6, -23.21],
        [-44.6, -23.22],
      ],
    ],
    [
      [
        [-44.73, -1.56],
        [-44.74, -1.54],
        [-44.74, -1.54],
        [-44.73, -1.56],
      ],
    ],
    [
      [
        [-45.02, -1.33],
        [-44.96, -1.28],
        [-44.84, -1.33],
        [-45.0, -1.41],
        [-45.02, -1.33],
      ],
    ],
    [
      [
        [-45.01, -23.76],
        [-45.01, -23.75],
        [-45.01, -23.75],
        [-45.01, -23.76],
      ],
    ],
    [
      [
        [-45.04, -23.53],
        [-45.06, -23.53],
        [-45.04, -23.53],
        [-45.04, -23.53],
      ],
    ],
    [
      [
        [-45.04, -1.35],
        [-45.05, -1.36],
        [-45.05, -1.34],
        [-45.04, -1.35],
      ],
    ],
    [
      [
        [-45.12, -23.81],
        [-45.14, -23.8],
        [-45.12, -23.81],
        [-45.12, -23.81],
      ],
    ],
    [
      [
        [-45.15, -23.57],
        [-45.16, -23.57],
        [-45.15, -23.56],
        [-45.15, -23.57],
      ],
    ],
    [
      [
        [-45.7, -1.22],
        [-45.66, -1.22],
        [-45.68, -1.26],
        [-45.7, -1.22],
      ],
    ],
    [
      [
        [-45.77, -23.86],
        [-45.78, -23.86],
        [-45.77, -23.86],
        [-45.77, -23.86],
      ],
    ],
    [
      [
        [-45.82, -1.15],
        [-45.82, -1.12],
        [-45.8, -1.15],
        [-45.82, -1.15],
      ],
    ],
    [
      [
        [-46.41, -0.97],
        [-46.41, -0.93],
        [-46.41, -0.93],
        [-46.41, -0.97],
      ],
    ],
    [
      [
        [-46.91, -24.38],
        [-46.91, -24.37],
        [-46.9, -24.38],
        [-46.91, -24.38],
      ],
    ],
    [
      [
        [-47.03, -0.71],
        [-47.03, -0.69],
        [-47.01, -0.7],
        [-47.03, -0.71],
      ],
    ],
    [
      [
        [-51.32, -30.78],
        [-51.28, -30.8],
        [-51.28, -30.8],
        [-51.3, -30.82],
        [-51.32, -30.78],
      ],
    ],
  ],
};
// ===== REDE ASSISTENCIAL (UBSI + CASAI) com coordenadas oficiais do CNES, embutida =====
// Formato compacto por estabelecimento: [nome, cnes, lat, lon, municipio, uf]
let REDE_CNES = { rede: {}, nac: [] };
function _unpackEstab(a) {
  return { n: a[0], cnes: a[1], lat: a[2], lon: a[3], mun: a[4], uf: a[5] };
}

let _leaflet = null,
  _layerDSEI = null,
  _layerPolos = null,
  _layerCasai = null,
  _layerUF = null,
  _layerBR = null,
  _mapInited = false;
let _detailLeaflet = null,
  _detailBaseLayer = null,
  _detailUnitLayer = null,
  _descarteDoDetalhe = criarRegistroDeDescarte(),
  _leque = null,
  _lequePolos = null,
  _detailMapInited = false;
/* Os dois enquadramentos do mapa detalhado e qual deles está em vigor. */
let _detailBounds = null;
let _detailEscopo = "territorio";
const _mapResizeObservers = [];

function addResilientMapTiles(map, element) {
  if (!map || !element || typeof L === "undefined") return null;
  /*
    A CARTO saiu daqui, e o motivo é que ela não falha — ela mente.

    `basemaps.cartocdn.com` sem chave devolve **HTTP 200 com um PNG de 10KB**:
    o azulejo com "API KEY REQUIRED" escrito por cima. Para o Leaflet o recurso
    funcionou, nenhum `tileerror` dispara, e o mapa fica coberto de avisos de
    chave em falta até alguém recarregar a página. Medido em produção a
    15/09/2026, e é o que se via na tela.

    O recurso passa a ser a imagem de satélite que a aplicação já serve na
    camada "Satélite" — nenhuma dependência nova, e responde anónima. Um mapa
    de satélite no lugar do mapa de ruas é uma mudança visível, mas é um mapa;
    o anterior era um aviso de erro em forma de mapa.
  */
  const providers = [
    {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: { maxZoom: 19, attribution: "© OpenStreetMap" },
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      options: {
        maxZoom: 19,
        attribution: "© Esri, Maxar, Earthstar Geographics",
      },
    },
  ];
  let providerIndex = 0;
  let consecutiveErrors = 0;
  let activeLayer = null;

  const mountProvider = () => {
    const provider = providers[providerIndex];
    activeLayer = L.tileLayer(provider.url, {
      ...provider.options,
      crossOrigin: true,
      updateWhenIdle: false,
      keepBuffer: 3,
    });
    activeLayer.on("tileload", () => {
      consecutiveErrors = 0;
      element.classList.remove("map-tiles-recovering");
    });
    activeLayer.on("tileerror", () => {
      consecutiveErrors += 1;
      if (consecutiveErrors < 4 || providerIndex >= providers.length - 1)
        return;
      element.classList.add("map-tiles-recovering");
      map.removeLayer(activeLayer);
      providerIndex += 1;
      consecutiveErrors = 0;
      mountProvider().addTo(map);
    });
    return activeLayer;
  };

  return mountProvider().addTo(map);
}

function observeLeafletSize(map, element) {
  if (!map || !element || typeof ResizeObserver === "undefined") return;
  let animationFrame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      if (!element.offsetWidth || !element.offsetHeight) return;
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch (e) {}
    });
  });
  observer.observe(element);
  _mapResizeObservers.push(observer);
}
let _lastMapAutoFitKey = "";
let _ptsZoom = null; // pontos a enquadrar no zoom (DSEIs + CASAIs nacionais filtradas)
let _heatMode = false; // mapa de calor de vagas ociosas
const _BRASIL_VIEW = [
  [-33.5, -73.0],
  [5.5, -34.5],
]; // enquadramento padrão (Brasil, justo)
let _saBounds = null; // limites de navegação (derivados da vista do Brasil)
let _homeFlyTimer = null; // controla reaplicação dos limites após enquadrar
let _suppressAutoFit = false; // evita o enquadramento instantâneo brigar com a animação
// Define os limites de navegação A PARTIR da vista atual do Brasil (quando no zoom
// mínimo), com uma folga. Como o zoom mínimo é o mais "afastado", qualquer outro
// zoom cabe dentro destes limites — então o mapa nunca "treme" tentando se corrigir,
// em qualquer tamanho de tela.
function setBrazilMaxBounds() {
  if (!_leaflet) return;
  try {
    const z = _leaflet.getZoom(),
      mz = _leaflet.getMinZoom();
    if (z <= mz + 0.05) {
      // No zoom mínimo (vista do Brasil): limites justos derivados da própria vista.
      _saBounds = _leaflet.getBounds().pad(0.12);
      _leaflet.setMaxBounds(_saBounds);
    } else if (_saBounds) {
      // Com zoom maior, mantém os limites já derivados da vista do Brasil
      // (que contêm qualquer vista mais aproximada) — nunca deixa sem limite.
      _leaflet.setMaxBounds(_saBounds);
    }
  } catch (e) {}
}
// Volta à visão do Brasil sem tremer: solta os limites, enquadra na hora (sem
// animação concorrente) e recalcula os limites a partir da nova vista.
function flyToBrasil(bounds) {
  if (!_leaflet) return;
  try {
    _leaflet.stop();
  } catch (e) {}
  try {
    _leaflet.setMaxBounds(null);
  } catch (e) {}
  try {
    _leaflet.fitBounds(bounds, { animate: false });
  } catch (e) {}
  clearTimeout(_homeFlyTimer);
  _homeFlyTimer = setTimeout(setBrazilMaxBounds, 0);
}
function buscarLocalMapa(termo) {
  if (!_leaflet) return;
  const norm = (s) =>
    txt(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const q = norm(termo).trim();
  if (!q) {
    toast("Digite o nome de um DSEI, polo ou município.");
    return;
  }
  let alvo = LMAP.dsei.find(
    (d) => norm(d.n).includes(q) || norm(d.k).includes(q),
  );
  if (alvo) {
    _leaflet.flyTo([alvo.lat, alvo.lon], 6, { duration: 0.6 });
    toast("DSEI " + alvo.n + " localizado.");
    return;
  }
  for (const d of LMAP.dsei) {
    const p = polosCorrigidosPorCnes(d).find((p) => norm(p.n).includes(q));
    if (p) {
      _leaflet.flyTo([p.lat, p.lon], 8, { duration: 0.6 });
      toast("Polo " + p.n + " (" + d.n + ") localizado.");
      return;
    }
  }
  for (const k in REDE_CNES.rede || {}) {
    const rede = REDE_CNES.rede[k];
    const ach = [...(rede.u || []), ...(rede.c || [])].find((a) =>
      norm(a[4] || "").includes(q),
    );
    if (ach) {
      _leaflet.flyTo([ach[2], ach[3]], 9, { duration: 0.6 });
      toast("Município " + (ach[4] || "") + " localizado.");
      return;
    }
  }
  toast('Não encontrei "' + termo + '" no mapa.');
}
function toggleHeatMap() {
  _heatMode = !_heatMode;
  const b = $("heatBtn");
  if (b) {
    b.classList.toggle("active", _heatMode);
    b.setAttribute("aria-pressed", _heatMode ? "true" : "false");
  }
  lastMapUfKey = null;
  drawDSEIBubbles();
  toast(
    _heatMode
      ? "Mapa de calor: cor por % de vagas ociosas."
      : "Mapa de calor desativado.",
  );
}
let _layerUbsi = null,
  _layerCasaiLocal = null;
let DSEI_BY_K = {};
function rebuildDseiIndex() {
  DSEI_BY_K = {};
  (LMAP.dsei || []).forEach((d) => {
    DSEI_BY_K[d.k] = d;
  });
}
rebuildDseiIndex();

// Normaliza nome de unidade ignorando preposições (de/do/da), acentos e hífen,
// para casar "Kaiapó de Mato Grosso" (CSV) com "Kaiapó do Mato Grosso" (mapa).
function dseiKey(s) {
  let u = txt(s)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  u = u
    .replace(/^DSEI\s+/, "")
    .replace(/^CASAI\s+/, "")
    .replace(/\bNACIONAL\b/g, " ")
    .replace(/-/g, " ");
  u = u
    .replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return u;
}
function mapNameKey(s) {
  let u = txt(s)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  u = u.replace(/\([^)]*\)/g, " ");
  u = u.replace(
    /\b(DISTRITO|SANITARIO|ESPECIAL|INDIGENA|SAUDE|DE|DO|DA|DOS|DAS|E|TIPO|I|II|III|IV)\b/g,
    " ",
  );
  u = u.replace(/\b(POLO|BASE|DSEI|UBSI|UBS|UNIDADE|BASICA|POSTO)\b/g, " ");
  u = u
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return u;
}
// Casamento de nome como PALAVRA INTEIRA (evita "ANTA" casar dentro de "CANTAGALO").
function _wordContains(hay, needle) {
  if (!hay || !needle) return false;
  return new RegExp(
    "(^| )" + needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( |$)",
  ).test(hay);
}
function _strongNameMatch(nk, pk) {
  if (!nk || !pk) return false;
  if (nk === pk) return true;
  const shorter = nk.length < pk.length ? nk : pk;
  if (shorter.length < 5) return false; // tokens curtos só casam se idênticos
  return _wordContains(nk, pk) || _wordContains(pk, nk);
}
function findOfficialPoloCoord(d, p) {
  const rede = REDE_CNES.rede[d.k];
  if (!rede) return null;
  const poloKey = mapNameKey(p.n);
  const poloUf = txt(p.uf).toUpperCase();
  // 1ª passada: registros que são "POLO BASE" no CNES (mais confiável)
  const candidates = (rede.u || [])
    .filter((a) => /\bPOLO\b/i.test(txt(a[0])))
    .map((a) => {
      const nameKey = mapNameKey(a[0]);
      const munKey = mapNameKey(a[4]);
      const uf = txt(a[5]).toUpperCase();
      let score = 0;
      if (
        nameKey &&
        poloKey &&
        (nameKey.includes(poloKey) || poloKey.includes(nameKey))
      )
        score += 100;
      if (
        munKey &&
        poloKey &&
        (munKey.includes(poloKey) || poloKey.includes(munKey))
      )
        score += 60;
      if (poloUf && uf && poloUf === uf) score += 10;
      return { a, nameKey, munKey, score };
    })
    .filter((x) => x.score >= 70)
    .sort((a, b) => b.score - a.score);
  if (candidates[0]) return candidates[0].a;
  // 2ª passada (fallback): qualquer estabelecimento (UBSI/POSTO) cujo NOME bate forte
  // com o nome do polo. Usa a coordenada da unidade que atende o polo quando não há
  // um "POLO BASE" cadastrado. Regra estrita p/ não casar nomes parecidos por acaso.
  if (!poloKey) return null;
  const fb = (rede.u || [])
    .map((a) => {
      const nameKey = mapNameKey(a[0]);
      const uf = txt(a[5]).toUpperCase();
      let score = _strongNameMatch(nameKey, poloKey) ? 100 : 0;
      if (score && poloUf && uf && poloUf === uf) score += 10;
      return { a, score };
    })
    .filter((x) => x.score >= 100)
    .sort((a, b) => b.score - a.score);
  return fb[0]?.a || null;
}
function polosCorrigidosPorCnes(d) {
  return (d.polos || []).map((p) => {
    const oficial = findOfficialPoloCoord(d, p);
    if (!oficial) return p;
    return Object.assign({}, p, {
      lat: oficial[2],
      lon: oficial[3],
      coord_oficial: true,
      coord_fonte: "CNES",
      coord_nome: oficial[0],
      cnes: oficial[1],
      mun_cnes: oficial[4],
      uf_cnes: oficial[5],
    });
  });
}
function procCounts() {
  const byUf = {},
    byDsei = {},
    vagasDsei = {},
    ociosasDsei = {};
  filtered.forEach((r) => {
    const uf = txt(r.uf).toUpperCase();
    if (uf) byUf[uf] = (byUf[uf] || 0) + 1;
    const u = dseiKey(r.unidade);
    if (u) {
      byDsei[u] = (byDsei[u] || 0) + 1;
      vagasDsei[u] = (vagasDsei[u] || 0) + n(r.vagas_total);
      ociosasDsei[u] = (ociosasDsei[u] || 0) + n(r.vagas_ociosas);
    }
  });
  return { byUf, byDsei, vagasDsei, ociosasDsei };
}
// Cor do mapa de calor conforme % de ociosidade do DSEI
function heatColor(pct) {
  if (pct >= 60) return "#d92d3a"; // crítico (vermelho)
  if (pct >= 40) return "#f2730c"; // alto (laranja)
  if (pct >= 20) return "#f2b705"; // médio (amarelo)
  return "#0b8f58"; // baixo (verde)
}

function initLeaflet() {
  const el = $("map");
  if (!el || _mapInited) return;
  if (typeof L === "undefined") {
    el.innerHTML =
      '<div role="alert" style="padding:28px 24px;text-align:center;color:#5a6b82;font-size:13px;line-height:1.5"><div style="font-size:28px;margin-bottom:8px">🌐</div><b style="color:#10243e;display:block;margin-bottom:6px">Mapa indisponível offline</b>O fundo geográfico do mapa precisa de internet para carregar.<br>Os dados, KPIs e a tabela continuam funcionando normalmente.<br><button type="button" onclick="reloadExternal&&reloadExternal()" style="margin-top:12px;background:var(--agsus-azul);color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer">Tentar novamente</button></div>';
    return;
  }
  _mapInited = true;
  // Limites de navegação derivados da própria vista do Brasil (ver setBrazilMaxBounds).
  // Não se define maxBounds na construção para não atrapalhar o enquadramento inicial.
  const BRASIL_BOUNDS = L.latLngBounds(_BRASIL_VIEW[0], _BRASIL_VIEW[1]);
  _leaflet = L.map(el, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true,
    minZoom: 4,
    maxZoom: 18,
    maxBoundsViscosity: 1.0,
    worldCopyJump: false,
  });
  _leaflet.fitBounds(BRASIL_BOUNDS);
  // Trava o zoom mínimo no nível que enquadra o Brasil (impede afastar e ver outros
  // países) e define os limites de pan a partir dessa vista.
  _leaflet.whenReady(function () {
    try {
      _leaflet.setMinZoom(_leaflet.getZoom());
      setBrazilMaxBounds();
    } catch (e) {}
  });
  addResilientMapTiles(_leaflet, el);
  observeLeafletSize(_leaflet, el);
  _layerBR = L.layerGroup().addTo(_leaflet); // contorno do Brasil (fundo)
  _layerUF = L.layerGroup().addTo(_leaflet); // estados destacados
  _layerDSEI = L.layerGroup().addTo(_leaflet);
  _layerPolos = L.layerGroup().addTo(_leaflet);
  _lequePolos = criarLeque(_leaflet);
  _layerCasaiLocal = L.layerGroup().addTo(_leaflet); // CASAIs do DSEI/locais (drill-down)
  _layerUbsi = L.layerGroup().addTo(_leaflet); // UBSIs (drill-down)
  _layerCasai = L.layerGroup().addTo(_leaflet); // CASAI Nacional (sempre)
  drawBrasilOutline();

  // Botão "ver Brasil inteiro" dentro do mapa (controle Leaflet, canto superior direito)
  const HomeCtl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function () {
      const wrap = L.DomUtil.create("div", "");
      wrap.style.cssText = "display:flex;gap:6px;";
      const b = L.DomUtil.create("button", "", wrap);
      b.type = "button";
      b.title = "Voltar à visão do Brasil inteiro";
      b.innerHTML = "🗺️ Brasil";
      b.style.cssText =
        "background:#fff;border:1px solid #bcd;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#22577a;cursor:pointer;box-shadow:0 2px 8px rgba(15,35,60,.18);";
      L.DomEvent.on(b, "click", function (e) {
        L.DomEvent.stop(e);
        mapVoltar();
      });
      const h = L.DomUtil.create("button", "", wrap);
      h.id = "heatBtn";
      h.type = "button";
      h.title = "Mapa de calor: cor por % de vagas ociosas";
      h.setAttribute("aria-pressed", "false");
      h.innerHTML = "🔥 Calor";
      h.style.cssText =
        "background:#fff;border:1px solid #bcd;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;color:#a3322b;cursor:pointer;box-shadow:0 2px 8px rgba(15,35,60,.18);";
      L.DomEvent.on(h, "click", function (e) {
        L.DomEvent.stop(e);
        toggleHeatMap();
      });
      L.DomEvent.disableClickPropagation(wrap);
      return wrap;
    },
  });
  _leaflet.addControl(new HomeCtl());

  // Legenda fixa dentro do mapa (controle Leaflet, canto inferior esquerdo)
  const LegendCtl = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd: function () {
      const d = L.DomUtil.create("div", "");
      d.id = "mapLegendBox";
      d.style.cssText =
        "background:rgba(255,255,255,.94);border:1px solid #d7e5f2;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:600;color:#43566d;box-shadow:0 2px 10px rgba(15,35,60,.12);line-height:1.7;max-width:230px;";
      L.DomEvent.disableClickPropagation(d);
      return d;
    },
  });
  _leaflet.addControl(new LegendCtl());
  initDetailLeaflet();
  resetDetailMap({ silent: true });
}

function initDetailLeaflet() {
  const el = $("detailMap");
  if (!el || _detailMapInited || typeof L === "undefined") return;
  _detailMapInited = true;
  _detailLeaflet = L.map(el, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true,
    minZoom: 4,
    maxZoom: 18,
    worldCopyJump: false,
  });
  addResilientMapTiles(_detailLeaflet, el);
  observeLeafletSize(_detailLeaflet, el);
  _detailBaseLayer = L.layerGroup().addTo(_detailLeaflet);
  _detailUnitLayer = L.layerGroup().addTo(_detailLeaflet);
  _leque = criarLeque(_detailLeaflet);

  const list = $("detailUnitList");
  list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-map-unit]");
    if (!button || !_detailLeaflet) return;
    const lat = Number(button.dataset.lat);
    const lon = Number(button.dataset.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    _detailLeaflet.flyTo([lat, lon], Math.max(_detailLeaflet.getZoom(), 11), {
      duration: 0.45,
    });
  });
}

function drawDetailBrazilBase(ufs = []) {
  if (!_detailLeaflet || !_detailBaseLayer) return;
  _detailBaseLayer.clearLayers();
  try {
    L.geoJSON(UF_GEO, {
      style: (feature) => {
        const selected = ufs.includes(feature.properties.uf);
        return {
          color: selected ? "#0d8192" : "#7798ad",
          weight: selected ? 2 : 0.65,
          opacity: selected ? 0.95 : 0.45,
          fillColor: selected ? "#71cbd0" : "#dce9ee",
          fillOpacity: selected ? 0.18 : 0.04,
          interactive: false,
        };
      },
    }).addTo(_detailBaseLayer);
    L.geoJSON(BR_OUTLINE, {
      style: {
        color: "#0d6f7b",
        weight: 2,
        opacity: 0.8,
        fill: false,
        interactive: false,
      },
    }).addTo(_detailBaseLayer);
  } catch (e) {}
}

function detailUnitType(name) {
  const normalized = txt(name).toUpperCase();
  if (/CASAI|CASA DE SAUDE|CASA DE SAÚDE/.test(normalized))
    return {
      key: "casai",
      label: "CASAI",
      color: "#d92d3a",
      icon: "fa-house-medical",
    };
  if (/POLO/.test(normalized))
    return {
      key: "polo",
      label: "Polo base",
      color: "#e49a1b",
      icon: "fa-location-dot",
    };
  if (/UBSI|UNIDADE BASICA|UNIDADE BÁSICA/.test(normalized))
    return {
      key: "ubsi",
      label: "UBSI",
      color: "#6d28d9",
      icon: "fa-staff-snake",
    };
  return {
    key: "unit",
    label: "Unidade",
    color: "#0d8192",
    icon: "fa-hospital",
  };
}

const TIPO_POLO = {
  key: "polo",
  label: "Polo base",
  color: "#e49a1b",
  icon: "fa-location-dot",
};
const TIPO_CASAI = {
  key: "casai",
  label: "CASAI",
  color: "#d92d3a",
  icon: "fa-house-medical",
};

/*
  A mesma estrutura existe nas duas fontes com nomes diferentes — `XITEI` no
  `lmap`, `POLO BASE XITEI` no `rede_cnes` —, e a deduplicação que vivia aqui
  era por `nome|lat|lon`. Nenhuma das duas partes dessa chave casava: os nomes
  diferem por construção, e nenhum polo do `lmap` tem coordenada igual à do
  CNES. Resultado: 166 estruturas desenhadas duas vezes, 89 delas com os dois
  marcadores a mais de 50 km um do outro.

  A reconciliação vive em `src/lib/reconciliacao-unidades.js` e só junta dentro
  do mesmo DSEI, por nome canónico inteiro e com tipo compatível. O que ela não
  consegue decidir não é adivinhado: fica em `ambiguos` e continua a ser
  desenhado como dois registos, que é o comportamento seguro.

  Repare-se que o polo entra aqui com a coordenada CRUA do `lmap`, não com a que
  `polosCorrigidosPorCnes` substitui. É o que permite medir a distância entre as
  duas fontes; deixar a substituição acontecer antes zeraria essa medida.
*/
function detailRecordsForDsei(d) {
  const rede = REDE_CNES.rede[d.k] || { u: [], c: [] };

  const estabelecimentos = [
    ...(rede.c || []).map((item) => ({ item, forcado: TIPO_CASAI })),
    ...(rede.u || []).map((item) => ({ item, forcado: null })),
  ].map(({ item, forcado }) => {
    const e = _unpackEstab(item);
    return {
      nome: e.n,
      cnes: e.cnes,
      chave: e.cnes || `${e.n}|${e.lat}|${e.lon}`,
      lat: e.lat,
      lon: e.lon,
      municipio: e.mun,
      uf: e.uf,
      _tipoVisual: forcado || detailUnitType(e.n),
    };
  });

  const { reconciliados, estabelecimentosUsados } = reconciliarDsei({
    dseiChave: d.k,
    polos: (d.polos || []).map((p) => ({
      nome: p.n,
      cnes: p.cnes || "",
      // O enriquecimento preserva três fontes. Para a posição do polo usa a
      // coordenada que já existia no lmap; Lotações e CNES ficam como
      // comparação até validação independente.
      lat: Number(p.coord_lmap?.lat ?? p.lat),
      lon: Number(p.coord_lmap?.lon ?? p.lon),
      coord_lotacoes: p.coord_lotacoes || null,
      uf: p.uf,
      mun_lotacao: p.mun_lotacao || "",
      cod: p.cod ?? null,
      tipo: "polo",
    })),
    estabelecimentos,
  });

  const unificados = reconciliados.map((u) => ({
    name: u.nome_exibicao,
    cnes: u.cnes,
    lat: u.lat,
    lon: u.lon,
    city: u.municipio,
    uf: u.uf || d.sedeuf,
    type: TIPO_POLO,
    origens: u.origens,
    nomes: u.nomes,
    cod: u.cod,
    coordenadas: u.coordenadas,
    coordenada_exibida: u.coordenada_exibida,
    distancia_entre_fontes_km: u.distancia_entre_fontes_km,
    divergencia: u.divergencia,
  }));

  // Polos que a reconciliação não casou continuam a existir, como sempre.
  const canonicosUnificados = new Set(reconciliados.map((u) => u.nomes.lmap));
  const polosSoltos = (d.polos || [])
    .filter((p) => !canonicosUnificados.has(p.n))
    .map((p) => ({
      name: p.n,
      cnes: "",
      lat: p.lat,
      lon: p.lon,
      city: p.n,
      uf: p.uf || d.sedeuf,
      type: TIPO_POLO,
      origens: ["lmap"],
    }));

  // Estabelecimentos que não foram absorvidos por nenhuma reconciliação.
  const soltos = estabelecimentos
    .filter((e) => !estabelecimentosUsados.has(e.chave))
    .map((e) => ({
      name: e.nome,
      cnes: e.cnes,
      lat: e.lat,
      lon: e.lon,
      city: e.municipio,
      uf: e.uf,
      type: e._tipoVisual,
      origens: ["rede_cnes"],
    }));

  const seen = new Set();
  return [...unificados, ...polosSoltos, ...soltos].filter((record) => {
    const key = [record.name, record.lat, record.lon].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return Number.isFinite(record.lat) && Number.isFinite(record.lon);
  });
}

/*
  FILTROS POR TIPO.

  Um DSEI grande traz polo base, CASAI, UBSI e "unidade" na mesma lista e no
  mesmo mapa — no Yanomami são 1462 registos. Procurar a CASAI entre eles era
  percorrer a lista inteira. Os tipos são os de `detailUnitType()`, e os chips
  nascem só para os tipos que aquele território tem: um botão "CASAI" num DSEI
  sem CASAI seria um filtro que nunca muda nada.

  O conjunto guarda os tipos OCULTOS, não os visíveis: assim um DSEI que traga
  um tipo novo aparece por inteiro, em vez de nascer escondido.
*/
const _detailTiposOcultos = new Set();

function _tiposDoTerritorio(registos) {
  const mapa = new Map();
  registos.forEach((r) => {
    const atual = mapa.get(r.type.key);
    if (atual) atual.quantidade += 1;
    else mapa.set(r.type.key, { tipo: r.type, quantidade: 1 });
  });
  return [...mapa.values()].sort((x, y) => y.quantidade - x.quantidade);
}

function renderDetailUnitList(records) {
  const list = $("detailUnitList");
  const count = $("detailUnitCount");
  if (count) count.textContent = fmt(records.length);
  if (!list) return;
  if (!records.length) {
    /*
      Lista vazia por filtro e lista vazia por falta de dados pedem respostas
      diferentes: uma resolve-se ligando um chip, a outra não se resolve aqui.
    */
    list.innerHTML = _detailTiposOcultos.size
      ? `<div class="health-map-empty"><i class="fa-solid fa-filter-circle-xmark"></i><strong>Nada a mostrar com estes filtros</strong><span>Ligue um dos tipos acima para ver as unidades.</span></div>`
      : `<div class="health-map-empty"><i class="fa-solid fa-map-location-dot"></i><strong>Nenhuma unidade georreferenciada</strong><span>O território está selecionado, mas não há coordenadas disponíveis.</span></div>`;
    return;
  }
  list.innerHTML = records
    .map(
      (
        record,
      ) => `<button class="health-map-unit" type="button" data-map-unit data-lat="${record.lat}" data-lon="${record.lon}" aria-label="Localizar ${esc(record.name)} no mapa">
        <span class="health-map-unit__icon" style="color:${record.type.color};background:${record.type.color}18"><i class="fa-solid ${record.type.icon}"></i></span>
        <span><strong title="${esc(record.name)}">${esc(record.name)}</strong><small>${esc(record.city || "Localidade não informada")}${record.ufAdministrativa ? " · " + esc(record.ufAdministrativa) : ""}${record.vinculo === "externo" ? " · <b class='health-map-unit__externo'>fora da área</b>" : ""}</small></span>
        <span class="health-map-unit__type">${esc(record.type.label)}</span>
      </button>`,
    )
    .join("");
}

/*
  Os chips ficam dentro do painel, por cima da lista que filtram — o controlo
  ao lado do que ele muda, não num canto do cabeçalho.

  `aria-pressed` porque são interruptores, não navegação: o leitor de ecrã
  anuncia "ativado/desativado" em vez de só ler o rótulo.
*/
function renderDetailFiltros(registos, aoMudar) {
  const caixa = $("detailFiltros");
  if (!caixa) return;
  const tipos = _tiposDoTerritorio(registos);
  if (tipos.length < 2) {
    /* Um tipo só não é filtro: seria um botão que ou mostra tudo ou nada. */
    caixa.hidden = true;
    caixa.innerHTML = "";
    return;
  }
  caixa.hidden = false;
  caixa.innerHTML = tipos
    .map(
      ({ tipo, quantidade }) =>
        `<button type="button" data-tipo="${esc(tipo.key)}" aria-pressed="true">${esc(tipo.label)} <b>${fmt(quantidade)}</b></button>`,
    )
    .join("");
  caixa.querySelectorAll("button").forEach((botao) => {
    botao.addEventListener("click", () => {
      const chave = botao.dataset.tipo;
      const oculto = _detailTiposOcultos.has(chave);
      if (oculto) _detailTiposOcultos.delete(chave);
      else _detailTiposOcultos.add(chave);
      botao.setAttribute("aria-pressed", oculto ? "true" : "false");
      aoMudar();
    });
  });
}

function renderDetailMap(d) {
  initDetailLeaflet();
  if (!_detailLeaflet || !_detailUnitLayer) return;
  const records = detailRecordsForDsei(d);
  const title = $("detailMapTitle");
  const trilho = $("detailBreadcrumbDsei");
  const reset = $("detailMapReset");
  if (title) title.textContent = `Mapa do DSEI ${d.n}`;
  if (trilho) trilho.textContent = `DSEI ${d.n}`;
  reset?.classList.remove("hidden");
  definirSelecaoDoMapaDetalhado(true);
  drawDetailBrazilBase(d.ufs || [d.sedeuf]);
  _detailUnitLayer.clearLayers();

  /*
    A UF administrativa vem do CNES; a coordenada só diz onde desenhar. Uma
    unidade fora das UFs do DSEI fica no lugar verdadeiro e ganha uma linha
    pontilhada até a sede — vínculo, não trajeto.
  */
  const classificados = classificarRegistros(records, d);
  const locais = registrosLocais(classificados);
  const externos = registrosExternos(classificados);

  /*
    Um território novo começa sem nada escondido. Sem isto, filtrar UBSI num
    DSEI e abrir o seguinte mostrava o seguinte já incompleto, sem dizer porquê.
  */
  _detailTiposOcultos.clear();
  const visiveis = (lista) =>
    lista.filter((r) => !_detailTiposOcultos.has(r.type.key));

  /*
    O popup e o tooltip deixam de ser construídos no `bind` e passam a nascer no
    momento da interação. O ganho é pequeno sozinho — medido, 21% — mas evita
    guardar duas strings de HTML por marcador em memória.
  */
  const popupDoRegistro = (record) => {
    const fontes = record.coordenadas;
    const linhas = [
      `<b>${esc(record.type.label)}</b>`,
      esc(record.name),
      `${esc(record.city || "")}${record.ufAdministrativa ? " – " + esc(record.ufAdministrativa) : ""}`,
    ];
    if (record.cnes) linhas.push(`CNES: ${esc(record.cnes)}`);
    if (fontes?.lmap && fontes?.rede_cnes) {
      linhas.push("<b>Localização em validação</b>");
      linhas.push(
        `Mapa anterior: ${Number(fontes.lmap.lat).toFixed(5)}, ${Number(fontes.lmap.lon).toFixed(5)}`,
      );
      if (fontes.lotacoes)
        linhas.push(
          `Lotações: ${Number(fontes.lotacoes.lat).toFixed(5)}, ${Number(fontes.lotacoes.lon).toFixed(5)}`,
        );
      linhas.push(
        `CNES: ${Number(fontes.rede_cnes.lat).toFixed(5)}, ${Number(fontes.rede_cnes.lon).toFixed(5)}`,
      );
    }
    return linhas.join("<br>");
  };

  const marcadorDeRegistro = (record, posicao) => {
    const marker = L.marker(posicao || [record.lat, record.lon], {
      icon: L.divIcon({
        className: "mapa-marcador-wrap",
        html: htmlDoMarcador(record),
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      keyboard: true,
      title: record.name,
    });
    marker.on("click", () =>
      marker.bindPopup(popupDoRegistro(record)).openPopup(),
    );
    marker.on("mouseover", () => {
      if (!marker.getTooltip())
        marker.bindTooltip(tooltipDoRegistro(record, d), {
          direction: "top",
          opacity: 0.96,
        });
      marker.openTooltip();
    });
    return marker;
  };

  /*
    AGRUPAMENTO — a mudança que tira o travamento.

    Medido com os volumes reais: desenhar um marcador por ponto custava 65,6 ms
    e 5848 nós de DOM. Agrupando por célula de 60 px, os mesmos 1462 pontos
    tornam-se cerca de 79 marcadores: 1,8 ms e 160 nós.

    O `divIcon` fica, e com ele as formas — círculo, casa, cruz, losango — que
    existem para quem não distingue as cores. O canvas seria mais rápido por
    marcador e teria custado essa informação.
  */
  const desenharCamadaDeUnidades = () => {
    _detailUnitLayer.clearLayers();

    // As linhas de vínculo continuam a sair da sede, agrupadas ou não.
    visiveis(externos).forEach((record) => {
      _detailUnitLayer.addLayer(
        L.polyline(
          [
            [d.lat, d.lon],
            [record.lat, record.lon],
          ],
          { ...ESTILO_DA_LINHA },
        ).bindTooltip(TOOLTIP_DA_LINHA, { sticky: true }),
      );
    });

    const visiveisAgora = visiveis(classificados);
    const polosVisiveis = visiveisAgora.filter((r) => r.type.key === "polo");
    const demaisVisiveis = visiveisAgora.filter((r) => r.type.key !== "polo");

    /*
      Polo Base é uma camada operacional pequena e precisa permanecer legível.
      O agrupamento por célula de 60 px escondia polos próximos no enquadramento
      inicial e dava a impressão de que tinham sumido. Polos só são agrupados
      quando têm exatamente a mesma coordenada; nesse caso o clique abre o leque.
    */
    agruparCoincidentes(polosVisiveis).forEach((grupo) => {
      if (grupo.registros.length === 1) {
        _detailUnitLayer.addLayer(marcadorDeRegistro(grupo.registros[0]));
        return;
      }

      const badge = L.marker([grupo.lat, grupo.lon], {
        icon: L.divIcon({
          className: "mapa-cluster mapa-cluster--leque",
          html: `<span>${grupo.registros.length}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: true,
        title: `${grupo.registros.length} polos na mesma coordenada — abrir em leque`,
      });

      const grupoDoLeque = {
        ...grupo,
        quantidade: grupo.registros.length,
      };
      const acionar = () => {
        if (_leque.aberto === grupo.chave) recolherLeque();
        else abrirLeque(grupoDoLeque);
      };
      badge.on("click", acionar);
      badge.on("keypress", (e) => {
        if (e.originalEvent?.key === " ") {
          e.originalEvent.preventDefault();
          acionar();
        }
      });
      _detailUnitLayer.addLayer(badge);
    });

    // UBSI/CASAI/unidades podem ser numerosas; nelas permanece o agrupamento
    // por célula para evitar milhares de nós de DOM.
    const grupos = agruparPorCelula(demaisVisiveis, (r) =>
      _detailLeaflet.latLngToContainerPoint([r.lat, r.lon]),
    );

    grupos.forEach((grupo) => {
      if (grupo.unico) {
        _detailUnitLayer.addLayer(marcadorDeRegistro(grupo.unico));
        return;
      }

      const coincidente = grupoCoincidente(grupo.registros);

      const badge = L.marker([grupo.lat, grupo.lon], {
        icon: L.divIcon({
          className: coincidente
            ? "mapa-cluster mapa-cluster--leque"
            : "mapa-cluster",
          html: `<span>${grupo.quantidade}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: true,
        title: coincidente
          ? `${grupo.quantidade} unidades na mesma coordenada — abrir em leque`
          : `${grupo.quantidade} unidades nesta área — aproximar`,
      });

      const acionar = () => {
        if (!coincidente) {
          _detailLeaflet.setView(
            [grupo.lat, grupo.lon],
            Math.min(_detailLeaflet.getZoom() + 2, 14),
            { animate: true },
          );
          return;
        }
        if (_leque.aberto === grupo.chave) recolherLeque();
        else abrirLeque(grupo);
      };

      badge.on("click", acionar);
      badge.on("keypress", (e) => {
        if (e.originalEvent?.key === " ") {
          e.originalEvent.preventDefault();
          acionar();
        }
      });
      badge.on("mouseover", () => {
        if (!badge.getTooltip())
          badge.bindTooltip(
            `<b>${grupo.quantidade} unidades</b><br>${grupo.registros
              .slice(0, 6)
              .map((r) => esc(r.name))
              .join("<br>")}${grupo.quantidade > 6 ? "<br>…" : ""}<br><i>${
              coincidente
                ? "mesma coordenada — clique para abrir em leque"
                : "clique para aproximar"
            }</i>`,
            { direction: "top", opacity: 0.96 },
          );
        badge.openTooltip();
      });
      _detailUnitLayer.addLayer(badge);
    });

    // Um leque aberto não sobrevive a um redesenho da camada.
    if (_leque.aberto) recolherLeque();
  };

  // Usa a primitiva partilhada; a cópia local desta lógica saiu daqui.
  const abrirLeque = (grupo) => {
    _leque.abrir(grupo, (record, destino) =>
      marcadorDeRegistro(record, destino),
    );
    toast(
      `${grupo.quantidade} unidades na mesma coordenada, abertas em leque. Clique no número para recolher.`,
    );
  };

  const recolherLeque = () => _leque.recolher();

  desenharCamadaDeUnidades();
  // Reagrupar ao mudar o zoom: a célula é de pixels, e o que cabe nela muda.
  _descarteDoDetalhe.descartarTudo();
  _descarteDoDetalhe.ouvirMapa(
    _detailLeaflet,
    "zoomend",
    desenharCamadaDeUnidades,
  );

  L.circleMarker([d.lat, d.lon], {
    radius: 9,
    color: "#fff",
    weight: 2,
    fillColor: "#1769aa",
    fillOpacity: 1,
  })
    .bindPopup(`<b>DSEI ${esc(d.n)}</b><br>Sede territorial`)
    .addTo(_detailUnitLayer);

  const redesenharPorFiltro = () => {
    desenharCamadaDeUnidades();
    renderDetailUnitList(visiveis(classificados));
  };
  renderDetailFiltros(classificados, redesenharPorFiltro);
  renderDetailUnitList(visiveis(classificados));

  /*
    O enquadramento inicial usa só a sede e as unidades locais. No DSEI Ceará,
    incluir a unidade de Uruçuí — 773 km — amplia a caixa de 3.01 x 2.75 para
    4.31 x 6.28 graus e encolhe o território principal a ponto de o mapa deixar
    de ser legível. Quem quiser ver os vínculos externos pede por eles.
  */
  _detailBounds = {
    territorio: [[d.lat, d.lon], ...locais.map((r) => [r.lat, r.lon])],
    completo: [[d.lat, d.lon], ...classificados.map((r) => [r.lat, r.lon])],
  };
  atualizarChipDeVinculos(externos.length);
  enquadrarDetalhe("territorio");

  /*
    A troca para o workspace com DSEI altera a largura do mapa. Se o fitBounds
    roda antes do navegador terminar esse layout, o Leaflet calcula o zoom com
    um tamanho antigo (ou quase zero) e pode abrir o território em nível de rua.
    Revalida o tamanho e reaplica o enquadramento depois do layout, sem alterar
    nenhuma coordenada.
  */
  requestAnimationFrame(() => {
    try {
      _detailLeaflet?.invalidateSize?.({ animate: false });
      enquadrarDetalhe("territorio");
    } catch (e) {}
    setTimeout(() => {
      try {
        _detailLeaflet?.invalidateSize?.({ animate: false });
        enquadrarDetalhe("territorio");
      } catch (e) {}
    }, 80);
  });
}

/*
  Dois enquadramentos nomeados em vez de um cálculo espalhado: "territorio" é o
  estado normal, "completo" inclui as unidades externas. O botão alterna entre
  os dois, e nenhum dos dois recalcula bounds a partir do que está na tela.
*/
function enquadrarDetalhe(escopo, { animar = false } = {}) {
  if (!_detailLeaflet || !_detailBounds) return;
  const pontos = _detailBounds[escopo] || _detailBounds.territorio;
  if (!pontos?.length) return;
  _detailEscopo = escopo;
  try {
    _detailLeaflet.fitBounds(L.latLngBounds(pontos), {
      padding: [34, 34],
      maxZoom: 9,
      animate: animar,
    });
  } catch (e) {
    _detailLeaflet.setView(pontos[0], 7);
  }
  const alternar = $("detailExternalToggle");
  if (alternar) {
    alternar.textContent =
      escopo === "completo"
        ? "Voltar ao território"
        : "Mostrar vínculos externos";
  }
}

function atualizarChipDeVinculos(quantidade) {
  const chip = $("detailExternalChip");
  const alternar = $("detailExternalToggle");
  const texto = textoDoChip(quantidade);
  if (chip) {
    chip.textContent = texto;
    chip.hidden = !quantidade;
  }
  if (alternar) {
    alternar.hidden = !quantidade;
    alternar.textContent = "Mostrar vínculos externos";
  }
}

function toggleVinculosExternos() {
  enquadrarDetalhe(_detailEscopo === "completo" ? "territorio" : "completo", {
    animar: true,
  });
}

/*
  UM MAPA PRINCIPAL DE CADA VEZ.

  A classe `com-dsei` no workspace é o único interruptor: sem ela vê-se a visão
  nacional a toda a largura, com ela vê-se o território e o painel de unidades.

  A `sem-selecao` que vivia aqui não fazia isso: colapsava a coluna de polos
  dentro de um card que continuava visível ao lado do mapa nacional. Não havia
  estado — havia dois mapas, e antes de escolher um DSEI o segundo mostrava um
  segundo Brasil.

  O `invalidateSize` é indispensável e vem DEPOIS de o navegador aplicar o novo
  layout: o Leaflet guarda a última medida que fez, e um mapa que estava
  escondido nasce com tamanho zero.
*/
function definirSelecaoDoMapaDetalhado(temSelecao) {
  const workspace = document.querySelector(".health-map-workspace");
  if (!workspace) return;
  const mudou = workspace.classList.contains("com-dsei") !== temSelecao;
  workspace.classList.toggle("com-dsei", temSelecao);
  if (!mudou) return;
  requestAnimationFrame(() => {
    try {
      /*
        Sem `pan: false`: com ele o Leaflet mantém o canto superior esquerdo e a
        largura nova entra toda à direita, empurrando o país para o lado. O
        padrão preserva o centro, e o reenquadramento em seguida acerta o resto.
      */
      _detailLeaflet?.invalidateSize?.({ animate: false });
      _leaflet?.invalidateSize?.({ animate: false });
    } catch (e) {}
  });
}

function resetDetailMap({ silent = false } = {}) {
  initDetailLeaflet();
  if (!_detailLeaflet) return;
  const title = $("detailMapTitle");
  const trilho = $("detailBreadcrumbDsei");
  const reset = $("detailMapReset");
  const count = $("detailUnitCount");
  const list = $("detailUnitList");
  if (title) title.textContent = "Mapa do Brasil";
  if (trilho) trilho.textContent = "território";
  _detailTiposOcultos.clear();
  const filtros = $("detailFiltros");
  if (filtros) {
    filtros.hidden = true;
    filtros.innerHTML = "";
  }
  reset?.classList.add("hidden");
  definirSelecaoDoMapaDetalhado(false);
  /* Volta ao Brasil: não há mais DSEI de referência, logo não há vínculo externo. */
  _detailBounds = null;
  _detailEscopo = "territorio";
  atualizarChipDeVinculos(0);
  if (count) count.textContent = "0";
  if (list)
    list.innerHTML = `<div class="health-map-empty"><i class="fa-solid fa-map-location-dot"></i><strong>Selecione um DSEI</strong><span>Os polos, CASAIs e unidades aparecerão aqui.</span></div>`;
  _detailUnitLayer?.clearLayers();
  drawDetailBrazilBase();
  try {
    _detailLeaflet.fitBounds(L.latLngBounds(_BRASIL_VIEW[0], _BRASIL_VIEW[1]), {
      animate: false,
    });
  } catch (e) {}
  setTimeout(() => _detailLeaflet?.invalidateSize?.({ animate: false }), 40);
  if (!silent) toast("Mapa detalhado voltou à visão do Brasil.");
}

function scheduleMapResize(delay = 80) {
  clearTimeout(window.__mapResizeTimer);
  window.__mapResizeTimer = setTimeout(() => {
    try {
      _leaflet?.invalidateSize?.({ animate: false, pan: false });
      _detailLeaflet?.invalidateSize?.({ animate: false, pan: false });
    } catch (e) {}
    setBrazilMaxBounds(); // re-deriva os limites após mudar o tamanho do mapa
  }, delay);
}

// Contorno do Brasil (linha tracejada ao redor do território) — desenhado uma vez
function drawBrasilOutline() {
  if (!_leaflet || !_layerBR) return;
  _layerBR.clearLayers();
  try {
    // divisas internas dos estados, bem sutis (referência)
    L.geoJSON(UF_GEO, {
      style: {
        color: "#5b7fa6",
        weight: 0.6,
        opacity: 0.35,
        fill: false,
        interactive: false,
      },
    }).addTo(_layerBR);
    // contorno externo do Brasil, linha forte e visível
    L.geoJSON(BR_OUTLINE, {
      style: {
        color: "#0d3b66",
        weight: 2.6,
        opacity: 0.9,
        fill: false,
        interactive: false,
      },
    }).addTo(_layerBR);
  } catch (e) {}
}

// Destacar os estados contemplados por um DSEI (preenchimento leve + borda)
function highlightUFs(ufs) {
  if (!_leaflet || !_layerUF) return;
  _layerUF.clearLayers();
  if (!ufs || !ufs.length) return;
  const set = new Set(ufs);
  try {
    L.geoJSON(UF_GEO, {
      filter: (f) => set.has(f.properties.uf),
      style: {
        color: "#1f6f4a",
        weight: 2,
        opacity: 0.9,
        fillColor: "#2e8b57",
        fillOpacity: 0.18,
        interactive: false,
      },
    }).addTo(_layerUF);
  } catch (e) {}
}

/*
  Entrar num território é a mesma coisa venha do mapa ou da lista ao lado dele.
  Estava escrita dentro do `on("click")` da bolha, e por isso a lista teria de
  a copiar — duas cópias que divergiriam na primeira mudança.
*/
function entrarNoTerritorio(d) {
  const campo = $("tableSearch");
  if (campo) campo.value = d.n;
  applyFilters();
  renderDetailMap(d);
  flyToBrasil(L.latLngBounds(_BRASIL_VIEW[0], _BRASIL_VIEW[1]));
  const voltar = $("drillBackBtn");
  if (voltar) voltar.style.display = "inline-flex";
  const ufTxt = d.ufs && d.ufs.length ? " (" + d.ufs.join(", ") + ")" : "";
  toast(
    "DSEI " + d.n + ufTxt + ": polos e unidades exibidos no mapa detalhado.",
  );
}

/*
  A LISTA NACIONAL, ao lado do mapa do Brasil.

  O mapa nacional ocupava a largura toda do card, e isso custava caro de duas
  maneiras. O Brasil é praticamente quadrado em Mercator, por isso num card de
  3.8:1 ele ficava em 24% da largura e o resto era oceano e África. E, medido na
  aplicação a 1920, eram **27 azulejos pedidos ao OpenStreetMap contra os 9** que
  o Brasil precisa — 18 pedidos por vista que não mostravam nada, numa fonte que
  limita este uso e cujo recurso, a CARTO anónima, passou a devolver imagem
  marcada.

  O mapa passa a ter a proporção que o país preenche e a largura que sobra leva
  informação: os territórios ordenados por vagas. Mesma leitura do painel do
  estado 2, e a mesma porta de entrada — clicar aqui é clicar na bolha.
*/
function renderPainelNacional(linhas) {
  const lista = $("brasilDseiList");
  const conta = $("brasilDseiCount");
  if (conta) conta.textContent = fmt(linhas.length);
  if (!lista) return;
  if (!linhas.length) {
    lista.innerHTML = `<div class="health-map-empty"><i class="fa-solid fa-filter-circle-xmark"></i><strong>Nenhum território no recorte</strong><span>Os filtros ativos não deixaram nenhum DSEI no resultado.</span></div>`;
    return;
  }
  lista.innerHTML = linhas
    .map(
      ({ d, vagas, ociosas, nproc }, i) =>
        `<button class="health-map-unit" type="button" data-dsei="${i}" aria-label="Abrir o DSEI ${esc(d.n)}">
        <span class="health-map-unit__icon"><i class="fa-solid fa-location-dot"></i></span>
        <span><strong title="${esc(d.n)}">DSEI ${esc(d.n)}</strong><small>${fmt(vagas)} vagas · ${fmt(ociosas)} ociosas${nproc ? " · " + fmt(nproc) + " processo" + (nproc > 1 ? "s" : "") : ""}</small></span>
        <span class="health-map-unit__type">${fmt(d.pop || 0)}</span>
      </button>`,
    )
    .join("");
  lista.querySelectorAll("[data-dsei]").forEach((botao) => {
    botao.addEventListener("click", () =>
      entrarNoTerritorio(linhas[Number(botao.dataset.dsei)].d),
    );
  });
}

// Nível 1: bolhas dos DSEIs
function drawDSEIBubbles() {
  if (!_leaflet) return;
  _layerDSEI.clearLayers();
  _layerPolos.clearLayers();
  if (_layerUbsi) _layerUbsi.clearLayers();
  if (_layerCasaiLocal) _layerCasaiLocal.clearLayers();
  if (_layerUF) _layerUF.clearLayers(); // visão Brasil: nenhum estado destacado
  const { byDsei, vagasDsei, ociosasDsei } = procCounts();
  const popMax = Math.max(...LMAP.dsei.map((d) => d.pop || 0)) || 1;
  const filtroAtivo = hasActiveFilter();
  const heatOn = !!_heatMode;
  const ptsVisiveis = []; // para enquadrar o zoom nos DSEIs filtrados
  /* A lista ao lado mostra exactamente os DSEIs que o mapa desenhou. */
  const noRecorte = [];
  _ptsZoom = ptsVisiveis; // compartilha com drawCasai (adiciona nacionais visíveis)
  /*
    DSEIS QUE PARTILHAM A SEDE

    Tirar o afastamento de 61 km foi certo, mas duas bolhas exactamente uma
    sobre a outra deixariam a de baixo inalcançável — Yanomami e Leste de
    Roraima partilham Boa Vista.

    Duas medidas, nenhuma delas mexendo na coordenada. Desenhar por raio
    decrescente põe a bolha menor por cima, de modo que ambas ficam clicáveis:
    a maior continua a aparecer como anel em volta da menor. E onde a sede é
    exactamente a mesma entra um selo com a contagem, que nomeia os distritos.
  */
  const sedesPartilhadas = new Map();
  LMAP.dsei.forEach((d) => {
    const chave = `${Number(d.lat).toFixed(4)},${Number(d.lon).toFixed(4)}`;
    if (!sedesPartilhadas.has(chave)) sedesPartilhadas.set(chave, []);
    sedesPartilhadas.get(chave).push(d);
  });

  [...LMAP.dsei]
    .sort((a, b) => raioDaBolha(b.pop, popMax) - raioDaBolha(a.pop, popMax))
    .forEach((d) => {
      const dk = dseiKey(d.k);
      const nproc = byDsei[dk] || 0,
        hp = nproc > 0;
      // Com filtro ativo, mostrar SOMENTE os DSEIs que tem processos no resultado filtrado.
      if (filtroAtivo && !hp) return;
      const vagas = vagasDsei[dk] || 0,
        ociosas = ociosasDsei[dk] || 0;
      const pctOcio = vagas > 0 ? Math.round((ociosas / vagas) * 100) : 0;
      /*
      O afastamento de 0,55° que vivia aqui foi removido. São cerca de 61 km:
      quem lia o mapa via o DSEI a essa distância de onde ele está, sem nada a
      dizer que aquilo era enfeite para desempilhar.

      Dois DSEIs na mesma sede — Yanomami e Leste de Roraima em Boa Vista —
      passam a sobrepor-se de facto, que é a verdade, e o preenchimento
      translúcido deixa a sobreposição visível. O tooltip desambigua.
    */
      const lat = d.lat,
        lon = d.lon;
      /*
      O teto do raio era 25 px — 50 px de diâmetro, e 34 bolhas dessas na visão
      nacional escondiam o território que deviam situar. Passa a 15.
    */
      const r = raioDaBolha(d.pop, popMax);
      ptsVisiveis.push([lat, lon]);
      noRecorte.push({ d, vagas, ociosas, nproc });
      // Cor: modo calor usa % de ociosidade; modo normal usa verde(tem proc)/azul(sem)
      const fillC = heatOn
        ? hp
          ? heatColor(pctOcio)
          : "#cfd8e3"
        : hp
          ? "#0b8f58"
          : "#5b9bd5";
      const strokeC = heatOn
        ? hp
          ? heatColor(pctOcio)
          : "#9fb0c4"
        : hp
          ? "#f2b705"
          : "#1f6f4a";
      const m = L.circleMarker([lat, lon], {
        radius: r,
        color: strokeC,
        weight: hp ? 3 : 1.5,
        fillColor: fillC,
        fillOpacity: heatOn ? 0.82 : 0.7,
      });
      const heatLine =
        heatOn && hp
          ? `<br><b style="color:${heatColor(pctOcio)}">Ociosidade: ${pctOcio}%</b> (${fmt(ociosas)} de ${fmt(vagas)} vagas)`
          : hp
            ? `<br>Vagas ociosas: ${fmt(ociosas)} de ${fmt(vagas)}`
            : "";
      m.bindTooltip(
        `<b>DSEI ${esc(d.n)}</b><br>População do DSEI: ${fmt(d.pop)} indígenas<br>Polos base: ${(d.polos || []).length}<br>Estados: ${(d.ufs || [d.sedeuf]).join(", ")}<br>Processos seletivos: ${nproc}${heatLine}<br><i>clique para ver os polos base</i>`,
        { direction: "top" },
      );
      m.on("click", () => entrarNoTerritorio(d));
      _layerDSEI.addLayer(m);
    });

  /*
    Onde a sede é exactamente a mesma, um selo nomeia os distritos empilhados.
    Fica ao lado do centro — deslocado em PIXELS, convertidos no zoom corrente —
    e não substitui as bolhas: elas continuam no seu lugar, clicáveis.
  */
  sedesPartilhadas.forEach((lista) => {
    if (lista.length < 2) return;
    const visiveis = filtroAtivo
      ? lista.filter((d) => (byDsei[dseiKey(d.k)] || 0) > 0)
      : lista;
    if (visiveis.length < 2) return;
    /*
      O SELO FICA EM CIMA DA SEDE, SEM DESVIO NENHUM.

      Isto convertia 18px numa latitude e numa longitude — `layerPointToLatLng`
      sobre `centro.add(L.point(18, -18))` — e punha o marcador nesse ponto
      inventado. Na visão nacional o mapa tem 9.57px por grau, portanto os 18px
      viravam **1.88° ≈ 209 km**: o selo dos dois DSEIs de Boa Vista
      (2.8563, -60.6527, em Roraima) era desenhado em 4.4209, -59.0849 — dentro
      da Guiana. Medido na aplicação a 15/09/2026.

      A primeira correção passou o desvio para o `iconAnchor`, o que torna a
      coordenada honesta mas não muda **nada do que se vê**: o selo continuava
      desenhado sobre a Guiana. Quem lê o mapa lê pixels, não a coordenada do
      marcador.

      Então o desvio sai. O selo é uma contagem do que está debaixo dele, e o
      lugar de uma contagem é em cima do que ela conta — é assim que os outros
      agrupamentos deste mapa já se desenham. A bolha maior continua a aparecer
      como anel em volta, e o tooltip nomeia os dois distritos.

      Regra que fica: nenhum desenho deste mapa inventa coordenada. Quando for
      preciso afastar alguma coisa do seu lugar — o leque, por exemplo — que
      haja uma linha ligando ao ponto verdadeiro, dizendo que aquilo é um
      chamamento e não um sítio.
    */
    const selo = L.marker([visiveis[0].lat, visiveis[0].lon], {
      icon: L.divIcon({
        className: "mapa-cluster mapa-cluster--sede",
        html: `<span>${visiveis.length}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      keyboard: true,
      title: `${visiveis.length} DSEIs com a mesma sede`,
    });
    selo.bindTooltip(
      `<b>${visiveis.length} DSEIs nesta sede</b><br>${visiveis
        .map((d) => esc(d.n))
        .join(
          "<br>",
        )}<br><i>as bolhas estão sobrepostas; a menor fica por cima</i>`,
      { direction: "top" },
    );
    _layerDSEI.addLayer(selo);
  });

  /*
    Por vagas, decrescente: é a pergunta que a página faz nos KPIs logo acima,
    e ordenar por população repetiria o que o tamanho da bolha já diz.
  */
  renderPainelNacional(
    noRecorte.sort((a, b) => b.vagas - a.vagas || b.d.pop - a.d.pop),
  );

  drawCasai();
  {
    const _b = $("drillBackBtn");
    if (_b) _b.style.display = "none";
  }
  // Zoom automático: com filtro ativo, enquadra apenas os DSEIs/CASAIs filtrados.
  // Sem filtro, volta para a visão geral do Brasil.
  const autoFitKey =
    (filtroAtivo ? "F|" : "A|") +
    ptsVisiveis
      .map((p) => p.map((v) => Number(v).toFixed(4)).join(","))
      .join("|");
  if (autoFitKey !== _lastMapAutoFitKey) {
    _lastMapAutoFitKey = autoFitKey;
    if (!_suppressAutoFit)
      try {
        if (filtroAtivo && ptsVisiveis.length) {
          if (ptsVisiveis.length === 1) {
            _leaflet.setView(ptsVisiveis[0], 7, { animate: false });
          } else {
            _leaflet.fitBounds(L.latLngBounds(ptsVisiveis), {
              padding: [60, 60],
              maxZoom: 7,
              animate: false,
            });
          }
        } else if (!filtroAtivo) {
          _leaflet.fitBounds(L.latLngBounds(_BRASIL_VIEW[0], _BRASIL_VIEW[1]), {
            animate: false,
          });
        }
      } catch (e) {}
  }
  _ptsZoom = null;
  const masterCount = $("masterMapCount");
  if (masterCount)
    masterCount.textContent = `${fmt(ptsVisiveis.length)} território${ptsVisiveis.length === 1 ? "" : "s"}`;
  syncMapLevelUI();
}

// CASAI Nacionais (Brasília e São Paulo) — pontos especiais (losango roxo)
function drawCasai() {
  if (!_leaflet || !_layerCasai) return;
  _layerCasai.clearLayers();
  const { byDsei } = procCounts();
  // CASAIs nacionais: desenhar DIRETO de REDE_CNES.nac (fonte de verdade), não da lista fixa do LMAP
  const ufNum2sigla = { 53: "DF", 35: "SP", 51: "MT", 50: "MS", 52: "GO" };
  const filtroAtivoC = hasActiveFilter();
  (REDE_CNES.nac || []).forEach((a) => {
    const nome = a[0],
      lat = a[2],
      lon = a[3],
      cidade = a[4] || "";
    const uf = ufNum2sigla[String(a[5])] || String(a[5] || "");
    const c = { n: nome, cidade: cidade, uf: uf };
    const nproc = byDsei[dseiKey(c.n)] || 0;
    // Com filtro ativo, só exibir a CASAI nacional se ela aparecer no resultado filtrado.
    if (filtroAtivoC && nproc === 0) return;
    // adiciona ao enquadramento do zoom (quando filtrado)
    if (_ptsZoom) _ptsZoom.push([lat, lon]);
    const aprox = /≈|aproxim|por endere/i.test(nome);
    const fonteCoord = aprox
      ? "≈ posição aproximada por endereço"
      : "📍 coordenada oficial do CNES";
    const mk = L.marker([lat, lon], {
      icon: L.divIcon({
        className: "",
        html: '<div style="width:16px;height:16px;background:#7b2ff7;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    });
    mk.bindTooltip(
      `<b>${esc(c.n)}</b><br>${esc(c.cidade)} – ${c.uf}<br>Processos seletivos: ${nproc}<br><i>clique para filtrar</i>`,
      { direction: "top" },
    );
    mk.bindPopup(
      `<b>${esc(c.n)}</b><br>Casa de Saúde Indígena (referência nacional)<br>${esc(c.cidade)} – ${c.uf}<br>Processos seletivos: ${nproc}<br><span style="font-size:10px;color:#6b7d92">${fonteCoord}</span>`,
    );
    mk.on("click", () => {
      const termo = "CASAI " + c.cidade;
      const s = $("tableSearch");
      if (s) s.value = termo;
      applyFilters();
      toast(esc(c.n) + ": " + nproc + " processo(s).");
    });
    _layerCasai.addLayer(mk);
  });
}

function polosBounds(d) {
  let pts = [[d.lat, d.lon]].concat(
    polosCorrigidosPorCnes(d).map((p) => [p.lat, p.lon]),
  );
  const rede = REDE_CNES.rede[d.k];
  if (rede) {
    (rede.c || []).forEach((a) => pts.push([a[2], a[3]]));
  }
  return L.latLngBounds(pts);
}

// Nível 2 (complemento): CASAIs locais do DSEI (coordenadas oficiais do CNES)
/*
  Esta função afastava cada estabelecimento repetido em até 0,05° — cerca de
  5,5 km — para os desempilhar. O dado nunca mudava, porque escrevia em
  `_lat`/`_lon`, mas o marcador era desenhado a 5,5 km do sítio, e nada na tela
  dizia isso a quem olhava.

  O afastamento em graus saiu. O que resolve a sobreposição agora é o
  agrupamento com contagem, em `desenharComAgrupamento`, que é de desenho e
  reversível: aproximar ou abrir o leque devolve cada unidade ao seu lugar.
*/
function _spread(items) {
  return items.map((it) =>
    Object.assign({}, it, { _lat: it.lat, _lon: it.lon }),
  );
}

/*
  Agrupamento com contagem para as camadas da visão nacional.

  Recebe registos já com `_lat`/`_lon` iguais aos reais, agrupa por célula de
  pixel e devolve o que desenhar: ou o registo sozinho, ou um grupo com a sua
  contagem. Quem chama decide o marcador — o que muda entre polos e CASAIs é a
  forma, não a regra de agrupamento.
*/
/*
  LEQUE (spiderfy) — primitiva única, usada pelo mapa detalhado e pelos polos.

  Os deslocamentos vêm de `posicoesSpiderfy`, em PIXELS, e são convertidos em
  coordenada com o zoom corrente. `lat`/`lon` dos registos não são tocados: o
  que muda é onde o marcador é pintado, e recolher devolve tudo ao lugar.

  Isto vivia dentro do mapa detalhado. Passou a primitiva partilhada porque os
  polos precisavam exactamente do mesmo, e duas cópias de uma regra destas
  divergem. Nos polos ela nem chegava a existir: grupos coincidentes só sabiam
  aproximar, e no zoom máximo continuavam num selo só — medido na base real,
  9 grupos e 40 polos, o maior com 19 no Alto Rio Negro.
*/
function criarLeque(mapa) {
  const camada = L.layerGroup();
  let aberto = "";

  const recolher = () => {
    camada.clearLayers();
    if (mapa?.hasLayer?.(camada)) mapa.removeLayer(camada);
    aberto = "";
  };

  return {
    get aberto() {
      return aberto;
    },
    recolher,
    /**
     * @param grupo      grupo devolvido por `agruparPorCelula`
     * @param marcadorDe (registo, posicao) => marcador do Leaflet
     */
    abrir(grupo, marcadorDe) {
      recolher();
      aberto = grupo.chave;
      const centro = mapa.latLngToLayerPoint([grupo.lat, grupo.lon]);
      posicoesSpiderfy(grupo.quantidade).forEach((pos, i) => {
        const destino = mapa.layerPointToLatLng(
          centro.add(L.point(pos.x, pos.y)),
        );
        camada.addLayer(
          L.polyline([[grupo.lat, grupo.lon], destino], {
            color: "#4a6b80",
            weight: 1.2,
            opacity: 0.6,
            interactive: false,
          }),
        );
        camada.addLayer(marcadorDe(grupo.registros[i], destino));
      });
      camada.addTo(mapa);
    },
  };
}

function desenharComAgrupamento(
  mapa,
  registros,
  aoDesenharUm,
  aoDesenharGrupo,
) {
  const grupos = agruparPorCelula(
    registros.map((r) => ({
      ...r,
      lat: r._lat ?? r.lat,
      lon: r._lon ?? r.lon,
    })),
    (r) => mapa.latLngToContainerPoint([r.lat, r.lon]),
  );
  grupos.forEach((grupo) => {
    if (grupo.unico) aoDesenharUm(grupo.unico);
    else aoDesenharGrupo(grupo);
  });
  return grupos;
}
function drawRedeAssistencial(d) {
  if (!_leaflet) return;
  if (_layerUbsi) _layerUbsi.clearLayers();
  if (_layerCasaiLocal) _layerCasaiLocal.clearLayers();
  const rede = REDE_CNES.rede[d.k];
  if (!rede) return;

  // CASAIs locais/DSEI — losango verde-escuro
  const casais = _spread((rede.c || []).map(_unpackEstab));
  casais.forEach((c) => {
    const mk = L.marker([c._lat, c._lon], {
      icon: L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;background:#d92d3a;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    });
    mk.bindTooltip(
      `<b>CASAI</b> ${esc(c.n)}<br>${esc(c.mun || "")}${c.uf ? " – " + c.uf : ""}<br><i>clique para filtrar processos</i>`,
      { direction: "top" },
    );
    mk.bindPopup(
      `<b>CASAI — Casa de Saúde Indígena</b><br>${esc(c.n)}<br>${esc(c.mun || "")}${c.uf ? " – " + c.uf : ""}<br>CNES: ${esc(c.cnes || "-")}<br><span style="font-size:10px;color:#6b7d92">📍 coordenada oficial do CNES</span>`,
    );
    mk.on("click", () => {
      const s = $("tableSearch");
      if (s) {
        s.value = d.n;
        applyFilters();
      }
      toast("Filtrando processos do DSEI " + d.n + ".");
    });
    _layerCasaiLocal.addLayer(mk);
  });
}

// Nível 2: polos base de um DSEI
function drawPolos(d) {
  if (!_leaflet) return;
  _lequePolos?.recolher();
  _layerPolos.clearLayers();
  drawRedeAssistencial(d);
  const polosBase = polosCorrigidosPorCnes(d);
  /*
    A sede de referencia da linha e um polo dentro da abrangencia do DSEI, pela
    mesma regra — nao pelo campo `fora` do payload.
  */
  const sede =
    polosBase.find(
      (p) =>
        classificarVinculoTerritorial(p.uf_cnes ?? p.uf, d.ufs).vinculo !==
        "externo",
    ) || polosBase[0];
  /*
    Aqui os polos repetidos eram afastados em até 0,06° — perto de 6,7 km. Como
    no `_spread`, o dado não mudava e o desenho sim: o polo aparecia a quase
    sete quilómetros do sítio, sem aviso.

    O afastamento em graus saiu. O marcador fica na coordenada real, e a
    sobreposição resolve-se com o agrupamento logo abaixo.
  */
  const polos = polosBase.map((p) =>
    Object.assign({}, p, { _lat: p.lat, _lon: p.lon }),
  );
  /*
    O campo `fora` que vem do payload significa "fora da UF da **sede**", e não
    "fora da abrangência do DSEI" — coisas diferentes em 12 dos 34 DSEIs, que
    cobrem mais de uma UF legitimamente.

    Conferido contra os dados reais: dos 381 polos, 58 chegam com `fora: true`,
    e **todos os 58** estão numa UF que consta do próprio `ufs` do DSEI. Boca do
    Acre (AM) no Alto Rio Purus, que cobre AC, AM e RO; Passo Fundo (RS) no
    Interior Sul, que cobre RS e SC. Eram 58 linhas pontilhadas afirmando uma
    anomalia territorial inexistente, com o texto "em outro estado".

    Vale aqui a mesma regra do mapa detalhado: o CNES decide a UF da unidade, e
    ela é comparada com a abrangência declarada do DSEI.
  */
  // As linhas de vínculo saem da sede para cada polo externo, agrupado ou não.
  polos.forEach((p) => {
    const externo =
      classificarVinculoTerritorial(p.uf_cnes ?? p.uf, d.ufs).vinculo ===
      "externo";
    if (externo && sede) {
      L.polyline(
        [
          [sede.lat, sede.lon],
          [p._lat, p._lon],
        ],
        { color: "#e8730c", weight: 1.6, dashArray: "6,5", opacity: 0.8 },
      )
        .bindTooltip(TOOLTIP_DA_LINHA, { sticky: true })
        .addTo(_layerPolos);
    }
  });

  /* `posicao` só é dada pelo leque: é o destino em pixels convertido. */
  const marcadorDoPolo = (p, posicao) => {
    const vinculo = classificarVinculoTerritorial(p.uf_cnes ?? p.uf, d.ufs);
    const externo = vinculo.vinculo === "externo";
    const mk = L.circleMarker(posicao || [p._lat, p._lon], {
      radius: externo ? 6 : 5,
      color: "#fff",
      weight: 1.5,
      fillColor: externo ? "#e8730c" : "#1d4e89",
      fillOpacity: 0.95,
    });
    mk.bindTooltip(
      esc(p.n) +
        (externo
          ? ` <i>(${esc(vinculo.uf || "")}, fora das UFs do DSEI)</i>`
          : ""),
      { direction: "top" },
    );
    const fonte = p.coord_oficial
      ? `📍 coordenada oficial do CNES<br>CNES: ${esc(p.cnes || "-")}${p.coord_nome ? `<br>Registro: ${esc(p.coord_nome)}` : ""}`
      : "≈ posição aproximada (centro do município)";
    mk.bindPopup(
      `<b>Polo base: ${esc(p.n)}</b><br>UF: ${p.uf}<br>População do polo: ${fmt(p.p)} indígenas${externo ? "<br><i>Vinculado ao DSEI " + esc(d.n) + ", fora das UFs de abrangência</i>" : ""}<br><span style="font-size:10px;color:#6b7d92">${fonte}</span>`,
    );
    return mk;
  };

  /*
    Com o afastamento em graus removido, polos no mesmo município ficariam um
    por cima do outro e o de baixo seria inalcançável. O agrupamento devolve um
    marcador com a contagem; aproximar separa-os, e o que continuar coincidente
    lista os nomes no tooltip.
  */
  desenharComAgrupamento(
    _leaflet,
    polos,
    (p) => _layerPolos.addLayer(marcadorDoPolo(p)),
    (grupo) => {
      /*
        A mesma distinção do mapa detalhado, que faltava aqui. Aproximar só
        resolve quem está perto; quem partilha a coordenada continuaria num selo
        só no zoom máximo — 19 polos do Alto Rio Negro num ponto, 5 do Yanomami
        noutro, e em cada grupo todos menos um inalcançáveis.
      */
      const coincidente = grupoCoincidente(
        grupo.registros.map((r) => ({ lat: r._lat, lon: r._lon })),
      );

      const badge = L.marker([grupo.lat, grupo.lon], {
        icon: L.divIcon({
          className: coincidente
            ? "mapa-cluster mapa-cluster--leque"
            : "mapa-cluster",
          html: `<span>${grupo.quantidade}</span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        keyboard: true,
        title: coincidente
          ? `${grupo.quantidade} polos base na mesma coordenada — abrir em leque`
          : `${grupo.quantidade} polos base nesta área — aproximar`,
      });
      badge.bindTooltip(
        `<b>${grupo.quantidade} polos base</b><br>${grupo.registros
          .slice(0, 8)
          .map((r) => esc(r.n))
          .join("<br>")}${grupo.quantidade > 8 ? "<br>…" : ""}<br><i>${
          coincidente
            ? "mesma coordenada — clique para abrir em leque"
            : "clique para aproximar"
        }</i>`,
        { direction: "top" },
      );

      const acionar = () => {
        if (!coincidente) {
          _leaflet.setView(
            [grupo.lat, grupo.lon],
            Math.min(_leaflet.getZoom() + 3, 12),
            { animate: true },
          );
          return;
        }
        if (_lequePolos.aberto === grupo.chave) _lequePolos.recolher();
        else {
          _lequePolos.abrir(grupo, (polo, destino) =>
            marcadorDoPolo(polo, destino),
          );
          toast(
            `${grupo.quantidade} polos base na mesma coordenada, abertos em leque. Clique no número para recolher.`,
          );
        }
      };

      badge.on("click", acionar);
      // O Leaflet dá Enter ao marcador; o Espaço é o que se espera de um botão.
      badge.on("keypress", (e) => {
        if (e.originalEvent?.key === " ") {
          e.originalEvent.preventDefault();
          acionar();
        }
      });
      _layerPolos.addLayer(badge);
    },
  );
  syncMapLevelUI();
}

// compat: chamada antiga renderMap() agora inicializa/atualiza o Leaflet
function renderMap() {
  if (currentView !== "dashboard") return;
  initLeaflet();
  if (!_leaflet) return;
  scheduleMapResize(60);
  drawDSEIBubbles();
}

function mapVoltar() {
  const s = $("tableSearch");
  if (s) s.value = "";
  filterState.uf = new Set();
  lastMapUfKey = null;
  applyFilters();
  if (_leaflet) {
    _layerPolos.clearLayers();
    if (_layerUbsi) _layerUbsi.clearLayers();
    if (_layerCasaiLocal) _layerCasaiLocal.clearLayers();
    if (_layerUF) _layerUF.clearLayers();
    flyToBrasil(L.latLngBounds(_BRASIL_VIEW[0], _BRASIL_VIEW[1]), {
      duration: 0.6,
    });
  }
  {
    const _b = $("drillBackBtn");
    if (_b) _b.style.display = "none";
  }
  _suppressAutoFit = true; // a câmera é controlada pelo flyToBrasil acima
  try {
    drawDSEIBubbles();
  } finally {
    _suppressAutoFit = false;
  }
  resetDetailMap({ silent: true });
  toast("Visão geral do Brasil.");
}

// Botão dentro do mapa: enquadra TODOS os DSEIs (Brasil inteiro), sem mexer nos filtros
function mapVerBrasil() {
  if (!_leaflet) return;
  const pts = LMAP.dsei
    .map((d) => [d.lat, d.lon])
    .concat((REDE_CNES.nac || []).map((a) => [a[2], a[3]]));
  try {
    flyToBrasil(L.latLngBounds(pts), { padding: [30, 30], duration: 0.6 });
  } catch (e) {
    flyToBrasil(L.latLngBounds(_BRASIL_VIEW[0], _BRASIL_VIEW[1]), {
      duration: 0.6,
    });
  }
}

// ===== IMPORTAÇÃO DA REDE ASSISTENCIAL (UBSI + CASAI) DO JSON v4 =====
// As coordenadas oficiais do CNES no JSON v4 estão nos estabelecimentos (UBSI/CASAI),
// não nos polos base (que vêm com latitude/longitude nulas). Esta função lê o JSON v4,
// agrupa os estabelecimentos por DSEI e atualiza REDE_CNES nesta sessão.
function _dseiKeyNorm(s) {
  let u = txt(s)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  u = u
    .replace(/^DSEI\s+/, "")
    .replace(/^CASAI\s+/, "")
    .replace(/\bNACIONAL\b/g, " ")
    .replace(/-/g, " ");
  u = u
    .replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return u;
}
function _redeFromV4(json) {
  // mapa: chave normalizada do DSEI -> k original do mapa
  const keyToK = {};
  LMAP.dsei.forEach((d) => {
    keyToK[_dseiKeyNorm(d.k)] = d.k;
  });
  const rede = {};
  const nac = [];
  let nUbsi = 0,
    nCasai = 0,
    semDsei = 0;
  const okLoc = (e) => {
    const l = e && e.localizacao;
    return (
      l && typeof l.latitude === "number" && typeof l.longitude === "number"
    );
  };
  const pack = (e) => [
    e.nome,
    e.cnes,
    +e.localizacao.latitude.toFixed(6),
    +e.localizacao.longitude.toFixed(6),
    e.municipio,
    e.uf,
  ];
  const add = (dseiNome, e, tipo) => {
    const k = keyToK[_dseiKeyNorm(dseiNome)];
    if (!k) {
      semDsei++;
      return;
    }
    if (!rede[k]) rede[k] = { u: [], c: [] };
    if (tipo === "UBSI") {
      rede[k].u.push(pack(e));
      nUbsi++;
    } else {
      rede[k].c.push(pack(e));
      nCasai++;
    }
  };
  (json.ubsis_amostra_por_dsei || []).forEach((b) =>
    (b.ubsis || []).forEach((e) => {
      if (okLoc(e)) add(b.dsei, e, "UBSI");
    }),
  );
  (json.casais_dsei_ou_local_por_dsei || []).forEach((b) =>
    (b.casais || []).forEach((e) => {
      if (okLoc(e)) add(b.dsei, e, "CASAI");
    }),
  );
  (json.casais_nacionais || []).forEach((e) => {
    if (okLoc(e)) nac.push(pack(e));
  });
  return { rede, nac, nUbsi, nCasai, semDsei };
}

function _parseCnesTextarea() {
  const raw = (($("cfgCnesJson") && $("cfgCnesJson").value) || "").trim();
  if (!raw) throw new Error("Cole o conteúdo do JSON v4 primeiro.");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error("O texto colado não é um JSON válido.");
  }
  if (
    !json.dseis &&
    !json.ubsis_amostra_por_dsei &&
    !json.casais_dsei_ou_local_por_dsei
  )
    throw new Error(
      "JSON sem as chaves esperadas (dseis / ubsis_amostra_por_dsei / casais_dsei_ou_local_por_dsei) — confira se é o arquivo v4 correto.",
    );
  return json;
}

function previewCnesCoords() {
  const box = $("cnesImportResumo");
  try {
    const json = _parseCnesTextarea();
    const { nUbsi, nCasai, nac, semDsei } = _redeFromV4(json);
    if (box) {
      box.style.display = "block";
      box.style.background = "#f0f7ff";
      box.style.borderColor = "#d7e5f2";
      box.style.color = "#234";
      box.innerHTML =
        `<b>Pré-visualização:</b> o arquivo traz <b>${nUbsi}</b> UBSIs e <b>${nCasai}</b> CASAIs de DSEI/locais com coordenada oficial do CNES, além de <b>${nac.length}</b> CASAI(s) nacional(is). ` +
        (semDsei
          ? `(${semDsei} estabelecimento(s) sem DSEI reconhecido foram ignorados.) `
          : ``) +
        `Clique em <b>Aplicar ao mapa</b> para usar estes estabelecimentos no drill-down dos DSEIs.`;
    }
  } catch (e) {
    if (box) {
      box.style.display = "block";
      box.style.background = "#fff3f3";
      box.style.borderColor = "#f0c0c0";
      box.style.color = "#a02020";
      box.textContent = e.message;
    }
  }
}

async function aplicarCnesCoords() {
  const box = $("cnesImportResumo");
  try {
    const json = _parseCnesTextarea();
    const { rede, nac, nUbsi, nCasai } = _redeFromV4(json);
    // Substitui a rede em memória e persiste no Supabase para os próximos acessos.
    REDE_CNES.rede = rede;
    REDE_CNES.nac = nac;
    const savedOnSupabase = await saveMapaConfigToSupabase({ silent: true });
    // redesenhar: visão Brasil e CASAIs nacionais
    if (_leaflet) {
      if (_layerPolos) _layerPolos.clearLayers();
      if (_layerUbsi) _layerUbsi.clearLayers();
      if (_layerCasaiLocal) _layerCasaiLocal.clearLayers();
      if (_layerUF) _layerUF.clearLayers();
      drawDSEIBubbles();
    }
    if (box) {
      box.style.display = "block";
      box.style.background = "#edfaf0";
      box.style.borderColor = "#bfe6cd";
      box.style.color = "#16603a";
      box.innerHTML =
        `<b>Rede assistencial aplicada${savedOnSupabase ? " e salva no Supabase" : ""}.</b> ${nUbsi} UBSIs e ${nCasai} CASAIs de DSEI/locais com coordenada oficial do CNES disponíveis no drill-down. ` +
        `<br><i>Clique num DSEI no mapa para ver as unidades.</i>`;
    }
    toast(
      savedOnSupabase
        ? "Rede do CNES aplicada e salva (" +
            nUbsi +
            " UBSIs, " +
            nCasai +
            " CASAIs)."
        : "Rede aplicada nesta tela, mas não foi salva no Supabase.",
      savedOnSupabase ? "ok" : "warn",
    );
  } catch (e) {
    if (box) {
      box.style.display = "block";
      box.style.background = "#fff3f3";
      box.style.borderColor = "#f0c0c0";
      box.style.color = "#a02020";
      box.textContent = e.message;
    }
  }
}

function syncMapLevelUI() {
  const showingPolos =
    (_layerPolos && _layerPolos.getLayers().length > 0) ||
    (_layerCasaiLocal && _layerCasaiLocal.getLayers().length > 0);
  const box = $("mapLegendBox");
  if (box) {
    const dot = (c) =>
      `<span style="width:12px;height:12px;border-radius:50%;background:${c};border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.15);display:inline-block;vertical-align:middle;margin-right:6px;"></span>`;
    const losango = (c) =>
      `<span style="width:11px;height:11px;background:${c};border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2);display:inline-block;transform:rotate(45deg);vertical-align:middle;margin-right:7px;margin-left:1px;"></span>`;
    const tracejado =
      '<span style="border-top:2.5px dashed #e8730c;width:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></span>';
    const quadUF =
      '<span style="width:12px;height:12px;background:#2e8b57;opacity:.45;border:1.5px solid #1f6f4a;display:inline-block;vertical-align:middle;margin-right:6px;"></span>';
    box.innerHTML = showingPolos
      ? `<b style="color:#22577a">Polos base do DSEI</b><br>${dot("#1d4e89")}polo base<br>${dot("#e8730c")}polo fora das UFs do DSEI<br>${losango("#d92d3a")}CASAI (Casa de Saúde)<br>${tracejado}ligação ao DSEI<br>${quadUF}estado atendido`
      : `<b style="color:#22577a">Legenda</b><br>${dot("#5b9bd5")}DSEI (tamanho = nº de indígenas)<br>${dot("#0b8f58")}DSEI com processo ativo<br>${losango("#7b2ff7")}CASAI Nacional`;
  }
  const lgDsei = $("mapLegendDsei");
  if (lgDsei)
    lgDsei.innerHTML = showingPolos
      ? '<span style="width:11px;height:11px;border-radius:50%;background:#1d4e89;display:inline-block;"></span> polo base &nbsp; <span style="width:11px;height:11px;border-radius:50%;background:#e8730c;display:inline-block;"></span> polo fora das UFs do DSEI'
      : '<span style="width:11px;height:11px;border-radius:50%;background:#5b9bd5;display:inline-block;"></span> DSEI &nbsp; <span style="width:11px;height:11px;border-radius:50%;background:#0b8f58;display:inline-block;"></span> com processo';
}

function renderRisks() {
  const critical = filtered.filter(isRiscoAtivo).slice(0, 30);
  $("riskList").innerHTML =
    critical
      .map((r) => {
        const isHigh = low(r.risco) === "alto";
        return `<div class="risk-item"><div class="top-line"><span>${esc(r.edital || "-")}</span><span class="chip ${isHigh ? "red" : "yellow"}">${esc(r.risco || "-")}</span></div><small>${esc(r.etapa || "Etapa não informada")} <span style="float:right">${esc(r.unidade || "")}</span></small></div>`;
      })
      .join("") ||
    `<div class="alert">Nenhum processo crítico com os filtros atuais.</div>`;
}

function statusChip(status) {
  const l = low(status);
  const cls = l.includes("conclu")
    ? "green"
    : l.includes("andamento")
      ? "blue"
      : l.includes("elabora")
        ? "cyan"
        : l.includes("cancel")
          ? "red"
          : "gray";
  return `<span class="chip ${cls}">${esc(status || "-")}</span>`;
}
function riscoChip(risco) {
  const l = low(risco);
  const cls =
    l === "alto" ? "red" : l === "médio" || l === "medio" ? "yellow" : "green";
  return `<span class="chip ${cls}">${esc(risco || "-")}</span>`;
}
function shouldShowObsToggle(value) {
  return txt(value).length > 180;
}
function toggleObs(button) {
  const cell = button.closest(".obs-cell");
  if (!cell) return;
  const text = cell.querySelector(".obs");
  if (!text) return;
  const expanded = text.classList.toggle("expanded");
  button.textContent = expanded ? "Ver menos" : "Ver mais";
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
}

// ── Definição de colunas configuráveis ──────────────────────────────────
const TABLE_COLS = [
  { key: "unidade", label: "Unidade", default: true },
  { key: "edital", label: "Edital", default: true },
  { key: "data_inicio", label: "Início", default: true },
  { key: "data_fim", label: "Encerramento", default: true },
  { key: "vagas_total", label: "Vagas", default: true, num: true },
  { key: "contratados", label: "Contratados", default: true, num: true },
  { key: "vagas_ociosas", label: "Ociosas", default: true, num: true },
  { key: "status", label: "Status", default: true },
  { key: "etapa", label: "Etapa", default: true },
  { key: "risco", label: "Risco", default: true },
  { key: "observacoes", label: "Observações", default: true },
];
let visibleCols = null;

function loadVisibleCols() {
  try {
    const saved = localStorage.getItem("agsus_visible_cols_v1");
    if (saved) return new Set(JSON.parse(saved));
  } catch (e) {}
  return new Set(TABLE_COLS.filter((c) => c.default).map((c) => c.key));
}
function saveVisibleCols() {
  try {
    localStorage.setItem(
      "agsus_visible_cols_v1",
      JSON.stringify([...visibleCols]),
    );
  } catch (e) {}
}

function buildColMenu() {
  if (!visibleCols) visibleCols = loadVisibleCols();
  const menu = $("colToggleMenu");
  if (!menu) return;
  const items = TABLE_COLS.map(
    (c) => `
      <label class="col-toggle-item">
        <input type="checkbox" ${visibleCols.has(c.key) ? "checked" : ""} onchange="toggleCol('${c.key}',this.checked)">
        ${esc(c.label)}
      </label>`,
  ).join("");
  // preservar o header
  const header = menu.querySelector("div");
  menu.innerHTML = "";
  if (header) menu.appendChild(header);
  menu.insertAdjacentHTML("beforeend", items);
}

function toggleCol(key, checked) {
  if (!visibleCols) visibleCols = loadVisibleCols();
  if (checked) visibleCols.add(key);
  else visibleCols.delete(key);
  if (visibleCols.size === 0) {
    visibleCols.add(key);
    return;
  } // mínimo 1
  saveVisibleCols();
  renderTable();
}

function toggleColMenu() {
  buildColMenu();
  const menu = $("colToggleMenu");
  if (menu) {
    menu.classList.toggle("open");
    if (menu.classList.contains("open")) {
      const close = (e) => {
        if (!e.target.closest(".col-toggle-wrap")) {
          menu.classList.remove("open");
          document.removeEventListener("click", close);
        }
      };
      setTimeout(() => document.addEventListener("click", close), 0);
    }
  }
}

// ── Alerta de encerramento próximo ──────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  // Parseia 'YYYY-MM-DD' como data LOCAL (evita erro de fuso: Date.parse trata como UTC).
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  let target;
  if (m) {
    target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else {
    const t = Date.parse(dateStr);
    if (!Number.isFinite(t)) return null;
    target = new Date(t);
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function expiryBadge(r) {
  if (["cancelado", "cancelada"].includes(low(r.status)))
    return `<span class="expiry-badge done"><i class="fa-solid fa-ban"></i> Cancelado</span>`;
  if (["concluído", "concluido"].includes(low(r.status)))
    return `<span class="expiry-badge done"><i class="fa-solid fa-check"></i> Concluído</span>`;
  if (!r.data_fim) return "";
  const days = daysUntil(r.data_fim);
  if (days === null) return "";
  if (days < 0) return `<span class="expiry-badge done">Encerrado</span>`;
  if (days <= 7)
    return `<span class="expiry-badge crit"><i class="fa-solid fa-fire"></i> ${days}d</span>`;
  if (days <= 30)
    return `<span class="expiry-badge warn"><i class="fa-solid fa-clock"></i> ${days}d</span>`;
  return "";
}

function rowExpiryClass(r) {
  if (isEncerrado(r)) return "";
  const days = daysUntil(r.data_fim);
  if (days === null) return "";
  if (days <= 7) return "row-ending-critical";
  if (days <= 30) return "row-ending-soon";
  return "";
}

// ── Pills de filtros ativos ──────────────────────────────────────────────
function renderActiveFilters() {
  const bar = $("activeFiltersBar");
  if (!bar) return;
  const searchQ = txt($("tableSearch")?.value);
  const pills = [];
  FILTER_CONFIG.forEach((cfg) => {
    const selected = Array.from(filterState[cfg.field] || []);
    selected.forEach((v) => {
      pills.push(
        `<span class="filter-pill">${esc(cfg.label)}: ${esc(v)}<button onclick="removeFilterPill('${attr(cfg.field)}','${attr(v)}')" title="Remover filtro" aria-label="Remover ${esc(v)}">×</button></span>`,
      );
    });
  });
  if (searchQ)
    pills.push(
      `<span class="filter-pill"><i class="fa-solid fa-magnifying-glass" style="font-size:10px;"></i> "${esc(searchQ)}"<button onclick="clearSearchPill()" title="Limpar busca">×</button></span>`,
    );
  if (hideClosed)
    pills.push(
      `<span class="filter-pill" style="background:#eef2f7;border-color:#d5dfec;color:#334155"><i class="fa-solid fa-eye-slash" style="font-size:10px;"></i> Encerrados ocultos<button onclick="toggleHideClosed()" title="Mostrar encerrados">×</button></span>`,
    );
  if (!pills.length) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }
  bar.classList.remove("hidden");
  bar.innerHTML =
    pills.join("") +
    `<button class="filters-clear-all" onclick="clearFilters()"><i class="fa-solid fa-xmark"></i> Limpar todos</button>`;
}

function removeFilterPill(field, value) {
  const selected = filterState[field] || new Set();
  selected.delete(value);
  filterState[field] = selected;
  applyFilterStateChange();
}

function clearSearchPill() {
  const el = $("tableSearch");
  if (el) el.value = "";
  applyFilters();
}

function renderTable() {
  if (!visibleCols) visibleCols = loadVisibleCols();
  const detailRows = filtered;
  const totalRows = rows;
  renderSortIndicators();
  renderActiveFilters();
  const sortText = tableSort.field
    ? ` Ordenação: ${tableSort.direction === "asc" ? "crescente" : "decrescente"}.`
    : " Clique nos cabeçalhos para ordenar.";
  $("tableMeta").textContent =
    `Exibindo ${fmt(detailRows.length)} de ${fmt(totalRows.length)} registros.${sortText}`;

  // sync cabeçalhos
  const thead = document.querySelector(".details-table thead tr");
  if (thead) {
    const allTh = [...thead.querySelectorAll("th[data-sort-field]")];
    allTh.forEach((th) => {
      th.style.display = visibleCols.has(th.dataset.sortField) ? "" : "none";
    });
  }

  $("monitorRows").innerHTML =
    detailRows
      .map((r) => {
        const link = safeUrl(r.link_edital);
        const edital = link
          ? `<a class="link" href="${attr(link)}" target="_blank" rel="noopener">${esc(r.edital || "-")} ↗</a>`
          : esc(r.edital || "-");
        const observacoes = txt(r.observacoes) || "-";
        const obsToggle = shouldShowObsToggle(observacoes)
          ? `<button type="button" class="obs-toggle" onclick="toggleObs(this)" aria-expanded="false">Ver mais</button>`
          : "";
        const badge = expiryBadge(r);
        const rowCls = rowExpiryClass(r);

        const cells = {
          unidade: `<td>${esc(r.unidade)}</td>`,
          edital: `<td>${edital}${badge ? `<div style="margin-top:4px">${badge}</div>` : ""}</td>`,
          data_inicio: `<td>${esc(fmtDate(r.data_inicio))}</td>`,
          data_fim: `<td>${esc(fmtDate(r.data_fim))}</td>`,
          vagas_total: `<td class="num">${fmt(r.vagas_total)}</td>`,
          contratados: `<td class="num green-text">${fmt(r.contratados)}</td>`,
          vagas_ociosas: `<td class="num red-text">${fmt(r.vagas_ociosas)}</td>`,
          status: `<td>${statusChip(r.status)}</td>`,
          etapa: `<td>${esc(r.etapa)}</td>`,
          risco: `<td>${riscoChip(r.risco)}</td>`,
          observacoes: `<td class="obs-col"><div class="obs-cell"><div class="obs">${esc(observacoes)}</div>${obsToggle}</div></td>`,
        };
        const tds = TABLE_COLS.filter((c) => visibleCols.has(c.key))
          .map((c) => cells[c.key])
          .join("");
        return `<tr class="${rowCls}">${tds}</tr>`;
      })
      .join("") ||
    `<tr><td colspan="${TABLE_COLS.filter((c) => visibleCols.has(c.key)).length || 1}" style="text-align:center;padding:22px">Nenhum registro encontrado com os filtros atuais.</td></tr>`;

  // Linha de totais (rodapé): soma das colunas numéricas visíveis
  const foot = $("monitorFoot");
  if (foot) {
    if (!detailRows.length) {
      foot.innerHTML = "";
    } else {
      const tot = { vagas_total: 0, contratados: 0, vagas_ociosas: 0 };
      detailRows.forEach((r) => {
        tot.vagas_total += n(r.vagas_total);
        tot.contratados += n(r.contratados);
        tot.vagas_ociosas += n(r.vagas_ociosas);
      });
      const footCells = {
        unidade: `<td><b>Totais (${fmt(detailRows.length)})</b></td>`,
        edital: `<td></td>`,
        data_inicio: `<td></td>`,
        data_fim: `<td></td>`,
        vagas_total: `<td class="num"><b>${fmt(tot.vagas_total)}</b></td>`,
        contratados: `<td class="num green-text"><b>${fmt(tot.contratados)}</b></td>`,
        vagas_ociosas: `<td class="num red-text"><b>${fmt(tot.vagas_ociosas)}</b></td>`,
        status: `<td></td>`,
        etapa: `<td></td>`,
        risco: `<td></td>`,
        observacoes: `<td class="obs-col"></td>`,
      };
      const ftds = TABLE_COLS.filter((c) => visibleCols.has(c.key))
        .map((c) => footCells[c.key])
        .join("");
      foot.innerHTML = `<tr style="position:sticky;bottom:0;background:#eef5fc;border-top:2px solid var(--agsus-ciano)">${ftds}</tr>`;
    }
  }
}

let nucleoDebounce = null;
function debouncedNucleo() {
  clearTimeout(nucleoDebounce);
  nucleoDebounce = setTimeout(renderNucleo, 250);
}
function renderNucleo() {
  const started = performance.now();
  const newButton = $("newEditalBtn");
  if (newButton) newButton.classList.toggle("hidden", !canManageEditais(profile));
  const q = low($("nucleoSearch").value);
  const data = rows
    .filter(
      (r) =>
        !q ||
        [r.edital, r.unidade, r.status, r.etapa, r.risco, r.processo]
          .map(low)
          .join(" | ")
          .includes(q),
    )
    .sort(compareRows);
  const markup =
    data
      .map(
        (r) => `<tr data-record-id="${attr(r.id)}">
      <td>${esc(r.unidade)}</td>
      <td>${safeUrl(r.link_edital) ? `<a class="link" href="${attr(safeUrl(r.link_edital))}" target="_blank" rel="noopener">${esc(r.edital || "-")}</a>` : esc(r.edital || "-")}</td>
      <td>${statusChip(r.status)}</td>
      <td>${esc(r.etapa)}</td>
      <td class="num">${fmt(r.vagas_total)}</td>
      <td class="num green-text">${fmt(r.contratados)}</td>
      <td class="num red-text">${fmt(r.vagas_ociosas)}</td>
      <td>${riscoChip(r.risco)}</td>
      <td style="text-align:center">
        <div class="nucleo-row-actions">
          ${canManageEditais(profile) ? `<button class="btn icon outline" onclick="openEditModal('${attr(r.id)}')" title="Editar registro" aria-label="Editar ${esc(r.edital || r.unidade)}"><i class="fa-solid fa-pen-to-square"></i></button>` : ""}
          ${canImportApprovedList(profile) ? `<button class="btn icon outline" onclick="openApprovedListImport('${attr(r.id)}')" title="Lista de aprovados" aria-label="Lista de aprovados de ${esc(r.edital || r.unidade)}"><i class="fa-solid fa-file-arrow-up"></i></button>` : ""}
          ${!canManageEditais(profile) && !canImportApprovedList(profile) ? '<span class="approved-no-action">—</span>' : ""}
        </div>
      </td>
    </tr>`,
      )
      .join("") ||
    `<tr><td colspan="9" style="text-align:center;padding:22px">Nenhum registro encontrado.</td></tr>`;
  renderNucleoTable($("nucleoRows"), markup);
  document.dispatchEvent(new CustomEvent("agsus:nucleo-rendered"));
  document.dispatchEvent(
    new CustomEvent("agsus:nucleo-metric", {
      detail: {
        name: "table-render",
        durationMs: performance.now() - started,
        rows: data.length,
      },
    }),
  );
}

function openApprovedListImport(id) {
  if (!canImportApprovedList(profile))
    return toast("Sem permissão para gerir listas de aprovados.", "warn");
  const row = rows.find((item) => String(item.id) === String(id));
  if (!row) return toast("Edital não encontrado.", "warn");
  const label = [row.edital, row.unidade].filter(Boolean).join(" · ");
  if (!window.aprovadosController)
    return toast("O módulo Lista de Aprovados ainda está carregando.", "warn");
  void window.aprovadosController.openImportModal(row.id, label);
}

function setFieldValue(id, value) {
  const el = $(id);
  if (el) el.value = value ?? "";
}
function setMetricValue(id, value) {
  const el = $(id);
  if (el) el.textContent = fmt(value);
}
function dateOrNull(id) {
  const v = txt($(id)?.value);
  return v || null;
}

function openEditModal(id) {
  if (!canManageEditais(profile))
    return toast("Seu perfil pode consultar a Equipe Núcleo, mas não editar editais.", "warn");
  const r = id ? rows.find((x) => String(x.id) === String(id)) : {};
  $("editModalTitle").textContent = id ? "Editar edital" : "Novo edital";
  setFieldValue("mId", r?.id || "");
  setFieldValue("mProcesso", r?.processo || "");
  setFieldValue("mEdital", r?.edital || "");
  const rowUnit = findUnitForRow(r);
  const unitValue = rowUnit ? unidadeOptionValue(rowUnit) : "";
  populateModalUnidades(unitValue);
  setFieldValue("mUnidade", unitValue);
  if (rowUnit) {
    onModalUnidadeChange();
  } else {
    setFieldValue("mIdUnidade", r?.id_unidade || "");
    setFieldValue("mSiglaUnidade", r?.sigla_unidade || "");
    setFieldValue("mTipoUnidade", r?.tipo_unidade || "");
    setFieldValue("mUf", r?.uf || "");
  }
  setFieldValue("mCiclo", r?.ciclo || "");
  setFieldValue("mLink", r?.link_edital || "");
  setFieldValue("mVagas", r?.vagas_total || 0);
  setFieldValue("mDataInicio", r?.data_inicio || "");
  setFieldValue("mDataFim", r?.data_fim || "");
  setFieldValue("mStatus", r?.status || "");
  setFieldValue("mEtapa", r?.etapa || "");
  setFieldValue("mRisco", r?.risco || "Baixo");
  setFieldValue("mResponsavel", r?.responsavel || "");
  setFieldValue("mObs", r?.observacoes || "");
  setFieldValue("mObsInternas", r?.observacoes_internas || "");
  setMetricValue("mAutoInscritos", r?.inscritos);
  setMetricValue("mAutoAptosAnalise", r?.aptos_analise);
  setMetricValue("mAutoCancelados", r?.cancelados);
  setMetricValue("mAutoEliminadosNota", r?.eliminados_nota);
  setMetricValue("mAutoReprovadosAnalise", r?.reprovados_analise);
  setMetricValue("mAutoTotalEliminados", r?.total_eliminados);
  setMetricValue("mAutoAprovadosAnalise", r?.aprovados_analise);
  setMetricValue("mAutoAprovadosProva", r?.aprovados_prova);
  setMetricValue("mAutoEntrevistados", r?.entrevistados);
  setMetricValue("mAutoContratados", r?.contratados);
  setMetricValue("mAutoOciosas", r?.vagas_ociosas);
  $("editModal").classList.add("show");
  setTimeout(() => {
    try {
      $("mProcesso")?.focus();
    } catch (e) {}
  }, 60);
}
function closeEditModal() {
  $("editModal").classList.remove("show");
}

async function saveEdital() {
  if (!canManageEditais(profile))
    return toast("Sem permissão para salvar editais.", "warn");
  const id = txt($("mId").value);
  const unit = selectedModalUnidade();
  const payload = {
    processo: txt($("mProcesso").value),
    edital: txt($("mEdital").value),
    id_unidade: txt(unit?.id_unidade) || null,
    sigla_unidade: txt(unit?.sigla) || null,
    tipo_unidade: txt(unit?.tipo) || null,
    unidade: txt(unit?.nome_oficial),
    uf: txt(unit?.uf_sede).toUpperCase(),
    ciclo: txt($("mCiclo").value),
    vagas_total: n($("mVagas").value),
    data_inicio: dateOrNull("mDataInicio"),
    data_fim: dateOrNull("mDataFim"),
    status: txt($("mStatus").value),
    etapa: txt($("mEtapa").value),
    risco: txt($("mRisco").value),
    responsavel: txt($("mResponsavel").value),
    link_edital: txt($("mLink").value),
    observacoes: txt($("mObs").value),
    observacoes_internas: txt($("mObsInternas").value),
    ativo: true,
  };
  if (id) payload.id = id;
  if (!payload.edital || !payload.unidade) {
    toast("Informe pelo menos edital e unidade.", "warn");
    return;
  }
  if (
    payload.data_inicio &&
    payload.data_fim &&
    payload.data_inicio > payload.data_fim
  ) {
    toast(
      "A data de início não pode ser posterior à data de encerramento.",
      "warn",
    );
    return;
  }
  const btn = $("saveEditalBtn");
  btn.disabled = true;
  btn.textContent = "Salvando...";
  loader(true, "Equipe Núcleo", "Salvando no Supabase...", 70);
  const result = await sb.rpc(RPC_SAVE_MONITORAMENTO, { p_payload: payload });
  btn.disabled = false;
  btn.textContent = "Salvar";
  if (result.error) {
    loader(false);
    toast("Erro ao salvar: " + friendlyError(result.error), "error");
    return;
  }
  const saved = rpcFirst(result.data);
  if (!saved || !saved.id) {
    loader(false);
    toast(
      "Não foi possível confirmar o salvamento. Verifique as permissões da Equipe Núcleo.",
      "error",
    );
    return;
  }
  closeEditModal();
  await loadData({ showLoader: false });
  loader(false);
  toast(
    `${saved.edital || "Registro"} — ${saved.unidade || ""} salvo com sucesso.`,
  );
  navigate("nucleo");
}

function warmExternalPanels(force = false) {
  if (!can("paineis")) return;
  const mount = $("externalMount");
  if (!mount) return;
  if (force) {
    document.querySelectorAll(".external-panel").forEach((el) => el.remove());
    externalPanelsWarmed = false;
  }
  if (externalPanelsWarmed) return;
  if (mount.classList.contains("external-placeholder")) {
    mount.className = "";
    mount.innerHTML = "";
  }
  panels
    .filter((p) => p.ativo !== false)
    .sort((a, b) => n(a.ordem) - n(b.ordem))
    .forEach((panel) => {
      const code = txt(panel.codigo);
      if (!code) return;
      let holder = document.getElementById("external-panel-" + code);
      if (holder) return;
      holder = document.createElement("div");
      holder.id = "external-panel-" + code;
      holder.className = "external-panel";
      holder.hidden = true;
      mount.appendChild(holder);
      buildExternalPanel(holder, panel);
    });
  externalPanelsWarmed = true;
}

function clearExternalPanelCache() {
  document.querySelectorAll(".external-panel").forEach((el) => el.remove());
  const mount = $("externalMount");
  if (mount) {
    mount.className = "external-placeholder";
    mount.textContent = cfgValue("external_placeholder");
  }
  externalPanelsWarmed = false;
  currentPanel = null;
}

function openPanel(code) {
  const panel = panels.find((p) => p.codigo === code && panelAllowed(p));
  if (!panel) {
    toast("Painel indisponível ou inativo.", "warn");
    return;
  }
  const safePanelUrl = safeUrl(panel.url);
  /*
    O painel externo traz o seu próprio cabeçalho. Somado ao do Monitora, a
    pessoa via dois títulos empilhados dizendo a mesma coisa.

    `external-panel-mode` esconde **apenas** o cabeçalho superior. Não é o antigo
    `external-clean`, que também escondia a navegação lateral — a sidebar fica,
    porque é por ela que se volta.
  */
  document.body.classList.remove("external-clean");
  document.body.classList.add("external-panel-mode");
  currentPanel = panel;
  currentView = "panel:" + code;
  rememberView(currentView);
  enforceResponsiveSidebar();
  setActiveNav(currentView);
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  $("page-external").classList.add("active");
  setPageTitle(panel.titulo, cfgValue("external_default_title"));
  $("externalTitle").textContent = panel.titulo;
  $("externalOpen").href = safeUrl(panel.url) || "#";
  const mount = $("externalMount");
  if (mount.classList.contains("external-placeholder")) {
    mount.className = "";
    mount.innerHTML = "";
  }
  document
    .querySelectorAll(".external-panel")
    .forEach((el) => (el.hidden = true));
  let holder = document.getElementById("external-panel-" + code);
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "external-panel-" + code;
    holder.className = "external-panel";
    mount.appendChild(holder);
    buildExternalPanel(holder, panel);
  }
  holder.hidden = false;
}

function buildExternalPanel(holder, panel) {
  if (panel.em_manutencao) {
    holder.innerHTML = `<div class="external-placeholder"><div><div style="font-size:58px;color:#555"><i class="fa-solid fa-screwdriver-wrench"></i></div><h2>${esc(cfgValue("maintenance_title"))}</h2><p>${esc(cfgValue("maintenance_message"))}</p></div></div>`;
    return;
  }
  const safePanelUrl = safeUrl(panel.url);
  if (!safePanelUrl) {
    holder.innerHTML = `<div class="external-placeholder"><div><h2>${esc(panel.titulo)}</h2><p>Cadastre uma URL http(s) válida deste painel em paineis_externos.</p></div></div>`;
    return;
  }

  holder.innerHTML = `<iframe class="external-frame" src="${attr(safePanelUrl)}" loading="eager" referrerpolicy="no-referrer-when-downgrade" allow="fullscreen *; clipboard-read *; clipboard-write *; encrypted-media *; geolocation *; display-capture *" allowfullscreen="true"></iframe>`;
}

function reloadExternal() {
  if (!currentPanel) return;
  const holder = document.getElementById(
    "external-panel-" + currentPanel.codigo,
  );
  if (holder) holder.remove();
  openPanel(currentPanel.codigo);
}

function renderConfigForm() {
  $("cfgMonitId").value = cfgValue("monit_id");
  $("cfgTitle").value = cfgValue("app_title");
  $("cfgSubtitle") && ($("cfgSubtitle").value = cfgValue("app_subtitle"));
  $("cfgSlogan").value = cfgValue("app_slogan");
  $("cfgPageTitle") && ($("cfgPageTitle").value = cfgValue("page_title"));
  $("cfgPageSubtitle") &&
    ($("cfgPageSubtitle").value = cfgValue("page_subtitle"));
  $("cfgLoginEyebrow") &&
    ($("cfgLoginEyebrow").value = cfgValue("login_eyebrow"));
  $("cfgLoginEmailLabel") &&
    ($("cfgLoginEmailLabel").value = cfgValue("login_email_label"));
  $("cfgLoginEmailPlaceholder") &&
    ($("cfgLoginEmailPlaceholder").value = cfgValue("login_email_placeholder"));
  $("cfgLoginPasswordLabel") &&
    ($("cfgLoginPasswordLabel").value = cfgValue("login_password_label"));
  $("cfgLoginPasswordPlaceholder") &&
    ($("cfgLoginPasswordPlaceholder").value = cfgValue(
      "login_password_placeholder",
    ));
  $("cfgLoginButtonText") &&
    ($("cfgLoginButtonText").value = cfgValue("login_button_text"));
  $("cfgPasswordResetMessage") &&
    ($("cfgPasswordResetMessage").value = passwordResetMessage());
  $("cfgGoogleEnabled") &&
    ($("cfgGoogleEnabled").value = String(
      cfgBool("auth_google_enabled", true),
    ));
  $("cfgGoogleButtonText") &&
    ($("cfgGoogleButtonText").value = cfgValue("auth_google_button_text"));
  $("cfgGoogleDomainHint") &&
    ($("cfgGoogleDomainHint").value = cfgValue("auth_google_domain_hint"));
  $("cfgGoogleAllowedDomains") &&
    ($("cfgGoogleAllowedDomains").value = normalizeAllowedDomains(
      cfgValue("auth_google_allowed_domains"),
    ).join(","));
  $("cfgAccessBackgroundUrl") &&
    ($("cfgAccessBackgroundUrl").value = normalizeAccessBackgroundUrl(
      cfgValue("auth_access_background_url"),
    ));
  $("cfgAccessBackgroundPath") &&
    ($("cfgAccessBackgroundPath").value = cfgValue(
      "auth_access_background_path",
    ));
  $("cfgAccessLogoUrl") &&
    ($("cfgAccessLogoUrl").value = normalizeAccessLogoUrl(
      cfgValue("auth_access_logo_url"),
    ));
  $("cfgAccessPanelColor") &&
    ($("cfgAccessPanelColor").value = normalizeAccessPanelColor(
      cfgValue("auth_access_panel_color"),
    ));
  if ($("cfgAccessTextoModo")) {
    $("cfgAccessTextoModo").value = normalizarModo(
      cfgValue("auth_access_texto_modo"),
    );
    // O aviso de contraste tem de refletir o modo carregado, não só a cor.
    $("cfgAccessPanelColor")?.dispatchEvent(new Event("input"));
  }
  $("cfgAccessGreeting") &&
    ($("cfgAccessGreeting").value =
      cfgValue("auth_access_greeting") || DEFAULT_ACCESS_BRANDING.greeting);
  $("cfgAccessInstruction") &&
    ($("cfgAccessInstruction").value =
      cfgValue("auth_access_instruction") ||
      DEFAULT_ACCESS_BRANDING.instruction);
  $("cfgFilterTitle") && ($("cfgFilterTitle").value = cfgValue("filter_title"));
  $("cfgFilterSubtitle") &&
    ($("cfgFilterSubtitle").value = cfgValue("filter_subtitle"));
  $("cfgFilterToggleShow") &&
    ($("cfgFilterToggleShow").value = cfgValue("filter_toggle_show"));
  $("cfgFilterToggleHide") &&
    ($("cfgFilterToggleHide").value = cfgValue("filter_toggle_hide"));
  $("cfgKpiProcessos") &&
    ($("cfgKpiProcessos").value = cfgValue("kpi_processos_label"));
  $("cfgKpiVagas") && ($("cfgKpiVagas").value = cfgValue("kpi_vagas_label"));
  $("cfgKpiContratados") &&
    ($("cfgKpiContratados").value = cfgValue("kpi_contratados_label"));
  $("cfgKpiOciosas") &&
    ($("cfgKpiOciosas").value = cfgValue("kpi_ociosas_label"));
  $("cfgKpiCriticos") &&
    ($("cfgKpiCriticos").value = cfgValue("kpi_criticos_label"));
  $("cfgKpiInscritos") &&
    ($("cfgKpiInscritos").value = cfgValue("kpi_inscritos_label"));
  $("cfgFooter").value = cfgValue("footer_text");
  $("cfgLoginLogo").value = cfgValue("login_logo_url");
  $("cfgLoginBg").value = cfgValue("login_bg_url");
  $("cfgCogipNome") && ($("cfgCogipNome").value = cfgValue("cogip_nome"));
  $("cfgCogipFuncao") && ($("cfgCogipFuncao").value = cfgValue("cogip_funcao"));
  $("cfgCogipVersao") && ($("cfgCogipVersao").value = cfgValue("cogip_versao"));
  $("cfgCogipDept") && ($("cfgCogipDept").value = cfgValue("cogip_dept"));
  $("cfgAppVersionCurrent") && ($("cfgAppVersionCurrent").value = appVersion());
  $("cfgCogipLogo") && ($("cfgCogipLogo").value = cfgValue("cogip_logo_url"));
  $("cfgBroadcastType").value = cfgValue("broadcast_type") || "info";
  $("cfgBroadcastMsg").value = cfgValue("broadcast_msg");
  $("cfgRealtimeEnabled") &&
    ($("cfgRealtimeEnabled").value = String(
      cfgBool("feature_realtime_monitoramento", true),
    ));
  $("cfgAccessHeartbeatMinutos") &&
    ($("cfgAccessHeartbeatMinutos").value = String(
      Math.max(
        1,
        cfgInt("access_heartbeat_minutos", DEFAULT_ACCESS_HEARTBEAT_MINUTES),
      ),
    ));
  previewImg("cfgLoginLogo", "prevLoginLogo");
  previewImg("cfgLoginBg", "prevLoginBg");
  if ($("cfgCogipLogo")) previewImg("cfgCogipLogo", "prevCogipLogo");
  renderAccessBackgroundPreview();
  void loadAccessBackgroundGallery();
  renderAccessRequestsAdmin();
  renderAccessDashboard(null);
  renderPanelAdmin();
}

function renderAccessBackgroundPreview(
  url = $("cfgAccessBackgroundUrl")?.value,
) {
  const preview = $("cfgAccessBackgroundPreview");
  if (!preview) return;
  const safeUrl = normalizeAccessBackgroundUrl(url || "");
  preview.style.backgroundImage = `url("${safeUrl.replace(/["\\]/g, "")}")`;
  preview.setAttribute(
    "aria-label",
    "Prévia da arte configurada na tela de acesso",
  );
}

async function persistAccessBackground(url, path) {
  const { data, error } = await sb.rpc("definir_fundo_acesso_monitora", {
    p_url: url || null,
    p_caminho: path || null,
  });
  if (error) throw error;
  appConfig.auth_access_background_url =
    data?.url || DEFAULT_ACCESS_BRANDING.backgroundUrl;
  appConfig.auth_access_background_path = data?.caminho || "";
  loadedConfigKeys.add("auth_access_background_url");
  loadedConfigKeys.add("auth_access_background_path");
  if ($("cfgAccessBackgroundUrl"))
    $("cfgAccessBackgroundUrl").value = appConfig.auth_access_background_url;
  if ($("cfgAccessBackgroundPath"))
    $("cfgAccessBackgroundPath").value = appConfig.auth_access_background_path;
  applyConfigToUi();
  renderAccessBackgroundPreview();
}

async function uploadAccessBackground(file) {
  if (!can("config"))
    return toast("Sem permissão para alterar a arte de acesso.", "warn");
  const validationError = validateAccessBackgroundFile(file);
  if (validationError) return toast(validationError, "warn");
  const input = $("cfgAccessBackgroundFile");
  if (input) input.disabled = true;
  loader(true, "Enviando arte", "Guardando a imagem institucional...", 45);
  const path = createAccessBackgroundPath(file);
  try {
    const { error: uploadError } = await sb.storage
      .from(ACCESS_BACKGROUND_BUCKET)
      .upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = sb.storage
      .from(ACCESS_BACKGROUND_BUCKET)
      .getPublicUrl(path);
    try {
      await persistAccessBackground(publicUrl.publicUrl, path);
    } catch (saveError) {
      await sb.storage.from(ACCESS_BACKGROUND_BUCKET).remove([path]);
      throw saveError;
    }
    await loadAccessBackgroundGallery();
    toast("Imagem guardada e aplicada à tela de acesso.");
  } catch (error) {
    toast(
      "Não foi possível guardar a imagem: " + friendlyError(error),
      "error",
    );
  } finally {
    if (input) input.disabled = false;
    loader(false);
  }
}

async function restoreAccessBackground() {
  if (!can("config"))
    return toast("Sem permissão para alterar a arte de acesso.", "warn");
  loader(true, "Restaurando arte", "Aplicando o fundo institucional...", 60);
  try {
    await persistAccessBackground(null, null);
    await loadAccessBackgroundGallery();
    toast("Arte institucional padrão restaurada.");
  } catch (error) {
    toast(
      "Não foi possível restaurar a arte: " + friendlyError(error),
      "error",
    );
  } finally {
    loader(false);
  }
}

async function useStoredAccessBackground(path, url) {
  if (!can("config")) return;
  loader(true, "Aplicando arte", "Atualizando a tela de acesso...", 60);
  try {
    await persistAccessBackground(url, path);
    await loadAccessBackgroundGallery();
    toast("Arte aplicada à tela de acesso.");
  } catch (error) {
    toast("Não foi possível aplicar a arte: " + friendlyError(error), "error");
  } finally {
    loader(false);
  }
}

/*
  Apaga uma arte guardada. Só as que não estão em uso chegam aqui — a galeria não
  oferece o botão para a ativa, e esta função recusa por garantia, para o caso de
  a interface e o estado divergirem por um instante.
*/
async function deleteStoredAccessBackground(path, nome) {
  if (!can("config"))
    return toast("Sem permissão para alterar a arte de acesso.", "warn");

  const emUso = txt(cfgValue("auth_access_background_path"));
  if (emUso && emUso === path) {
    return toast(
      "Esta arte está em uso. Escolha outra ou restaure o padrão antes de apagar.",
      "warn",
    );
  }

  if (
    !window.confirm(
      `Apagar definitivamente a arte "${nome}"? Esta ação não pode ser desfeita.`,
    )
  )
    return;

  loader(true, "Apagando arte", "Removendo a imagem do armazenamento...", 60);
  try {
    const { error } = await sb.storage
      .from(ACCESS_BACKGROUND_BUCKET)
      .remove([path]);
    if (error) throw error;
    await loadAccessBackgroundGallery();
    toast("Arte apagada.");
  } catch (error) {
    toast("Não foi possível apagar a arte: " + friendlyError(error), "error");
  } finally {
    loader(false);
  }
}

async function loadAccessBackgroundGallery() {
  const gallery = $("cfgAccessBackgroundGallery");
  if (!gallery || !sb || !currentUser || !can("config")) return;
  const { data, error } = await sb.storage
    .from(ACCESS_BACKGROUND_BUCKET)
    .list(ACCESS_BACKGROUND_FOLDER, {
      limit: 60,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (error) {
    gallery.replaceChildren();
    return;
  }
  const currentPath = cfgValue("auth_access_background_path");
  const items = (data || []).filter((item) =>
    /\.(?:jpe?g|png|webp)$/i.test(item.name || ""),
  );
  gallery.replaceChildren();
  if (!items.length) return;
  const heading = document.createElement("p");
  heading.className = "access-background-gallery-title";
  heading.textContent = "Artes enviadas";
  gallery.appendChild(heading);
  const list = document.createElement("div");
  list.className = "access-background-gallery-grid";
  items.forEach((item) => {
    const path = `${ACCESS_BACKGROUND_FOLDER}/${item.name}`;
    const url = sb.storage.from(ACCESS_BACKGROUND_BUCKET).getPublicUrl(path)
      .data.publicUrl;
    const emUso = path === currentPath;

    const cartao = document.createElement("div");
    cartao.className = `access-background-gallery-card${emUso ? " is-active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `access-background-gallery-item${emUso ? " is-active" : ""}`;
    button.setAttribute(
      "aria-label",
      emUso ? "Arte atualmente em uso" : "Usar esta arte",
    );
    const image = document.createElement("span");
    image.style.backgroundImage = `url("${url.replace(/["\\]/g, "")}")`;
    const label = document.createElement("small");
    label.textContent = emUso ? "Em uso" : "Usar";
    button.append(image, label);
    if (!emUso)
      button.addEventListener(
        "click",
        () => void useStoredAccessBackground(path, url),
      );
    cartao.appendChild(button);

    /*
      A arte em uso não ganha botão de apagar. Apagá-la deixaria
      `auth_access_background_url` a apontar para um objeto inexistente — e o
      cache de marca, guardado no navegador de cada pessoa, continuaria a pedir
      essa imagem por tempo indeterminado. Para remover a atual, troca-se por
      outra ou restaura-se o padrão primeiro.
    */
    if (emUso) {
      const aviso = document.createElement("small");
      aviso.className = "access-background-gallery-hint";
      aviso.textContent =
        "Para apagar, escolha outra arte ou restaure o padrão.";
      cartao.appendChild(aviso);
    } else {
      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.className = "access-background-gallery-delete";
      apagar.textContent = "Apagar";
      apagar.setAttribute("aria-label", `Apagar a arte ${item.name}`);
      apagar.addEventListener(
        "click",
        () => void deleteStoredAccessBackground(path, item.name),
      );
      cartao.appendChild(apagar);
    }

    list.appendChild(cartao);
  });
  gallery.appendChild(list);
}

function renderPanelAdmin() {
  const box = $("panelAdmin");
  if (!box) return;
  box.innerHTML = renderPanelAdminHTML(panels);
}

async function loadAccessManagement() {
  return renderAccessRequestsAdmin();
}

async function renderAccessRequestsAdmin() {
  const card = $("accessRequestsAdminCard");
  const box = $("accessRequestsAdmin");
  if (!card || !box) return;
  const allowed = isMasterProfile();
  card.classList.toggle("hidden", !allowed);
  if (!allowed) return;
  box.innerHTML = `<div class="access-status">Carregando acessos...</div>`;
  const [requestsResponse, profilesResponse] = await Promise.all([
    sb
      .from("solicitacoes_acesso")
      .select(
        "id,user_id,email,nome,setor,justificativa,perfil_solicitado,status,observacao_admin,created_at",
      )
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(50),
    sb
      .from("perfis_usuarios")
      .select(
        "id,user_id,email,nome,perfil,ativo,updated_at",
      )
      .eq("ativo", true)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);
  if (requestsResponse.error || profilesResponse.error) {
    box.innerHTML = `<div class="alert error">Erro ao carregar acessos: ${esc(friendlyError(requestsResponse.error || profilesResponse.error))}</div>`;
    return;
  }
  accessRequests = Array.isArray(requestsResponse.data)
    ? requestsResponse.data
    : [];
  accessProfiles = Array.isArray(profilesResponse.data)
    ? profilesResponse.data
    : [];
  const pendingHTML = accessRequests.length
    ? accessRequests.map(renderAccessRequestAdminItem).join("")
    : `<div class="access-status">Nenhuma solicitação pendente.</div>`;
  const usersHTML = accessProfiles.length
    ? accessProfiles.map(renderAccessUserAdminItem).join("")
    : `<div class="access-status">Nenhum usuário ativo encontrado.</div>`;

  box.innerHTML = `
      <div class="access-admin-section">
        <div class="section-title-row">
          <div>
            <h4>Solicitações pendentes</h4>
            <p>Aprove ou recuse novos pedidos. Solicitações já avaliadas ficam no histórico do banco.</p>
          </div>
          <span class="chip blue">${fmt(accessRequests.length)}</span>
        </div>
        ${pendingHTML}
      </div>
      <div class="access-admin-section">
        <div class="section-title-row">
          <div>
            <h4>Usuários ativos</h4>
            <p>Ajuste o perfil ou desative o acesso sem apagar o histórico.</p>
          </div>
          <span class="chip green">${fmt(accessProfiles.length)}</span>
        </div>
        ${usersHTML}
      </div>
    `;
}

function renderAccessRequestAdminItem(req) {
  return renderAccessRequestAdminItemHTML(req);
}

function renderAccessUserAdminItem(user) {
  return renderAccessUserAdminItemHTML(user, { currentUser });
}

function accessRequestById(id) {
  return accessRequests.find((r) => String(r.id) === String(id));
}



async function updateUserAccess(id) {
  const user = accessProfiles.find((r) => String(r.id) === String(id));
  if (!user) return toast("Usuário não encontrado.", "warn");
  if (isOwnAccessProfile(currentUser, user))
    return toast("Sua própria permissão deve ser alterada por outro administrador.", "warn");
  const perfil = txt($("userPerfil" + id)?.value) || "usuario";
  const label = user.email || user.nome || "este usuário";
  if (!window.confirm(`Salvar alterações de acesso para ${label}?`)) return;
  const motivo = window.prompt("Motivo da alteração (opcional):", "") || "";
  loader(
    true,
    "Salvando acesso",
    "Atualizando o perfil de acesso...",
    55,
  );
  const { error } = await sb.rpc(RPC_UPDATE_USER_ACCESS, {
    p_perfil_usuario_id: id,
    p_perfil: perfil,
    p_permissoes: {},
    p_paineis: [],
    p_motivo: motivo,
  });
  loader(false);
  if (error)
    return toast("Erro ao salvar acesso: " + friendlyError(error), "error");
  toast("Acesso atualizado. Oriente o usuário a sair e entrar novamente.");
  await renderAccessRequestsAdmin();
}

async function approveAccessRequest(id) {
  const req = accessRequestById(id);
  if (!req) return toast("Solicitação não encontrada.", "warn");
  const perfil = txt($("accessPerfil" + id)?.value) || "usuario";
  loader(
    true,
    "Aprovando acesso",
    "Salvando o perfil de acesso...",
    55,
  );
  const { error: reqErr } = await sb.rpc(RPC_APPROVE_ACCESS_REQUEST, {
    p_solicitacao_id: id,
    p_perfil: perfil,
    p_permissoes: {},
    p_paineis: [],
    p_observacao_admin: txt($("accessObs" + id)?.value),
  });
  loader(false);
  if (reqErr)
    return toast("Erro ao aprovar acesso: " + friendlyError(reqErr), "error");
  toast("Acesso aprovado. Oriente o usuário a sair e entrar novamente.");
  await renderAccessRequestsAdmin();
}


async function deactivateUserAccess(id) {
  const user = accessProfiles.find((r) => String(r.id) === String(id));
  if (!user) return toast("Usuário não encontrado.", "warn");
  if (isOwnAccessProfile(currentUser, user))
    return toast("Você não pode desativar o próprio acesso.", "warn");
  const label = user.email || "este usuário";
  if (
    !window.confirm(`Desativar o acesso de ${label}? O histórico será mantido.`)
  )
    return;
  const motivo = window.prompt("Motivo da desativação (opcional):", "") || "";
  loader(true, "Desativando acesso", "Removendo permissões do usuário...", 45);
  const { error } = await sb.rpc(RPC_DEACTIVATE_USER_ACCESS, {
    p_perfil_usuario_id: id,
    p_motivo: motivo,
  });
  loader(false);
  if (error)
    return toast("Erro ao desativar acesso: " + friendlyError(error), "error");
  toast("Acesso desativado.");
  await renderAccessRequestsAdmin();
}

async function denyAccessRequest(id) {
  const req = accessRequestById(id);
  if (!req) return toast("Solicitação não encontrada.", "warn");
  /*
    Recusar passou a ser RPC, como aprovar, atualizar e desativar já eram. Antes,
    esta era a única decisão de acesso que o navegador gravava direto na tabela —
    escolhendo `status`, `avaliado_por` e `avaliado_em` por conta própria. A
    autorização da mesma decisão vivia, portanto, em dois lugares.
  */
  const { error } = await sb.rpc(RPC_DENY_ACCESS_REQUEST, {
    p_solicitacao_id: id,
    p_observacao_admin: txt($("accessObs" + id)?.value),
  });
  if (error)
    return toast(
      "Erro ao recusar solicitação: " + friendlyError(error),
      "error",
    );
  toast("Solicitação recusada.");
  await renderAccessRequestsAdmin();
}

async function saveAdminSettings() {
  if (!can("config"))
    return toast("Sem permissão para salvar configurações.", "warn");
  if (!configLoadOk)
    return toast(
      "As configurações não foram carregadas do Supabase. Recarregue antes de salvar para evitar sobrescrever valores bons.",
      "warn",
    );
  loader(true, "Configurações", "Salvando ajustes no Supabase...", 60);
  const configRows = [
    {
      chave: "monit_id",
      valor: txt($("cfgMonitId").value),
      descricao: "ID / referência da base",
    },
    {
      chave: "page_title",
      valor: txt($("cfgPageTitle")?.value || ""),
      descricao: "Título da página inicial",
    },
    {
      chave: "page_subtitle",
      valor: txt($("cfgPageSubtitle")?.value || ""),
      descricao: "Subtítulo da página inicial",
    },
    {
      chave: "auth_google_enabled",
      valor: txt($("cfgGoogleEnabled")?.value || "true"),
      descricao: "Exibe ou oculta o login com Google",
    },
    {
      chave: "auth_google_button_text",
      valor: txt($("cfgGoogleButtonText")?.value || ""),
      descricao: "Texto do botão de autenticação Google",
    },
    {
      chave: "auth_google_domain_hint",
      valor: txt($("cfgGoogleDomainHint")?.value || ""),
      descricao: "Domínio sugerido no login Google",
    },
    {
      chave: "auth_google_allowed_domains",
      valor: normalizeAllowedDomains(
        $("cfgGoogleAllowedDomains")?.value || "",
      ).join(","),
      descricao: "Domínios institucionais autorizados no login Google",
    },
    {
      chave: "auth_access_background_url",
      valor: normalizeAccessBackgroundUrl(
        $("cfgAccessBackgroundUrl")?.value || "",
      ),
      descricao: "Arte institucional da tela de acesso",
    },
    {
      chave: "auth_access_logo_url",
      valor: normalizeAccessLogoUrl($("cfgAccessLogoUrl")?.value || ""),
      descricao: "Logo da AgSUS na tela de acesso",
    },
    {
      chave: "auth_access_panel_color",
      valor: normalizeAccessPanelColor($("cfgAccessPanelColor")?.value || ""),
      descricao: "Cor do painel da tela de acesso",
    },
    {
      chave: "auth_access_texto_modo",
      valor: txt($("cfgAccessTextoModo")?.value || "auto"),
      descricao: "Texto sobre o painel de acesso: auto, claro ou escuro",
    },

    {
      chave: "auth_access_greeting",
      valor: txt(
        $("cfgAccessGreeting")?.value || DEFAULT_ACCESS_BRANDING.greeting,
      ),
      descricao: "Saudação da tela de acesso",
    },
    {
      chave: "auth_access_instruction",
      valor: txt(
        $("cfgAccessInstruction")?.value || DEFAULT_ACCESS_BRANDING.instruction,
      ),
      descricao: "Instrução da tela de acesso",
    },
    {
      chave: "filter_title",
      valor: txt($("cfgFilterTitle")?.value || ""),
      descricao: "Título dos filtros",
    },
    {
      chave: "filter_subtitle",
      valor: txt($("cfgFilterSubtitle")?.value || ""),
      descricao: "Subtítulo dos filtros",
    },
    {
      chave: "filter_toggle_show",
      valor: txt($("cfgFilterToggleShow")?.value || ""),
      descricao: "Texto para mostrar filtros",
    },
    {
      chave: "filter_toggle_hide",
      valor: txt($("cfgFilterToggleHide")?.value || ""),
      descricao: "Texto para ocultar filtros",
    },
    {
      chave: "kpi_processos_label",
      valor: txt($("cfgKpiProcessos")?.value || ""),
      descricao: "Rótulo do KPI processos",
    },
    {
      chave: "kpi_vagas_label",
      valor: txt($("cfgKpiVagas")?.value || ""),
      descricao: "Rótulo do KPI vagas",
    },
    {
      chave: "kpi_contratados_label",
      valor: txt($("cfgKpiContratados")?.value || ""),
      descricao: "Rótulo do KPI contratações",
    },
    {
      chave: "kpi_ociosas_label",
      valor: txt($("cfgKpiOciosas")?.value || ""),
      descricao: "Rótulo do KPI vagas ociosas",
    },
    {
      chave: "kpi_criticos_label",
      valor: txt($("cfgKpiCriticos")?.value || ""),
      descricao: "Rótulo do KPI críticos",
    },
    {
      chave: "kpi_inscritos_label",
      valor: txt($("cfgKpiInscritos")?.value || ""),
      descricao: "Rótulo do KPI inscritos",
    },
    {
      chave: "footer_text",
      valor: txt($("cfgFooter").value),
      descricao: "Texto do rodapé (fallback)",
    },
    {
      chave: "cogip_nome",
      valor: txt($("cfgCogipNome")?.value || ""),
      descricao: "Nome da equipe (COGIP)",
    },
    {
      chave: "cogip_funcao",
      valor: txt($("cfgCogipFuncao")?.value || ""),
      descricao: "Função / área da equipe",
    },
    {
      chave: "cogip_versao",
      valor: txt($("cfgCogipVersao")?.value || ""),
      descricao: "Versão do sistema",
    },
    {
      chave: "cogip_dept",
      valor: txt($("cfgCogipDept")?.value || ""),
      descricao: "Texto institucional",
    },
    {
      chave: "app_version_current",
      valor: txt($("cfgAppVersionCurrent")?.value || ""),
      descricao: "Versão corrente publicada",
    },
    {
      chave: "cogip_logo_url",
      valor: txt($("cfgCogipLogo")?.value || ""),
      descricao: "Logo da equipe",
    },
    {
      chave: "broadcast_type",
      valor: txt($("cfgBroadcastType").value),
      descricao: "Tipo do aviso global",
    },
    {
      chave: "broadcast_msg",
      valor: txt($("cfgBroadcastMsg").value),
      descricao: "Mensagem do aviso global",
    },
    {
      chave: "feature_realtime_monitoramento",
      valor: txt($("cfgRealtimeEnabled")?.value || "true"),
      descricao: "Habilita atualização em tempo real do monitoramento",
    },
    {
      chave: "access_heartbeat_minutos",
      valor: String(
        Math.max(
          1,
          n(
            $("cfgAccessHeartbeatMinutos")?.value ||
              DEFAULT_ACCESS_HEARTBEAT_MINUTES,
          ),
        ),
      ),
      descricao: "Intervalo de auditoria heartbeat, em minutos",
    },
  ];

  const panelRows = collectPanelRows(panels);

  /*
    As chaves da barra lateral viajam no mesmo `p_config_rows`. Uma chamada, uma
    transação: ou tudo é gravado, ou nada é — sem salvamento parcial e sem
    depender de deduzir sucesso pela mensagem que apareceu na tela.
  */
  const linhasDeConfiguracao = [
    ...configRows,
    ...linhasDeConfiguracaoDaSidebar(),
  ];

  const { error: cfgErr } = await sb.rpc(RPC_SAVE_CONFIG, {
    p_config_rows: linhasDeConfiguracao,
    p_paineis: panelRows,
  });
  if (cfgErr) {
    loader(false);
    return toast(
      "Erro ao salvar configurações: " + friendlyError(cfgErr),
      "error",
    );
  }

  await loadConfig();
  await loadPanels();
  reaplicarSidebarAposSalvar();
  if (currentUser?.id) {
    startAccessHeartbeat();
    startOnlinePresence();
    stopRealtime();
    startRealtime();
  }
  buildNav();
  loader(false);
  toast("Configurações salvas.");
}

function syncDisplayModeButtons() {
  const fullscreenActive =
    !!document.fullscreenElement ||
    document.body.classList.contains("app-fullscreen-fallback");
  const moreMenu = $("moreActionsMenu");
  if (moreMenu) {
    const fsBtn = moreMenu.querySelector("button:first-child i");
    if (fsBtn)
      fsBtn.className = fullscreenActive
        ? "fa-solid fa-compress"
        : "fa-solid fa-expand";
  }
}
function applyStoredDisplayModes() {
  syncDisplayModeButtons();
}

// Sai de um painel externo e volta para o sistema. Também encerra a tela cheia
// (nativa ou fallback) — atende "ao tirar a tela cheia, voltar para o sistema".
function exitExternalPanel() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      const p = document.exitFullscreen();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) {}
  if (document.body.classList.contains("app-fullscreen-fallback"))
    toggleAppFullscreenFallback(false);
  document.body.classList.remove("external-clean");
  document.body.classList.remove("external-panel-mode");
  currentPanel = null;
  navigate(systemHomeView());
}

function getFullscreenTarget() {
  if (currentView && currentView.startsWith("panel:") && currentPanel) {
    const holder = document.getElementById(
      "external-panel-" + currentPanel.codigo,
    );
    const frame = holder?.querySelector?.(".external-frame");
    if (frame) return frame;
  }
  return document.documentElement;
}

function toggleAppFullscreenFallback(force) {
  const active =
    typeof force === "boolean"
      ? force
      : !document.body.classList.contains("app-fullscreen-fallback");
  document.body.classList.toggle("app-fullscreen-fallback", active);
  document.body.classList.toggle(
    "system-fullscreen-mode",
    active || !!document.fullscreenElement,
  );
  syncDisplayModeButtons();
  if (currentView === "dashboard") scheduleMapResize(220);
  toast(active ? "Modo expandido ativado." : "Modo expandido desativado.");
}

function toggleBrowserFullscreen() {
  try {
    if (document.body.classList.contains("app-fullscreen-fallback")) {
      toggleAppFullscreenFallback(false);
      return;
    }
    if (document.fullscreenElement) {
      const exiting = document.exitFullscreen?.();
      if (exiting?.catch)
        exiting.catch(() => toggleAppFullscreenFallback(false));
      return;
    }
    const target = getFullscreenTarget();
    if (!document.fullscreenEnabled || !target?.requestFullscreen) {
      toggleAppFullscreenFallback(true);
      return;
    }
    const entering = target.requestFullscreen();
    if (entering?.catch)
      entering.catch(() => toggleAppFullscreenFallback(true));
  } catch (error) {
    toggleAppFullscreenFallback(true);
  }
}

document.addEventListener("fullscreenchange", () => {
  document.body.classList.toggle(
    "system-fullscreen-mode",
    !!document.fullscreenElement ||
      document.body.classList.contains("app-fullscreen-fallback"),
  );
  syncDisplayModeButtons();
  if (currentView === "dashboard") scheduleMapResize(220);
});

function exportCSV() {
  const source = filtered.length ? filtered : rows;
  const fieldMap = [
    { key: "unidade", label: "Unidade" },
    { key: "uf", label: "UF" },
    { key: "edital", label: "Edital" },
    { key: "processo", label: "Processo SEI" },
    { key: "ciclo", label: "Ciclo" },
    { key: "vagas_total", label: "Vagas Previstas" },
    { key: "contratados", label: "Contratados" },
    { key: "vagas_ociosas", label: "Vagas Ociosas" },
    { key: "inscritos", label: "Inscritos" },
    { key: "status", label: "Status" },
    { key: "etapa", label: "Etapa" },
    { key: "risco", label: "Risco" },
    { key: "data_inicio", label: "Data de Início" },
    { key: "data_fim", label: "Data de Encerramento" },
    { key: "responsavel", label: "Responsável" },
    { key: "observacoes", label: "Observações" },
    { key: "link_edital", label: "Link do Edital" },
  ];
  const clean = (v) =>
    `"${String(v ?? "")
      .replaceAll('"', '""')
      .replaceAll("\r", " ")
      .replaceAll("\n", " ")}"`;
  const headers = fieldMap.map((f) => `"${f.label}"`).join(";");
  const data = source
    .map((r) => fieldMap.map((f) => clean(r[f.key])).join(";"))
    .join("\r\n");
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const blob = new Blob(["\ufeff" + headers + "\n" + data], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `AgSUS_Monitora_SaudeIndigena_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Exporta relatório em PDF (via diálogo de impressão do navegador — funciona offline)
function exportPDF() {
  closeMoreActions && closeMoreActions();
  const now = new Date();
  const dataStr = now.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Resumo dos filtros ativos
  const ativos = [];
  if (typeof FILTER_CONFIG !== "undefined") {
    FILTER_CONFIG.forEach((cfg) => {
      const sel = Array.from(filterState[cfg.field] || []);
      if (sel.length)
        ativos.push(
          cfg.all.replace("Todas", "").replace("Todos", "").trim() +
            ": " +
            sel.join(", "),
        );
    });
  }
  const busca = ($("tableSearch")?.value || "").trim();
  if (busca) ativos.push("Busca: " + busca);
  const filtrosTxt = ativos.length
    ? ativos.join(" · ")
    : "Nenhum filtro aplicado (todos os processos)";
  // KPIs do conjunto filtrado
  const vagas = sum("vagas_total"),
    contrat = sum("contratados"),
    ociosas = sum("vagas_ociosas");
  const pctO = vagas > 0 ? Math.round((ociosas / vagas) * 100) : 0;
  // Cabeçalho de relatório (inserido só para a impressão)
  let head = document.getElementById("printReportHeader");
  if (head) head.remove();
  head = document.createElement("div");
  head.id = "printReportHeader";
  head.className = "print-only";
  head.innerHTML = `<div style="padding:0 0 12px;border-bottom:2px solid #003b70;margin-bottom:14px;">
      <div style="font-size:20px;font-weight:700;color:#003b70;">AgSUS Monitora — Saúde Indígena</div>
      <div style="font-size:12px;color:#444;margin-top:2px;">Relatório de processos seletivos · gerado em ${dataStr}</div>
      <div style="font-size:11px;color:#555;margin-top:6px;"><b>Filtros:</b> ${esc(filtrosTxt)}</div>
      <div style="font-size:12px;color:#222;margin-top:8px;display:flex;gap:18px;flex-wrap:wrap;">
        <span><b>${fmt(filtered.length)}</b> processos</span>
        <span><b>${fmt(vagas)}</b> vagas previstas</span>
        <span><b>${fmt(contrat)}</b> contratações</span>
        <span style="color:#a3322b;"><b>${fmt(ociosas)}</b> ociosas (${pctO}%)</span>
      </div>
    </div>`;
  const content = document.querySelector(".content") || document.body;
  content.insertBefore(head, content.firstChild);
  const cleanup = () => {
    const h = document.getElementById("printReportHeader");
    if (h) h.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1500);
  }, 120);
  toast(
    'Gerando relatório PDF… escolha "Salvar como PDF" na janela de impressão.',
  );
}

/*
  Traduz o erro numa frase útil — e, acima de tudo, não inventa expiração.

  A linha `msg.includes("JWT") || msg.includes("session")` era a maior fonte de
  "Sessão expirada" falsa do sistema. Qualquer resposta que contivesse essas
  letras mandava a pessoa entrar de novo — inclusive
  `Could not find the function public.registrar_evento_acesso(p_client_session_id, …)`,
  que é função ausente no banco e não tem nada a ver com a sessão de quem está
  usando o sistema.

  A classificação agora vem do objeto de erro — código, status, tipo — e não do
  texto. Ver `lib/sessao.js`. As regras por mensagem que sobraram tratam de
  erros que as nossas próprias RPCs emitem com texto que nós mesmos escrevemos.
*/
function friendlyError(error) {
  const msg = error?.message || String(error || "Erro desconhecido");

  if (error?.sessaoEncerrada || ehSessaoEncerrada(error))
    return "Sessão expirada. Faça login novamente.";
  if (error?.falhaTransitoria || ehFalhaTransitoria(error))
    return "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

  if (msg.includes("vagas_ociosas"))
    return "Campo calculado protegido pelo banco. Atualize a página e tente novamente.";
  if (msg.includes(RPC_SAVE_MONITORAMENTO) || msg.includes(RPC_SAVE_CONFIG))
    return "As funções RPC necessárias ainda não estão disponíveis. Aplique o script SQL institucional no Supabase.";
  if (msg.includes("Sem permissão para salvar monitoramento indígena"))
    return "Seu usuário não tem permissão para salvar registros da Equipe Núcleo.";
  if (msg.includes("Sem permissão para salvar configurações"))
    return "Seu usuário não tem permissão para alterar configurações do sistema.";
  if (
    msg.includes("permission denied") ||
    msg.includes("violates row-level security")
  )
    return "Permissão insuficiente para esta ação. Verifique o perfil do usuário e as políticas RLS.";
  // PGRST202: função ausente no schema. Não é permissão nem sessão.
  if (error?.code === "PGRST202")
    return "Esta operação depende de uma função que ainda não está publicada no banco. Avise a equipe técnica.";
  return msg;
}

// ── Dark mode ───────────────────────────────────────────────────────────
function applyDarkMode(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "");
  const thumb = $("darkModeThumb");
  const track = $("darkModeToggle");
  if (thumb)
    thumb.style.transform = dark ? "translateX(18px)" : "translateX(0)";
  if (track) track.style.background = dark ? "#00a8d6" : "#334e6a";
}
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = !isDark;
  try {
    localStorage.setItem("agsus_dark_mode_v1", next ? "1" : "0");
  } catch (e) {}
  applyDarkMode(next);
  // re-renderiza o mapa para adaptar ao fundo
  setTimeout(() => {
    if (currentView === "dashboard") scheduleMapResize(80);
  }, 200);
}
function loadDarkModePreference() {
  try {
    const saved = localStorage.getItem("agsus_dark_mode_v1");
    if (saved === "1") {
      applyDarkMode(true);
      return;
    }
    if (saved === "0") {
      applyDarkMode(false);
      return;
    }
    // Sem preferência salva: não aplicar dark mode automaticamente
    // para não afetar a tela de login no primeiro acesso
    applyDarkMode(false);
  } catch (e) {
    applyDarkMode(false);
  }
}

// ── Busca global Ctrl+K ─────────────────────────────────────────────────
let searchIdx = -1;

function openSearchModal() {
  $("searchModal").classList.add("show");
  setTimeout(() => {
    $("searchModalInput").focus();
    $("searchModalInput").value = "";
    runGlobalSearch("");
  }, 50);
  document.body.style.overflow = "hidden";
}
function closeSearchModal() {
  $("searchModal").classList.remove("show");
  document.body.style.overflow = "";
  searchIdx = -1;
}
function runGlobalSearch(q) {
  searchIdx = -1;
  const el = $("searchResults");
  if (!el) return;
  if (!q.trim()) {
    el.innerHTML = `<div style="padding:18px;text-align:center;color:#9fb3c8;font-size:13px;font-weight:700;">Digite para buscar em todos os processos seletivos</div>`;
    return;
  }
  const ql = low(q);
  const results = rows
    .filter((r) =>
      [
        r.edital,
        r.unidade,
        r.etapa,
        r.status,
        r.uf,
        r.risco,
        r.ciclo,
        r.responsavel,
        r.observacoes,
      ]
        .map(low)
        .join(" ")
        .includes(ql),
    )
    .slice(0, 12);
  if (!results.length) {
    el.innerHTML = `<div style="padding:18px;text-align:center;color:#9fb3c8;font-size:13px;font-weight:700;">Nenhum resultado encontrado</div>`;
    return;
  }
  el.innerHTML = results
    .map((r, i) => {
      const risco = low(r.risco);
      const riscoColor =
        risco === "alto"
          ? "#d92d3a"
          : risco === "médio" || risco === "medio"
            ? "#f2b705"
            : "#0b8f58";
      const riscoText =
        risco === "alto"
          ? "Alto"
          : risco === "médio" || risco === "medio"
            ? "Médio"
            : "Baixo";
      return `<div class="search-result-item" data-idx="${i}" data-id="${attr(r.id)}" onclick="selectSearchResult('${attr(r.id)}')" onmouseenter="searchIdx=${i};highlightSearchItems()">
        <div class="search-result-icon" style="background:#f0f7ff"><i class="fa-solid fa-folder-open" style="color:#0075c9"></i></div>
        <div class="search-result-body">
          <div class="search-result-title">${esc(r.edital || "-")} — ${esc(r.unidade)}</div>
          <div class="search-result-sub">${esc(r.etapa || "")}${r.uf ? " · " + r.uf : ""}</div>
        </div>
        <span class="search-result-chip" style="background:${riscoColor}1a;color:${riscoColor};border:1px solid ${riscoColor}40">${riscoText}</span>
      </div>`;
    })
    .join("");
}
function highlightSearchItems() {
  document
    .querySelectorAll(".search-result-item")
    .forEach((el, i) => el.classList.toggle("active", i === searchIdx));
}
function searchModalKey(e) {
  const items = [...document.querySelectorAll(".search-result-item")];
  if (e.key === "Escape") {
    closeSearchModal();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    searchIdx = Math.min(searchIdx + 1, items.length - 1);
    highlightSearchItems();
    items[searchIdx]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    searchIdx = Math.max(searchIdx - 1, 0);
    highlightSearchItems();
    items[searchIdx]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (e.key === "Enter" && searchIdx >= 0) {
    const item = items[searchIdx];
    if (item) selectSearchResult(item.dataset.id);
  }
}
function selectSearchResult(id) {
  closeSearchModal();
  const r = rows.find((x) => String(x.id) === String(id));
  if (!r) return;

  if (!can("ind")) {
    toast(
      "Busca localizada, mas seu perfil não tem acesso ao dashboard de Saúde Indígena.",
      "warn",
    );
    return;
  }

  // Garante que o item escolhido fique visível, mesmo se havia filtros/busca ativos.
  FILTER_CONFIG.forEach((cfg) => {
    filterState[cfg.field] = new Set();
  });
  if ($("tableSearch")) $("tableSearch").value = "";
  if (r.unidade) filterState.unidade = new Set([txt(r.unidade)]);
  if (r.edital) filterState.edital = new Set([txt(r.edital)]);

  navigate("dashboard");
  applyFilters();

  setTimeout(() => {
    const rows2 = document.querySelectorAll("#monitorRows tr");
    rows2.forEach((tr) => {
      if (
        tr.textContent.includes(r.edital || "") &&
        tr.textContent.includes(r.unidade || "")
      ) {
        tr.scrollIntoView({ behavior: "smooth", block: "center" });
        tr.style.outline = "2px solid var(--agsus-ciano)";
        tr.style.borderRadius = "8px";
        setTimeout(() => {
          tr.style.outline = "";
          tr.style.borderRadius = "";
        }, 2500);
      }
    });
  }, 400);
}

// ── Realtime Supabase ───────────────────────────────────────────────────
let realtimeChannel = null;
let realtimeEnabled = false;
function startRealtime() {
  if (!sb || !currentUser) return;
  if (!cfgBool("feature_realtime_monitoramento", true)) return;
  if (realtimeChannel) return;
  try {
    realtimeChannel = sb
      .channel("monitoramento_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitoramento_indigena" },
        () => {
          // Debounce: evita múltiplas chamadas em rajada
          clearTimeout(window.__realtimeDebounce);
          window.__realtimeDebounce = setTimeout(async () => {
            await loadData({ showLoader: false });
            toast("Dashboard atualizado automaticamente.", "ok");
          }, 800);
        },
      )
      .subscribe((status) => {
        realtimeEnabled = status === "SUBSCRIBED";
      });
  } catch (e) {
    console.warn("Realtime não disponível:", e);
    realtimeChannel = null;
  }
}
function stopRealtime() {
  clearTimeout(window.__realtimeDebounce);
  if (realtimeChannel && sb) {
    try {
      sb.removeChannel(realtimeChannel);
    } catch (e) {}
    realtimeChannel = null;
    realtimeEnabled = false;
  }
}

window.addEventListener("agsus:background-suspend", () => {
  stopAccessHeartbeat();
  stopRealtime();
  stopAccessDashboardRefresh();
});
window.addEventListener("agsus:background-resume", () => {
  if (!currentUser?.id) return;
  startAccessHeartbeat();
  startOnlinePresence();
  startRealtime();
  if (currentView === "acessos") startAccessDashboardRefresh();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser?.id)
    void syncOnlinePresence();
});

window.addEventListener("resize", () => {
  clearTimeout(window.__responsiveResize);
  window.__responsiveResize = setTimeout(() => {
    enforceResponsiveSidebar();
    if (currentView === "dashboard") scheduleMapResize(80);
  }, 220);
});
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    enforceResponsiveSidebar();
    if (currentView === "dashboard") scheduleMapResize(80);
  }, 300);
});

// Indicador de conexão (offline)
function updateOnlineStatus() {
  const bar = $("offlineBar");
  if (!bar) return;
  const off = typeof navigator !== "undefined" && navigator.onLine === false;
  bar.style.display = off ? "block" : "none";
  document.body.style.paddingTop = off ? "32px" : "";
}
window.addEventListener("online", () => {
  updateOnlineStatus();
  toast("Conexão restabelecida.");
});
window.addEventListener("offline", () => {
  updateOnlineStatus();
  toast("Você está offline. Os dados continuam visíveis.");
});
updateOnlineStatus();

// Ctrl+K / Cmd+K abre busca global
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    if ($("searchModal").classList.contains("show")) closeSearchModal();
    else if (currentUser) openSearchModal();
  }
  if (e.key === "Escape" && $("searchModal").classList.contains("show"))
    closeSearchModal();
});
// Fechar modal de busca ao clicar fora
$("searchModal")?.addEventListener("click", (e) => {
  if (e.target === $("searchModal")) closeSearchModal();
});

// Esc fecha o modal de edição; clique no backdrop também fecha.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if ($("editModal")?.classList.contains("show")) closeEditModal();
});
$("editModal")?.addEventListener("click", (e) => {
  if (e.target === $("editModal")) closeEditModal();
});

loadDarkModePreference();
enforceResponsiveSidebar();
initFilterControls();
Object.defineProperty(window, "searchIdx", {
  configurable: true,
  get() {
    return searchIdx;
  },
  set(value) {
    searchIdx = Number(value) || 0;
  },
});
Object.assign(window, {
  $,
  getMonitoraProfile: () => profile,
  monitoraToast: toast,
  monitoraLoader: loader,
  aplicarCnesCoords,
  approveAccessRequest,
  clearFilters,
  clearFilterField,
  clearSearchPill,
  closeEditModal,
  closeMoreActions,
  closeSearchModal,
  debouncedNucleo,
  debouncedSearch,
  denyAccessRequest,
  deactivateUserAccess,
  exitExternalPanel,
  exportCSV,
  exportPDF,
  highlightSearchItems,
  login,
  loadAccessDashboard,
  loadAccessManagement,
  loginWithGoogle,
  logout,
  navigate,
  openEditModal,
  openApprovedListImport,
  previewCnesCoords,
  previewImg,
  refreshData,
  reloadExternal,
  returnToLogin,
  removeFilterPill,
  runGlobalSearch,
  saveAdminSettings,
  restoreAccessBackground,
  saveEdital,
  searchModalKey,
  selectAllFilterValues,
  selectSearchResult,
  sortDetails,
  updateUserAccess,
  uploadAccessBackground,
  submitAccessRequest,
  toggleBrowserFullscreen,
  toggleColMenu,
  toggleCriticalRiskFilter,
  toggleDarkMode,
  toggleFilterMenu,
  toggleFilters,
  toggleHideClosed,
  toggleMoreActions,
  toggleObs,
  togglePassword,
  toggleSelectFilter,
  toggleSidebar,
  toggleOnlinePresence,
  resetDetailMap,
  toggleVinculosExternos,
});
boot();
