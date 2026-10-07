import { getSupabaseClient } from "../lib/supabaseClient.js";
import {
  DEFAULT_ACCESS_BRANDING,
  normalizeAccessLogoUrl,
} from "../lib/access-branding.js";
import { avisoGlobal } from "../lib/aviso-global.js";
import { erroAmigavel } from "../lib/erro-amigavel.js";
import {
  aplicarFaviconDaMarca,
  definirSistemaDaAba,
} from "../lib/identidade-da-aba.js";
import { sessaoDoApp } from "./sessao.js";
import { definirMarcaDaConfiguracao } from "./entrada/marca.js";
import { estadoDasConfiguracoes } from "../modulos/configuracoes/estado.js";
import { avisar as avisarPadrao } from "./avisos.js";
import {
  CHAVE_DAS_COMEMORACOES,
  definirConfiguracaoDasComemoracoes,
} from "../lib/catalogo-de-comemoracoes.ts";

/*
  A configuração do sistema (TB_CONFIGURACAO), sem React: carrega, guarda as
  chaves que vieram do banco e aplica nos textos do app (marca da tela de
  acesso, nome da aba, rodapé da barra, rótulos do cabeçalho e do painel
  externo, aviso global). As seções de Configurações (React) leem os valores
  do `estadoDasConfiguracoes`.

  Chave que não veio do banco vale o padrão abaixo (só as que não são vazias).
*/
export const PADROES = Object.freeze({
  feature_realtime_monitoramento: "true",
  access_heartbeat_minutos: "5",
  password_reset_flow: "admin",
  broadcast_type: "info",
  external_back_text: "Voltar ao sistema",
  auth_google_enabled: "true",
  auth_google_allowed_domains: "agenciasus.org.br,agsus.org.br",
  auth_access_background_url: DEFAULT_ACCESS_BRANDING.backgroundUrl,
  auth_access_logo_url: DEFAULT_ACCESS_BRANDING.logoUrl,
  auth_access_panel_color: DEFAULT_ACCESS_BRANDING.panelColor,
  auth_access_greeting: DEFAULT_ACCESS_BRANDING.greeting,
});

const VERDADEIROS = ["true", "1", "sim", "yes", "on"];
const FALSOS = ["false", "0", "nao", "não", "no", "off"];

