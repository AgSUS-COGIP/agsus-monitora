import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.js";
import { resumoDoRelatorio } from "../lib/visao-geral.js";
import { obterDadosDoMonitoramento } from "../componentes/dados-do-monitoramento.js";
import {
  SECOES,
  secaoAtualDeConfiguracao,
} from "../modulos/configuracoes/secoes.js";
import {
  avisar,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../lib/eventos-da-barra-lateral.js";
import { EVENTO_ESCOLHA_DA_BUSCA } from "../lib/busca-global.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { sessaoDoApp } from "../app/sessao.js";
import { criarNavegacao } from "../app/navegacao.js";
import { configuracaoDoApp as configuracao } from "../app/configuracao.js";
import { criarPaineisExternos } from "../app/paineis-externos.js";
import { criarCarga } from "../app/carga.js";
import { avisar as toast, mostrarCarregamento } from "../app/avisos.js";
import { comemorarAcessoLiberado } from "./comemoracao-do-acesso.js";
import { profileDisplayName } from "../lib/platform-context.js";
import {
  normalizeOnlinePresenceList,
  ondeEstaNoMonitora,
} from "../lib/online-presence.js";
import {
  podeUsarChat,
  podeVerPessoasOnline,
  permissaoLegada,
  roleLabel,
} from "../lib/access-roles.js";
import { apagarCacheDePayload } from "./cache-de-payload-indexeddb.js";
import {
  esquecerSituacaoDoSistema,
  situacaoDoSistema,
} from "./situacao-dos-modulos.js";
import { esconderEsqueleto, mostrarEsqueleto } from "./carregamento.js";

/*
  O que sobra do legado do app. A navegação (src/app/navegacao.js), a
  configuração (src/app/configuracao.js), os painéis externos
  (src/app/paineis-externos.js) e a carga dos dados (src/app/carga.js) já são
  do app; este arquivo os liga à sessão (src/app/sessao.js) e ainda cuida da
  presença, da auditoria e da moldura (barra recolhida, tema, tela cheia, PDF).
*/

const RPC_ACCESS_LOG = "registrar_evento_acesso";
const RPC_REGISTER_ONLINE_PRESENCE = "registrar_presenca_monitora";
const RPC_LIST_ONLINE_PRESENCE = "listar_presenca_online_monitora";
const DEFAULT_ACCESS_HEARTBEAT_MINUTES = 5;
const SIDEBAR_MOBILE_BREAKPOINT = 900;
const SIDEBAR_FORCE_LOCK_VIEWS = new Set([]);

let sb = getSupabaseClient();
/*
  Usuário e perfil vêm da sessão do app (src/app/sessao.js): estas são cópias
  locais, atualizadas por `receberSessao` a cada mudança dela.
*/
let currentUser = null;
let profile = null;
let accessHeartbeatHandle = null;
let onlinePresenceHandle = null;

const paineis = criarPaineisExternos({
  obterPerfil: () => profile,
  configuracao: (chave) => configuracao.valor(chave),
  aoTentarDeNovo: () => reloadExternal(),
});
const navegacao = criarNavegacao({
  obterPerfil: () => profile,
  paineis,
  configuracao: (chave) => configuracao.valor(chave),
  avisar: (texto, tom) => toast(texto, tom),
  ajustarBarra: () => enforceResponsiveSidebar(),
});
const carga = criarCarga({
  configuracao,
  paineis,
  navegacao,
  obterPerfil: () => profile,
  obterUsuario: () => currentUser,
  mostrarApp: () => openApp(currentUser),
  comemorar: () =>
    comemorarAcessoLiberado({
      usuario: currentUser,
      perfil: profile,
      ligadas: situacaoDoSistema().comemoracoes,
    }),
});
const viewAtual = () => navegacao.obter().view;
const areaAtual = () => obterDadosDoMonitoramento().areaAtual;

function $(id) {
  return document.getElementById(id);
}
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value || "";
}
function fmt(v) {
  const x = Number(v || 0);
  return (Number.isFinite(x) ? x : 0).toLocaleString("pt-BR");
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
function can(perm) {
  return permissaoLegada(profile, perm);
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
      p_tela: options.tela ?? viewAtual() ?? null,
      p_origem: "index",
      p_detalhes: options.detalhes ?? {},
      p_client_session_id: getClientSessionId(),
      p_user_agent: navigator.userAgent || "",
      p_app_version: configuracao.versao(),
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
      view: viewAtual(),
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
    configuracao.inteiro("access_heartbeat_minutos", DEFAULT_ACCESS_HEARTBEAT_MINUTES),
  );
  accessHeartbeatHandle = setInterval(
    () =>
      trackAccess("heartbeat", {
        detalhes: { current_view: viewAtual(), page_title: document.title },
      }),
    minutes * 60 * 1000,
  );
}

/*
  A sessão é do app (src/app/sessao.js). O legado recebe o usuário e o perfil
  por assinatura e liga a carga, a navegação, a presença e a auditoria aos
  ganchos do contrato (docs/arquitetura-react.md, "Sessão ↔ legado").
*/
let perfilRecebido = null;
function receberSessao() {
  const atual = sessaoDoApp.obter();
  currentUser = atual.usuario;
  // Só quando o perfil muda: a carga completa os painéis liberados.
  if (atual.perfil !== perfilRecebido) {
    perfilRecebido = atual.perfil;
    profile = atual.perfil;
    paineis.definirLiberados(atual.painelIds);
  }
}

