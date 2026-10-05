import { aplicarAtualizacaoPendente } from "./pwa-lifecycle.js";
import { ordenarUnidades as sortUnits } from "../lib/editais-do-nucleo.js";
import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.js";
import { resumoDoRelatorio } from "../lib/visao-geral.js";
import {
  assinarDadosDoMonitoramento,
  definirAreasDoUsuario,
  obterDadosDoMonitoramento,
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
} from "../componentes/dados-do-monitoramento.js";
import {
  abrirSecaoDeConfiguracao,
  definirSecoesPermitidas,
  SECOES,
  secaoAtualDeConfiguracao,
} from "./config-secoes.js";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
} from "../componentes/barra-lateral/estado.js";
import {
  areasDoUsuario,
  montarArvoreDoMenu,
  nomeDaArea,
} from "../lib/menu-lateral.js";
import {
  avisar,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../lib/eventos-da-barra-lateral.js";
import { enderecoDoPainel } from "../lib/endereco-do-painel.js";
import { EVENTO_ESCOLHA_DA_BUSCA } from "../lib/busca-global.js";
import { semOPainelAntigoDeAnalises } from "../lib/pagina-do-painel.js";
import { mostrarNotificacao } from "./notificacao.js";
import { cabecalhoDaVisaoGeral } from "../lib/visao-geral-da-area.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { sessaoDoApp } from "../app/sessao.js";
import { definirMarcaDaConfiguracao } from "../app/entrada/marca.js";
import { definirPaginaDaAya } from "../modulos/aya/estado.js";
import { comemorarAcessoLiberado } from "./comemoracao-do-acesso.js";
import { estadoDasConfiguracoes } from "../componentes/configuracoes/estado.js";
import { profileDisplayName } from "../lib/platform-context.js";
import {
  DEFAULT_ACCESS_BRANDING,
  normalizeAccessLogoUrl,
} from "../lib/access-branding.js";
import {
  normalizeOnlinePresenceList,
  ondeEstaNoMonitora,
} from "../lib/online-presence.js";
import { avisoGlobal } from "../lib/aviso-global.js";
import {
  aplicarFaviconDaMarca,
  definirPaginaDaAba,
  definirSistemaDaAba,
} from "../lib/identidade-da-aba.js";
import { ehFalhaTransitoria, ehSessaoEncerrada } from "../lib/sessao.js";
import {
  canViewCore,
  canViewEntrevistas,
  canViewRecursos,
  canViewSelecao,
  canViewClassificacao,
  podeUsarChat,
  canImportApprovedList,
  isAdminGlobal,
  podeVerPessoasOnline,
  paginasPermitidas,
  permissaoLegada,
  podeAbrirConfiguracoes,
  roleLabel,
  secaoDeConfiguracaoPermitida,
} from "../lib/access-roles.js";
import {
  assinaturaDoAcesso,
  consultasDosDados,
  copiaServe,
  dadosDasRespostas,
  montarCopia,
  partesQueMudaram,
  respostasDasConsultas,
} from "../lib/copia-da-sessao.js";
import {
  VERSAO_DA_COPIA,
  apagarCopiaDaSessao,
  guardarCopiaDaSessao,
  lerCopiaDaSessao,
} from "./copia-da-sessao-indexeddb.js";
import { apagarCacheDePayload } from "./cache-de-payload-indexeddb.js";
import {
  abasDoMenu,
  carregarCatalogoDeAbas,
  consultaDoCatalogoDeAbas,
} from "./catalogo-de-abas.js";
import {
  aplicarManutencaoNaNavegacao,
  carregarSituacaoDoSistema,
  consultaDaSituacaoDoSistema,
  esquecerSituacaoDoSistema,
  situacaoDoSistema,
} from "./situacao-dos-modulos.js";
import { filtrarAreasAtivas } from "../lib/situacao-dos-modulos.js";
import {
  acompanharCarregamentoDoPainel,
  esconderEsqueleto,
  marcarAtualizacao,
  mostrarEsqueleto,
} from "./carregamento.js";

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

const RPC_ACCESS_LOG = "registrar_evento_acesso";
const RPC_REGISTER_ONLINE_PRESENCE = "registrar_presenca_monitora";
const RPC_LIST_ONLINE_PRESENCE = "listar_presenca_online_monitora";
const RPC_MONITORAMENTO_DASHBOARD_PAYLOAD =
  "get_monitoramento_dashboard_payload";
const MAPA_CONFIG_TABLE = "TB_CONFIG_MAPA_SAUDE_INDIG";
const DEFAULT_ACCESS_HEARTBEAT_MINUTES = 5;
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
  action_more_label: "",
  action_fullscreen_text: "",
  action_refresh_text: "",
  action_export_pdf_text: "",
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
};

const DEFAULT_PANELS = [];