export function criarConfiguracao({
  cliente = getSupabaseClient,
  documento = globalThis.document,
  avisar = avisarPadrao,
  sessao = sessaoDoApp,
  definirMarca = definirMarcaDaConfiguracao,
  estado = estadoDasConfiguracoes,
} = {}) {
  let valores = {};
  let chaves = new Set();
  let carregou = false;

  const $ = (id) => documento?.getElementById(id);
  const escrever = (id, texto) => {
    const el = $(id);
    if (el) el.textContent = texto || "";
  };
  const atributo = (id, nome, texto) => {
    const el = $(id);
    if (el) el.setAttribute(nome, texto || "");
  };

  function valor(chave) {
    return chaves.has(chave) ? (valores[chave] ?? "") : PADROES[chave] || "";
  }

  function booleano(chave, padrao = false) {
    const texto = String(valor(chave)).trim().toLowerCase();
    if (VERDADEIROS.includes(texto)) return true;
    if (FALSOS.includes(texto)) return false;
    return padrao;
  }

  function inteiro(chave, padrao = 0) {
    const numero = parseInt(valor(chave), 10);
    return Number.isFinite(numero) ? numero : padrao;
  }

  const versao = () => valor("app_version_current");

  /*
    Aviso global — a mensagem de topo definida em Configurações. A decisão de
    aparência está em `lib/aviso-global.js`; aqui só a escrita no DOM.
  */
  function aplicarAvisoGlobal() {
    const barra = $("broadcastBar");
    if (!barra) return;
    const aviso = avisoGlobal({
      mensagem: valor("broadcast_msg"),
      tipo: valor("broadcast_type"),
    });
    // `textContent`, não `innerHTML`: o texto vem do banco e não é marcação.
    barra.textContent = aviso.mensagem;
    barra.className = aviso.classe;
    barra.hidden = !aviso.visivel;
  }

  function aplicarNaTela() {
    /*
      O nome da aba: aqui entra só a metade que a configuração conhece (o nome
      do sistema). A metade da página fica com a navegação.
    */
    definirSistemaDaAba(valor("app_title") || "AgSUS Monitora");
    void aplicarFaviconDaMarca(
      normalizeAccessLogoUrl(valor("auth_access_logo_url")),
    );
    documento
      ?.querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        "AgSUS Monitora - Monitoramento de Processos Seletivos",
      );
    escrever("skipLink", valor("skip_link_text"));
    escrever("offlineBar", valor("offline_message"));
    /*
      A tela de acesso (src/app/entrada/) é React: a marca dela (arte, cor,
      logo, saudação e rodapé) e as chaves do login vão para o app, que só grava
      a identidade quando ela veio mesmo do banco.
    */
    definirMarca({ valores, carregou, chaves });
    sessao.definirConfiguracao(valores);
    escrever("sidebarUserLabel", valor("sidebar_user_label"));
    escrever("sidebarVersionLabel", valor("sidebar_version_label"));
    escrever("sidebarVersion", versao());
    escrever("logoutText", valor("logout_text"));
    escrever("pageTitle", valor("page_title"));
    escrever("pageSubtitle", valor("page_subtitle"));
    escrever("externalBackText", valor("external_back_text"));
    escrever("darkModeLabel", valor("dark_mode_label"));
    escrever("fullscreenActionText", valor("action_fullscreen_text"));
    escrever("refreshActionText", valor("action_refresh_text"));
    escrever("exportPdfActionText", valor("action_export_pdf_text"));
    escrever("externalTitle", valor("external_default_title"));
    escrever("externalRefreshText", valor("external_refresh_text"));
    escrever("externalOpen", valor("external_open_text"));
    const quadro = $("externalMount");
    if (quadro?.classList.contains("external-placeholder"))
      quadro.textContent = valor("external_placeholder");
    // O botão de recolher da barra lateral é React e tem rótulo próprio (recolher/expandir).
    atributo("hambToggle", "title", valor("sidebar_toggle_label"));
    atributo("hambToggle", "aria-label", valor("sidebar_toggle_label"));
    atributo("externalBackBtn", "title", valor("external_back_text"));
    atributo("externalBackBtn", "aria-label", valor("external_back_text"));
    aplicarAvisoGlobal();
    // `#sideLogo` não entra aqui: a logo da barra tem chave e dono próprios (sidebar-branding.js).
  }

  const consulta = () =>
    cliente().from("TB_CONFIGURACAO").select("chave,valor,descricao");

  /**
   * Carrega TB_CONFIGURACAO (ou usa a `consulta` já disparada) e aplica.
   * `silent`: sem toast de erro (arranque, cópia da sessão). `true` = carregou.
   */
  async function carregar({ consulta: disparada, silent = false } = {}) {
    valores = {};
    chaves = new Set();
    carregou = false;
    const { data, error } = await (disparada || consulta());
    if (error) {
      if (!silent)
        avisar(
          "Erro ao carregar configurações: " + erroAmigavel(error),
          "error",
        );
    } else {
      (Array.isArray(data) ? data : []).forEach((linha) => {
        if (!linha.chave) return;
        chaves.add(linha.chave);
        valores[linha.chave] = linha.valor ?? "";
      });
      carregou = true;
    }
    aplicarNaTela();
    // Os marcos das comemorações (Configurações › Comemorações) valem para todos.
    definirConfiguracaoDasComemoracoes(valores[CHAVE_DAS_COMEMORACOES]);
    // As seções de Configurações (React, src/modulos/configuracoes/) leem daqui.
    estado.definirValoresCarregados(valores);
    documento?.body.classList.remove("config-loading");
    return carregou;
  }

  /*
    Configurações › Aparência (React) gravou a arte da tela de acesso na hora
    (definir_fundo_acesso_monitora): a tela de acesso e o cache de marca usam o
    valor novo sem esperar a próxima carga. Devolve o cancelamento.
  */
  function acompanharFundoDoAcesso() {
    const aoDefinir = (evento) => {
      valores.auth_access_background_url =
        evento.detail?.url || DEFAULT_ACCESS_BRANDING.backgroundUrl;
      valores.auth_access_background_path = evento.detail?.caminho || "";
      chaves.add("auth_access_background_url");
      chaves.add("auth_access_background_path");
      aplicarNaTela();
    };
    documento.addEventListener("agsus:fundo-do-acesso-definido", aoDefinir);
    return () =>
      documento.removeEventListener(
        "agsus:fundo-do-acesso-definido",
        aoDefinir,
      );
  }

  return {
    valor,
    booleano,
    inteiro,
    versao,
    consulta,
    carregar,
    aplicarNaTela,
    acompanharFundoDoAcesso,
  };
}

export const configuracaoDoApp = criarConfiguracao();