/* A pessoa saiu (ou a sessão acabou): nada dela fica na tela. */
function limparEstadoDeslogado() {
  carga.esquecer();
  stopAccessHeartbeat();
  stopOnlinePresence();
  paineis.limpar();
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
function prepararEntrada() {
  mostrarEsqueleto(navegacao.telaGuardada());
  carga.prepararEntrada();
}

/* Perfil confirmado: carrega e abre o sistema. `true` = aberto. */
async function abrirSistema({ origem }) {
  mostrarUsuarioNaBarra();
  const pronto = await carga.carregarEntrada();
  if (!pronto) return false;
  // Sem esperar: a tela já abriu (a sessão esconde a de acesso ao voltar daqui).
  void trackAccess(origem === "boot" ? "sessao_restaurada" : "login_google", {
    tela: origem,
  });
  startAccessHeartbeat();
  startOnlinePresence();
  carga.iniciarRealtime();
  return true;
}

/* Sem acesso, ou acesso revogado: nada desta pessoa fica no navegador. */
function ficarSemAcesso() {
  carga.esquecer();
  void carga.apagarCopia();
  carga.pararRealtime();
  stopAccessHeartbeat();
  encerrarEspera();
  $("appScreen").classList.add("hidden");
}

/* O perfil mudou com o sistema aberto (USER_UPDATED). */
async function atualizarPerfilAberto() {
  mostrarUsuarioNaBarra();
  paineis.completarLiberados();
  navegacao.montarMenu();
  if (!navegacao.telaPermitida(viewAtual()))
    navegacao.irPara(navegacao.telaDeEntrada());
}

/*
  Antes do `signOut()` do botão Sair: auditoria e Realtime. A cópia da sessão
  fica (entrar de novo é imediato); a do painel de análises, com nomes e notas
  de candidatos, sai com a pessoa.
*/
async function antesDeSair() {
  await trackAccess("logout", { detalhes: { current_view: viewAtual() } });
  carga.pararRealtime();
  await apagarCacheDePayload();
}

function applyStoredSidebarState() {
  if (isSidebarLockedViewport()) return;
  try {
    const saved = localStorage.getItem("agsus_monitora_sidebar_collapsed_v1");
    if (saved === "0") document.body.classList.remove("sidebar-collapsed");
    if (saved === "1") document.body.classList.add("sidebar-collapsed");
  } catch (e) {
    // Sem localStorage: a barra fica como está.
  }
  syncSidebarToggle();
}

function openApp(user) {
  document.body.classList.remove("access-request-mode");
  $("appScreen").classList.remove("hidden");
  setText("userName", profileDisplayName(profile, user));
  setText("topUserPopoverName", profileDisplayName(profile, user));
  setText("userEmail", user?.email || "-");
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

function isSidebarLockedViewport() {
  return window.matchMedia(`(max-width:${SIDEBAR_MOBILE_BREAKPOINT}px)`)
    .matches;
}
function shouldLockSidebar() {
  return SIDEBAR_FORCE_LOCK_VIEWS.has(viewAtual());
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
function reloadExternal() {
  const painel = paineis.atual();
  if (!painel) return;
  paineis.descartar(painel.codigo);
  navegacao.irPara("panel:" + painel.codigo);
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
  paineis.esquecerAtual();
  navegacao.irPara(navegacao.telaInicialDoSistema());
}

function getFullscreenTarget() {
  const painel = paineis.atual();
  if (viewAtual().startsWith("panel:") && painel) {
    const holder = document.getElementById("external-panel-" + painel.codigo);
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
  const r = carga.linhas().find((x) => String(x.id) === String(id));
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
  navegacao.irPara("dashboard");
  estadoDaVisaoGeral.localizar(r);
}
document.addEventListener(EVENTO_ESCOLHA_DA_BUSCA, (e) =>
  localizarLinhaDoMonitoramento(e.detail?.id),
);

window.addEventListener("agsus:background-suspend", () => {
  stopAccessHeartbeat();
  carga.pararRealtime();
});
window.addEventListener("agsus:background-resume", () => {
  if (!currentUser?.id) return;
  startAccessHeartbeat();
  startOnlinePresence();
  carga.iniciarRealtime();
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
  monitoraLoader: mostrarCarregamento,
  exitExternalPanel,
  exportPDF,
  navigate: navegacao.irPara,
  refreshData: carga.atualizarDados,
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
configuracao.acompanharFundoDoAcesso();
navegacao.acompanharArea();
navegacao.assinar((evento) => {
  if (evento.tipo === "abertura" && evento.view !== evento.anterior)
    void trackAccess("abertura_tela", { tela: evento.view });
  avisarTrocaDeLocalNaPresenca();
});
sessaoDoApp.ligarSistema({
  carregarConfiguracao: () => configuracao.carregar({ silent: true }),
  mostrarEsqueleto: () => mostrarEsqueleto(navegacao.telaGuardada()),
  aoVerificar: prepararEntrada,
  abrir: abrirSistema,
  aoFicarSemAcesso: ficarSemAcesso,
  aoAtualizarPerfil: atualizarPerfilAberto,
  antesDeSair,
  aoSair: limparEstadoDeslogado,
  aoLimparSessao: () => carga.apagarCopia(),
  encerrarEspera,
});