let sb = getSupabaseClient();
/*
  Usuário e perfil vêm da sessão do app (src/app/sessao.js): estas são cópias
  locais, atualizadas por `receberSessao` a cada mudança dela.
*/
let currentUser = null;
let profile = null;
let appConfig = {};
let loadedConfigKeys = new Set();
let configLoadOk = false;
let rows = [];
let unidadesCatalog = [];
const VIEW_STORAGE_KEY = "agsus_monitora_current_view_v268";
let panels = [...DEFAULT_PANELS];
let allowedPanelIds = new Set();
let mapConfigLoadOk = false;
let currentPanel = null;
let currentView = "dashboard";
let dataLoadedAtLeastOnce = false;
let accessHeartbeatHandle = null;
let onlinePresenceHandle = null;
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
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value || "";
}
function setAttr(id, name, value) {
  const el = $(id);
  if (el) el.setAttribute(name, value || "");
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

function toast(message, type = "ok") {
  mostrarNotificacao($("toastBox"), message, type);
}

function loader(show, title = "Carregando", sub = "Aguarde...", pct = 0) {
  if (show && document.body.classList.contains("config-loading")) return;
  $("loader").classList.toggle("show", !!show);
  $("loaderTitle").textContent = title;
  $("loaderSub").textContent = sub;
  $("loaderPct").textContent = Math.round(pct) + "%";
  $("loaderBar").style.width = Math.max(0, Math.min(100, pct)) + "%";
}

function can(perm) {
  return permissaoLegada(profile, perm);
}

function isMasterProfile() {
  return isAdminGlobal(profile);
}

function getClientSessionId() {
  try {
    const key = "agsus_monitora_client_session_id";
    let value = sessionStorage.getItem(key);
    if (!value) {
      // Identificador da aba para a auditoria: gerador criptográfico, não
      // Math.random (apontado pelo CodeQL).
      value = globalThis.crypto.randomUUID();
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

/* "Pessoas online": administrador global e Gestor (o chat está em teste com os dois; 05/10/2026). */
function canViewOnlinePresence() {
  return podeVerPessoasOnline(profile);
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
            <span><strong>${esc(person.fullName)}</strong><small>${esc(person.profileLabel)}${person.currentView ? ` · ${esc(person.currentView)}` : ""}</small></span>${
              /* "Mensagem" abre a conversa direta (src/modulos/chat/ escuta o clique). */
              podeUsarChat(profile) && person.userId !== currentUser?.id
                ? `<button type="button" class="online-presence-mensagem" data-chat-usuario="${attr(person.userId)}">Mensagem</button>`
                : ""
            }
          </div>`,
        )
        .join("")
    : `<p>${synchronized ? "Ninguém mais com a plataforma aberta agora." : "Sincronizando presença…"}</p>`;
}

/* Onde a pessoa está agora, em texto para quem lê (página · área). */
function localAtualNaPresenca() {
  const secao = secaoAtualDeConfiguracao(document);
  return (
    ondeEstaNoMonitora({
      view: currentView,
      area: areaAtual(),
      rotuloDaSecao: SECOES.find((s) => s.id === secao)?.rotulo,
    }) || null
  );
}

let ultimoLocalNaPresenca = null;

async function registrarLocalNaPresenca() {
  if (!sb || !currentUser?.id || document.visibilityState !== "visible") return;
  const local = localAtualNaPresenca();
  const beat = await sb.rpc(RPC_REGISTER_ONLINE_PRESENCE, {
    p_current_view: local,
  });
  if (beat.error) throw beat.error;
  ultimoLocalNaPresenca = local;
}

/* Ao trocar de página, área ou seção, avisa na hora (sem esperar os 45 s). */
function avisarTrocaDeLocalNaPresenca() {
  if (!onlinePresenceHandle) return;
  if (localAtualNaPresenca() === ultimoLocalNaPresenca) return;
  registrarLocalNaPresenca().catch(() => {});
}

async function syncOnlinePresence() {
  if (!sb || !currentUser?.id || document.visibilityState !== "visible") return;
  try {
    await registrarLocalNaPresenca();
    // Sem permissão (inclusive quem a perdeu nesta sessão): o indicador some.
    if (!canViewOnlinePresence()) {
      $("onlinePresence")?.classList.add("hidden");
      return;
    }
    const result = await sb.rpc(RPC_LIST_ONLINE_PRESENCE);
    if (result.error) throw result.error;
    renderOnlinePresence(normalizeOnlinePresenceList(result.data), true);
  } catch (_) {
    if (canViewOnlinePresence()) renderOnlinePresence([], false);
    else $("onlinePresence")?.classList.add("hidden");
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

/*
  A sessão é do app (src/app/sessao.js). O legado recebe o usuário e o perfil
  por assinatura e cuida, nesta fase, do que vem depois de entrar: a carga dos
  dados, a navegação, a presença e a auditoria. Os ganchos abaixo são o
  contrato (docs/arquitetura-react.md, "Sessão ↔ legado").
*/
let perfilRecebido = null;
function receberSessao() {
  const atual = sessaoDoApp.obter();
  currentUser = atual.usuario;
  // Só quando o perfil muda: `loadPanelPermissions` completa os painéis do legado.
  if (atual.perfil !== perfilRecebido) {
    perfilRecebido = atual.perfil;
    profile = atual.perfil;
    allowedPanelIds = new Set(atual.painelIds);
  }
}

/* A pessoa saiu (ou a sessão acabou): nada dela fica na tela. */
function limparEstadoDeslogado() {
  rows = [];
  dataLoadedAtLeastOnce = false;
  allowedPanelIds = new Set();
  copiaEmLeitura = null;
  stopAccessHeartbeat();
  stopOnlinePresence();
  clearExternalPanelCache();
  esquecerSituacaoDoSistema(document);
  esconderEsqueleto();
  $("appScreen").classList.add("hidden");
}

/* Fim da espera da entrada, aconteça o que acontecer: sem skeleton. */
function encerrarEspera() {
  esconderEsqueleto();
  document.body.classList.remove("config-loading");
}

/*
  Sessão válida, perfil ainda chegando: o skeleton da entrada (no formato da
  última tela) e a leitura local da cópia da sessão, que corre junto com a
  consulta do perfil.
*/
let copiaEmLeitura = null;
function prepararEntrada() {
  mostrarEsqueleto(storedView());
  copiaEmLeitura = lerCopiaDaSessao();
}

/* Perfil confirmado: carrega e abre o sistema. `true` = aberto. */
async function abrirSistema({ origem }) {
  mostrarUsuarioNaBarra();
  const pronto = await loadInitialData();
  if (!pronto) return false;
  // Sem esperar: a tela já abriu (a sessão esconde a de acesso ao voltar daqui).
  void trackAccess(origem === "boot" ? "sessao_restaurada" : "login_google", {
    tela: origem,
  });
  startAccessHeartbeat();
  startOnlinePresence();
  startRealtime();
  return true;
}

/* Sem acesso, ou acesso revogado: nada desta pessoa fica no navegador. */
function ficarSemAcesso() {
  copiaEmLeitura = null;
  void apagarCopiaDaSessao();
  stopRealtime();
  stopAccessHeartbeat();
  encerrarEspera();
  $("appScreen").classList.add("hidden");
}

/* O perfil mudou com o sistema aberto (USER_UPDATED). */
async function atualizarPerfilAberto() {
  mostrarUsuarioNaBarra();
  await loadPanelPermissions();
  buildNav();
  if (!isViewAllowed(currentView)) navigate(startView());
}

/*
  Antes do `signOut()` do botão Sair: auditoria e Realtime. A cópia da sessão
  fica (entrar de novo é imediato); a do painel de análises, com nomes e notas
  de candidatos, sai com a pessoa.
*/
async function antesDeSair() {
  await trackAccess("logout", { detalhes: { current_view: currentView } });
  stopRealtime();
  await apagarCacheDePayload();
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

function openApp(user) {
  document.body.classList.remove("access-request-mode");
  $("appScreen").classList.remove("hidden");
  setText("userName", profileDisplayName(profile, user));
  setText("topUserPopoverName", profileDisplayName(profile, user));
  setText("userEmail", user?.email || "-");
}

/*
  As consultas da entrada saem juntas.

  Configurações, painéis, mapa, unidades e monitoramento dependem só da sessão e
  do perfil, não uns dos outros. Pedir cada um depois que o anterior voltava
  somava as idas ao Supabase; agora a espera é a da consulta mais lenta. Quem
  aplica o resultado continua sendo cada `load*`, na mesma ordem de antes: muda
  só a hora em que o pedido sai. `Promise.resolve` é o que dispara, porque a
  consulta do Supabase só vai para a rede quando alguém chama `then`.
*/
function iniciarConsultasDaSessao() {
  const iniciar = (consulta) => Promise.resolve(consulta);
  return {
    config: iniciar(consultaDeConfiguracao()),
    paineis: iniciar(consultaDePaineis()),
    mapa: iniciar(consultaDoMapa()),
    unidades: iniciar(consultaDeUnidades()),
    abas: consultaDoCatalogoDeAbas(sb),
    monitoramento: podeCarregarMonitoramento()
      ? consultaDoMonitoramento()
      : null,
  };
}

/*
  Depois que a tela abriu. Espera as consultas reais e guarda a cópia nova (regras
  em `lib/copia-da-sessao.js`). Se a tela abriu pela cópia (`anteriores`),
  reaplica antes só o que mudou; quase sempre nada, e nada pisca.
*/
async function atualizarCopiaDaSessao(sessao, consultas, anteriores) {
  const dados = dadosDasRespostas(await respostasDasConsultas(consultas));
  if (currentUser?.id !== sessao.usuarioId) return;
  if (!dados) {
    if (anteriores)
      toast(
        "Não foi possível atualizar os dados; mostrando os da última entrada.",
        "warn",
      );
    return;
  }
  if (anteriores) {
    const mudou = partesQueMudaram(anteriores, dados);
    const novas = consultasDosDados(dados);
    if (mudou.has("config"))
      await loadConfig({ consulta: novas.config, silent: true });
    if (mudou.has("paineis")) {
      await loadPanels({ consulta: novas.paineis });
      await loadPanelPermissions();
    }
    if (mudou.has("abas"))
      await carregarCatalogoDeAbas({ consulta: novas.abas });
    if (mudou.has("config") || mudou.has("paineis") || mudou.has("abas"))
      buildNav();
    // Só painel: `isViewAllowed` não conhece todas as telas (Acessos, por exemplo).
    if (currentView.startsWith("panel:") && !isViewAllowed(currentView))
      navigate(startView());
    // A cópia trazia o catálogo antigo: a manutenção das abas pode ter mudado.
    // Configurações fica (reabrir repreencheria os campos que a pessoa edita).
    else if (mudou.has("abas") && currentView !== "config")
      navigate(currentView);
    if (mudou.has("mapa")) await loadMapaConfig({ consulta: novas.mapa });
    if (mudou.has("unidades")) await loadUnidades({ consulta: novas.unidades });
    if (
      mudou.has("mapa") ||
      mudou.has("unidades") ||
      mudou.has("monitoramento")
    )
      await loadData({ consulta: novas.monitoramento });
  }
  if (currentUser?.id !== sessao.usuarioId) return;
  await guardarCopiaDaSessao(
    montarCopia({ ...sessao, agora: Date.now(), dados }),
  );
}

async function loadInitialData() {
  /*
    O perfil já foi confirmado pela sessão (src/app/sessao.js). O skeleton da
    entrada e a leitura da cópia começaram em `prepararEntrada`, junto com a
    consulta do perfil.
  */
  const copiaLida = copiaEmLeitura || lerCopiaDaSessao();
  copiaEmLeitura = null;
  const sessao = {
    usuarioId: currentUser.id,
    acesso: assinaturaDoAcesso(profile, allowedPanelIds),
    versao: VERSAO_DA_COPIA,
  };
  const consultas = iniciarConsultasDaSessao();
  // Fora da cópia da sessão: a manutenção é sempre a do banco, nesta entrada.
  const situacaoDoBanco = consultaDaSituacaoDoSistema(sb);
  const copia = await copiaLida;
  // Outra pessoa entrou neste navegador: a cópia de quem saiu vai embora.
  if (copia && copia.usuarioId !== sessao.usuarioId) void apagarCopiaDaSessao();
  const daCopia = copiaServe(copia, { ...sessao, agora: Date.now() });
  const fonte = daCopia ? consultasDosDados(copia.dados) : consultas;
  await loadConfig({ consulta: fonte.config });
  await loadPanels({ consulta: fonte.paineis });
  await loadPanelPermissions();
  await carregarCatalogoDeAbas({ consulta: fonte.abas });
  await carregarSituacaoDoSistema({ consulta: situacaoDoBanco });
  buildNav();
  await loadMapaConfig({ consulta: fonte.mapa });
  await loadUnidades({ consulta: fonte.unidades });
  const dataOk = await loadData({ consulta: fonte.monitoramento });
  if (!dataOk) {
    esconderEsqueleto();
    return;
  }
  openApp(currentUser);
  navigate(startView());
  esconderEsqueleto();
  comemorarAcessoLiberado({
    usuario: currentUser,
    perfil: profile,
    ligadas: situacaoDoSistema().comemoracoes,
  });
  atualizarCopiaDaSessao(sessao, consultas, daCopia ? copia.dados : null).catch(
    (erro) => console.warn("Falha ao atualizar a cópia da sessão:", erro),
  );
  return true;
}

function isViewAllowed(view) {
  if (!view) return false;
  const paginas = paginasPermitidas(profile);
  if (Object.hasOwn(paginas, view)) return paginas[view];
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
  if (can("calendario")) return "calendario";
  if (canViewCore(profile)) return "approved";
  if (can("analises")) return "analises";
  if (canViewRecursos(profile)) return "recursos";
  if (canViewEntrevistas(profile)) return "entrevistas";
  if (canViewClassificacao(profile)) return "classificacao";
  if (canViewSelecao(profile)) return "selecao";
  if (podeAbrirConfiguracoes(profile)) return "config";
  const firstPanel = panels.find(panelAllowed);
  if (firstPanel) return "panel:" + firstPanel.codigo;
  return "sem-acesso";
}
function startView() {
  // Restaura a última tela — EXCETO painéis externos, para o app nunca abrir
  // "preso" num painel externo (sem menu para voltar) ao recarregar.
  const stored = storedView();
  if (stored && !stored.startsWith("panel:") && isViewAllowed(stored))
    return stored;
  return systemHomeView();
}

/* Nome, e-mail e perfil de quem entrou, no topo e na barra. */
function mostrarUsuarioNaBarra() {
  setText("userName", profileDisplayName(profile, currentUser));
  setText("topUserPopoverName", profileDisplayName(profile, currentUser));
  setText("userEmail", currentUser?.email || profile?.email || "-");
  const badge = $("userProfileBadge");
  if (badge && profile?.perfil) {
    const label = roleLabel(profile);
    badge.textContent = label;
    badge.style.display = "inline-block";
    setText("topUserPopoverProfile", label);
  }
}

function consultaDeConfiguracao() {
  return sb.from("TB_CONFIGURACAO").select("chave,valor,descricao");
}

async function loadConfig(options = {}) {
  const silent = options.silent === true;
  appConfig = {};
  loadedConfigKeys = new Set();
  configLoadOk = false;
  const { data, error } = await (options.consulta || consultaDeConfiguracao());
  if (error) {
    if (!silent)
      toast("Erro ao carregar configurações: " + friendlyError(error), "error");
    applyConfigToUi();
    estadoDasConfiguracoes.definirValoresCarregados(appConfig);
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
  // As seções de Configurações (React, src/componentes/configuracoes/) leem daqui.
  estadoDasConfiguracoes.definirValoresCarregados(appConfig);
  document.body.classList.remove("config-loading");
  return true;
}

/*
  Configurações › Aparência (React) gravou a arte da tela de acesso na hora
  (definir_fundo_acesso_monitora): a tela de acesso e o cache de marca usam o
  valor novo sem esperar a próxima carga.
*/
document.addEventListener("agsus:fundo-do-acesso-definido", (evento) => {
  appConfig.auth_access_background_url =
    evento.detail?.url || DEFAULT_ACCESS_BRANDING.backgroundUrl;
  appConfig.auth_access_background_path = evento.detail?.caminho || "";
  loadedConfigKeys.add("auth_access_background_url");
  loadedConfigKeys.add("auth_access_background_path");
  applyConfigToUi();
});

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
  /*
    A tela de acesso (src/app/entrada/) é desenhada pelo React: a marca dela
    (arte, cor, logo, saudação e rodapé) e as chaves do login vão para o app,
    que só grava a identidade quando ela veio mesmo do banco.
  */
  definirMarcaDaConfiguracao({
    valores: appConfig,
    carregou: configLoadOk,
    chaves: loadedConfigKeys,
  });
  sessaoDoApp.definirConfiguracao(appConfig);
  setText("sidebarUserLabel", cfgValue("sidebar_user_label"));
  setText("sidebarVersionLabel", cfgValue("sidebar_version_label"));
  setText("sidebarVersion", appVersion());
  setText("logoutText", cfgValue("logout_text"));
  setText("pageTitle", cfgValue("page_title"));
  setText("pageSubtitle", cfgValue("page_subtitle"));
  setText("externalBackText", cfgValue("external_back_text"));
  setText("darkModeLabel", cfgValue("dark_mode_label"));
  setText("fullscreenActionText", cfgValue("action_fullscreen_text"));
  setText("refreshActionText", cfgValue("action_refresh_text"));
  setText("exportPdfActionText", cfgValue("action_export_pdf_text"));
  setText("externalTitle", cfgValue("external_default_title"));
  setText("externalRefreshText", cfgValue("external_refresh_text"));
  setText("externalOpen", cfgValue("external_open_text"));
  const externalMount = $("externalMount");
  if (externalMount && externalMount.classList.contains("external-placeholder"))
    externalMount.textContent = cfgValue("external_placeholder");
  // O botão de recolher da barra lateral é React e tem rótulo próprio (recolher/expandir).
  ["hambToggle"].forEach((id) => {
    setAttr(id, "title", cfgValue("sidebar_toggle_label"));
    setAttr(id, "aria-label", cfgValue("sidebar_toggle_label"));
  });
  ["externalBackBtn"].forEach((id) => {
    setAttr(id, "title", cfgValue("external_back_text"));
    setAttr(id, "aria-label", cfgValue("external_back_text"));
  });
  aplicarAvisoGlobal();
  /*
    `#sideLogo` não entra mais aqui. A logo da barra lateral tem chave própria
    (`ui_sidebar_logo_url`) e um único dono: `sidebar-branding.js`. Enquanto esta
    função a sobrescrevia com `auth_access_logo_url` — a marca da tela de
    **login** —, escolher uma logo para a barra lateral não sobrevivia ao
    carregamento das configurações.
  */
}

function consultaDeUnidades() {
  return sb
    .from("TD_UNIDADE")
    .select("id_unidade,sigla,nome_oficial,tipo,uf_sede,ativo")
    .eq("ativo", true)
    .order("tipo", { ascending: true })
    .order("nome_oficial", { ascending: true });
}

async function loadUnidades(options = {}) {
  if (!sb) {
    unidadesCatalog = [];
    publicarUnidadesDoCatalogo(unidadesCatalog);
    return false;
  }
  const { data, error } = await (options.consulta || consultaDeUnidades());
  if (error) {
    unidadesCatalog = [];
    publicarUnidadesDoCatalogo(unidadesCatalog);
    toast("Catálogo dim_unidades não disponível.", "warn");
    return false;
  }
  unidadesCatalog = Array.isArray(data)
    ? data.filter((u) => txt(u.nome_oficial)).sort(sortUnits)
    : [];
  publicarUnidadesDoCatalogo(unidadesCatalog);
  return true;
}

function consultaDePaineis() {
  return sb
    .from("TB_PAINEL_EXTERNO")
    .select(
      "id,codigo,titulo,icone,url,ordem,ativo,em_manutencao,tipo_abertura",
    )
    .order("ordem", { ascending: true });
}

async function loadPanels(options = {}) {
  const { data, error } = await (options.consulta || consultaDePaineis());
  // Análises curriculares virou página (view `analises`): o painel antigo sai.
  if (!error && Array.isArray(data) && data.length)
    panels = semOPainelAntigoDeAnalises(data);
  else panels = [...DEFAULT_PANELS];
  // Configurações › Painéis externos (React) lê daqui.
  estadoDasConfiguracoes.definirPaineisCarregados(panels);
}

async function loadPanelPermissions() {
  if (profile?.permissoes) return true;
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
  return (
    !!panel &&
    panel.ativo !== false &&
    can("paineis") &&
    (!profile?.permissoes || allowedPanelIds.has(String(panel.id)))
  );
}

function canAccessPanelCode(code) {
  return panels.some((p) => p.codigo === code && panelAllowed(p));
}

function consultaDoMapa() {
  return sb
    .from(MAPA_CONFIG_TABLE)
    .select("chave,payload")
    .in("chave", ["lmap", "rede_cnes"]);
}

async function loadMapaConfig(options = {}) {
  mapConfigLoadOk = false;
  if (!sb) return false;
  const { data, error } = await (options.consulta || consultaDoMapa());
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
  // O mapa da Saúde Indígena (React) lê do estado da Visão geral.
  const anteriores = estadoDaVisaoGeral.obter().mapa || {};
  estadoDaVisaoGeral.definirDadosDoMapa({
    lmap:
      byKey.lmap && Array.isArray(byKey.lmap.dsei)
        ? byKey.lmap
        : anteriores.lmap,
    redeCnes:
      byKey.rede_cnes && byKey.rede_cnes.rede
        ? byKey.rede_cnes
        : anteriores.redeCnes,
  });
  mapConfigLoadOk = !!(byKey.lmap && byKey.rede_cnes);
  if (!mapConfigLoadOk && can("config"))
    toast("Configuração do mapa incompleta no Supabase.", "warn");
  return mapConfigLoadOk;
}

async function loadMonitoramentoPayload() {
  if (!sb) return null;
  const { data, error } = await sb.rpc(RPC_MONITORAMENTO_DASHBOARD_PAYLOAD);
  if (error) {
    console.warn(
      "Payload consolidado de monitoramento indisponível; usando carregamento legado:",
      error,
    );
    return null;
  }
  return data || null;
}

function podeCarregarMonitoramento() {
  return (
    can("ind") ||
    can("cores") ||
    can("calendario") ||
    canViewCore(profile) ||
    canImportApprovedList(profile)
  );
}

function consultaDoMonitoramento() {
  return Promise.all([
    loadMonitoramentoPayload(),
    sb
      .from("TB_MONITORAMENTO_INDIGENA")
      /*
        As seis colunas `cronograma_*` entram aqui de proposito.

        `health-status-details.js` fazia uma **segunda leitura completa** da
        mesma view so para obte-las: 21 colunas, das quais 15 eram copia exata
        desta requisicao. Enquanto essa segunda chamada nao voltava, cada linha
        ficava com "Carregando cronograma...", porque o badge so existe quando
        o dado do cronograma chega. Uma requisicao, um conjunto de linhas.
      */
      .select(
        "aprovados_analise,aprovados_prova,aptos_analise,ativo,cancelados,cargos,ciclo,contratados,cronograma_atividade_atual,cronograma_automatico,cronograma_dias_para_proxima,cronograma_percentual,cronograma_proxima_atividade,cronograma_proxima_data,data_fim,data_inicio,edital,eliminados_nota,entrevistados,etapa,id,id_unidade,inscritos,link_edital,observacoes,observacoes_internas,processo,reprovados_analise,responsavel,risco,sigla_unidade,status,tipo_unidade,total_eliminados,uf,unidade,vagas_ociosas,vagas_total,CO_AREA",
      )
      .eq("ativo", true)
      .order("unidade", { ascending: true })
      .order("edital", { ascending: true }),
  ]);
}

async function loadData(options = {}) {
  if (activeLoadDataPromise) return activeLoadDataPromise;
  const runId = ++loadDataRunCounter;
  activeLoadDataPromise = (async () => {
    if (!podeCarregarMonitoramento()) {
      rows = [];
      publicarLinhasDoMonitoramento(rows);
      buildNav();
      return true;
    }
    const [, tableResponse] = await (options.consulta ||
      consultaDoMonitoramento());
    if (runId !== loadDataRunCounter) return false;
    const { data, error } = tableResponse;
    if (error) {
      toast("Erro ao carregar dados: " + friendlyError(error), "error");
      return false;
    }
    rows = Array.isArray(data) ? data : [];
    dataLoadedAtLeastOnce = true;
    /*
      As linhas vão para dados-do-monitoramento.js; a Visão geral (React)
      recorta, e o mapa da Saúde Indígena lê o recorte dela.
    */
    publicarLinhasDoMonitoramento(rows);
    return true;
  })();
  try {
    return await activeLoadDataPromise;
  } finally {
    activeLoadDataPromise = null;
  }
}

async function refreshData() {
  if (activeRefreshDataPromise) return activeRefreshDataPromise;
  /*
    Sem tela de carregamento: o que está na tela fica, com a barra de
    atualização no cabeçalho, até os dados novos chegarem. Tudo é esperado antes
    de aplicar, porque `loadConfig` zera a configuração enquanto espera a sua.
    Como dá para navegar nesse meio-tempo, a tela reaberta no fim é a de agora,
    e não a do clique.
  */
  marcarAtualizacao(true);
  activeRefreshDataPromise = (async () => {
    const consultas = iniciarConsultasDaSessao();
    const situacaoDoBanco = consultaDaSituacaoDoSistema(sb);
    await respostasDasConsultas(consultas);
    await loadConfig({ consulta: consultas.config });
    await loadPanels({ consulta: consultas.paineis });
    await loadPanelPermissions();
    await loadMapaConfig({ consulta: consultas.mapa });
    await carregarCatalogoDeAbas({ consulta: consultas.abas });
    await carregarSituacaoDoSistema({ consulta: situacaoDoBanco });
    buildNav();
    await loadUnidades({ consulta: consultas.unidades });
    const dataOk = await loadData({ consulta: consultas.monitoramento });
    if (!dataOk) return false;
    // Painel já aberto recarrega na próxima abertura; o atual, logo abaixo.
    document.querySelectorAll(".external-panel").forEach((el) => el.remove());
    const painel = currentView.startsWith("panel:")
      ? currentView.split(":")[1]
      : "";
    if (painel && canAccessPanelCode(painel)) openPanel(painel);
    else if (!painel && isViewAllowed(currentView)) navigate(currentView);
    else {
      currentPanel = null;
      navigate(startView());
    }
    toast("Dados atualizados.");
    return true;
  })();
  try {
    return await activeRefreshDataPromise;
  } finally {
    activeRefreshDataPromise = null;
    marcarAtualizacao(false);
  }
}

/*
  A barra lateral é React (`src/componentes/barra-lateral/`). Aqui só se decide
  o que o perfil vê; a árvore vai para o estado da barra, que desenha o menu.
*/
function buildNav() {
  // As mesmas regras do "Ver como" de Acessos (src/lib/access-roles.js).
  const permitidas = paginasPermitidas(profile);
  const paineis = can("paineis")
    ? panels.filter(panelAllowed).sort((a, b) => n(a.ordem) - n(b.ordem))
    : [];
  // Seção "Acessos" só para quem gerencia acessos; as demais, para quem edita configurações.
  const secoes = SECOES.filter((secao) =>
    secaoDeConfiguracaoPermitida(profile, secao.id),
  );
  definirSecoesPermitidas(
    document,
    secoes.map((secao) => secao.id),
  );
  // Um grupo por área do usuário; a área atual passa a ser uma delas.
  // Área desativada (Configurações › Módulos e abas) sai do menu.
  const situacao = situacaoDoSistema();
  const areas = areasDoUsuario(profile?.areas);
  const ativas = filtrarAreasAtivas(areas, situacao);
  definirAreasDoUsuario(ativas.length ? ativas : areas);
  atualizarMenuLateral(
    montarArvoreDoMenu({
      permitidas,
      paineis,
      secoesDeConfiguracao: secoes,
      areas,
      abas: abasDoMenu(),
      situacao,
    }),
    {
      aoAbrirSecao: (_view, secao) => abrirSecaoDeConfiguracao(document, secao),
      textoVazio: cfgValue("permissions_empty_text"),
    },
  );
  setActiveNav(currentView);
}

function setActiveNav(view) {
  marcarItemAtivoNoMenu(view, secaoAtualDeConfiguracao(document));
  avisarTrocaDeLocalNaPresenca();
}

/*
  Telas React de página inteira (montadas por src/main.js na própria
  `#page-<view>`): título, subtítulo (depois da área) e o controlador.
*/
const TELAS_REACT = Object.freeze({
  nucleo: () => [
    "Editais",
    cfgValue("nucleo_page_subtitle"),
    window.nucleoController,
  ],
  calendario: () => [
    "Cronograma",
    "Etapas dos editais, por data.",
    window.calendarioEditaisController,
  ],
  approved: () => [
    "Lista de Aprovados",
    "Candidatos por edital e situação de contratação.",
    window.aprovadosController,
  ],
  recursos: () => ["Recursos", "", window.recursosController],
  entrevistas: () => ["Entrevistas", "", window.entrevistasController],
  classificacao: () => ["Classificação", "", window.classificacaoController],
  analises: () => ["Análises curriculares", "", window.analisesController],
  selecao: () => ["Seleção", "", window.selecaoController],
});

function navigate(view) {
  const previousView = currentView;
  const requestedView = txt(view) || startView();
  // Sair com alteração não salva (Acessos, Módulos e abas ou campos de Configurações) pergunta antes.
  if (
    requestedView !== currentView &&
    (window.acessosController?.confirmarSaida() === false ||
      window.modulosController?.confirmarSaida() === false ||
      !estadoDasConfiguracoes.confirmarSaida())
  )
    return;
  // Versão nova do sistema esperando: entra agora. A tela pedida fica guardada
  // e abre depois da recarga (startView confere a permissão).
  if (
    requestedView !== currentView &&
    aplicarAtualizacaoPendente(() => {
      rememberView(requestedView);
      window.location.reload();
    })
  )
    return;

  // Valida permissão antes de alterar currentView e antes de esconder páginas.
  // A versão anterior mudava o estado primeiro; se a permissão falhasse,
  // o painel podia ficar sem página ativa.
  if (requestedView === "dashboard" && !can("ind")) {
    toast("Sem permissão para Saúde Indígena.", "warn");
    return;
  }
  if (requestedView === "nucleo" && !can("cores")) {
    toast("Sem permissão para Editais.", "warn");
    return;
  }
  if (
    requestedView === "calendario" &&
    !(profile?.permissoes ? can("calendario") : can("cores"))
  ) {
    toast("Sem permissão para o Cronograma.", "warn");
    return;
  }
  if (requestedView === "approved" && !canViewCore(profile)) {
    toast("Sem permissão para Lista de Aprovados.", "warn");
    return;
  }
  if (requestedView === "analises" && !can("analises")) {
    toast("Sem permissão para Análises curriculares.", "warn");
    return;
  }
  if (requestedView === "recursos" && !canViewRecursos(profile)) {
    toast("Sem permissão para Recursos.", "warn");
    return;
  }
  if (requestedView === "entrevistas" && !canViewEntrevistas(profile)) {
    toast("Sem permissão para Entrevistas.", "warn");
    return;
  }
  if (requestedView === "classificacao" && !canViewClassificacao(profile)) {
    toast("Sem permissão para Classificação.", "warn");
    return;
  }
  if (requestedView === "selecao" && !canViewSelecao(profile)) {
    toast("Sem permissão para Seleção.", "warn");
    return;
  }
  if (requestedView === "config" && !podeAbrirConfiguracoes(profile)) {
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
  enforceResponsiveSidebar();
  setActiveNav(requestedView);
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));

  if (requestedView === "sem-acesso") {
    let empty = $("page-sem-acesso");
    if (!empty) {
      empty = document.createElement("section");
      empty.id = "page-sem-acesso";
      empty.className = "page";
      empty.innerHTML =
        '<div class="alert warn">Seu usuário ainda não tem módulos liberados. Solicite a liberação a um administrador.</div>';
      $("page-dashboard").parentElement.append(empty);
    }
    empty.classList.add("active");
    setPageTitle(
      "Acesso aos módulos",
      "Nenhum módulo disponível para seu perfil.",
    );
    return;
  }

  // Sistema, área ou aba em manutenção: quem não é admin global vê a tela de manutenção.
  if (
    aplicarManutencaoNaNavegacao({
      view: requestedView,
      area: areaAtual(),
      abas: abasDoMenu(),
      adminGlobal: isMasterProfile(),
    })
  ) {
    setPageTitle("Em manutenção", subtituloDaArea(""));
    return;
  }

  if (requestedView === "dashboard") {
    $("page-dashboard").classList.add("active");
    // A página, com os mapas, é React (src/modulos/visao-geral/); aqui só o título.
    prepararVisaoGeralDaArea();
    if (previousView !== requestedView)
      trackAccess("abertura_tela", { tela: requestedView });
    return;
  }
  if (Object.hasOwn(TELAS_REACT, requestedView)) {
    const [titulo, subtitulo, controlador] = TELAS_REACT[requestedView]();
    $("page-" + requestedView).classList.add("active");
    setPageTitle(titulo, subtituloDaArea(subtitulo));
    void controlador?.render();
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
    // Reabre a seção guardada (ou a primeira permitida); em Acessos, carrega a tela React.
    abrirSecaoDeConfiguracao(document, secaoAtualDeConfiguracao(document));
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

/* Editais, Cronograma e Aprovados mostram só a área atual; o subtítulo diz qual. */
function subtituloDaArea(sub) {
  const area = nomeDaArea(areaAtual());
  return [area, sub].filter(Boolean).join(" · ");
}

const areaAtual = () => obterDadosDoMonitoramento().areaAtual;

/*
  A VISÃO GERAL É UMA SÓ PARA AS TRÊS ÁREAS

  Saúde Indígena, SEDE e Projetos abrem esta mesma página (React,
  src/modulos/visao-geral/, com o mapa de cada área), com os editais da área
  atual. Daqui sai só o cabeçalho (`cabecalhoDaVisaoGeral`).
*/
function prepararVisaoGeralDaArea() {
  const area = areaAtual();
  if (currentView !== "dashboard") return;
  const { titulo, subtitulo } = cabecalhoDaVisaoGeral(area, {
    titulo: cfgValue("page_title"),
    subtitulo: cfgValue("page_subtitle"),
  });
  setPageTitle(titulo, subtitulo);
}

/*
  Trocou a área (menu): o cabeçalho (o estado da Visão geral tira o DSEI
  aberto, poda os filtros e troca o mapa). Roda também fora da Visão geral.
*/
let areaDaVisaoGeral = areaAtual();
function aoMudarDadosDoMonitoramento() {
  const area = areaAtual();
  if (area === areaDaVisaoGeral) return;
  areaDaVisaoGeral = area;
  prepararVisaoGeralDaArea();
}
assinarDadosDoMonitoramento(aoMudarDadosDoMonitoramento);

function setPageTitle(title, sub) {
  $("pageTitle").textContent = title;
  $("pageSubtitle").textContent = sub;
  // O nome da aba tem um dono só; aqui entra apenas a metade da página.
  definirPaginaDaAba(title);
  // A Aya (src/modulos/aya/) acompanha a página: saudação, sugestões e contexto.
  definirPaginaDaAya(currentView, title);
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

/*
  A barra lateral (React) lê a classe de `body` e desenha o botão de recolher,
  com rótulo e `aria-expanded`; aqui só se avisa que ela mudou.
*/
function syncSidebarToggle() {
  avisar(EVENTO_BARRA_ALTERNADA);
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
}

function clearExternalPanelCache() {
  document.querySelectorAll(".external-panel").forEach((el) => el.remove());
  const mount = $("externalMount");
  if (mount) {
    mount.className = "external-placeholder";
    mount.textContent = cfgValue("external_placeholder");
  }
  currentPanel = null;
}

function openPanel(code) {
  const panel = panels.find((p) => p.codigo === code && panelAllowed(p));
  if (!panel) {
    toast("Painel indisponível ou inativo.", "warn");
    return;
  }
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
  $("externalOpen").href =
    enderecoDoPainel(panel.url, window.location.origin) || "#";
  const mount = $("externalMount");
  if (mount.classList.contains("external-placeholder")) {
    mount.className = "";
    mount.innerHTML = "";
  }
  document
    .querySelectorAll(".external-panel")
    .forEach((el) => (el.hidden = true));
  /*
    O iframe nasce na primeira abertura e fica até a página fechar. Antes, a
    entrada criava de uma vez o iframe de cada painel ativo, escondido, e todos
    carregavam a cada login, mesmo sem ninguém abrir.
  */
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
  const safePanelUrl = enderecoDoPainel(panel.url, window.location.origin);
  if (!safePanelUrl) {
    holder.innerHTML = `<div class="external-placeholder"><div><h2>${esc(panel.titulo)}</h2><p>Cadastre uma URL http(s) válida deste painel em paineis_externos.</p></div></div>`;
    return;
  }

  holder.innerHTML = `<iframe class="external-frame" src="${attr(safePanelUrl)}" loading="eager" referrerpolicy="no-referrer-when-downgrade" allow="fullscreen *; clipboard-read *; clipboard-write *; encrypted-media *; geolocation *; display-capture *" allowfullscreen="true"></iframe>`;
  // Até o site de fora responder, o quadro ficaria em branco.
  acompanharCarregamentoDoPainel(holder, { aoTentarDeNovo: reloadExternal });
}

function reloadExternal() {
  if (!currentPanel) return;
  const holder = document.getElementById(
    "external-panel-" + currentPanel.codigo,
  );
  if (holder) holder.remove();
  openPanel(currentPanel.codigo);
}

function syncDisplayModeButtons() {
  const fullscreenActive =
    !!document.fullscreenElement ||
    document.body.classList.contains("app-fullscreen-fallback");
  // O item de tela cheia fica no menu da conta (index.html, #fullscreenActionIcon).
  {
    const fsBtn = $("fullscreenActionIcon");
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
});

// Exporta relatório em PDF (via diálogo de impressão do navegador — funciona offline)
function exportPDF() {
  const now = new Date();
  const dataStr = now.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  // O recorte da Visão geral: filtros aplicados e os números dele.
  const { filtros, busca, filtradas } = estadoDaVisaoGeral.obter();
  const resumo = resumoDoRelatorio({ filtros, busca, linhas: filtradas });
  // Cabeçalho de relatório (inserido só para a impressão)
  let head = document.getElementById("printReportHeader");
  if (head) head.remove();
  head = document.createElement("div");
  head.id = "printReportHeader";
  head.className = "print-only";
  head.innerHTML = `<div style="padding:0 0 12px;border-bottom:2px solid #003b70;margin-bottom:14px;">
      <div style="font-size:20px;font-weight:700;color:#003b70;">AgSUS Monitora — Saúde Indígena</div>
      <div style="font-size:12px;color:#444;margin-top:2px;">Relatório de processos seletivos · gerado em ${dataStr}</div>
      <div style="font-size:11px;color:#555;margin-top:6px;"><b>Filtros:</b> ${esc(resumo.filtros)}</div>
      <div style="font-size:12px;color:#222;margin-top:8px;display:flex;gap:18px;flex-wrap:wrap;">
        <span><b>${fmt(resumo.processos)}</b> processos</span>
        <span><b>${fmt(resumo.vagas)}</b> vagas previstas</span>
        <span><b>${fmt(resumo.contratados)}</b> contratações</span>
        <span style="color:#a3322b;"><b>${fmt(resumo.ociosas)}</b> ociosas (${resumo.pctOciosas}%)</span>
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
  if (msg.includes("Sem permissão para salvar monitoramento indígena"))
    return "Seu usuário não tem permissão para salvar registros de Editais.";
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
  // O CSS antigo ainda lê `body.dark-mode`; o novo, `html[data-theme]`.
  document.body?.classList.toggle("dark-mode", dark);
  avisar(EVENTO_TEMA_ALTERADO);
}
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = !isDark;
  try {
    localStorage.setItem("agsus_dark_mode_v1", next ? "1" : "0");
  } catch (e) {}
  applyDarkMode(next);
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

/*
  Busca global (Ctrl+K): o componente React (src/componentes/busca-global/)
  avisa a linha escolhida; aqui, dono dos filtros e da navegação, ela fica à
  vista no painel de Saúde Indígena.
*/
function localizarLinhaDoMonitoramento(id) {
  const r = rows.find((x) => String(x.id) === String(id));
  if (!r) return;

  if (!can("ind")) {
    toast(
      "Busca localizada, mas seu perfil não tem acesso ao dashboard de Saúde Indígena.",
      "warn",
    );
    return;
  }

  /*
    A linha escolhida fica à vista mesmo com filtros ou busca: a Visão geral
    troca o recorte pela unidade e pelo edital dela (sem DSEI aberto) e
    destaca a linha.
  */
  navigate("dashboard");
  estadoDaVisaoGeral.localizar(r);
}
document.addEventListener(EVENTO_ESCOLHA_DA_BUSCA, (e) =>
  localizarLinhaDoMonitoramento(e.detail?.id),
);

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
        { event: "*", schema: "public", table: "TB_MONITORAMENTO_INDIGENA" },
        () => {
          // Debounce: evita múltiplas chamadas em rajada
          clearTimeout(window.__realtimeDebounce);
          window.__realtimeDebounce = setTimeout(async () => {
            await loadData();
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
});
window.addEventListener("agsus:background-resume", () => {
  if (!currentUser?.id) return;
  startAccessHeartbeat();
  startOnlinePresence();
  startRealtime();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser?.id)
    void syncOnlinePresence();
});

window.addEventListener("resize", () => {
  clearTimeout(window.__responsiveResize);
  window.__responsiveResize = setTimeout(() => {
    enforceResponsiveSidebar();
  }, 220);
});
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    enforceResponsiveSidebar();
  }, 300);
});

// Indicador de conexão (offline)
/*
  Conexão: quem avisa é src/modules/connectivity-status.js (faixa com
  "Tentar", e "Conexão restabelecida" que some sozinha). Aqui havia mais dois
  avisos para o mesmo fato — um toast e a #offlineBar, que ainda empurrava a
  página 32px para baixo —, e a queda de rede mostrava três mensagens juntas.
  O texto configurável `offline_message` continua sendo gravado em #offlineBar,
  que fica escondida.
*/

loadDarkModePreference();
enforceResponsiveSidebar();
Object.assign(window, {
  $,
  getMonitoraProfile: () => profile,
  getMonitoraUser: () => currentUser,
  monitoraToast: toast,
  monitoraLoader: loader,
  exitExternalPanel,
  exportPDF,
  navigate,
  refreshData,
  reloadExternal,
  toggleBrowserFullscreen,
  toggleDarkMode,
  toggleSidebar,
  toggleOnlinePresence,
});
applyStoredSidebarState();
applyStoredDisplayModes();
// A entrada é da sessão do app (src/main.js chama sessaoDoApp.iniciar()).
sessaoDoApp.assinar(receberSessao);
sessaoDoApp.ligarSistema({
  carregarConfiguracao: () => loadConfig({ silent: true }),
  mostrarEsqueleto: () => mostrarEsqueleto(storedView()),
  aoVerificar: prepararEntrada,
  abrir: abrirSistema,
  aoFicarSemAcesso: ficarSemAcesso,
  aoAtualizarPerfil: atualizarPerfilAberto,
  antesDeSair,
  aoSair: limparEstadoDeslogado,
  aoLimparSessao: () => apagarCopiaDaSessao(),
  encerrarEspera,
});
