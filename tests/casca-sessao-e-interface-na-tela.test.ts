// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import fs, { readFileSync, readdirSync, statSync } from "node:fs";
import {
  act,
  createElement,
  type ReactElement,
  type ReactNode,
  StrictMode,
  createElement as h,
  useSyncExternalStore,
  useState,
  type ChangeEvent,
} from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  avisar,
  mostrarCarregamento,
  normalizarTom,
  redefinirAvisos,
} from "../src/app/avisos.ts";
import { Avisos } from "../src/app/casca/avisos.tsx";
import { definido } from "./definido.ts";
import { achar } from "./dom.ts";
import {
  desenharNoTeste,
  montarPortaisNoTeste,
  montarTela,
} from "./montar-tela.ts";
import { VISIVEL_DEPOIS_DE_VOLTAR_MS } from "../src/app/casca/aviso-de-conexao.tsx";
import { DURACAO_MS } from "../src/app/casca/notificacoes.tsx";
import { Casca } from "../src/app/casca/casca.tsx";
import { Topo } from "../src/app/casca/topo.tsx";
import { ContextoDoApp, type PecasDoApp } from "../src/app/contexto-do-app.ts";
import {
  ESTADO_INICIAL_DA_NAVEGACAO,
  type EstadoDaNavegacao,
  type LeituraDaNavegacao,
  CHAVE_DA_ROTA_PEDIDA,
  TEXTO_ROTA_DESCONHECIDA,
  criarNavegacao,
  type EventoDaNavegacao,
  type OpcoesDaNavegacao,
  type PaineisDoApp,
} from "../src/app/navegacao.ts";
import { TELAS_DA_CASCA } from "../src/app/telas.tsx";
import {
  type SupabaseClient,
  type User,
  type Session,
} from "@supabase/supabase-js";
import { criarConfiguracao, PADROES } from "../src/app/configuracao.ts";
import {
  ACCESS_INSTRUCTION,
  DEFAULT_ACCESS_BRANDING,
  enderecosDaArteNaTela,
} from "../src/lib/entrada/access-branding.ts";
import {
  INSTITUICAO,
  SLOGAN,
  TelaDeEntrada,
  ligarEntradaAPagina,
  type EstadoDaSessaoNaEntrada,
  type PropsDaTelaDeEntrada,
} from "../src/app/entrada/entrada.tsx";
import { type PedidoDeAcesso } from "../src/app/entrada/pedido-de-acesso.ts";
import {
  type EstadoDaMarcaDaEntrada,
  criarMarcaDaEntrada,
  aplicarAjusteDoVidro,
  definirMarcaDaConfiguracao,
} from "../src/app/entrada/marca.ts";
import {
  FASES,
  TEXTO_DO_BOTAO,
  TEXTO_DO_BOTAO_OCUPADO,
  configuracaoDaEntrada,
  MENSAGENS,
  criarSessao,
  nomeDoUsuario,
  type GanchosDoSistema,
} from "../src/app/sessao.ts";
import {
  clicar,
  digitar,
  teclar,
  esperar,
  escolher,
} from "./componentes/interacoes.ts";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary } from "../src/app/ErrorBoundary.tsx";
import {
  criarRegistroDeErros,
  type DependenciasDoRegistro,
  MAXIMO_DE_ENVIOS_POR_PAGINA,
} from "../src/app/registro-de-erros.ts";
import {
  criarMoldura,
  type Moldura,
  CHAVE_DA_BARRA_RECOLHIDA,
  CHAVE_DO_TEMA,
  type OpcoesDaMoldura,
} from "../src/app/moldura.ts";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
  obterEstadoDaBarraLateral,
} from "../src/componentes/barra-lateral/estado.ts";
import {
  redefinirDadosDoMonitoramento,
  definirAreaAtual,
  obterDadosDoMonitoramento,
  definirAreasDoUsuario,
  areaDaLinha,
  idsDasLinhas,
  linhasDaArea,
  soDosEditais,
  publicarLinhasDoMonitoramento,
  assinarDadosDoMonitoramento,
  esquecerLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
} from "../src/componentes/dados-do-monitoramento.ts";
import {
  montarArvoreDoMenu,
  ABAS_DO_MENU,
  abasDoCatalogo,
} from "../src/lib/navegacao/menu-lateral.ts";
import { Raiz, type PropsDaRaiz } from "../src/app/raiz.tsx";
import {
  type EstadoDoAviso,
  AVISO_DE_PENDENCIA,
  CHAVE_DO_FECHAMENTO,
  INTERVALO_DA_CONFERENCIA_MS,
  criarAvisoDeVersao,
  type AvisoDeVersao as ControleDoAviso,
} from "../src/app/aviso-de-versao.ts";
import {
  type EstadoDaPresenca,
  PessoasOnline,
  type PresencaDoCabecalho,
} from "../src/componentes/pessoas-online/pessoas-online.tsx";
import { type EstadoDoEncerramento } from "../src/modulos/encerramento-do-edital/estado.ts";
import {
  janelaCom,
  type OuvinteDaJanela,
  type OuvintesDaJanela,
} from "./app/janela-falsa.ts";
import {
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../src/lib/navegacao/eventos-da-barra-lateral.ts";
import {
  filtrosGuardadosDaTela,
  buscaComFiltros,
  esquecerFiltrosDasTelas,
  filtrosDaBusca,
  guardarFiltrosDaTela,
  mudouOQueEmpilha,
  normalizarFiltros,
  type EsquemaDosFiltros,
  type ValoresDosFiltros,
} from "../src/app/filtros-no-endereco.ts";
import {
  criarPresenca,
  INTERVALO_DA_PRESENCA_MS,
  CARONA_MAXIMA,
  LISTA_FECHADA_MS,
  ONLINE_NO_BANCO_MS,
  idDaAba,
  type EventoDaNavegacaoNaPresenca,
} from "../src/app/presenca.ts";
import { carregarTela, registrarTelas } from "../src/app/registro-das-telas.ts";
import { CHAVE_DA_TELA_GUARDADA } from "../src/lib/navegacao/navegacao";
import {
  TELAS_DAS_AREAS,
  caminhoDoDestino,
  destinoDoCaminho,
} from "../src/lib/navegacao/rotas.ts";
import {
  obterPaginaDaAya,
  redefinirPaginaDaAya,
} from "../src/modulos/aya/estado.ts";
import { type PerfilDeAcesso } from "../src/lib/acessos/tipos-dos-acessos.ts";
import {
  comAct,
  fontesFalsas,
  montarTelasNoTeste,
  type TelaFalsa,
} from "./app/telas-no-teste.ts";
import { type ArvoreDoMenu } from "../src/componentes/barra-lateral/tipos.ts";
import {
  criarVigiaDoCatalogo,
  versaoDaResposta,
} from "../src/app/vigia-do-catalogo.ts";
import {
  paginaDesligada,
  primeiraPaginaLigada,
} from "../src/lib/navegacao/pagina-desligada.ts";
import { normalizarSituacaoDoSistema } from "../src/lib/navegacao/situacao-dos-modulos.ts";
import { carregarCatalogoDeAbas } from "../src/modules/catalogo-de-abas.ts";
import {
  carregarSituacaoDoSistema,
  esquecerSituacaoDoSistema,
} from "../src/app/situacao-do-sistema.ts";
import {
  criarPaineisExternos,
  type PainelExternoDoApp,
} from "../src/app/paineis-externos.ts";
import {
  criarPerfil,
  type EstadoDaSessaoDoPerfil,
  type OuvinteDoPerfil,
} from "../src/app/perfil.ts";
import {
  SAIDA_EXPIRADA,
  declararSaida,
  reiniciarEstadoDeSaidaParaTestes,
} from "../src/lib/sessao/estado-de-saida";
import {
  criarPerfilGuardado,
  type PerfilGuardado,
} from "../src/app/perfil-guardado.ts";
import { sessaoFalsa } from "./supabase-falso.ts";
import {
  type MudarFiltros,
  TelaNaUrl,
  usarEditalNaUrl,
  usarFiltrosNaUrl,
  usarLojaNaUrl,
} from "../src/app/usar-filtros-na-url.ts";
import {
  guardarMarca,
  limparMarcaGuardada,
  lerMarcaGuardada,
} from "../src/lib/entrada/access-branding-cache.ts";
import { resumoDasLinhas } from "../src/lib/editais/editais-do-nucleo.ts";
import { COLUNAS_DO_MONITORAMENTO } from "../src/app/carga.ts";
import { AvisoDeVersao } from "../src/componentes/aviso-de-versao/aviso-de-versao.tsx";
import {
  EVENTO_PEDACO_QUE_SUMIU,
  EVENTO_TELA_ANTIGA,
} from "../src/lib/base/versao-do-sistema.ts";
import { EVENTO_ESCOLHA_DA_BUSCA } from "../src/lib/navegacao/busca-global.ts";
import { consumirPedidoDeFiltro } from "../src/app/pedido-de-filtro.ts";
import { abrirTelaDoEdital } from "../src/app/abrir-tela-do-edital.ts";
import { etapaDoFluxo } from "../src/lib/navegacao/fluxo-das-etapas.ts";
import { criarEstadoDasConfiguracoes } from "../src/modulos/configuracoes/estado.ts";
import {
  obterSaida,
  redefinirSaida,
  sairDoSistema,
  temConfiguracaoNaoSalva,
} from "../src/app/casca/saida.ts";
import {
  deveAlternarTema,
  estadoDoSeletorDeTema,
  OPCOES_DE_TEMA,
} from "../src/componentes/barra-lateral/seletor-de-tema.ts";
import {
  MultiSelectBusca,
  type PropriedadesDoMultiSelectBusca,
} from "../src/componentes/multi-select-busca.tsx";
import { FecharModal, Modal, usarAlteradoNoModal } from "../src/ui/modal.tsx";
import {
  situacaoDaPresenca,
  normalizeOnlinePresenceList,
} from "../src/lib/sessao/online-presence";
import { SECOES } from "../src/modulos/configuracoes/secoes.ts";
import { BarraLateral } from "../src/componentes/barra-lateral/barra-lateral.tsx";
import {
  definirAreaAtual as definirAreaAtual__1,
  redefinirDadosDoMonitoramento as redefinirDadosDoMonitoramento__2,
} from "../src/componentes/dados-do-monitoramento.js";
import { SecaoMarca } from "../src/modulos/configuracoes/marca.tsx";
import { PreviaDaBarraLateral } from "../src/modulos/configuracoes/previa-da-barra-lateral.tsx";
import { CATALOGO_DOS_ROBOS } from "./fixtures/catalogo-dos-robos.ts";
import {
  escapeHtml,
  safeHttpUrl,
  sanitizeHtml,
} from "../src/lib/seguranca/sanitize";
import { callbackResultUrl } from "../src/auth/callback.ts";
import {
  LOGIN_POPUP_MESSAGE,
  openLoginPopup,
  supportsLoginPopup,
} from "../src/lib/sessao/auth-flow";
import { htmlDaPagina } from "./pagina-montada.ts";
import {
  MaisDaCarga,
  usarCargaContinua,
  CarregandoConteudo,
  Carregando,
  EstadoVazio,
  AcoesDaLinha,
  Campo,
  gravarNaSessao,
  Kpi,
  lerDaSessao,
  MenuDeAcoes,
  usarEstadoDaSessao,
  BarraDaLista,
  CabecalhoDaTela,
  CardDaLista,
  FaixaDeSituacao,
  porcentagemDe,
  Selo,
  TabelaDaLista,
  textoDaDistribuicao,
  type GrupoDaTabela,
  type ItemDaFaixa,
  type PropriedadesDaTabelaDaLista,
  TabelaInfinita,
  type PropriedadesDaTabelaInfinita,
  usarListaNoServidor,
  type BuscarPagina,
  type PaginaDoServidor,
  Aviso,
  BlocosEsqueleto,
  BotaoDeAcao,
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  ErroAoCarregar,
  Gaveta,
  usarNavegacaoDaLista,
  GradeDeKpis,
  Kv,
  LinhaDoRecorte,
  LinhasEsqueleto,
  ListaDePendencias,
  MaisOpcoes,
  MarcasDoRecorte,
  PainelDeFiltros,
  Secao,
  Segmentado,
  textoDoRecorte,
  TopoDoPainel,
} from "../src/ui/index.ts";
import path, { join } from "node:path";
import { TopoDaGaveta } from "../src/ui/gaveta.tsx";
import { SeletorDeEdital } from "../src/componentes/seletor-de-edital.tsx";
import { type AcaoEmCurso } from "../src/ui/botao-de-acao.tsx";
import {
  DESFOQUE_DO_VIDRO_EM_PX,
  avaliarCor,
  normalizarCorNoVidro,
  normalizarDesfoqueDoVidro,
  porcentagemDaCorNoVidro,
} from "../src/lib/base/contraste.ts";
import { mapearBrandingPublico } from "../src/lib/entrada/access-branding-publico.ts";
import { CAMPOS_DAS_SECOES } from "../src/lib/configuracoes/publicacao-de-configuracoes.ts";

bloco("app/avisos", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /*
  Os avisos por cima de tudo (src/app/casca/avisos.tsx): a notificação curta
  (#toastBox), a tela de carregamento dos salvamentos (#loader) e o aviso de
  conexão. Eram marcação fixa do index.html e três módulos do legado; o DOM
  (ids, classes, papéis) é o de antes.
*/

  let avisos: { desmontar: () => void } | null = null;
  /* O elemento pelo id; quebra se faltar, como a leitura de `null.x` quebrava. */
  const $ = (id: string) => definido(document.getElementById(id), `#${id}`);
  const talvez = (id: string) => document.getElementById(id);

  function montar() {
    document.body.innerHTML = '<div id="avisosApp"></div>';
    // Como a raiz do app (src/app/raiz.tsx): na hora, com flushSync.
    avisos = desenharNoTeste($("avisosApp"), createElement(Avisos), {
      sincrono: true,
    });
  }

  function online(valor: boolean) {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => valor,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T13:00:00Z"));
    redefinirAvisos();
    online(true);
  });

  afterEach(() => {
    act(() => avisos?.desmontar());
    avisos = null;
    act(() => redefinirAvisos());
    document.body.className = "";
    document.body.innerHTML = "";
    vi.useRealTimers();
    Reflect.deleteProperty(window.navigator, "onLine");
  });

  describe("Avisos", () => {
    it("desenha na hora, com os ids de antes", () => {
      montar();
      // Sem act: quem vem depois em src/main.ts já acha os elementos.
      expect($("toastBox").className).toBe("toast-box");
      expect($("toastBox").getAttribute("role")).toBe("status");
      expect($("toastBox").getAttribute("aria-live")).toBe("polite");
      expect($("loader").className).toBe("loader");
      expect(talvez("connectivityStatusNotice")).toBeNull();
    });

    it("o index.html não traz a marcação: os avisos são da raiz (#raiz)", () => {
      const indice = readFileSync("index.html", "utf8");
      expect(indice).not.toContain('id="avisosApp"');
      expect(readFileSync("src/app/raiz.tsx", "utf8")).toContain(
        '<div id="avisosApp">',
      );
      for (const id of ["loader", "toastBox", "offlineBar"])
        expect(indice).not.toContain(`id="${id}"`);
    });
  });

  describe("notificação (window.monitoraToast)", () => {
    it("mostra o ícone do tipo, o texto como texto e o fechar com rótulo", () => {
      montar();
      act(() => avisar("<b>oi</b>", "warn"));
      const el = achar(".toast", $("toastBox"));
      expect(el.className).toBe("toast warn");
      expect(el.querySelector(".fa-triangle-exclamation.toast-icone")).not.toBe(
        null,
      );
      expect(el.querySelector<HTMLElement>(".toast-texto")?.innerHTML).toBe(
        "&lt;b&gt;oi&lt;/b&gt;",
      );
      expect(
        el
          .querySelector<HTMLElement>(".toast-fechar")
          ?.getAttribute("aria-label"),
      ).toBe("Fechar notificação");
    });

    it("só o erro interrompe o leitor de tela; tipo desconhecido vira sucesso", () => {
      montar();
      act(() => {
        avisar("x", "error");
        avisar("y", "ok");
        avisar("z", "qualquer");
      });
      const [erro, ok, outro] = $("toastBox").children;
      expect(erro?.getAttribute("role")).toBe("alert");
      expect(ok?.hasAttribute("role")).toBe(false);
      expect(outro?.className).toBe("toast ok");
      expect(normalizarTom("success")).toBe("ok");
    });

    it("some sozinha depois do tempo (com a animação de saída) e fecha pelo botão", () => {
      montar();
      act(() => avisar("a"));
      act(() => vi.advanceTimersByTime(DURACAO_MS));
      expect(
        $("toastBox").querySelector<HTMLElement>(".toast")?.className,
      ).toBe("toast ok is-saindo");
      act(() => vi.advanceTimersByTime(200));
      expect($("toastBox").children).toHaveLength(0);

      act(() => avisar("b"));
      act(() => achar(".toast-fechar", $("toastBox")).click());
      act(() => vi.advanceTimersByTime(200));
      expect($("toastBox").children).toHaveLength(0);
    });

    it("parada sob o mouse não some; ao sair, conta o que faltava", () => {
      montar();
      act(() => avisar("c"));
      const el = achar(".toast", $("toastBox"));
      act(() => vi.advanceTimersByTime(1000));
      act(() => el.dispatchEvent(new Event("mouseenter")));
      act(() => vi.advanceTimersByTime(DURACAO_MS * 2));
      expect(el.isConnected).toBe(true);
      act(() => el.dispatchEvent(new Event("mouseleave")));
      act(() => vi.advanceTimersByTime(DURACAO_MS - 1000 - 10));
      expect(el.isConnected).toBe(true);
      act(() => vi.advanceTimersByTime(10)); // + a animação de saída
      act(() => vi.advanceTimersByTime(200));
      expect(el.isConnected).toBe(false);
    });

    it("avisar antes da montagem não se perde", () => {
      avisar("cedo", "info");
      montar();
      expect(
        $("toastBox").querySelector<HTMLElement>(".toast.info .toast-texto")
          ?.textContent,
      ).toBe("cedo");
    });
  });

  describe("tela de carregamento (window.monitoraLoader)", () => {
    it("na entrada (config-loading) não aparece", () => {
      document.body.className = "config-loading";
      montar();
      act(() => mostrarCarregamento(true));
      const loader = $("loader");
      expect(loader.classList.contains("show")).toBe(false);
      expect(loader.getAttribute("role")).toBe("status");
      expect(loader.getAttribute("aria-hidden")).toBe("true");
      expect(document.body.getAttribute("aria-busy")).toBe("false");
      expect(talvez("loaderMeta")).toBeNull();
    });

    it("troca o texto genérico pela etapa, mostra o percentual e, na demora, Tentar novamente", () => {
      montar();
      act(() => mostrarCarregamento(true));
      expect($("loader").className).toBe("loader show");
      expect($("loader").getAttribute("aria-hidden")).toBe("false");
      expect(document.body.getAttribute("aria-busy")).toBe("true");
      expect($("loaderTitle").textContent).toBe("Preparando o Yeendé");
      expect($("loaderPct").textContent).toBe("0%");
      expect($("loaderMeta").textContent).toBe("Etapa 1 de 5");
      expect($("loaderRetry").hidden).toBe(true);

      act(() => vi.advanceTimersByTime(25_000));
      expect($("loaderRetry").hidden).toBe(false);
      expect($("loaderMeta").textContent).toContain(
        "demorando mais que o normal",
      );
      expect($("loaderMeta").className).toBe("loader-meta is-delayed");
    });

    it("título próprio fica; subtítulo genérico vira o detalhe da etapa; barra limitada a 100%", () => {
      montar();
      act(() => mostrarCarregamento(true, "Salvando edital", "Aguarde…", 40));
      expect($("loaderTitle").textContent).toBe("Salvando edital");
      expect($("loaderSub").textContent).toBe(
        "Consultando indicadores e registros do monitoramento.",
      );
      expect($("loaderPct").textContent).toBe("40%");
      expect($("loaderBar").style.width).toBe("40%");
      expect($("loaderMeta").textContent).toBe("Etapa 3 de 5");

      act(() => mostrarCarregamento(true, "Salvando edital", "Quase", 140));
      expect($("loaderBar").style.width).toBe("100%");
    });

    it("sem carregamento, nenhum relógio fica rodando", () => {
      montar();
      expect(vi.getTimerCount()).toBe(0);

      act(() => mostrarCarregamento(true, "Editais", "Salvando…", 70));
      expect(document.body.getAttribute("aria-busy")).toBe("true");
      expect(vi.getTimerCount()).toBe(1);

      act(() => mostrarCarregamento(false));
      expect(document.body.getAttribute("aria-busy")).toBe("false");
      expect($("loader").classList.contains("show")).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("aviso de conexão", () => {
    it("ao cair, avisa com Tentar novamente; ao voltar, avisa e some em 3,2s", () => {
      montar();
      act(() => window.dispatchEvent(new Event("offline")));
      const aviso = $("connectivityStatusNotice");
      expect(aviso.className).toBe("connectivity-status");
      expect(aviso.dataset.state).toBe("offline");
      expect(aviso.getAttribute("role")).toBe("status");
      expect(
        aviso.querySelector<HTMLElement>(".connectivity-status__title")
          ?.textContent,
      ).toBe("Sem conexão com a internet");
      expect(
        aviso.querySelector<HTMLElement>(".connectivity-status__action")
          ?.textContent,
      ).toBe("Tentar novamente");

      act(() => window.dispatchEvent(new Event("online")));
      expect(aviso.dataset.state).toBe("online");
      expect(
        aviso.querySelector<HTMLElement>(".connectivity-status__title")
          ?.textContent,
      ).toBe("Conexão restabelecida");
      expect(aviso.querySelector(".connectivity-status__action")).toBeNull();

      act(() => vi.advanceTimersByTime(VISIVEL_DEPOIS_DE_VOLTAR_MS));
      expect(aviso.className).toBe("connectivity-status hidden");
    });

    it("uma queda antes do prazo não é escondida pelo prazo antigo", () => {
      montar();
      act(() => window.dispatchEvent(new Event("offline")));
      act(() => window.dispatchEvent(new Event("online")));
      act(() => vi.advanceTimersByTime(1000));
      act(() => window.dispatchEvent(new Event("offline")));
      act(() => vi.advanceTimersByTime(VISIVEL_DEPOIS_DE_VOLTAR_MS * 2));
      const aviso = $("connectivityStatusNotice");
      expect(aviso.dataset.state).toBe("offline");
      expect(aviso.classList.contains("hidden")).toBe(false);
    });

    it("'online' sem queda antes não mostra nada; página aberta sem rede já avisa", () => {
      montar();
      act(() => window.dispatchEvent(new Event("online")));
      expect(talvez("connectivityStatusNotice")).toBeNull();
      act(() => definido(avisos).desmontar());

      online(false);
      montar();
      expect($("connectivityStatusNotice").dataset.state).toBe("offline");
    });
  });
});

bloco("app/casca", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /*
  A casca do app (src/app/casca/): a marcação fixa do #appScreen, que era do
  index.html, desenhada pelo React uma vez e na hora. O resto do app a acha
  pelos mesmos ids e classes de antes.
*/

  const ACOES = [
    "exitExternalPanel",
    "toggleSidebar",
    "refreshData",
    "toggleBrowserFullscreen",
    "reloadExternal",
  ];

  let casca: { desmontar: () => void } | null = null;

  afterEach(() => {
    act(() => casca?.desmontar());
    casca = null;
    for (const nome of ACOES) Reflect.deleteProperty(window, nome);
    document.body.innerHTML = "";
  });

  function montar() {
    document.body.innerHTML =
      '<section id="appScreen" class="app hidden"></section>';
    const raiz = definido(document.getElementById("appScreen"));
    // Como a raiz do app (src/app/raiz.tsx): na hora, com flushSync.
    casca = desenharNoTeste(raiz, createElement(Casca), { sincrono: true });
    return raiz;
  }

  describe("Casca", () => {
    it("desenha na hora (sem esperar o React), dentro do #appScreen, que continua escondido", () => {
      const raiz = montar();
      // Sem act: o código seguinte de src/main.ts procura os ids logo depois.
      expect(raiz.querySelector(":scope > #externalReturnBar")).not.toBeNull();
      expect(
        raiz.querySelector(
          ':scope > aside.sidebar[aria-label="Navegação principal"]',
        ),
      ).not.toBeNull();
      expect(
        raiz.querySelector(":scope > main#conteudoPrincipal.main"),
      ).not.toBeNull();
      expect(raiz.classList).toContain("hidden");
    });

    it("tem os ids que o sistema, as ilhas e o legado procuram", () => {
      montar();
      for (const id of [
        "externalBackBtn",
        "externalBackText",
        "pageTitle",
        "pageSubtitle",
        "pessoasOnlineApp",
        "topUserMenu",
        "topUserAvatar",
        "seloNoAvatarApp",
        "userName",
        "userProfileBadge",
        "topUserPopoverName",
        "userEmail",
        "topUserPopoverProfile",
        "selosDoEditalApp",
        "refreshActionText",
        "fullscreenActionIcon",
        "fullscreenActionText",
        "avisoDeVersaoApp",
        "ayaApp",
        "encerramentoDoEditalApp",
        "broadcastBar",
        "externalTitle",
        "externalRefreshBtn",
        "externalRefreshText",
        "externalOpen",
        "externalMount",
        "configuracoesApp",
        "acessosApp",
        "modulosApp",
        "saudeDasCargasApp",
        "automacaoApp",
      ])
        expect(document.getElementById(id), id).not.toBeNull();
      expect(
        document.querySelector("#conteudoPrincipal > header.top > .title-row"),
      ).not.toBeNull();
      expect(document.getElementById("broadcastBar")?.hidden).toBe(true);
      expect(document.getElementById("conteudoPrincipal")?.tabIndex).toBe(-1);
    });

    it("as seções das telas, na ordem de antes, com a Visão geral ativa", () => {
      montar();
      const secoes = [
        ...document.querySelectorAll(
          "#conteudoPrincipal > .content > section.page",
        ),
      ];
      expect(secoes.map((s) => s.id)).toEqual([
        ...TELAS_DA_CASCA.map((view) => `page-${view}`),
        "page-external",
        "page-config",
        "page-sem-acesso",
        "page-manutencao",
      ]);
      expect(
        secoes.filter((s) => s.classList.contains("active")).map((s) => s.id),
      ).toEqual(["page-dashboard"]);
      // Sem telas registradas (a raiz registra), as seções chegam vazias.
      for (const view of TELAS_DA_CASCA)
        expect(
          document.getElementById(`page-${view}`)?.childNodes,
          view,
        ).toHaveLength(0);
    });

    it("os botões chamam os contratos de window na hora do clique, fechando o menu da conta como antes", () => {
      montar();
      const menu = definido(document.getElementById("topUserMenu"));
      const chamadas: string[] = [];
      for (const nome of ACOES)
        Reflect.set(window, nome, () =>
          chamadas.push(
            `${nome}:${menu.hasAttribute("open") ? "aberto" : "fechado"}`,
          ),
        );
      const clicar = (botao: HTMLElement | null) => {
        menu.setAttribute("open", "");
        act(() => definido(botao).click());
      };
      clicar(document.getElementById("externalBackBtn"));
      for (const botao of document.querySelectorAll<HTMLElement>(
        ".top-user-popover-actions button",
      ))
        clicar(botao);
      clicar(document.getElementById("externalRefreshBtn"));
      expect(chamadas).toEqual([
        "exitExternalPanel:aberto",
        // Atualizar chama e depois fecha; Tela cheia fecha antes.
        "refreshData:aberto",
        "toggleBrowserFullscreen:fechado",
        "reloadExternal:aberto",
      ]);
      expect(menu.hasAttribute("open")).toBe(true);
    });

    it("sem o contrato em window (antes de ligarSistema), o clique não quebra", () => {
      montar();
      expect(() =>
        act(() => definido(document.getElementById("externalBackBtn")).click()),
      ).not.toThrow();
    });

    it("não tem onclick inline: as ações são do React", () => {
      montar();
      expect(document.querySelectorAll("#appScreen [onclick]")).toHaveLength(0);
    });
  });

  describe("faixa do topo", () => {
    /* O topo sozinho com uma navegação falsa parada na tela pedida. */
    function topoNa(view: string, aviso: EstadoDaNavegacao["aviso"] = "") {
      document.body.innerHTML = '<div id="raiz"></div>';
      const estado: EstadoDaNavegacao = {
        ...ESTADO_INICIAL_DA_NAVEGACAO,
        view,
        aviso,
        titulo: "Título",
      };
      const navegacao = {
        obter: () => estado,
        assinar: () => () => {},
        esquecerEditalEVisao: () => {},
        abrirRegrasDoEdital: () => false,
        fecharRegrasDoEdital: () => {},
        voltarDaPaginaDoEdital: () => false,
        irParaInicio: () => {},
      };
      casca = desenharNoTeste(
        definido(document.getElementById("raiz")),
        createElement(
          ContextoDoApp.Provider,
          { value: { navegacao, avisar, pecas: null } },
          createElement(Topo),
        ),
        { sincrono: true },
      );
      return definido(document.querySelector("header.top"));
    }

    it("nas telas com título próprio fica compacta, com o título só para o leitor de tela", () => {
      const topo = topoNa("classificacao");
      expect(topo.hasAttribute("data-compacto")).toBe(true);
      expect(topo.querySelector(".page-title")?.classList).toContain("sr-only");
    });

    it("as outras telas das áreas também usam título no conteúdo; avisos mantêm o da casca", () => {
      expect(topoNa("dashboard").hasAttribute("data-compacto")).toBe(true);
      act(() => casca?.desmontar());
      expect(
        topoNa("classificacao", "sem-acesso").hasAttribute("data-compacto"),
      ).toBe(false);
    });

    it("o CSS compacto vale só fora do celular e tira o perfil do botão", () => {
      const css = readFileSync("src/styles/app.css", "utf8");
      const bloco = css.slice(
        css.indexOf("@media (min-width: 901px) {\n  .top[data-compacto]"),
      );
      expect(bloco).toContain(
        ".top[data-compacto] .top-user-compact-copy .user-profile-badge",
      );
      expect(bloco.slice(0, bloco.indexOf("\n}\n"))).toContain("display: none");
    });
  });

  describe("arranque", () => {
    const main = readFileSync("src/main.ts", "utf8");
    const indice = readFileSync("index.html", "utf8");

    it("src/main.ts desenha a raiz (com a casca) antes de ligar o sistema", () => {
      const raiz = main.indexOf("montarRaiz({");
      expect(raiz).toBeGreaterThan(-1);
      for (const depois of ["ligarSistema();", "ligarEntradaAPagina("])
        expect(main.indexOf(depois), depois).toBeGreaterThan(raiz);
      // Busca global, Aya, Pessoas online… são filhas da raiz, não ilhas.
      expect(main).not.toMatch(/montar(BuscaGlobal|Aya|PessoasOnline)\(/);
      // As telas são rotas da raiz, não ilhas de src/main.ts.
      expect(main).not.toMatch(
        /montar(VisaoGeral|Nucleo|BarraLateral|Casca)\(/,
      );
    });

    it("o index.html só tem a raiz do #appScreen, escondida", () => {
      expect(indice).toContain(
        '<section id="appScreen" class="app hidden"></section>',
      );
      expect(indice).not.toContain('id="conteudoPrincipal"');
      expect(indice).not.toMatch(/\sonclick=/);
    });
  });
});

bloco("app/configuracao", () => {
  /*
  A configuração do sistema (src/app/configuracao.ts): carrega
  TB_CONFIGURACAO, aplica os textos do app e o aviso global, e repassa à
  sessão, à marca da tela de acesso e às seções de Configurações.
*/

  /* O cliente falso só tem `from` (a leitura de TB_CONFIGURACAO). */
  function ehClienteSupabase(cliente: object): cliente is SupabaseClient {
    return "from" in cliente;
  }
  function comoSupabase(cliente: object): SupabaseClient {
    if (!ehClienteSupabase(cliente)) throw new TypeError("cliente sem from");
    return cliente;
  }

  type LinhaDaConfiguracao = { chave: string; valor: string };

  function montar({
    linhas = [],
    erro = null,
  }: {
    linhas?: LinhaDaConfiguracao[];
    erro?: { message: string } | null;
  } = {}) {
    document.body.className = "config-loading";
    document.body.innerHTML = `
    <span id="sidebarVersion"></span>
    <h1 id="pageTitle"></h1>
    <span id="externalBackText"></span>
    <button id="externalBackBtn"></button>
    <div id="externalMount" class="external-placeholder"></div>
    <div id="broadcastBar" hidden></div>`;
    const consulta = vi.fn(() =>
      Promise.resolve({ data: erro ? null : linhas, error: erro }),
    );
    const cliente = {
      from: vi.fn(() => ({ select: consulta })),
    };
    const sessao = { definirConfiguracao: vi.fn() };
    const definirMarca = vi.fn();
    const estado = { definirValoresCarregados: vi.fn() };
    const avisar = vi.fn();
    const pintarBarra = vi.fn();
    const configuracao = criarConfiguracao({
      cliente: () => comoSupabase(cliente),
      avisar,
      sessao,
      definirMarca,
      estado,
      pintarBarra,
    });
    return {
      configuracao,
      cliente,
      sessao,
      definirMarca,
      estado,
      avisar,
      pintarBarra,
    };
  }

  const $ = (id: string) => document.getElementById(id);

  beforeEach(() => {
    document.title = "MONITORA";
  });

  describe("valores", () => {
    it("chave que não veio do banco vale o padrão; a que veio, o valor (mesmo vazio)", async () => {
      const { configuracao } = montar({
        linhas: [
          { chave: "external_back_text", valor: "" },
          { chave: "access_heartbeat_minutos", valor: "9" },
          { chave: "feature_realtime_monitoramento", valor: "não" },
        ],
      });
      expect(configuracao.valor("external_back_text")).toBe(
        PADROES.external_back_text,
      );
      await configuracao.carregar();
      expect(configuracao.valor("external_back_text")).toBe("");
      expect(configuracao.inteiro("access_heartbeat_minutos", 5)).toBe(9);
      expect(
        configuracao.booleano("feature_realtime_monitoramento", true),
      ).toBe(false);
      expect(configuracao.booleano("chave_sem_valor", true)).toBe(true);
    });
  });

  describe("carregar", () => {
    it("a logo e a cor da barra saem desta leitura (sem consulta própria)", async () => {
      const { configuracao, pintarBarra, cliente } = montar({
        linhas: [{ chave: "ui_sidebar_background_color", valor: "#123456" }],
      });
      await configuracao.carregar();
      expect(cliente.from).toHaveBeenCalledTimes(1);
      expect(pintarBarra).toHaveBeenCalledWith(
        expect.objectContaining({ ui_sidebar_background_color: "#123456" }),
      );
    });

    it("leitura com erro não pinta a barra", async () => {
      const { configuracao, pintarBarra } = montar({ erro: { message: "x" } });
      await configuracao.carregar({ silent: true });
      expect(pintarBarra).not.toHaveBeenCalled();
    });

    it("aplica os textos, repassa à sessão, à marca e às Configurações", async () => {
      const { configuracao, sessao, definirMarca, estado } = montar({
        linhas: [
          { chave: "app_version_current", valor: "V3" },
          { chave: "page_title", valor: "Visão geral" },
          { chave: "external_placeholder", valor: "Escolha um painel" },
        ],
      });
      await expect(configuracao.carregar()).resolves.toBe(true);
      expect($("sidebarVersion")?.textContent).toBe("V3");
      expect(configuracao.versao()).toBe("V3");
      // O título da página é da navegação, não da configuração.
      expect($("pageTitle")?.textContent).toBe("");
      expect($("externalMount")?.textContent).toBe("Escolha um painel");
      expect($("externalBackText")?.textContent).toBe("Voltar ao sistema");
      expect($("externalBackBtn")?.getAttribute("aria-label")).toBe(
        "Voltar ao sistema",
      );
      expect(sessao.definirConfiguracao).toHaveBeenCalledWith(
        expect.objectContaining({ page_title: "Visão geral" }),
      );
      expect(definirMarca).toHaveBeenCalledWith(
        expect.objectContaining({ carregou: true }),
      );
      expect(estado.definirValoresCarregados).toHaveBeenCalled();
      expect(document.body.classList.contains("config-loading")).toBe(false);
      // O nome da aba não é a versão publicada.
      expect(document.title).not.toContain("V3");
    });

    it("usa a consulta já disparada (entrada em paralelo)", async () => {
      const { configuracao, cliente } = montar();
      await configuracao.carregar({
        consulta: Promise.resolve({
          data: [{ chave: "page_title", valor: "Da cópia" }],
          error: null,
        }),
      });
      expect(cliente.from).not.toHaveBeenCalled();
      expect(configuracao.valor("page_title")).toBe("Da cópia");
    });

    it("erro: avisa (salvo silent), aplica os padrões e tira o config-loading", async () => {
      const { configuracao, avisar, definirMarca } = montar({
        erro: { message: "fora do ar" },
      });
      await expect(configuracao.carregar()).resolves.toBe(false);
      expect(avisar).toHaveBeenCalledWith(
        "Erro ao carregar configurações: fora do ar",
        "error",
      );
      expect(definirMarca).toHaveBeenCalledWith(
        expect.objectContaining({ carregou: false }),
      );
      expect(document.body.classList.contains("config-loading")).toBe(false);
      avisar.mockClear();
      await configuracao.carregar({ silent: true });
      expect(avisar).not.toHaveBeenCalled();
    });
  });

  describe("aviso global", () => {
    it("aparece com a mensagem do banco, como texto", async () => {
      const { configuracao } = montar({
        linhas: [
          { chave: "broadcast_msg", valor: "<b>Manutenção</b> às 18h" },
          { chave: "broadcast_type", valor: "warning" },
        ],
      });
      await configuracao.carregar();
      const barra = definido($("broadcastBar"));
      expect(barra.hidden).toBe(false);
      expect(barra.textContent).toBe("<b>Manutenção</b> às 18h");
      expect(barra.querySelector("b")).toBeNull();
    });

    it("sem mensagem, fica escondido", async () => {
      const { configuracao } = montar();
      await configuracao.carregar();
      expect($("broadcastBar")?.hidden).toBe(true);
    });
  });

  describe("fundo da tela de acesso gravado em Aparência", () => {
    it("vale na hora, sem esperar a próxima carga", async () => {
      const { configuracao, definirMarca } = montar();
      await configuracao.carregar();
      const parar = configuracao.acompanharFundoDoAcesso();
      document.dispatchEvent(
        new CustomEvent("agsus:fundo-do-acesso-definido", {
          detail: { url: "https://x/fundo.webp", caminho: "fundo.webp" },
        }),
      );
      expect(configuracao.valor("auth_access_background_url")).toBe(
        "https://x/fundo.webp",
      );
      expect(definirMarca).toHaveBeenLastCalledWith(
        expect.objectContaining({
          valores: expect.objectContaining({
            auth_access_background_path: "fundo.webp",
          }),
        }),
      );
      parar();
    });
  });
});

bloco("app/entrada", () => {
  /*
  A tela de acesso (src/app/entrada/): desenha a marca e a configuração que
  vêm de fora (estado da marca, configuração da sessão), as mensagens e o
  botão; a fase da sessão mostra e esconde o #loginScreen e o pedido.
*/

  function sessaoFalsa(inicial: Partial<EstadoDaSessaoNaEntrada> = {}) {
    let estado: EstadoDaSessaoNaEntrada = {
      fase: FASES.DESLOGADO,
      usuario: null,
      mensagem: { texto: "", tom: "" },
      entrando: false,
      erroDeConfiguracao: "",
      consultarPedido: true,
      configuracao: configuracaoDaEntrada(),
      ...inicial,
    };
    const ouvintes = new Set<() => void>();
    return {
      obter: () => estado,
      assinar: (ouvinte: () => void) => {
        ouvintes.add(ouvinte);
        return () => ouvintes.delete(ouvinte);
      },
      definir(parcial: Partial<EstadoDaSessaoNaEntrada>) {
        estado = { ...estado, ...parcial };
        ouvintes.forEach((ouvinte) => ouvinte());
      },
      entrarComGoogle: vi.fn(),
      limparSessao: vi.fn(),
      tentarDeNovo: vi.fn(),
    };
  }

  type SessaoFalsa = ReturnType<typeof sessaoFalsa>;

  /*
  O pedido de acesso de mentira: o estado de antes (a tela só precisa
  montar) e `carregar`/`limpar` espiados. A guarda confere a forma mínima
  e devolve o próprio objeto como o pedido do app.
*/
  function pedidoFalso(): PedidoDeAcesso {
    const estado = {
      usuarioId: "",
      email: "u1@agenciasus.org.br",
      carregando: true,
      status: null,
      formulario: { formulario: "oculto" },
      campos: { nome: "", setor: "", coordenacao: "", justificativa: "" },
      erros: {},
      coordenacoes: [],
      focoNaJustificativa: 0,
    };
    const pedido = {
      obter: () => estado,
      assinar: () => () => {},
      carregar: vi.fn(async () => null),
      limpar: vi.fn(),
    };
    if (!ehPedido(pedido)) throw new TypeError("pedido sem obter/carregar");
    return pedido;
  }
  function ehPedido(pedido: object): pedido is PedidoDeAcesso {
    return "obter" in pedido && "carregar" in pedido;
  }

  let tela: { desmontar(): void } | null = null;

  /*
  Como a raiz do app (src/app/raiz.tsx) faz: o cartão do primeiro quadro sai,
  a tela de acesso desenha na hora no #telaDeEntrada e a página acompanha a
  fase da sessão (src/main.ts: ligarEntradaAPagina).
*/
  function montarEntrada({ sessao, marca, pedido }: PropsDaTelaDeEntrada) {
    const elemento = definido(document.getElementById("telaDeEntrada"));
    elemento.replaceChildren();
    const desligar = ligarEntradaAPagina({ sessao, pedido });
    const desenho = desenharNoTeste(
      elemento,
      createElement(TelaDeEntrada, { sessao, marca, pedido }),
      { sincrono: true, nome: "a tela de acesso" },
    );
    return {
      desmontar() {
        desligar();
        desenho.desmontar();
      },
    };
  }

  async function montar({
    sessao = sessaoFalsa(),
    marca = criarMarcaDaEntrada(),
    pedido = pedidoFalso(),
  }: {
    sessao?: SessaoFalsa;
    marca?: EstadoDaMarcaDaEntrada;
    pedido?: PedidoDeAcesso;
  } = {}) {
    await act(async () => {
      tela = montarEntrada({ sessao, marca, pedido });
    });
    return { sessao, marca, pedido };
  }

  const $ = (id: string) => document.getElementById(id);

  beforeEach(() => {
    document.body.className = "config-loading";
    document.body.innerHTML = `
    <section id="loginScreen" class="login-screen">
      <div id="telaDeEntrada"><div class="login-card" aria-hidden="true"></div></div>
    </section>
    <section id="appScreen" class="app hidden"></section>`;
  });

  afterEach(async () => {
    await act(async () => tela?.desmontar());
    tela = null;
    document.body.innerHTML = "";
    document.body.className = "";
  });

  describe("cartão provisório do index.html", () => {
    /*
    Ele segura o primeiro quadro até o React montar. Se tiver menos peças que o
    cartão de verdade, o cartão cresce na troca e a tela de acesso "pisca".
  */
    const indice = readFileSync("index.html", "utf8");
    const inicio = indice.indexOf('<div id="telaDeEntrada">');
    const provisorio = indice.slice(
      inicio,
      indice.indexOf("</section>", inicio),
    );

    it("tem as mesmas peças do cartão do React: marca, slogan, saudação e botão", () => {
      for (const classe of [
        "login-brand-lockup",
        "login-subtitle",
        "login-form google-only-login",
        "google-login-btn",
      ])
        expect(provisorio).toContain(`class="${classe}"`);
      expect(provisorio).toContain(
        `<h1>${DEFAULT_ACCESS_BRANDING.greeting}</h1>`,
      );
      expect(provisorio).toContain(`<span>${TEXTO_DO_BOTAO}</span>`);
      expect(provisorio).toContain(SLOGAN);
      expect(provisorio).toContain(ACCESS_INSTRUCTION);
      expect(provisorio).toContain(INSTITUICAO);
    });

    /*
    Slogan, nome da Agência e texto do botão ficam numa linha só, em qualquer
    largura (fonte que encolhe e, no limite, reticências): quebrar em duas
    linhas mudava a altura do cartão.
  */
    it("slogan, nome da Agência e texto do botão nunca quebram linha", () => {
      const css =
        readFileSync("src/styles/app.css", "utf8") +
        readFileSync("src/styles/platform-shell.css", "utf8");
      const regra = (seletor: string) => {
        const inicio = css.lastIndexOf(`${seletor} {`);
        expect(inicio, seletor).toBeGreaterThan(-1);
        return css.slice(inicio, css.indexOf("}", inicio));
      };
      for (const seletor of [
        ".login-card .login-subtitle",
        ".login-card .login-instituicao > span",
        ".login-screen .google-login-btn > span",
      ]) {
        expect(regra(seletor)).toContain("white-space: nowrap");
        expect(regra(seletor)).toContain("text-overflow: ellipsis");
      }
      expect(regra(".login-screen .google-login-btn")).toContain(
        "height: 56px",
      );
    });

    it("o botão provisório é inerte (sem clique nem foco)", () => {
      const botao = provisorio.slice(provisorio.indexOf("<button"));
      expect(botao).toMatch(/^<button[^>]*\bdisabled\b/);
      expect(botao).toMatch(/^<button[^>]*tabindex="-1"/);
      expect(botao).not.toContain("id=");
    });

    /*
    A mesma árvore, peça por peça: tag, classes, medidas reservadas (width e
    height do logo e dos ícones) e o estado do texto do botão. Uma peça a mais
    ou a menos de um lado é o cartão mudando de altura ao recarregar.
  */
    it("tem a mesma árvore e as mesmas medidas do cartão do React", async () => {
      type Assinatura = {
        tag: string;
        classes: string;
        medidas: string;
        filhos: Assinatura[];
      };
      const assinatura = (elemento: Element): Assinatura => ({
        tag: elemento.tagName.toLowerCase(),
        classes: elemento.getAttribute("class") || "",
        medidas: ["width", "height", "viewBox", "data-texto"]
          .map((nome) => elemento.getAttribute(nome))
          .join("|"),
        filhos: [...elemento.children].map(assinatura),
      });
      const pagina = new DOMParser().parseFromString(provisorio, "text/html");
      const doIndice = assinatura(
        definido(pagina.querySelector(".login-outer")),
      );
      await montar();
      const doReact = assinatura(
        definido(document.querySelector("#telaDeEntrada .login-outer")),
      );
      expect(doReact).toEqual(doIndice);
    });
  });

  describe("tela de acesso", () => {
    it("troca o cartão vazio do index.html pelo de verdade, com o slogan", async () => {
      await montar();
      expect(document.querySelectorAll(".login-card")).toHaveLength(1);
      expect($("loginSubtitle")?.textContent).toBe(SLOGAN);
      expect(SLOGAN).toBe("Gestão dos processos seletivos");
      expect($("loginGreeting")?.textContent).toBe("Boas-vindas!");
      expect($("googleLoginText")?.textContent).toBe(TEXTO_DO_BOTAO);
      expect($("loginMsg")?.classList.contains("hidden")).toBe(true);
    });

    it("desenha a marca configurada: logo, saudação, texto do botão e rodapé", async () => {
      const marca = criarMarcaDaEntrada();
      await montar({ marca });
      await act(async () =>
        marca.definir({
          logoUrl: "https://exemplo.org/logo.png",
          saudacao: "Bem-vindo ao Agosto Lilás",
          textoDoBotao: "Entrar com a conta da AgSUS",
          rodape: {
            nome: "COGIP",
            logoUrl: "",
            funcao: "Dados",
            versao: "v3",
            departamento: "AgSUS",
          },
        }),
      );
      await act(async () =>
        document
          .querySelector("[data-logo-carregando]")
          ?.dispatchEvent(new Event("load")),
      );
      expect($("loginLogo")?.getAttribute("src")).toBe(
        "https://exemplo.org/logo.png",
      );
      expect($("loginGreeting")?.textContent).toBe("Bem-vindo ao Agosto Lilás");
      expect($("googleLoginText")?.textContent).toBe(
        "Entrar com a conta da AgSUS",
      );
      expect($("loginCogipName")?.textContent).toBe("COGIP");
      expect($("loginCogipRole")?.textContent).toBe("Dados · v3");
      expect($("loginFoot")?.textContent).toBe("AgSUS");
    });

    it("o texto do botão da configuração vence o da marca guardada", async () => {
      const marca = criarMarcaDaEntrada();
      marca.definir({ textoDoBotao: "Da marca guardada" });
      const sessao = sessaoFalsa({
        configuracao: configuracaoDaEntrada({
          auth_google_button_text: "Da configuração",
        }),
      });
      await montar({ sessao, marca });
      expect($("googleLoginText")?.textContent).toBe("Da configuração");
    });

    it("sem rodapé configurado, o bloco institucional não aparece", async () => {
      await montar();
      expect(document.querySelector(".login-cogip")).toBeNull();
    });

    it("logo que não carrega some sem sair do lugar (tamanho reservado)", async () => {
      await montar();
      expect($("loginLogo")?.getAttribute("width")).toBe("52");
      expect($("loginLogo")?.getAttribute("height")).toBe("52");
      await act(async () => $("loginLogo")?.dispatchEvent(new Event("error")));
      expect($("loginLogo")?.hidden).toBe(false);
      expect($("loginLogo")?.hasAttribute("data-falhou")).toBe(true);
    });

    /*
    13/11/2026: a tela de acesso piscava a cada recarga. O primeiro quadro tem
    o logo local; a marca do banco trazia o mesmo logo em outro domínio, e o
    logo sumia até a imagem nova chegar.
  */
    it("começa no logo do primeiro quadro, mesmo com outro na marca guardada", async () => {
      const marca = criarMarcaDaEntrada();
      marca.definir({
        logoUrl: "https://dominio-antigo.exemplo.org/logo.webp",
      });
      await montar({ marca });
      const primeiroQuadro = new DOMParser()
        .parseFromString(readFileSync("index.html", "utf8"), "text/html")
        .querySelector(".login-organization-mark img")
        ?.getAttribute("src");
      expect($("loginLogo")?.getAttribute("src")).toBe(primeiroQuadro);
      expect(
        document.querySelector("[data-logo-carregando]")?.getAttribute("src"),
      ).toBe("https://dominio-antigo.exemplo.org/logo.webp");
    });

    it("logo novo só entra depois de carregado: o de antes fica até lá", async () => {
      const marca = criarMarcaDaEntrada();
      await montar({ marca });
      const antes = $("loginLogo")?.getAttribute("src");
      await act(async () =>
        marca.definir({ logoUrl: "https://outro.exemplo.org/logo.webp" }),
      );
      expect($("loginLogo")?.getAttribute("src")).toBe(antes);
      expect($("loginLogo")?.hasAttribute("data-falhou")).toBe(false);
      const proximo = document.querySelector<HTMLImageElement>(
        "[data-logo-carregando]",
      );
      expect(proximo?.hidden).toBe(true);
      expect(proximo?.getAttribute("src")).toBe(
        "https://outro.exemplo.org/logo.webp",
      );
      await act(async () => proximo?.dispatchEvent(new Event("load")));
      expect($("loginLogo")?.getAttribute("src")).toBe(
        "https://outro.exemplo.org/logo.webp",
      );
      expect(document.querySelector("[data-logo-carregando]")).toBeNull();
    });

    it("logo novo que não carrega some sem sair do lugar", async () => {
      const marca = criarMarcaDaEntrada();
      await montar({ marca });
      await act(async () =>
        marca.definir({ logoUrl: "https://outro.exemplo.org/quebrado.webp" }),
      );
      await act(async () =>
        document
          .querySelector("[data-logo-carregando]")
          ?.dispatchEvent(new Event("error")),
      );
      expect($("loginLogo")?.getAttribute("src")).toBe(
        "https://outro.exemplo.org/quebrado.webp",
      );
      expect($("loginLogo")?.hasAttribute("data-falhou")).toBe(true);
    });

    it("Google desligado nas configurações: sem botão, mas o lugar fica", async () => {
      const sessao = sessaoFalsa();
      await montar({ sessao });
      expect($("googleLoginBtn")).not.toBeNull();
      await act(async () =>
        sessao.definir({
          configuracao: configuracaoDaEntrada({ auth_google_enabled: "false" }),
        }),
      );
      expect($("googleLoginBtn")).toBeNull();
      const reservado = document.querySelector(".google-login-btn--reservado");
      expect(reservado?.classList.contains("google-login-btn")).toBe(true);
      expect(reservado?.getAttribute("aria-hidden")).toBe("true");
    });

    it("o texto do botão só aparece quando a marca é conhecida", async () => {
      const marca = criarMarcaDaEntrada();
      await montar({ marca });
      expect($("googleLoginBtn")?.dataset.texto).toBe("pendente");
      await act(async () =>
        marca.definir({ textoDoBotao: "Entrar com a AgSUS", resolvida: true }),
      );
      expect($("googleLoginBtn")?.dataset.texto).toBe("pronto");
      expect($("googleLoginText")?.textContent).toBe("Entrar com a AgSUS");
    });

    it("o texto da configuração já basta para mostrar o botão", async () => {
      await montar({
        sessao: sessaoFalsa({
          configuracao: configuracaoDaEntrada({
            auth_google_button_text: "Da configuração",
          }),
        }),
      });
      expect($("googleLoginBtn")?.dataset.texto).toBe("pronto");
    });

    it("a linha de apoio e o rodapé institucional com o escudo", async () => {
      await montar();
      expect($("loginApoio")?.textContent).toBe(ACCESS_INSTRUCTION);
      expect($("loginInstituicao")?.textContent).toBe(INSTITUICAO);
      expect(
        $("loginInstituicao")?.querySelector("svg.login-instituicao-icone"),
      ).not.toBeNull();
      expect($("googleLoginBtn")?.querySelector("svg.gmark")).not.toBeNull();
    });

    it("o botão chama a sessão e fica ocupado enquanto entra", async () => {
      const { sessao } = await montar();
      await clicar($("googleLoginBtn"));
      expect(sessao.entrarComGoogle).toHaveBeenCalled();
      await act(async () =>
        sessao.definir({
          entrando: true,
          mensagem: { texto: "Escolha sua conta.", tom: "warn" },
        }),
      );
      expect(
        document.querySelector<HTMLButtonElement>("#googleLoginBtn")?.disabled,
      ).toBe(true);
      expect($("googleLoginBtn")?.getAttribute("aria-busy")).toBe("true");
      expect($("googleLoginText")?.textContent).toBe(TEXTO_DO_BOTAO_OCUPADO);
      expect($("loginMsg")?.className).toBe("alert warn");
      expect($("loginMsg")?.textContent).toBe("Escolha sua conta.");
    });

    it("perfil ilegível: o erro e Tentar de novo, não o pedido de acesso", async () => {
      const { sessao } = await montar({
        sessao: sessaoFalsa({
          fase: FASES.FALHA_NA_ENTRADA,
          mensagem: { texto: "Não deu.", tom: "error" },
        }),
      });
      expect($("loginMsg")?.textContent).toBe("Não deu.");
      expect(document.querySelector(".solicitacao-marca")).toBeNull();
      await clicar($("tentarDeNovoBtn"));
      expect(sessao.tentarDeNovo).toHaveBeenCalled();
      await act(async () => sessao.definir({ fase: FASES.DESLOGADO }));
      expect($("tentarDeNovoBtn")).toBeNull();
    });

    it("sem as variáveis do Supabase: o aviso de configuração", async () => {
      await montar({
        sessao: sessaoFalsa({ erroDeConfiguracao: "Configure o Supabase." }),
      });
      expect($("configMsg")?.textContent).toBe("Configure o Supabase.");
      expect($("configMsg")?.getAttribute("role")).toBe("alert");
    });

    it("não usa innerHTML: texto do banco entra como texto", async () => {
      const marca = criarMarcaDaEntrada();
      await montar({ marca });
      await act(async () =>
        marca.definir({ saudacao: "<img src=x onerror=alert(1)>" }),
      );
      expect($("loginGreeting")?.textContent).toBe(
        "<img src=x onerror=alert(1)>",
      );
      expect($("loginGreeting")?.querySelector("img")).toBeNull();
    });
  });

  describe("a fase da sessão na página", () => {
    it("conectado: a tela de acesso some; deslogado: volta", async () => {
      const { sessao } = await montar();
      expect($("loginScreen")?.classList.contains("hidden")).toBe(false);
      await act(async () => sessao.definir({ fase: FASES.CONECTADO }));
      expect($("loginScreen")?.classList.contains("hidden")).toBe(true);
      await act(async () => sessao.definir({ fase: FASES.DESLOGADO }));
      expect($("loginScreen")?.classList.contains("hidden")).toBe(false);
    });

    it("sem acesso: modo do pedido, cartão e carga do pedido (uma vez por pessoa)", async () => {
      const { sessao, pedido } = await montar();
      const usuario = { id: "u1", email: "u1@agenciasus.org.br" };
      await act(async () =>
        sessao.definir({
          fase: FASES.SEM_ACESSO,
          usuario,
          consultarPedido: true,
        }),
      );
      expect(document.body.classList.contains("access-request-mode")).toBe(
        true,
      );
      expect($("accessRequestCard")).not.toBeNull();
      expect(pedido.carregar).toHaveBeenCalledWith({
        usuario,
        consultar: true,
      });

      await act(async () =>
        sessao.definir({ mensagem: { texto: "x", tom: "warn" } }),
      );
      expect(pedido.carregar).toHaveBeenCalledTimes(1);

      // Outra conta no meio do pedido: carrega de novo, para ela.
      const outra = { id: "u2", email: "u2@agenciasus.org.br" };
      await act(async () => sessao.definir({ usuario: outra }));
      expect(pedido.carregar).toHaveBeenLastCalledWith({
        usuario: outra,
        consultar: true,
      });

      await act(async () =>
        sessao.definir({ fase: FASES.DESLOGADO, usuario: null }),
      );
      expect(document.body.classList.contains("access-request-mode")).toBe(
        false,
      );
      expect($("accessRequestCard")).toBeNull();
      expect(pedido.limpar).toHaveBeenCalled();
    });

    it("a marca pública só é pedida quando a tela de acesso aparece", () => {
      const sessao = sessaoFalsa({ fase: FASES.ABRINDO });
      const atualizarMarca = vi.fn();
      ligarEntradaAPagina({ sessao, pedido: pedidoFalso(), atualizarMarca });
      sessao.definir({ fase: FASES.CONECTADO });
      // Sessão guardada que abriu o sistema: a tela de acesso não apareceu.
      expect(atualizarMarca).not.toHaveBeenCalled();
      sessao.definir({ fase: FASES.DESLOGADO });
      expect(atualizarMarca).toHaveBeenCalled();
    });

    it("ligar e desligar não deixa assinatura para trás", () => {
      const sessao = sessaoFalsa();
      const desligar = ligarEntradaAPagina({ sessao, pedido: pedidoFalso() });
      desligar();
      sessao.definir({ fase: FASES.CONECTADO });
      expect($("loginScreen")?.classList.contains("hidden")).toBe(false);
    });
  });
});

bloco("app/error-boundary", () => {
  /*
  O ErrorBoundary de src/app/: erro de render num filho vira um aviso curto
  (com "Tentar de novo"), o erro vai para o console, e o resto da página fica.
*/

  let raiz: Root | null = null;
  let espiaoDoConsole: MockInstance<typeof console.error>;

  beforeEach(() => {
    // O React também reclama no console de erro capturado; o teste só confere o nosso.
    espiaoDoConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    document.body.innerHTML = `<div id="fora">fora</div><div id="raiz"></div>`;
  });

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    espiaoDoConsole.mockRestore();
    document.body.innerHTML = "";
  });

  async function montar(elemento: ReactElement) {
    await act(async () => {
      const novaRaiz = createRoot(definido(document.getElementById("raiz")));
      raiz = novaRaiz;
      novaRaiz.render(elemento);
    });
  }

  describe("ErrorBoundary", () => {
    it("desenha os filhos quando não há erro", async () => {
      await montar(
        createElement(
          ErrorBoundary,
          null,
          createElement("p", null, "conteúdo"),
        ),
      );
      expect(document.getElementById("raiz")?.textContent).toBe("conteúdo");
      expect(document.querySelector("[role=alert]")).toBeNull();
    });

    it("captura o erro do filho, mostra o aviso e registra no console", async () => {
      function Quebra(): ReactNode {
        throw new Error("falhou o render");
      }
      await montar(
        createElement(
          ErrorBoundary,
          { nome: "o teste" },
          createElement(Quebra),
        ),
      );
      const aviso = document.querySelector(".ui-erro-do-modulo[role=alert]");
      expect(aviso).not.toBeNull();
      expect(aviso?.textContent).toContain("Não foi possível mostrar");
      expect(aviso?.querySelector("button")?.textContent).toBe(
        "Tentar de novo",
      );
      // O resto da página continua lá.
      expect(document.getElementById("fora")?.textContent).toBe("fora");
      const nosso = espiaoDoConsole.mock.calls.find((chamada) =>
        String(chamada[0]).includes("[Yeendé] Erro ao desenhar o teste"),
      );
      expect(nosso?.[1]?.message).toBe("falhou o render");
      // O código curto do registro, para a pessoa passar ao suporte.
      expect(
        aviso?.querySelector(".ui-erro-do-modulo__codigo")?.textContent,
      ).toMatch(/^Código do erro: [0-9A-F]{8}$/);
    });

    it("“Tentar de novo” remonta os filhos do zero", async () => {
      let falhar = true;
      let montagens = 0;
      function Instavel() {
        if (falhar) throw new Error("ainda não");
        montagens += 1;
        return createElement("p", null, "voltou");
      }
      await montar(createElement(ErrorBoundary, null, createElement(Instavel)));
      expect(document.querySelector(".ui-erro-do-modulo")).not.toBeNull();

      falhar = false;
      await clicar(document.querySelector(".ui-erro-do-modulo button"));
      expect(document.querySelector(".ui-erro-do-modulo")).toBeNull();
      expect(document.getElementById("raiz")?.textContent).toBe("voltou");
      expect(montagens).toBeGreaterThan(0);
    });
  });
});

bloco("app/registro-de-erros", () => {
  /*
    O registro dos erros do navegador (src/app/registro-de-erros.ts) com as
    dependências simuladas: escuta error/unhandledrejection, só manda com
    sessão, não repete em 30 s, para de mandar depois de PGRST202 (migration
    ainda não aplicada) e nunca lança.
  */
  type Envio = Parameters<DependenciasDoRegistro["enviar"]>[0];

  function montar(mudancas: Partial<DependenciasDoRegistro> = {}) {
    const enviados: Envio[] = [];
    let agora = 1_000;
    let n = 0;
    const deps: DependenciasDoRegistro = {
      enviar: async (pedido) => {
        enviados.push(pedido);
        return { error: null };
      },
      temSessao: async () => true,
      agora: () => agora,
      online: () => true,
      rota: () => "/sede/editais",
      area: () => "sede",
      versao: "abc123",
      novaReferencia: () => `ref-${String((n += 1)).padStart(4, "0")}`,
      ...mudancas,
    };
    const registro = criarRegistroDeErros(deps);
    return {
      registro,
      enviados,
      andar: (ms: number) => {
        agora += ms;
      },
    };
  }
  const esperar = () => new Promise((r) => setTimeout(r, 0));

  it("escuta error e unhandledrejection da janela e desliga", async () => {
    const { registro, enviados } = montar();
    const janela = new EventTarget();
    const desligar = registro.ouvir(janela);
    const evento = new ErrorEvent("error", {
      error: new Error("quebrou para pessoa@exemplo.org"),
      message: "Uncaught Error",
      filename: "https://yeende.vercel.app/assets/a.js",
      lineno: 3,
      colno: 9,
    });
    janela.dispatchEvent(evento);
    const rejeicao = new Event("unhandledrejection");
    Object.defineProperty(rejeicao, "reason", {
      value: { message: "permissão", code: "42501" },
    });
    janela.dispatchEvent(rejeicao);
    await esperar();
    expect(enviados.map((p) => [p.p_tipo, p.p_mensagem])).toEqual([
      ["CLIENTE", "quebrou para [e-mail]"],
      ["BANCO", "permissão"],
    ]);
    expect(enviados[0]?.p_contexto).toMatchObject({
      origem: "janela",
      arquivo: "/assets/a.js",
      linha: 3,
      coluna: 9,
    });
    expect(enviados[0]).toMatchObject({
      p_rota: "/sede/editais",
      p_area: "sede",
      p_versao: "abc123",
    });

    desligar();
    janela.dispatchEvent(
      new ErrorEvent("error", { error: new Error("depois") }),
    );
    await esperar();
    expect(enviados).toHaveLength(2);
  });

  it("o mesmo erro em 30 s não vai de novo e devolve a referência do primeiro", async () => {
    const { registro, enviados, andar } = montar();
    const primeiro = registro.registrarErro({
      erro: new Error("x"),
      origem: "tela",
    });
    andar(29_000);
    expect(
      registro.registrarErro({ erro: new Error("x"), origem: "tela" }),
    ).toBe(primeiro);
    andar(1_000);
    expect(
      registro.registrarErro({ erro: new Error("x"), origem: "tela" }),
    ).not.toBe(primeiro);
    await esperar();
    expect(enviados).toHaveLength(2);
  });

  it("sem sessão não manda, mas devolve a referência", async () => {
    const { registro, enviados } = montar({ temSessao: async () => false });
    expect(
      registro.registrarErro({ erro: new Error("x"), origem: "tela" }),
    ).toBe("ref-0001");
    await esperar();
    expect(enviados).toEqual([]);
  });

  it("depois de PGRST202 para de mandar naquela página, em silêncio", async () => {
    const pedidos: Envio[] = [];
    const { registro } = montar({
      enviar: async (pedido) => {
        pedidos.push(pedido);
        return { error: { code: "PGRST202" } };
      },
    });
    registro.registrarErro({ erro: new Error("a"), origem: "tela" });
    await esperar();
    registro.registrarErro({ erro: new Error("b"), origem: "tela" });
    registro.registrarErro({ erro: new Error("c"), origem: "tela" });
    await esperar();
    expect(pedidos.map((p) => p.p_mensagem)).toEqual(["a"]);
  });

  it("nunca lança, nem com o envio quebrando; no máximo 50 envios por página", async () => {
    let tentativas = 0;
    const { registro } = montar({
      enviar: async () => {
        tentativas += 1;
        throw new Error("rede caiu");
      },
    });
    for (let i = 0; i < MAXIMO_DE_ENVIOS_POR_PAGINA + 10; i += 1)
      expect(() =>
        registro.registrarErro({ erro: new Error(`e${i}`), origem: "tela" }),
      ).not.toThrow();
    await esperar();
    expect(tentativas).toBe(MAXIMO_DE_ENVIOS_POR_PAGINA);
  });

  it("ruído (extensão do navegador) não vai", async () => {
    const { registro, enviados } = montar();
    registro.registrarErro({
      erro: null,
      origem: "janela",
      arquivo: "chrome-extension://abc/x.js",
    });
    await esperar();
    expect(enviados).toEqual([]);
  });
});

bloco("app/gaveta-do-celular", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /*
  No celular a navegação é uma só: o ☰ do cabeçalho abre a barra lateral como
  gaveta por cima do conteúdo (src/app/casca/gaveta-do-celular.tsx). Não há
  menu preso ao pé da tela. Escolher uma página, tocar fora e o Esc fecham; a
  gaveta fechada sai do Tab (`inert`) e, aberta, é o resto que sai.
*/

  const LARGURA_ORIGINAL = window.innerWidth;
  const MATCH_MEDIA_ORIGINAL = window.matchMedia;

  /* O contrato que o app publica em window (src/app/sistema.ts). */
  const janela: Window & { toggleSidebar?: () => void } = window;

  let casca: ReturnType<typeof desenharNoTeste> | null = null;
  let desligarMoldura: (() => void) | null = null;

  async function largura(px: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: px,
    });
    await act(async () => window.dispatchEvent(new Event("resize")));
  }

  async function montar(px = 390) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: px,
    });
    document.body.className = "sidebar-collapsed";
    document.body.innerHTML = '<section id="appScreen" class="app"></section>';
    const moldura = criarMoldura({ armazenamento: () => null });
    janela.toggleSidebar = moldura.alternarBarra;
    // A casca liga a moldura à página (MolduraNaPagina); aqui, sem as peças, à mão.
    desligarMoldura = moldura.ligarNaPagina();
    // A casca já traz a barra lateral (src/app/casca/casca.tsx).
    await act(async () => {
      casca = desenharNoTeste(
        document.getElementById("appScreen"),
        createElement(Casca),
        { sincrono: true },
      );
    });
    await act(async () =>
      atualizarMenuLateral(
        montarArvoreDoMenu({
          permitidas: { dashboard: true, nucleo: true, calendario: true },
          areas: ["saude-indigena"],
        }),
        { navegar: (view: string) => marcarItemAtivoNoMenu(view) },
      ),
    );
    await act(async () => marcarItemAtivoNoMenu("nucleo"));
  }

  const aside = () => achar("#appScreen .sidebar");
  const conteudo = () => achar("#conteudoPrincipal");
  const veu = () => achar("#sidebarOverlay");
  const botao = () => achar("#globalSidebarToggle");
  const aberta = () => !document.body.classList.contains("sidebar-collapsed");
  const clicar = (elemento: HTMLElement | null) =>
    act(async () => definido(elemento).click());
  /* O elemento com o foco (HTML, com `dataset`). */
  const ativo = () => {
    const elemento = document.activeElement;
    if (!(elemento instanceof HTMLElement))
      throw new TypeError("Sem elemento HTML com o foco");
    return elemento;
  };

  async function abrir() {
    await clicar(botao());
    expect(aberta()).toBe(true);
  }

  beforeEach(() => {
    // Só `matches`, que é o que a casca lê (sem o resto do MediaQueryList).
    Reflect.set(window, "matchMedia", (consulta: string) => ({
      matches:
        window.innerWidth <=
        Number(/max-width:\s*(\d+)px/.exec(consulta)?.[1] ?? 0),
    }));
    localStorage.clear();
  });

  afterEach(async () => {
    desligarMoldura?.();
    desligarMoldura = null;
    await act(async () => casca?.desmontar());
    casca = null;
    await act(async () => redefinirBarraLateral());
    await act(async () => redefinirDadosDoMonitoramento());
    delete janela.toggleSidebar;
    window.matchMedia = MATCH_MEDIA_ORIGINAL;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: LARGURA_ORIGINAL,
    });
    document.body.className = "";
    document.body.innerHTML = "";
  });

  describe("navegação no celular", () => {
    it("não há menu no pé da tela nem outro ☰: só o botão da gaveta no topo", async () => {
      await montar();
      expect(document.getElementById("mobileBottomNav")).toBeNull();
      expect(document.querySelector(".mobile-bottom-nav")).toBeNull();
      expect(document.getElementById("hambToggle")).toBeNull();
      expect(
        document.querySelectorAll("header.top .title-row button"),
      ).toHaveLength(1);
      expect(botao().closest("header.top .title-row")).not.toBeNull();
    });

    it("fechada, a gaveta sai do Tab e o véu some", async () => {
      await montar();
      expect(aberta()).toBe(false);
      expect(aside().hasAttribute("inert")).toBe(true);
      expect(conteudo().hasAttribute("inert")).toBe(false);
      expect(veu().hidden).toBe(true);
      expect(botao().getAttribute("aria-expanded")).toBe("false");
    });

    it("o ☰ abre a mesma barra lateral por cima; o foco vai para a página atual", async () => {
      await montar();
      await abrir();
      expect(aside().hasAttribute("inert")).toBe(false);
      expect(conteudo().hasAttribute("inert")).toBe(true);
      expect(veu().hidden).toBe(false);
      expect(veu().getAttribute("aria-label")).toBe("Fechar menu");
      expect(botao().getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(
        document.querySelector('#nav [aria-current="page"]'),
      );
      expect(ativo().dataset.view).toBe("nucleo");
    });

    it("Esc fecha e o foco volta para o ☰", async () => {
      await montar();
      await abrir();
      await act(async () =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
      );
      expect(aberta()).toBe(false);
      expect(aside().hasAttribute("inert")).toBe(true);
      expect(conteudo().hasAttribute("inert")).toBe(false);
      expect(document.activeElement).toBe(botao());
    });

    it("tocar fora (no véu) fecha", async () => {
      await montar();
      await abrir();
      await clicar(veu());
      expect(aberta()).toBe(false);
      expect(veu().hidden).toBe(true);
    });

    it("escolher uma página fecha; abrir uma área, não", async () => {
      await montar();
      await abrir();
      await clicar(
        document.querySelector<HTMLElement>(
          '.menu-area[data-area="saude-indigena"] .menu-area__cabecalho',
        ),
      );
      expect(aberta()).toBe(true);
      await clicar(
        document.querySelector<HTMLElement>(
          '.menu-item[data-view="calendario"]',
        ),
      );
      expect(aberta()).toBe(false);
      expect(
        document.querySelector<HTMLElement>('#nav [aria-current="page"]')
          ?.dataset.view,
      ).toBe("calendario");
    });

    it("Esc com a gaveta fechada não a abre", async () => {
      await montar();
      await act(async () =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
      );
      expect(aberta()).toBe(false);
    });

    it("no computador, a barra recolhida continua navegável e não há véu", async () => {
      await montar(1280);
      expect(aside().hasAttribute("inert")).toBe(false);
      expect(conteudo().hasAttribute("inert")).toBe(false);
      expect(veu().hidden).toBe(true);
      // Passou de celular para computador com a gaveta aberta: tudo navegável.
      await largura(390);
      document.body.classList.remove("sidebar-collapsed");
      await largura(1280);
      expect(aside().hasAttribute("inert")).toBe(false);
      expect(conteudo().hasAttribute("inert")).toBe(false);
    });
  });

  describe("o que saiu com o menu do pé da tela", () => {
    const ler = (caminho: string) => readFileSync(caminho, "utf8");

    it("nenhum módulo, estilo ou recuo do menu inferior sobra no código", () => {
      const main = ler("src/main.ts");
      expect(main).not.toContain("mobile-bottom-navigation");
      expect(main).not.toContain("mobile-app-experience");
      expect(main).not.toContain("mobile-table-cards.js");
      expect(ler("src/styles/tokens.css")).not.toContain(
        "--recuo-da-navegacao-inferior",
      );
      for (const nome of [
        "aya-tours.ts",
        ...readdirSync("src/lib/aya/tours"),
      ]) {
        const caminho =
          nome === "aya-tours.ts"
            ? "src/lib/aya/aya-tours.ts"
            : `src/lib/aya/tours/${nome}`;
        expect(ler(caminho)).not.toContain("mobileBottomNav");
      }
    });
  });
});

bloco("app/moldura-na-casca", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /*
  A moldura (src/app/moldura.ts) é um store; a casca a leva para a página
  (MolduraNaPagina em src/app/casca/pecas.tsx): classes de body/html, o
  ícone da tela cheia e o cabeçalho do relatório em PDF. Desmontada, solta a
  página. No StrictMode, liga uma vez só no fim.
*/

  // A navegação parada no início (o dashboard, sem área nem edital).
  const ESTADO_DA_NAVEGACAO = ESTADO_INICIAL_DA_NAVEGACAO;
  const NAVEGACAO: LeituraDaNavegacao = {
    obter: () => ESTADO_DA_NAVEGACAO,
    assinar: () => () => {},
    esquecerEditalEVisao: () => {},
    abrirRegrasDoEdital: () => false,
    fecharRegrasDoEdital: () => {},
    voltarDaPaginaDoEdital: () => false,
    irParaInicio: () => {},
  };

  /* Sem a tela de acesso (`lugares.entrada` nulo), a raiz não lê sessão, marca nem pedido. */
  const SEM_ENTRADA: Pick<PropsDaRaiz, "sessao" | "marca" | "pedido"> = {
    // @ts-expect-error -- nula de propósito: sem a tela de acesso, não é lida.
    sessao: null,
    // @ts-expect-error -- nula de propósito: sem a tela de acesso, não é lida.
    marca: null,
    // @ts-expect-error -- nulo de propósito: sem a tela de acesso, não é lido.
    pedido: null,
  };

  function janelaFalsa() {
    const ouvintes: OuvintesDaJanela = {};
    return janelaCom({
      matchMedia: () => ({ matches: false }),
      addEventListener: (nome: string, funcao: OuvinteDaJanela) =>
        (ouvintes[nome] ||= new Set()).add(funcao),
      removeEventListener: (nome: string, funcao: OuvinteDaJanela) =>
        ouvintes[nome]?.delete(funcao),
      dispatchEvent: vi.fn(),
      contar: (nome: string) => ouvintes[nome]?.size ?? 0,
    });
  }

  /* As outras peças do sistema, paradas (só a moldura importa aqui). */
  function pecasParadas(): PecasDoApp {
    const parado = <T>(valor: T) => ({
      obter: () => valor,
      assinar: () => () => {},
    });
    return {
      presenca: {
        ...parado<EstadoDaPresenca>(
          Object.freeze({
            visivel: false,
            aberto: false,
            sincronizado: false,
            desde: 0,
            pessoas: [],
          }),
        ),
        alternar() {},
        fechar() {},
      },
      avisoDeVersao: {
        ...parado<EstadoDoAviso>(
          Object.freeze({
            versaoNova: null,
            novidade: null,
            telaAntiga: false,
            fechado: false,
            pendencia: false,
            atualizando: false,
          }),
        ),
        // Parado: nada confere, liga ou recarrega.
        conferir: async () => false,
        aoSinalDeTelaAntiga: async () => {},
        iniciar() {},
        parar() {},
        fechar() {},
        atualizarAgora: () => false,
      },
      encerramento: {
        ...parado<EstadoDoEncerramento>(
          Object.freeze({
            aberto: null,
            encerramentos: [],
            fogosJaSoltos: new Set<string>(),
          }),
        ),
        // Parado: nada lê, acompanha nem esquece (o desassinar diz se saiu).
        assinar: () => () => false,
        verificar: async () => [],
        fechar: async () => {},
        editalConcluidoNaTela() {},
        acompanhar: () => () => {},
        esquecer() {},
      },
      appAberto: parado(false),
      estaConectado: () => false,
    };
  }

  let raiz: Root | null = null;
  // O primeiro quadro (index.html): a barra recolhida.
  beforeEach(() => {
    document.body.className = "sidebar-collapsed";
  });
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.className = "";
    document.body.innerHTML = "";
    document.documentElement.setAttribute("data-theme", "");
  });

  function montar(moldura: Moldura) {
    document.body.className = "sidebar-collapsed";
    document.body.innerHTML =
      '<section id="appScreen" class="app hidden"></section><div id="raiz"></div>';
    const novaRaiz = createRoot(achar("#raiz"));
    raiz = novaRaiz;
    act(() =>
      novaRaiz.render(
        createElement(
          StrictMode,
          null,
          createElement(Raiz, {
            navegacao: NAVEGACAO,
            ...SEM_ENTRADA,
            pecas: { ...pecasParadas(), moldura },
            lugares: {
              entrada: null,
              casca: document.getElementById("appScreen"),
            },
          }),
        ),
      ),
    );
  }

  describe("a moldura na casca", () => {
    it("a casca aplica o tema e a barra e acompanha a página; desmontada, solta", () => {
      const janela = janelaFalsa();
      const moldura = criarMoldura({ janela, armazenamento: () => null });
      montar(moldura);
      // StrictMode: ligou, desligou e ligou — um ouvinte de cada, só.
      expect(janela.contar("resize")).toBe(1);
      expect(janela.contar("storage")).toBe(1);
      act(() => moldura.alternarTema());
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.body.classList).toContain("dark-mode");
      act(() => moldura.alternarBarra());
      expect(document.body.classList).not.toContain("sidebar-collapsed");

      act(() => definido(raiz).unmount());
      raiz = null;
      expect(janela.contar("resize")).toBe(0);
      moldura.alternarTema();
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("o ícone da tela cheia lê o estado", () => {
      const moldura = criarMoldura({
        janela: janelaFalsa(),
        armazenamento: () => null,
        avisar: vi.fn(),
        areaAtual: () => "sede",
      });
      montar(moldura);
      const icone = () => document.getElementById("fullscreenActionIcon");
      expect(icone()?.className).toBe("fa-solid fa-expand");
      act(() => moldura.alternarTelaCheia());
      expect(icone()?.className).toBe("fa-solid fa-compress");
      // O cabeçalho do relatório impresso saiu (o menu abre o montador).
      expect(document.getElementById("printReportHeader")).toBeNull();
    });
  });
});

bloco("app/moldura", () => {
  /*
  A moldura do app (src/app/moldura.ts): um store (barra, tema, tela cheia e
  o cabeçalho do PDF) que a casca liga à página (`ligarNaPagina`: classes de
  body/html, eventos da barra, largura, outra aba e tela cheia).
*/

  let desligar: (() => void) | null = null;

  function janelaFalsa({ celular = false }: { celular?: boolean } = {}) {
    const ouvintes: OuvintesDaJanela = {};
    return janelaCom({
      matchMedia: () => ({ matches: celular }),
      addEventListener: (nome: string, funcao: OuvinteDaJanela) => {
        (ouvintes[nome] ||= new Set()).add(funcao);
      },
      removeEventListener: (nome: string, funcao: OuvinteDaJanela) =>
        ouvintes[nome]?.delete(funcao),
      dispatchEvent: vi.fn(),
      emitir: (nome: string, evento: unknown = {}) =>
        ouvintes[nome]?.forEach((funcao) => funcao(evento)),
    });
  }

  function montar(
    opcoes: { celular?: boolean; extras?: Partial<OpcoesDaMoldura> } = {},
  ) {
    const janela = janelaFalsa(opcoes);
    const avisar = vi.fn();
    const moldura = criarMoldura({
      janela,
      avisar,
      ...opcoes.extras,
    });
    // Como a casca faz ao montar (src/app/casca/pecas.tsx, MolduraNaPagina).
    desligar?.();
    desligar = moldura.ligarNaPagina();
    return { moldura, janela, avisar };
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.documentElement.setAttribute("data-theme", "");
    document.body.innerHTML = `<i id="fullscreenActionIcon"></i><div class="content"><p>conteúdo</p></div>`;
  });
  afterEach(() => {
    desligar?.();
    desligar = null;
    vi.useRealTimers();
    redefinirDadosDoMonitoramento();
  });

  describe("barra lateral", () => {
    it("no computador, recolhe/expande, guarda e avisa a barra React", () => {
      const { moldura } = montar();
      const aviso = vi.fn();
      document.addEventListener(EVENTO_BARRA_ALTERNADA, aviso);
      moldura.alternarBarra();
      expect(document.body.classList).toContain("sidebar-collapsed");
      expect(localStorage.getItem(CHAVE_DA_BARRA_RECOLHIDA)).toBe("1");
      moldura.alternarBarra();
      expect(localStorage.getItem(CHAVE_DA_BARRA_RECOLHIDA)).toBe("0");
      expect(aviso).toHaveBeenCalled();
      document.removeEventListener(EVENTO_BARRA_ALTERNADA, aviso);
    });

    it("reaplica a escolha guardada (só no computador)", () => {
      localStorage.setItem(CHAVE_DA_BARRA_RECOLHIDA, "1");
      montar().moldura.aplicarBarraGuardada();
      expect(document.body.classList).toContain("sidebar-collapsed");
      document.body.className = "";
      montar({ celular: true }).moldura.aplicarBarraGuardada();
      expect(document.body.classList).not.toContain("sidebar-collapsed");
    });

    it("no celular, abre por cima e recolhe ao mudar a largura", () => {
      vi.useFakeTimers();
      const { moldura, janela } = montar({ celular: true });
      moldura.ajustarBarra();
      expect(document.body.classList).toContain("sidebar-collapsed");
      moldura.alternarBarra();
      expect(document.body.classList).toContain("sidebar-open");
      expect(document.body.classList).not.toContain("sidebar-collapsed");
      expect(localStorage.getItem(CHAVE_DA_BARRA_RECOLHIDA)).toBeNull();
      moldura.alternarBarra();
      janela.emitir("resize");
      vi.advanceTimersByTime(220);
      expect(document.body.classList).toContain("sidebar-collapsed");
    });
  });

  describe("tema", () => {
    it("alterna, guarda, marca o html e o body e avisa", () => {
      const { moldura } = montar();
      const aviso = vi.fn();
      document.addEventListener(EVENTO_TEMA_ALTERADO, aviso);
      moldura.alternarTema();
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(document.body.classList).toContain("dark-mode");
      expect(localStorage.getItem(CHAVE_DO_TEMA)).toBe("1");
      expect(aviso).toHaveBeenCalled();
      moldura.alternarTema();
      expect(document.documentElement.getAttribute("data-theme")).toBe("");
      document.removeEventListener(EVENTO_TEMA_ALTERADO, aviso);
    });

    it("sem preferência, claro; o tema trocado em outra aba vale aqui", () => {
      const { moldura, janela } = montar();
      moldura.aplicarTemaGuardado();
      expect(document.documentElement.getAttribute("data-theme")).toBe("");
      janela.emitir("storage", { key: CHAVE_DO_TEMA, newValue: "1" });
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      janela.emitir("storage", { key: "outra", newValue: "0" });
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });

  describe("tela cheia", () => {
    it("sem a do navegador, expande o app (o ícone lê o estado)", () => {
      const { moldura, avisar } = montar();
      moldura.alternarTelaCheia();
      expect(document.body.classList).toContain("app-fullscreen-fallback");
      expect(document.body.classList).toContain("system-fullscreen-mode");
      expect(moldura.obter().telaCheiaDoApp).toBe(true);
      expect(avisar).toHaveBeenCalledWith("Modo expandido ativado.");
      moldura.sairDaTelaCheia();
      expect(document.body.classList).not.toContain("app-fullscreen-fallback");
    });

    it("pede a tela cheia do alvo (o painel externo aberto)", () => {
      const alvo = Object.assign(document.createElement("div"), {
        requestFullscreen: vi.fn(() => Promise.resolve()),
      });
      Object.defineProperty(document, "fullscreenEnabled", {
        configurable: true,
        value: true,
      });
      const { moldura } = montar({ extras: { alvoDaTelaCheia: () => alvo } });
      moldura.alternarTelaCheia();
      expect(alvo.requestFullscreen).toHaveBeenCalled();
      Reflect.deleteProperty(document, "fullscreenEnabled");
    });
  });

  describe("a página", () => {
    it("desligada (a casca desmontou), as mudanças não mexem mais na página", () => {
      const { moldura, janela } = montar();
      definido(desligar)();
      desligar = null;
      moldura.alternarTema();
      expect(document.documentElement.getAttribute("data-theme")).toBe("");
      janela.emitir("storage", { key: CHAVE_DO_TEMA, newValue: "1" });
      expect(moldura.obter().temaEscuro).toBe(true);
      expect(document.documentElement.getAttribute("data-theme")).toBe("");
    });

    it("marca a área aberta no html (a cor da área) e acompanha a troca", () => {
      definirAreaAtual("saude-indigena");
      montar();
      expect(document.documentElement.getAttribute("data-area")).toBe(
        "saude-indigena",
      );
      definirAreaAtual("projetos");
      expect(document.documentElement.getAttribute("data-area")).toBe(
        "projetos",
      );
      definido(desligar)();
      desligar = null;
      definirAreaAtual("sede");
      expect(document.documentElement.getAttribute("data-area")).toBe(
        "projetos",
      );
    });

    it("o estado começa no que o primeiro quadro pintou (body e html)", () => {
      document.body.className = "sidebar-collapsed";
      document.documentElement.setAttribute("data-theme", "dark");
      const moldura = criarMoldura({ janela: janelaFalsa() });
      expect(moldura.obter()).toMatchObject({
        barraRecolhida: true,
        temaEscuro: true,
      });
    });
  });
});

bloco("app/navegacao", () => {
  type Navegacao = ReturnType<typeof criarNavegacao>;
  type Montado = ReturnType<typeof montarTelasNoTeste<Navegacao>>;

  /*
  O cliente de mentira só tem o `rpc` que a presença usa; o tipo do Supabase
  descreve muito mais. A guarda confere a forma mínima e devolve o objeto.
*/
  function ehClienteSupabase(cliente: object): cliente is SupabaseClient {
    return "rpc" in cliente;
  }
  function comoSupabase(cliente: object): SupabaseClient {
    if (!ehClienteSupabase(cliente)) throw new TypeError("cliente sem rpc");
    return cliente;
  }

  /*
  A navegação do app (src/app/navegacao.ts) com as telas como rotas
  (src/app/telas.tsx): troca de tela, título, menu, permissões, guarda de
  saída, versão nova esperando, painel externo, o endereço (link direto,
  voltar/avançar, área na URL) e os avisos para quem acompanha (auditoria e
  presença, uma vez por navegação).
*/

  const EDITAL = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
  const GESTOR: PerfilDeAcesso = {
    id: "g",
    ativo: true,
    perfil: "edital_gestor",
    areas: ["saude-indigena", "sede"],
  };
  const SO_EDITAIS: PerfilDeAcesso = {
    id: "e",
    ativo: true,
    permissoes: { nucleo: "leitor" },
  };

  let montado: Montado | null = null;

  function telasFalsas() {
    return {
      dashboard: { render: vi.fn() },
      nucleo: { render: vi.fn() },
      calendario: { render: vi.fn() },
      recursos: { render: vi.fn() },
      classificacao: { render: vi.fn(), abrirEdital: vi.fn() },
      edital: { render: vi.fn(), abrirEdital: vi.fn() },
      "conduzir-entrevistas": {
        render: vi.fn(),
        abrirVisao: vi.fn(),
        abrirEdital: vi.fn(),
      },
    };
  }

  function criar(
    opcoes: OpcoesDaNavegacao = {},
    {
      telas = telasFalsas(),
      menu = true,
    }: { telas?: ReturnType<typeof telasFalsas>; menu?: boolean } = {},
  ) {
    const janela = { location: { reload: vi.fn() } };
    const paineis = {
      podeAbrir: (codigo: string) => codigo === "bi",
      primeiro: () => ({ codigo: "bi" }),
      doMenu: () => [],
      mostrar: vi.fn(() => ({ titulo: "BI RH" })),
      esquecerAtual: vi.fn(),
    } satisfies PaineisDoApp;
    const avisar = vi.fn();
    const crua = criarNavegacao({
      janela,
      obterPerfil: () => GESTOR,
      paineis,
      avisar,
      configuracao: (chave: string) =>
        ({ nucleo_page_subtitle: "Editais da área" })[chave] || "",
      confirmarSaida: () => true,
      aplicarAtualizacao: () => false,
      ...opcoes,
    });
    const novo = montarTelasNoTeste(crua, telas, { avisar });
    montado = novo;
    const { navegacao } = novo;
    if (menu) navegacao.montarMenu();
    return { navegacao, janela, paineis, avisar, telas };
  }

  /* O sistema aberto (a entrada já passou): o endereço passa a trocar a tela. */
  function entrar(navegacao: Pick<Navegacao, "abrirEntrada">) {
    navegacao.abrirEntrada();
  }

  const ativas = () =>
    [...document.querySelectorAll(".page.active")].map((pagina) => pagina.id);
  const endereco = () => location.pathname + location.search;
  const $ = (id: string) => document.getElementById(id);

  /* Voltar/avançar do navegador: o jsdom avisa o popstate depois. */
  async function noHistorico(passo: number) {
    await act(async () => {
      const mudou = new Promise((resolver) =>
        addEventListener("popstate", resolver, { once: true }),
      );
      history.go(passo);
      await mudou;
    });
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.className = "";
    document.body.innerHTML = '<main id="conteudoPrincipal"></main>';
  });
  afterEach(() => {
    montado?.desmontar();
    montado = null;
    redefinirDadosDoMonitoramento();
    redefinirBarraLateral();
    redefinirPaginaDaAya();
    document.body.innerHTML = "";
  });

  describe("troca de tela", () => {
    it("usa o cabeçalho padrão nas telas do menu sem duplicar o dos módulos", () => {
      const { navegacao } = criar();
      entrar(navegacao);
      for (const view of ["dashboard", "nucleo", "calendario", "recursos"]) {
        navegacao.irPara(view);
        const pagina = definido($("page-" + view));
        expect(pagina.querySelectorAll(".ui-cabecalho-da-pagina")).toHaveLength(
          1,
        );
        expect(pagina.querySelector(".ui-cabecalho-titulo")?.textContent).toBe(
          navegacao.obter().titulo ||
            TELAS_DAS_AREAS.find((tela) => tela.view === view)?.titulo,
        );
        expect(pagina.querySelector(".ui-cabecalho-trilha")).toBeNull();
      }
      navegacao.irPara("classificacao");
      expect(
        $("page-classificacao")?.querySelector(".ui-cabecalho-da-pagina"),
      ).toBeNull();
    });

    it("deixa só a página pedida ativa, com título, menu, endereço e render da tela", () => {
      const { navegacao, telas } = criar();
      entrar(navegacao);
      navegacao.irPara("recursos");
      expect(ativas()).toEqual(["page-recursos"]);
      expect($("pageTitle")?.textContent).toBe("Painel de recursos");
      expect($("pageSubtitle")?.textContent).toBe("Saúde Indígena");
      expect(telas.recursos.render).toHaveBeenCalledTimes(1);
      expect(navegacao.obter().view).toBe("recursos");
      expect(obterEstadoDaBarraLateral().ativo.view).toBe("recursos");
      expect(localStorage.getItem(CHAVE_DA_TELA_GUARDADA)).toBe("recursos");
      expect(endereco()).toBe("/saude-indigena/painel-de-recursos");
      expect(obterPaginaDaAya()).toMatchObject({
        view: "recursos",
        titulo: "Painel de recursos",
      });
    });

    it("render que falha vira aviso amigável, sem rejeição solta", async () => {
      const telas = telasFalsas();
      telas.recursos.render.mockRejectedValue(new Error("tabela fora do ar"));
      const erro = vi.spyOn(console, "error").mockImplementation(() => {});
      const { navegacao, avisar } = criar({}, { telas });
      navegacao.irPara("recursos");
      await vi.waitFor(() =>
        expect(avisar).toHaveBeenCalledWith(
          "Não foi possível abrir Painel de recursos: tabela fora do ar",
          "error",
        ),
      );
      expect(navegacao.obter().view).toBe("recursos");
      erro.mockRestore();
    });

    it("reabrir a mesma tela chama o render de novo (Atualizar dados)", () => {
      const { navegacao, telas } = criar();
      navegacao.irPara("nucleo");
      navegacao.reabrir();
      expect(telas.nucleo.render).toHaveBeenCalledTimes(2);
    });

    it("o subtítulo das telas das áreas vem depois da área", () => {
      const { navegacao } = criar();
      navegacao.irPara("nucleo");
      expect($("pageSubtitle")?.textContent).toBe(
        "Saúde Indígena · Editais da área",
      );
    });

    it("toda tela das áreas tem título e caminho próprio", () => {
      const caminhos = TELAS_DAS_AREAS.map((tela) => tela.caminho);
      expect(new Set(caminhos).size).toBe(caminhos.length);
      for (const tela of TELAS_DAS_AREAS)
        expect(tela.titulo, tela.view).toBeTruthy();
    });

    it("sem view, abre a tela de entrada (a guardada, se permitida)", () => {
      localStorage.setItem(CHAVE_DA_TELA_GUARDADA, "nucleo");
      const { navegacao } = criar();
      expect(navegacao.telaDeEntrada()).toBe("nucleo");
      navegacao.irPara("");
      expect(ativas()).toEqual(["page-nucleo"]);
    });

    it("sem permissão, avisa e fica onde está (e o endereço também)", () => {
      const { navegacao, avisar } = criar({ obterPerfil: () => SO_EDITAIS });
      navegacao.irPara("nucleo");
      const antes = endereco();
      navegacao.irPara("config");
      expect(avisar).toHaveBeenCalledWith(
        "Sem permissão para Configurações.",
        "warn",
      );
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(navegacao.obter().view).toBe("nucleo");
      expect(endereco()).toBe(antes);
    });

    it("sem módulo liberado, mostra o aviso de sem acesso", () => {
      const { navegacao } = criar();
      navegacao.irPara("sem-acesso");
      expect(ativas()).toEqual(["page-sem-acesso"]);
      expect($("page-sem-acesso")?.textContent).toContain(
        "não tem módulos liberados",
      );
      expect($("pageTitle")?.textContent).toBe("Acesso aos módulos");
      expect(endereco()).toBe("/sem-acesso");
    });
  });

  describe("guarda de saída e versão nova", () => {
    it("alteração não salva confirmada como não: não sai da tela", () => {
      const confirmarSaida = vi.fn(() => false);
      const { navegacao } = criar({ confirmarSaida });
      expect(navegacao.irPara("dashboard")).toBe(true);
      confirmarSaida.mockClear();
      // Recusada: devolve false (quem trocou a área antes a desfaz).
      expect(navegacao.irPara("recursos")).toBe(false);
      expect(confirmarSaida).toHaveBeenCalledTimes(1);
      expect(navegacao.obter().view).toBe("dashboard");
    });

    it("reabrir a mesma tela não pergunta", () => {
      const confirmarSaida = vi.fn(() => false);
      const { navegacao } = criar({ confirmarSaida });
      navegacao.irPara("dashboard");
      expect(confirmarSaida).not.toHaveBeenCalled();
    });

    it("a guarda padrão consulta Acessos e Módulos já baixados (antes da carga, deixam sair)", async () => {
      const confirmarSaida = vi.fn(() => false);
      registrarTelas(
        fontesFalsas({
          "secao:acessos": {
            carregar: async () => ({
              conteudo: null,
              nome: "Acessos",
              render() {},
              confirmarSaida,
            }),
          },
          "secao:modulos": {
            carregar: async () => ({
              conteudo: null,
              nome: "Módulos",
              render() {},
              confirmarSaida: () => true,
            }),
          },
        }),
      );
      const navegacao = comAct(
        criarNavegacao({
          janela: { location: { reload: vi.fn() } },
          obterPerfil: () => GESTOR,
          aplicarAtualizacao: () => false,
        }),
      );
      // Antes da carga, nada aberto, nada a perder.
      expect(navegacao.irPara("nucleo")).toBe(true);
      await carregarTela("secao:acessos");
      expect(navegacao.irPara("dashboard")).toBe(false);
      expect(confirmarSaida).toHaveBeenCalled();
      expect(navegacao.obter().view).toBe("nucleo");
      navegacao.desligar();
      registrarTelas({});
    });

    it("versão nova esperando: guarda a tela pedida, vai ao endereço dela e recarrega", () => {
      const { navegacao, janela } = criar({
        aplicarAtualizacao: (recarregar: () => void) => {
          recarregar();
          return true;
        },
      });
      navegacao.irPara("nucleo");
      expect(localStorage.getItem(CHAVE_DA_TELA_GUARDADA)).toBe("nucleo");
      expect(endereco()).toBe("/saude-indigena/editais");
      expect(janela.location.reload).toHaveBeenCalled();
      expect(ativas()).toEqual(["page-dashboard"]);
    });

    it("versão nova esperando com rascunho ainda não guardado: não recarrega e troca de tela", () => {
      const aplicarAtualizacao = vi.fn(() => true);
      const { navegacao, janela } = criar({
        aplicarAtualizacao,
        podeRecarregar: () => false,
      });
      navegacao.irPara("nucleo");
      expect(aplicarAtualizacao).not.toHaveBeenCalled();
      expect(janela.location.reload).not.toHaveBeenCalled();
      expect(navegacao.obter().view).toBe("nucleo");
    });
  });

  describe("painel externo", () => {
    it("abre pelo dono dos painéis, no endereço /paineis/<código>; outra tela esquece o painel", () => {
      const { navegacao, paineis } = criar();
      navegacao.irPara("panel:bi");
      expect(paineis.mostrar).toHaveBeenCalledWith("bi");
      expect(ativas()).toEqual(["page-external"]);
      expect(endereco()).toBe("/paineis/bi");
      expect(paineis.esquecerAtual).not.toHaveBeenCalled();
      navegacao.irPara("nucleo");
      expect(paineis.esquecerAtual).toHaveBeenCalled();
      expect(ativas()).toEqual(["page-nucleo"]);
    });

    it("tira o modo de painel externo ao trocar de tela", () => {
      const { navegacao } = criar();
      document.body.classList.add("external-panel-mode", "external-clean");
      navegacao.irPara("nucleo");
      expect(document.body.classList.contains("external-panel-mode")).toBe(
        false,
      );
      expect(document.body.classList.contains("external-clean")).toBe(false);
    });
  });

  describe("o endereço (rotas)", () => {
    it("link direto: entra na tela e na área do endereço", () => {
      history.replaceState(null, "", "/sede/cronograma");
      const { navegacao, telas } = criar();
      entrar(navegacao);
      expect(ativas()).toEqual(["page-calendario"]);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("sede");
      expect($("pageSubtitle")?.textContent).toContain("SEDE");
      expect(telas.calendario.render).toHaveBeenCalledTimes(1);
      expect(endereco()).toBe("/sede/cronograma");
    });

    it("link direto guardado antes de entrar (volta do Google em /?auth=google)", () => {
      history.replaceState(null, "", "/sede/editais");
      criarNavegacao({ obterPerfil: () => null }).desligar();
      expect(sessionStorage.getItem(CHAVE_DA_ROTA_PEDIDA)).toBe(
        "/sede/editais",
      );
      history.replaceState(null, "", "/?auth=google");
      const { navegacao } = criar();
      entrar(navegacao);
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(endereco()).toBe("/sede/editais");
      expect(sessionStorage.getItem(CHAVE_DA_ROTA_PEDIDA)).toBeNull();
    });

    it("link interno aberto sem sessão volta à mesma página depois do login", () => {
      history.replaceState(null, "", "/saude-indigena/edital/37-2026");
      // A tela de acesso: a navegação existe, mas o sistema não abriu.
      criarNavegacao({ obterPerfil: () => null }).desligar();
      // A volta do Google cai na raiz.
      history.replaceState(null, "", "/?auth=google");
      const { navegacao } = criar();
      entrar(navegacao);
      expect(ativas()).toEqual(["page-edital"]);
      expect(endereco()).toBe("/saude-indigena/edital/37-2026");
      expect(sessionStorage.getItem(CHAVE_DA_ROTA_PEDIDA)).toBeNull();
    });

    it("link para tela proibida: avisa e abre a tela de entrada no lugar (sem empilhar)", () => {
      history.replaceState(null, "", "/administracao/configuracoes/acessos");
      const tamanho = history.length;
      const { navegacao, avisar } = criar({ obterPerfil: () => SO_EDITAIS });
      entrar(navegacao);
      expect(avisar).toHaveBeenCalledWith(
        "Sem permissão para Configurações.",
        "warn",
      );
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(endereco()).toBe("/saude-indigena/editais");
      expect(history.length).toBe(tamanho);
    });

    it("endereço que não é tela: avisa e abre a tela de entrada", () => {
      history.replaceState(null, "", "/sede/nao-existe");
      const { navegacao, avisar } = criar();
      entrar(navegacao);
      expect(avisar).toHaveBeenCalledWith(TEXTO_ROTA_DESCONHECIDA, "warn");
      expect(ativas()).toEqual(["page-dashboard"]);
      expect(endereco()).toBe("/saude-indigena/visao-geral");
    });

    it("área do endereço que não é da pessoa: fica a área dela", () => {
      history.replaceState(null, "", "/projetos/editais");
      const { navegacao } = criar();
      entrar(navegacao);
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
      expect(endereco()).toBe("/saude-indigena/editais");
    });

    it("link com edital: a tela abre e então recebe o edital; o endereço volta a ser o da tela", async () => {
      history.replaceState(null, "", `/saude-indigena/classificacao/${EDITAL}`);
      const { navegacao, telas } = criar();
      entrar(navegacao);
      expect(telas.classificacao.render).toHaveBeenCalledTimes(1);
      await vi.waitFor(() =>
        expect(telas.classificacao.abrirEdital).toHaveBeenCalledWith(EDITAL),
      );
      expect(endereco()).toBe("/saude-indigena/classificacao");
    });

    it('o edital do "Ir para…" vai no endereço e chega na tela', async () => {
      const { navegacao, telas } = criar();
      entrar(navegacao);
      navegacao.irPara("conduzir-entrevistas", { edital: EDITAL });
      await vi.waitFor(() =>
        expect(telas["conduzir-entrevistas"].abrirEdital).toHaveBeenCalledWith(
          EDITAL,
        ),
      );
    });

    it("link antigo com visão (entrevistas:conduzir): a visão chega na tela", () => {
      const { navegacao, telas } = criar();
      navegacao.irPara("entrevistas:conduzir");
      expect(telas["conduzir-entrevistas"].abrirVisao).toHaveBeenCalledWith(
        "fila",
      );
      expect(endereco()).toBe("/saude-indigena/entrevistas");
    });

    it("voltar e avançar do navegador trocam a tela (e o render roda de novo)", async () => {
      const { navegacao, telas } = criar();
      entrar(navegacao);
      navegacao.irPara("nucleo");
      navegacao.irPara("recursos");
      expect(endereco()).toBe("/saude-indigena/painel-de-recursos");

      await noHistorico(-1);
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(navegacao.obter().view).toBe("nucleo");
      expect(telas.nucleo.render).toHaveBeenCalledTimes(2);

      await noHistorico(1);
      expect(ativas()).toEqual(["page-recursos"]);
      expect(telas.recursos.render).toHaveBeenCalledTimes(2);
    });

    it("voltar troca a área junto (Editais da SEDE → da Saúde Indígena)", async () => {
      const { navegacao } = criar();
      entrar(navegacao);
      navegacao.irPara("nucleo");
      act(() => definirAreaAtual("sede"));
      navegacao.irPara("nucleo");
      expect(endereco()).toBe("/sede/editais");
      await noHistorico(-1);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
      expect($("pageSubtitle")?.textContent).toContain("Saúde Indígena");
    });

    it("voltar com alteração não salva recusada: fica na tela e o endereço volta", async () => {
      let podeSair = true;
      const { navegacao } = criar({ confirmarSaida: () => podeSair });
      entrar(navegacao);
      navegacao.irPara("nucleo");
      navegacao.irPara("recursos");
      podeSair = false;
      await noHistorico(-1);
      expect(ativas()).toEqual(["page-recursos"]);
      expect(endereco()).toBe("/saude-indigena/painel-de-recursos");
    });

    it("link com filtros: a tela abre com eles na URL e volta com eles pelo menu", () => {
      history.replaceState(null, "", "/sede/cronograma?edital=e1&aba=x");
      const { navegacao } = criar();
      entrar(navegacao);
      expect(endereco()).toBe("/sede/cronograma?edital=e1&aba=x");
      navegacao.irPara("nucleo");
      expect(endereco()).toBe("/sede/editais");
      navegacao.irPara("calendario");
      expect(endereco()).toBe("/sede/cronograma?edital=e1&aba=x");
    });

    it("voltar/avançar só nos filtros da mesma tela não a reabre", async () => {
      const { navegacao, telas } = criar();
      entrar(navegacao);
      navegacao.irPara("calendario");
      const aberturas = telas.calendario.render.mock.calls.length;
      history.pushState(null, "", "/saude-indigena/cronograma?aba=x");
      await noHistorico(-1);
      await noHistorico(1);
      expect(telas.calendario.render).toHaveBeenCalledTimes(aberturas);
      expect(filtrosGuardadosDaTela("calendario")).toBe("aba=x");
      navegacao.irPara("nucleo");
      navegacao.irPara("calendario");
      expect(endereco()).toBe("/saude-indigena/cronograma?aba=x");
    });

    it("entrada do histórico com o mesmo endereço (marca das Regras do edital) não reabre", async () => {
      const { navegacao, telas } = criar();
      entrar(navegacao);
      navegacao.irPara("nucleo");
      history.pushState({ monitoraRegrasDoEdital: { id: "e1" } }, "");
      await noHistorico(-1);
      expect(telas.nucleo.render).toHaveBeenCalledTimes(1);
    });

    it("fora do sistema (tela de acesso), voltar não abre tela", async () => {
      const { navegacao, telas, avisar } = criar();
      entrar(navegacao);
      navegacao.irPara("nucleo");
      navegacao.irPara("recursos");
      navegacao.fechar();
      await noHistorico(-1);
      expect(navegacao.obter().view).toBe("recursos");
      expect(telas.nucleo.render).toHaveBeenCalledTimes(1);
      expect(avisar).not.toHaveBeenCalled();
    });
  });

  describe("a página do edital", () => {
    /* O "Voltar" da página vai pelo histórico: espera o popstate do jsdom. */
    async function voltarDaPagina(navegacao: Navegacao) {
      await act(async () => {
        const mudou = new Promise((resolver) =>
          addEventListener("popstate", resolver, { once: true }),
        );
        expect(navegacao.voltarDaPaginaDoEdital()).toBe(true);
        await mudou;
      });
    }

    it("aberta de outra tela: o edital fica no endereço e o Voltar volta para ela, com os filtros", async () => {
      const { navegacao, telas } = criar();
      entrar(navegacao);
      navegacao.irPara("nucleo");
      history.replaceState(null, "", "/saude-indigena/editais?status=Suspenso");
      navegacao.irPara("edital", { edital: "105-2026" });
      expect(ativas()).toEqual(["page-edital"]);
      expect(telas.edital.render).toHaveBeenCalledTimes(1);
      await vi.waitFor(() =>
        expect(telas.edital.abrirEdital).toHaveBeenCalledWith("105-2026"),
      );
      // O edital é a página: não sai do endereço depois de aberto.
      expect(endereco()).toBe("/saude-indigena/edital/105-2026");
      expect(navegacao.obter().edital).toBe("105-2026");
      expect(navegacao.obter().retorno).toMatchObject({
        view: "nucleo",
        edital: "105-2026",
      });
      // Não vira a tela de entrada (sem o edital, ela não abriria).
      expect(localStorage.getItem(CHAVE_DA_TELA_GUARDADA)).toBe("nucleo");

      await voltarDaPagina(navegacao);
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(endereco()).toBe("/saude-indigena/editais?status=Suspenso");
    });

    it("aberta por link: sem retorno, o Voltar vai à Visão geral", () => {
      history.replaceState(null, "", "/sede/edital/105-2026");
      const { navegacao } = criar();
      entrar(navegacao);
      expect(ativas()).toEqual(["page-edital"]);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("sede");
      expect(navegacao.obter().retorno).toBeNull();
      expect(navegacao.voltarDaPaginaDoEdital()).toBe(true);
      expect(ativas()).toEqual(["page-dashboard"]);
      expect(endereco()).toBe("/sede/visao-geral");
    });

    it("foi à Classificação e voltou pelo navegador: o retorno do mesmo edital continua", async () => {
      const { navegacao } = criar();
      entrar(navegacao);
      navegacao.irPara("calendario");
      navegacao.irPara("edital", { edital: "105-2026" });
      navegacao.irPara("classificacao", { edital: EDITAL });
      await noHistorico(-1);
      expect(ativas()).toEqual(["page-edital"]);
      expect(navegacao.obter().retorno).toMatchObject({ view: "calendario" });
      await voltarDaPagina(navegacao);
      expect(ativas()).toEqual(["page-calendario"]);
    });

    it("sem permissão (só Classificação): o link não abre a página", () => {
      history.replaceState(null, "", "/saude-indigena/edital/105-2026");
      const { navegacao, avisar } = criar({
        obterPerfil: () => ({
          id: "c",
          ativo: true,
          permissoes: { classificacao: "leitor" },
        }),
      });
      entrar(navegacao);
      expect(avisar).toHaveBeenCalledWith(
        "Sem permissão para a página do edital.",
        "warn",
      );
      expect(ativas()).toEqual(["page-classificacao"]);
    });
  });

  describe("fluxo entre as etapas (a faixa das etapas)", () => {
    const etapa = (view: string) => {
      const achada = etapaDoFluxo(view);
      if (!achada) throw new Error(`sem a etapa ${view}`);
      return achada;
    };

    it("vai às Entrevistas e à Classificação no mesmo edital e volta pelo navegador", async () => {
      const { navegacao, telas } = criar();
      entrar(navegacao);
      const janela = {
        navigate: (view: string, extras?: { edital?: string | null }) =>
          navegacao.irPara(view, extras),
      };
      const edital = { id: EDITAL, numero: "93/2026" };

      expect(
        abrirTelaDoEdital(etapa("conduzir-entrevistas"), edital, "", janela),
      ).toBe(true);
      await vi.waitFor(() =>
        expect(telas["conduzir-entrevistas"].abrirEdital).toHaveBeenCalledWith(
          EDITAL,
        ),
      );
      expect(ativas()).toEqual(["page-conduzir-entrevistas"]);
      const daEntrevista = endereco();

      abrirTelaDoEdital(etapa("classificacao"), edital, "179698", janela);
      await vi.waitFor(() =>
        expect(telas.classificacao.abrirEdital).toHaveBeenCalledWith(EDITAL),
      );
      expect(ativas()).toEqual(["page-classificacao"]);
      // A vaga espera a Classificação no edital do pedido.
      expect(consumirPedidoDeFiltro("classificacao")).toEqual({
        editalId: EDITAL,
        vaga: "179698",
      });

      // Voltar: as Entrevistas, no endereço em que estavam (a tela segue montada no edital).
      await noHistorico(-1);
      expect(ativas()).toEqual(["page-conduzir-entrevistas"]);
      expect(endereco()).toBe(daEntrevista);
      expect(telas["conduzir-entrevistas"].render).toHaveBeenCalledTimes(2);
      // E de novo para a frente: a Classificação.
      await noHistorico(1);
      expect(ativas()).toEqual(["page-classificacao"]);
    });

    it("sem a navegação ou sem o edital que a tela pede, não vai", () => {
      expect(
        abrirTelaDoEdital(etapa("classificacao"), { id: EDITAL }, "", {}),
      ).toBe(false);
      const navigate = vi.fn();
      expect(
        abrirTelaDoEdital(etapa("classificacao"), { numero: "93/2026" }, "", {
          navigate,
        }),
      ).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("quem acompanha a navegação", () => {
    it("recebe uma abertura por tela (com a anterior)", () => {
      const { navegacao } = criar();
      const eventos: EventoDaNavegacao[] = [];
      navegacao.assinar((evento) => eventos.push(evento));
      navegacao.irPara("nucleo");
      navegacao.irPara("recursos");
      expect(eventos.filter((e) => e.tipo === "abertura")).toEqual([
        { tipo: "abertura", view: "nucleo", anterior: "dashboard" },
        { tipo: "abertura", view: "recursos", anterior: "nucleo" },
      ]);
      // Trocar de tela não manda "menu" à parte (era o registro em dobro).
      expect(eventos.some((e) => e.tipo === "menu")).toBe(false);
    });

    it("a troca de área refaz o cabeçalho da Visão geral", () => {
      const { navegacao } = criar();
      const parar = navegacao.acompanharArea();
      navegacao.irPara("dashboard");
      const antes = definido($("pageTitle")).textContent;
      act(() => definirAreaAtual("sede"));
      expect($("pageTitle")?.textContent).not.toBe(antes);
      parar();
    });

    it("a presença registra a navegação uma vez por troca de tela", async () => {
      const { navegacao } = criar();
      const cliente = {
        rpc: vi.fn(async (_nome: string, _args?: Record<string, unknown>) => ({
          data: { status: "OK" },
          error: null,
        })),
      };
      const presenca = criarPresenca({
        cliente: () => comoSupabase(cliente),
        agente: () => "teste",
        obterUsuario: () => ({ id: "u1" }),
        obterPerfil: () => GESTOR,
        configuracao: { inteiro: () => 2, versao: () => "V9" },
        navegacao,
        local: (view: string) => `lugar ${view}`,
      });
      const parar = presenca.acompanhar();
      presenca.iniciar();
      await vi.waitFor(() => expect(cliente.rpc).toHaveBeenCalled());
      const daNavegacao = () =>
        cliente.rpc.mock.calls.filter(
          ([nome, args]) =>
            nome === "registrar_navegacao_monitora" &&
            args?.p_evento === "abertura_tela",
        );
      // Toda chamada de registrar_navegacao_monitora (evento ou só presença).
      const registros = () =>
        cliente.rpc.mock.calls.filter(
          ([nome]) => nome === "registrar_navegacao_monitora",
        ).length;
      const antes = registros();
      navegacao.irPara("nucleo");
      await act(async () => {});
      expect(daNavegacao()).toHaveLength(1);
      expect(registros() - antes).toBe(1);
      navegacao.irPara("recursos");
      await act(async () => {});
      expect(daNavegacao()).toHaveLength(2);
      expect(daNavegacao()[1]?.[1]).toMatchObject({ p_tela: "recursos" });
      expect(registros() - antes).toBe(2);
      parar();
      presenca.pararTudo();
    });
  });

  describe("telas sob demanda", () => {
    it('"Carregando…" enquanto baixa; a falha mostra "Tentar de novo", que baixa de novo e abre', async () => {
      const render = vi.fn();
      let tentativas = 0;
      let falhar = () => {};
      const crua = criarNavegacao({
        obterPerfil: () => GESTOR,
        confirmarSaida: () => true,
        aplicarAtualizacao: () => false,
      });
      const novo = montarTelasNoTeste(crua, {});
      montado = novo;
      act(() =>
        registrarTelas(
          fontesFalsas({
            recursos: {
              carregar: () => {
                tentativas += 1;
                if (tentativas === 1)
                  return new Promise<TelaFalsa>((_, rejeitar) => {
                    falhar = () => rejeitar(new Error("rede caída"));
                  });
                return Promise.resolve({
                  nome: "o painel de recursos",
                  conteudo: "Painel carregado",
                  render,
                });
              },
            },
          }),
        ),
      );
      const erro = vi.spyOn(console, "error").mockImplementation(() => {});
      novo.navegacao.irPara("recursos");
      expect($("page-recursos")?.textContent).toContain("Carregando…");
      await act(async () => falhar());
      expect($("page-recursos")?.textContent).toContain(
        "Não foi possível carregar esta tela.",
      );
      const botao = definido($("page-recursos")?.querySelector("button"));
      expect(botao.textContent).toBe("Tentar de novo");
      await act(async () => botao.click());
      await vi.waitFor(() =>
        expect($("page-recursos")?.textContent).toContain("Painel carregado"),
      );
      expect(tentativas).toBe(2);
      expect(render).toHaveBeenCalledTimes(1);
      erro.mockRestore();
    });
  });
});

bloco("app/pagina-desligada", () => {
  type Navegacao = ReturnType<typeof criarNavegacao>;
  type Montado = ReturnType<typeof montarTelasNoTeste<Navegacao>>;

  /*
  O cliente e o documento de mentira só têm o que a presença usa; os tipos
  do Supabase e de Document descrevem muito mais. A guarda confere a forma
  mínima e devolve o próprio objeto do teste.
*/
  function ehClienteSupabase(cliente: object): cliente is SupabaseClient {
    return "rpc" in cliente;
  }
  function comoSupabase(cliente: object): SupabaseClient {
    if (!ehClienteSupabase(cliente)) throw new TypeError("cliente sem rpc");
    return cliente;
  }
  function ehDocumento(documento: object): documento is Document {
    return "visibilityState" in documento && "addEventListener" in documento;
  }
  function comoDocumento(documento: object): Document {
    if (!ehDocumento(documento))
      throw new TypeError("documento sem visibilityState");
    return documento;
  }

  /*
  Página desligada pela coordenação fecha sem recarregar (19/10/2026: o banco
  saturou e quem já estava numa aba desligada continuava nela, consultando,
  até recarregar).

  - a regra pura (src/lib/navegacao/pagina-desligada.ts);
  - a checagem periódica: a versão do catálogo vem de carona na presença, a
    cada 90 s com a aba visível, e para com a aba oculta (src/app/presenca.ts);
  - o vigia (src/app/vigia-do-catalogo.ts) relê o catálogo só quando a versão
    muda;
  - a navegação (src/app/navegacao.ts) troca a página pelo aviso, sem
    chamar a tela de novo; com trabalho não salvo, só a faixa; religada, o
    menu volta.
*/

  /* O catálogo no formato de `listar_abas_do_menu`, sem as ligações `fora` ("aba@area"). */
  function catalogo(fora: string[] = []) {
    return ABAS_DO_MENU.map((aba) => ({
      co_aba: aba.id,
      no_aba: aba.rotulo,
      ds_icone: aba.icone,
      nu_ordem: aba.ordem,
      co_view: aba.view,
      co_recurso: aba.recurso,
      tp_aba: aba.tipo,
      areas: aba.areas
        .filter(({ area }) => !fora.includes(`${aba.id}@${area}`))
        .map(({ area }) => ({ co_area: area, nu_ordem: aba.ordem })),
    })).filter((linha) => !fora.includes(linha.co_aba));
  }

  const situacaoCom = (areas: [string, boolean][]) =>
    normalizarSituacaoDoSistema({
      sistema: { situacao: "ATIVA" },
      areas: areas.map(([co_area, ativo]) => ({
        co_area,
        ativo,
        situacao: "ATIVA",
      })),
    });

  describe("a regra da página desligada", () => {
    const semEditaisNaSede = definido(
      abasDoCatalogo(catalogo(["editais@sede"])),
    );

    it("aba tirada da área está desligada nela, e só nela", () => {
      const base = { abas: semEditaisNaSede, doBanco: true, view: "nucleo" };
      expect(paginaDesligada({ ...base, area: "sede" })).toBe(true);
      expect(paginaDesligada({ ...base, area: "saude-indigena" })).toBe(false);
    });

    it("aba desligada em todas as áreas (fora do catálogo do banco)", () => {
      const abas = definido(abasDoCatalogo(catalogo(["selecao"])));
      expect(
        paginaDesligada({ abas, doBanco: true, view: "selecao", area: "sede" }),
      ).toBe(true);
      // Sem área: desligada porque não está em área nenhuma.
      expect(paginaDesligada({ abas, doBanco: true, view: "selecao" })).toBe(
        true,
      );
    });

    it("a Triagem (já ativada) segue a regra das outras abas", () => {
      // Sem catálogo (inclusive falha de rede), nada está desligado: a Triagem
      // está no catálogo do código desde a ativação (#597).
      expect(
        paginaDesligada({
          abas: ABAS_DO_MENU,
          doBanco: false,
          view: "pre-classificacao",
          area: "projetos",
        }),
      ).toBe(false);
      const catalogoAtivado = definido(
        abasDoCatalogo(
          catalogo([
            "pre-classificacao@sede",
            "pre-classificacao@saude-indigena",
          ]),
        ),
      );
      expect(
        paginaDesligada({
          abas: catalogoAtivado,
          doBanco: true,
          view: "pre-classificacao",
          area: "projetos",
        }),
      ).toBe(false);
      expect(
        paginaDesligada({
          abas: catalogoAtivado,
          doBanco: true,
          view: "pre-classificacao",
          area: "sede",
        }),
      ).toBe(true);
    });

    it("área desligada fecha as páginas dela", () => {
      const abas = definido(abasDoCatalogo(catalogo()));
      const situacao = situacaoCom([
        ["sede", false],
        ["projetos", true],
      ]);
      const base = { abas, doBanco: true, situacao, view: "dashboard" };
      expect(paginaDesligada({ ...base, area: "sede" })).toBe(true);
      expect(paginaDesligada({ ...base, area: "projetos" })).toBe(false);
    });

    it("sem o catálogo do banco, ou fora das abas, nada está desligado", () => {
      expect(
        paginaDesligada({
          abas: ABAS_DO_MENU,
          doBanco: false,
          view: "nucleo",
          area: "sede",
        }),
      ).toBe(false);
      for (const view of ["config", "panel:bi", "sem-acesso"])
        expect(
          paginaDesligada({
            abas: semEditaisNaSede,
            doBanco: true,
            view,
            area: "sede",
          }),
        ).toBe(false);
    });

    it("o botão vai à primeira página da área atual; sem ela, à de outro grupo", () => {
      // Rótulos e ícones vazios: a regra só lê a view e a área.
      const arvore: ArvoreDoMenu = [
        {
          id: "saude-indigena",
          rotulo: "",
          icone: "",
          itens: [
            {
              view: "dashboard",
              area: "saude-indigena",
              rotulo: "",
              icone: "",
            },
          ],
        },
        {
          id: "sede",
          rotulo: "",
          icone: "",
          itens: [{ view: "nucleo", area: "sede", rotulo: "", icone: "" }],
        },
      ];
      expect(primeiraPaginaLigada(arvore, "sede", "approved")?.view).toBe(
        "nucleo",
      );
      expect(primeiraPaginaLigada(arvore, "sede", "nucleo")?.view).toBe(
        "dashboard",
      );
      expect(primeiraPaginaLigada([], "sede", "nucleo")).toBeNull();
    });
  });

  /* Documento falso da presença: a visibilidade da aba muda pelo teste. */
  function documentoFalso() {
    const ouvintes = new Set<() => void>();
    const documento = {
      visibilityState: "visible",
      title: "MONITORA",
      addEventListener: (_nome: string, ouvinte: () => void) =>
        ouvintes.add(ouvinte),
      removeEventListener: (_nome: string, ouvinte: () => void) =>
        ouvintes.delete(ouvinte),
      mudar(estado: string) {
        documento.visibilityState = estado;
        ouvintes.forEach((ouvinte) => ouvinte());
      },
    };
    return documento;
  }

  describe("checagem periódica: carona na presença", () => {
    afterEach(() => vi.useRealTimers());

    it("a cada batida (150 s) com a aba visível, nenhuma com ela oculta; a versão chega ao vigia", async () => {
      vi.useFakeTimers();
      const documento = documentoFalso();
      const cliente = {
        rpc: vi.fn(async (_nome: string, _args?: Record<string, unknown>) => ({
          data: { status: "OK", versao_do_catalogo: "v1" },
          error: null,
        })),
      };
      const aoRegistrar = vi.fn();
      const presenca = criarPresenca({
        cliente: () => comoSupabase(cliente),
        documento: comoDocumento(documento),
        obterUsuario: () => ({ id: "u1" }),
        obterPerfil: () => ({ id: "c", ativo: true, perfil: "usuario" }),
        navegacao: {
          obter: () => ({ view: "nucleo" }),
          assinar: () => () => {},
        },
        local: () => "Editais · SEDE",
        aoRegistrar,
      });
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      expect(cliente.rpc).toHaveBeenCalledTimes(1);
      expect(aoRegistrar).toHaveBeenLastCalledWith({
        status: "OK",
        versao_do_catalogo: "v1",
      });
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
      expect(cliente.rpc).toHaveBeenCalledTimes(2);

      documento.mudar("hidden");
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 5);
      expect(cliente.rpc).toHaveBeenCalledTimes(2);
      expect(aoRegistrar).toHaveBeenCalledTimes(2);

      // A volta da aba, passado o intervalo, bate (e checa) uma vez só.
      documento.mudar("visible");
      await vi.advanceTimersByTimeAsync(0);
      expect(cliente.rpc).toHaveBeenCalledTimes(3);
      // Só a presença: nenhuma chamada nova ao banco por causa do catálogo.
      expect(
        cliente.rpc.mock.calls.every(
          ([nome]) => nome === "registrar_navegacao_monitora",
        ),
      ).toBe(true);
      presenca.pararTudo();
    });

    it("quem ouve a resposta não derruba a presença", async () => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      const presenca = criarPresenca({
        cliente: () =>
          comoSupabase({ rpc: async () => ({ data: {}, error: null }) }),
        documento: comoDocumento(documentoFalso()),
        obterUsuario: () => ({ id: "u1" }),
        obterPerfil: () => ({ id: "c", ativo: true, perfil: "usuario" }),
        local: () => "x",
        aoRegistrar: () => {
          throw new Error("falhou");
        },
      });
      await presenca.sincronizar();
      expect(aviso).toHaveBeenCalled();
      aviso.mockRestore();
    });
  });

  describe("o vigia relê o catálogo só quando a versão muda", () => {
    /* A resposta das consultas falsas (o erro, como o do Supabase). */
    type RespostaFalsa = {
      data: unknown;
      error: { code?: string; message?: string } | null;
    };
    function montar({ falhar = false }: { falhar?: boolean } = {}) {
      const navegacao = {
        montarMenu: vi.fn(),
        reavaliarTelaAtual: vi.fn(),
      };
      const resposta = (data: unknown) =>
        Promise.resolve<RespostaFalsa>(
          falhar
            ? { data: null, error: { message: "Failed to fetch" } }
            : { data, error: null },
        );
      const abas = {
        consulta: vi.fn(() => resposta(catalogo())),
        carregar: vi.fn(async () => true),
      };
      const situacao = {
        consulta: vi.fn(() => resposta({ sistema: {}, areas: [] })),
        carregar: vi.fn(async () => ({})),
      };
      const vigia = criarVigiaDoCatalogo({
        // As consultas falsas não usam o cliente.
        cliente: () => null,
        abas,
        situacao,
        navegacao,
      });
      return { vigia, navegacao, abas, situacao };
    }

    it("lê a versão da resposta da presença", () => {
      expect(versaoDaResposta({ status: "OK", versao_do_catalogo: "a" })).toBe(
        "a",
      );
      expect(versaoDaResposta({ status: "OK" })).toBeNull();
      expect(versaoDaResposta(null)).toBeNull();
    });

    it("a primeira versão só guarda; a mesma não relê; outra relê, remonta o menu e reavalia", async () => {
      const { vigia, navegacao, abas, situacao } = montar();
      expect(
        vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" }),
      ).toBeNull();
      expect(
        vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" }),
      ).toBeNull();
      expect(abas.consulta).not.toHaveBeenCalled();
      expect(navegacao.reavaliarTelaAtual).toHaveBeenCalledTimes(2);

      await vigia.aoRegistrarPresenca({ versao_do_catalogo: "v2" });
      expect(abas.consulta).toHaveBeenCalledTimes(1);
      expect(situacao.consulta).toHaveBeenCalledTimes(1);
      expect(abas.carregar).toHaveBeenCalledTimes(1);
      expect(situacao.carregar).toHaveBeenCalledTimes(1);
      expect(navegacao.montarMenu).toHaveBeenCalledTimes(1);
      expect(navegacao.reavaliarTelaAtual).toHaveBeenCalledTimes(3);
      expect(vigia.versao()).toBe("v2");
    });

    it("banco sem a migration (sem versão): nada é relido", () => {
      const { vigia, abas } = montar();
      vigia.aoRegistrarPresenca({ status: "OK" });
      vigia.aoRegistrarPresenca({ status: "OK" });
      expect(abas.consulta).not.toHaveBeenCalled();
      expect(vigia.versao()).toBeNull();
    });

    it("falha ao reler: o menu fica como está e a próxima batida tenta de novo", async () => {
      const { vigia, navegacao, abas } = montar({ falhar: true });
      vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" });
      expect(
        await vigia.aoRegistrarPresenca({ versao_do_catalogo: "v2" }),
      ).toBe(false);
      expect(abas.carregar).not.toHaveBeenCalled();
      expect(navegacao.montarMenu).not.toHaveBeenCalled();
      expect(vigia.versao()).toBe("v1");
      await vigia.aoRegistrarPresenca({ versao_do_catalogo: "v2" });
      expect(abas.consulta).toHaveBeenCalledTimes(2);
    });

    it("depois de sair, a próxima entrada recomeça (a primeira versão só guarda)", () => {
      const { vigia, abas } = montar();
      vigia.aoRegistrarPresenca({ versao_do_catalogo: "v1" });
      vigia.esquecer();
      vigia.aoRegistrarPresenca({ versao_do_catalogo: "v9" });
      expect(abas.consulta).not.toHaveBeenCalled();
      expect(vigia.versao()).toBe("v9");
    });
  });

  describe("a página aberta que foi desligada vira o aviso", () => {
    const PERFIL: PerfilDeAcesso & { areas: string[] } = {
      id: "g",
      ativo: true,
      perfil: "edital_gestor",
      areas: ["saude-indigena", "sede"],
    };

    // As seções e o título são da rota (src/app/telas.tsx): montarTelasNoTeste.
    let montado: Montado | null = null;
    function montarPaginas() {
      document.body.innerHTML = '<main id="conteudoPrincipal"></main>';
    }

    /* A navegação com as telas falsas desenhadas; `janela` aponta para elas. */
    function comTelas(
      opcoes: OpcoesDaNavegacao,
      telas: Readonly<Record<string, TelaFalsa>>,
    ) {
      const novo = montarTelasNoTeste(criarNavegacao(opcoes), telas);
      montado = novo;
      return novo.navegacao;
    }

    async function usarCatalogo(fora: string[] = []) {
      await carregarCatalogoDeAbas({
        consulta: Promise.resolve({ data: catalogo(fora), error: null }),
      });
    }

    function criar({
      trabalho = () => false,
    }: { trabalho?: () => boolean } = {}) {
      const janela = {
        nucleoController: { render: vi.fn() },
        calendarioEditaisController: { render: vi.fn() },
        location: { reload: vi.fn() },
      };
      const navegacao = comTelas(
        {
          janela,
          obterPerfil: () => PERFIL,
          paineis: {
            podeAbrir: () => false,
            primeiro: () => null,
            doMenu: () => [],
            mostrar: vi.fn(),
            esquecerAtual: vi.fn(),
          },
          confirmarSaida: () => true,
          aplicarAtualizacao: () => false,
          temTrabalhoNaoSalvo: trabalho,
        },
        {
          nucleo: janela.nucleoController,
          calendario: janela.calendarioEditaisController,
        },
      );
      return { navegacao, janela };
    }

    const aviso = () => document.getElementById("page-manutencao");
    const ativas = () =>
      [...document.querySelectorAll(".page.active")].map((pagina) => pagina.id);
    const viewsDoMenu = (area: string) =>
      obterEstadoDaBarraLateral()
        .arvore.find((grupo) => grupo.id === area)
        ?.itens.map((item) => item.view) ?? [];

    beforeEach(async () => {
      localStorage.clear();
      montarPaginas();
      definirAreasDoUsuario(PERFIL.areas);
      definirAreaAtual("sede");
      await carregarSituacaoDoSistema({
        consulta: Promise.resolve({
          data: { sistema: {}, areas: [] },
          error: null,
        }),
      });
      await usarCatalogo();
    });
    afterEach(async () => {
      await carregarCatalogoDeAbas({
        consulta: Promise.resolve({ data: null, error: null }),
      });
      esquecerSituacaoDoSistema();
      redefinirDadosDoMonitoramento();
      redefinirBarraLateral();
      redefinirPaginaDaAya();
      montado?.desmontar();
      montado = null;
      document.body.innerHTML = "";
    });

    it("desligada no meio da sessão: menu sem ela, aviso no lugar e a tela não é chamada de novo", async () => {
      const { navegacao, janela } = criar();
      navegacao.montarMenu();
      navegacao.irPara("nucleo");
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(janela.nucleoController.render).toHaveBeenCalledTimes(1);

      // O vigia releu o catálogo: Editais saiu da SEDE.
      await usarCatalogo(["editais@sede"]);
      navegacao.montarMenu();
      navegacao.reavaliarTelaAtual();

      expect(viewsDoMenu("sede")).not.toContain("nucleo");
      expect(ativas()).toEqual(["page-manutencao"]);
      expect(aviso()?.textContent).toContain(
        "Esta página foi desativada pela coordenação.",
      );
      expect(document.getElementById("pageTitle")?.textContent).toBe(
        "Página desativada",
      );
      expect(janela.nucleoController.render).toHaveBeenCalledTimes(1);
      // As próximas checagens não mexem em nada.
      navegacao.reavaliarTelaAtual();
      expect(janela.nucleoController.render).toHaveBeenCalledTimes(1);

      // O botão leva à primeira página ligada da área.
      const botao = definido(aviso()?.querySelector("button"));
      expect(botao.hidden).toBe(false);
      expect(botao.textContent).toBe("Ir para a página inicial");
      act(() => botao.click());
      expect(navegacao.obter().view).toBe("dashboard");
      expect(ativas()).toEqual(["page-dashboard"]);
    });

    it("religada: o menu volta sozinho; o aviso fica até a pessoa escolher", async () => {
      const { navegacao, janela } = criar();
      navegacao.montarMenu();
      navegacao.irPara("nucleo");
      await usarCatalogo(["editais@sede"]);
      navegacao.montarMenu();
      navegacao.reavaliarTelaAtual();
      expect(ativas()).toEqual(["page-manutencao"]);

      await usarCatalogo();
      navegacao.montarMenu();
      navegacao.reavaliarTelaAtual();
      expect(viewsDoMenu("sede")).toContain("nucleo");
      expect(ativas()).toEqual(["page-manutencao"]);
      navegacao.irPara("nucleo");
      expect(ativas()).toEqual(["page-nucleo"]);
      expect(janela.nucleoController.render).toHaveBeenCalledTimes(2);
    });

    it("com trabalho não salvo, só a faixa; fecha na checagem depois de salvo", async () => {
      let pendente = true;
      const { navegacao } = criar({ trabalho: () => pendente });
      navegacao.montarMenu();
      navegacao.irPara("nucleo");
      await usarCatalogo(["editais@sede"]);
      navegacao.montarMenu();
      navegacao.reavaliarTelaAtual();

      expect(ativas()).toEqual(["page-nucleo"]);
      const faixa = definido(document.getElementById("faixaDeManutencao"));
      expect(faixa.hidden).toBe(false);
      expect(faixa.textContent).toContain(
        "Esta página foi desativada pela coordenação. Salve",
      );

      pendente = false;
      navegacao.reavaliarTelaAtual();
      expect(ativas()).toEqual(["page-manutencao"]);
      expect(faixa.hidden).toBe(true);
    });

    it("a tela guardada desligada não reabre na entrada", async () => {
      const { navegacao } = criar();
      navegacao.guardarTela("nucleo");
      await usarCatalogo(["editais@sede"]);
      navegacao.montarMenu();
      expect(navegacao.telaDeEntrada()).toBe("dashboard");
    });

    /*
    A tela inicial respeita o catálogo: o grupo Avaliador tem a Visão geral
    (dashboard leitor), mas, com ela desligada na área, entra direto na
    primeira página ligada que pode abrir — sem montar a Visão geral nem ler
    as linhas do monitoramento.
  */
    describe("tela inicial com a Visão geral desligada", () => {
      const avaliador = (areas = ["saude-indigena"]): PerfilDeAcesso => ({
        id: "a",
        ativo: true,
        permissoes: { dashboard: "leitor", avaliacao_documental: "editor" },
        areas,
      });

      function criarAvaliador(perfil = avaliador()) {
        const janela = {
          avaliacaoDocumentalController: { render: vi.fn() },
          location: { reload: vi.fn() },
        };
        const navegacao = comTelas(
          {
            janela,
            obterPerfil: () => perfil,
            paineis: {
              podeAbrir: () => false,
              primeiro: () => null,
              doMenu: () => [],
              mostrar: vi.fn(),
              esquecerAtual: vi.fn(),
            },
            confirmarSaida: () => true,
            aplicarAtualizacao: () => false,
          },
          { "avaliacao-documental": janela.avaliacaoDocumentalController },
        );
        return { navegacao, janela };
      }

      beforeEach(() => {
        definirAreasDoUsuario(["saude-indigena"]);
        definirAreaAtual("saude-indigena");
      });

      // A Triagem (mesmo recurso, antes da Avaliação documental no menu) e o
      // Mapa (permissão da Visão geral) ficam desligados aqui para a primeira
      // página ligada ser a Avaliação documental.
      it("sem tela guardada, entra na primeira página ligada (Avaliação documental)", async () => {
        await usarCatalogo([
          "visao-geral@saude-indigena",
          "mapa@saude-indigena",
          "pre-classificacao@saude-indigena",
        ]);
        const { navegacao, janela } = criarAvaliador();
        navegacao.montarMenu();
        expect(navegacao.telaDeEntrada()).toBe("avaliacao-documental");
        navegacao.irPara(navegacao.telaDeEntrada());
        expect(ativas()).toEqual(["page-avaliacao-documental"]);
        expect(janela.avaliacaoDocumentalController.render).toHaveBeenCalled();
      });

      it("a inicial do sistema (sair do painel externo) também", async () => {
        await usarCatalogo([
          "visao-geral@saude-indigena",
          "mapa@saude-indigena",
          "pre-classificacao@saude-indigena",
        ]);
        const { navegacao } = criarAvaliador();
        navegacao.montarMenu();
        expect(navegacao.telaInicialDoSistema()).toBe("avaliacao-documental");
      });

      it("ligada, a Visão geral continua sendo a inicial", () => {
        const { navegacao } = criarAvaliador();
        navegacao.montarMenu();
        expect(navegacao.telaDeEntrada()).toBe("dashboard");
        expect(navegacao.telaInicialDoSistema()).toBe("dashboard");
      });

      it("sem página ligada na área atual, a de outra área — e ela vira a atual", async () => {
        await usarCatalogo([
          "visao-geral@saude-indigena",
          "mapa@saude-indigena",
          "avaliacao-documental@saude-indigena",
          "pre-classificacao@saude-indigena",
          "pre-classificacao@sede",
        ]);
        const { navegacao } = criarAvaliador(
          avaliador(["saude-indigena", "sede"]),
        );
        navegacao.montarMenu();
        expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
        expect(navegacao.telaDeEntrada()).toBe("avaliacao-documental");
        expect(obterDadosDoMonitoramento().areaAtual).toBe("sede");
      });
    });

    it("abrir por link ou busca uma página desligada mostra o aviso", async () => {
      const { navegacao, janela } = criar();
      await usarCatalogo(["editais@sede"]);
      navegacao.montarMenu();
      navegacao.irPara("nucleo");
      expect(ativas()).toEqual(["page-manutencao"]);
      expect(janela.nucleoController.render).not.toHaveBeenCalled();
    });

    it("aba em manutenção no meio da sessão: o aviso de manutenção, com o botão", async () => {
      const { navegacao } = criar();
      navegacao.montarMenu();
      navegacao.irPara("nucleo");
      const comManutencao = catalogo().map((linha) =>
        linha.co_aba === "editais"
          ? { ...linha, tp_situacao: "MANUTENCAO", ds_mensagem: "Volta já" }
          : linha,
      );
      await carregarCatalogoDeAbas({
        consulta: Promise.resolve({ data: comManutencao, error: null }),
      });
      navegacao.montarMenu();
      navegacao.reavaliarTelaAtual();
      expect(ativas()).toEqual(["page-manutencao"]);
      expect(aviso()?.textContent).toContain("Volta já");
      expect(aviso()?.querySelector("button")?.hidden).toBe(false);
    });
  });
});

bloco("app/paineis-externos", () => {
  /*
  Os painéis externos (src/app/paineis-externos.ts): a lista, os liberados
  para o perfil e o quadro de cada painel (iframe na primeira abertura).
*/

  const PAINEIS: PainelExternoDoApp[] = [
    {
      id: "1",
      codigo: "bi",
      titulo: "BI RH",
      url: "https://bi.exemplo/rh",
      ordem: 2,
    },
    {
      id: "2",
      codigo: "obras",
      titulo: "Obras",
      url: "https://obras.exemplo",
      ordem: 1,
    },
    {
      id: "3",
      codigo: "inativo",
      titulo: "Velho",
      url: "https://x",
      ativo: false,
    },
    {
      id: "4",
      codigo: "manut",
      titulo: "Em obra",
      url: "https://y",
      em_manutencao: true,
    },
    {
      id: "5",
      codigo: "semurl",
      titulo: "Sem URL",
      url: "javascript:alert(1)",
    },
    { id: "6", codigo: "analises", titulo: "Analises", url: "/analises.html" },
  ];

  const COM_MATRIZ: PerfilDeAcesso = {
    id: "m",
    ativo: true,
    permissoes: { paineis: "leitor" },
  };
  const GESTOR: PerfilDeAcesso = {
    id: "g",
    ativo: true,
    perfil: "edital_gestor",
  };

  const TEXTOS_DA_CONFIGURACAO: Record<string, string> = {
    maintenance_title: "Em manutenção",
    maintenance_message: "Volte mais tarde",
    external_placeholder: "Escolha um painel",
  };

  function montar(perfil: PerfilDeAcesso = GESTOR) {
    document.body.className = "";
    document.body.innerHTML = `
    <section id="page-external" class="page">
      <h3 id="externalTitle"></h3><a id="externalOpen"></a>
      <div id="externalMount" class="external-placeholder">Escolha</div>
    </section>`;
    const estado = {
      definirPaineisCarregados: vi.fn<(lista: PainelExternoDoApp[]) => void>(),
    };
    const avisar = vi.fn();
    const aoTentarDeNovo = vi.fn();
    const paineis = criarPaineisExternos({
      cliente: () => null,
      origem: () => "https://monitora.exemplo",
      obterPerfil: () => perfil,
      configuracao: (chave: string) => TEXTOS_DA_CONFIGURACAO[chave] || "",
      avisar,
      aoTentarDeNovo,
      estado,
    });
    return { paineis, estado, avisar };
  }

  const carregar = (
    paineis: ReturnType<typeof criarPaineisExternos>,
    dados: PainelExternoDoApp[] = PAINEIS,
  ) =>
    paineis.carregar({
      consulta: Promise.resolve({ data: dados, error: null }),
    });

  beforeEach(() => vi.restoreAllMocks());

  describe("lista e permissões", () => {
    it("tira o painel antigo de análises e publica para as Configurações", async () => {
      const { paineis, estado } = montar();
      await carregar(paineis);
      const publicados = definido(
        estado.definirPaineisCarregados.mock.calls[0],
      )[0];
      expect(publicados.map((p) => p.codigo)).not.toContain("analises");
    });

    it("sem matriz: todos os ativos ficam liberados; o menu sai em ordem", async () => {
      const { paineis } = montar();
      await carregar(paineis);
      paineis.completarLiberados();
      expect(paineis.podeAbrir("bi")).toBe(true);
      expect(paineis.podeAbrir("inativo")).toBe(false);
      // Sem ordem conta como 0.
      expect(paineis.doMenu().map((p) => p.codigo)).toEqual([
        "manut",
        "semurl",
        "obras",
        "bi",
      ]);
      expect(paineis.primeiro()?.codigo).toBe("bi");
    });

    it("com matriz: só os ids liberados pela sessão", async () => {
      const { paineis } = montar(COM_MATRIZ);
      await carregar(paineis);
      paineis.definirLiberados(["2"]);
      paineis.completarLiberados();
      expect(paineis.podeAbrir("obras")).toBe(true);
      expect(paineis.podeAbrir("bi")).toBe(false);
    });

    it("erro na consulta: lista vazia", async () => {
      const { paineis } = montar();
      await paineis.carregar({
        consulta: Promise.resolve({ data: null, error: { message: "x" } }),
      });
      expect(paineis.doMenu()).toEqual([]);
    });
  });

  describe("quadro", () => {
    it("o iframe nasce na primeira abertura e é reaproveitado", async () => {
      const { paineis } = montar();
      await carregar(paineis);
      paineis.completarLiberados();
      expect(paineis.mostrar("bi")?.titulo).toBe("BI RH");
      const quadro = definido(
        document.querySelector("#external-panel-bi iframe"),
      );
      expect(quadro.getAttribute("src")).toBe("https://bi.exemplo/rh");
      expect(quadro.className).toBe("external-frame");
      expect(quadro.getAttribute("allow")).toBe("fullscreen; clipboard-write");
      // Apps Script e Looker Studio precisam destes; nada de navegar o topo sem clique.
      const sandbox = definido(quadro.getAttribute("sandbox")).split(" ");
      expect(sandbox).toEqual(
        expect.arrayContaining([
          "allow-scripts",
          "allow-same-origin",
          "allow-forms",
          "allow-popups",
          "allow-popups-to-escape-sandbox",
          "allow-downloads",
          "allow-top-navigation-by-user-activation",
        ]),
      );
      expect(sandbox).not.toContain("allow-top-navigation");
      expect(document.getElementById("externalTitle")?.textContent).toBe(
        "BI RH",
      );
      expect(
        document.querySelector<HTMLAnchorElement>("#externalOpen")?.href,
      ).toBe("https://bi.exemplo/rh");
      expect(document.body.classList).toContain("external-panel-mode");
      paineis.mostrar("obras");
      expect(document.getElementById("external-panel-bi")?.hidden).toBe(true);
      paineis.mostrar("bi");
      expect(
        document.querySelectorAll("#external-panel-bi iframe"),
      ).toHaveLength(1);
      expect(document.getElementById("external-panel-obras")?.hidden).toBe(
        true,
      );
    });

    it("a cobertura diz o que está carregando até o site responder", async () => {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      const { paineis } = montar();
      // A cobertura é um portal da raiz do app (src/app/portais-avulsos.tsx).
      const desmontarPortais = montarPortaisNoTeste();
      await carregar(paineis);
      paineis.completarLiberados();
      act(() => void paineis.mostrar("bi"));
      expect(
        document.querySelector("#external-panel-bi .carregamento-do-painel")
          ?.textContent,
      ).toContain("Carregando o painel");
      act(() => paineis.descartarAbertos());
      desmontarPortais();
    });

    it("em manutenção ou sem endereço válido: aviso, sem iframe", async () => {
      const { paineis } = montar();
      await carregar(paineis);
      paineis.completarLiberados();
      paineis.mostrar("manut");
      const manut = definido(document.getElementById("external-panel-manut"));
      expect(manut.querySelector("iframe")).toBeNull();
      expect(manut.textContent).toContain("Volte mais tarde");
      paineis.mostrar("semurl");
      const sem = definido(document.getElementById("external-panel-semurl"));
      expect(sem.querySelector("iframe")).toBeNull();
      expect(sem.textContent).toContain("Cadastre uma URL");
    });

    it("painel não liberado: avisa e não abre", async () => {
      const { paineis, avisar } = montar();
      await carregar(paineis);
      expect(paineis.mostrar("inativo")).toBeNull();
      expect(avisar).toHaveBeenCalledWith(
        "Painel indisponível ou inativo.",
        "warn",
      );
    });

    it("descartar, descartar os abertos e limpar ao sair", async () => {
      const { paineis } = montar();
      await carregar(paineis);
      paineis.completarLiberados();
      paineis.mostrar("bi");
      paineis.mostrar("obras");
      paineis.descartar("bi");
      expect(document.getElementById("external-panel-bi")).toBeNull();
      paineis.descartarAbertos();
      expect(document.querySelectorAll(".external-panel")).toHaveLength(0);
      paineis.mostrar("bi");
      paineis.limpar();
      expect(paineis.atual()).toBeNull();
      const montagem = definido(document.getElementById("externalMount"));
      expect(montagem.className).toBe("external-placeholder");
      expect(montagem.textContent).toBe("Escolha um painel");
      expect(paineis.liberados().size).toBe(0);
    });
  });

  describe("pré-conexão dos painéis", () => {
    const LOOKER = {
      id: "7",
      codigo: "recrutamento",
      titulo: "Formas de Ingresso",
      url: "https://datastudio.google.com/embed/reporting/x/page/y",
      ordem: 3,
      tipo_abertura: "iframe",
    };
    const links = () =>
      [
        ...document.head.querySelectorAll<HTMLLinkElement>(
          "link[data-preconexao-do-painel]",
        ),
      ].map(
        (l) =>
          `${l.rel} ${l.href.replace(/\/$/, "")}${l.crossOrigin ? " cors" : ""}`,
      );

    beforeEach(() => {
      document.head.innerHTML = "";
    });

    it("apontar ou focar o item do painel no menu pré-conecta, sem criar o iframe", async () => {
      const { paineis } = montar();
      await carregar(paineis, [...PAINEIS, LOOKER]);
      paineis.completarLiberados();
      const parar = paineis.preconectarAoApontar();
      const item = document.createElement("button");
      item.dataset.view = "panel:recrutamento";
      item.innerHTML = "<span>Formas de Ingresso</span>";
      document.body.append(item);
      definido(item.firstChild).dispatchEvent(
        new Event("pointerover", { bubbles: true }),
      );
      expect(links()).toEqual([
        "preconnect https://datastudio.google.com",
        "dns-prefetch https://datastudio.google.com",
        "preconnect https://www.gstatic.com",
        "dns-prefetch https://www.gstatic.com",
        "preconnect https://fonts.googleapis.com",
        "dns-prefetch https://fonts.googleapis.com",
        "preconnect https://fonts.gstatic.com cors",
        "dns-prefetch https://fonts.gstatic.com",
      ]);
      // Uma vez por origem.
      item.dispatchEvent(new Event("focusin", { bubbles: true }));
      expect(links()).toHaveLength(8);
      expect(document.querySelector("iframe")).toBeNull();
      parar();
    });

    it("não pré-conecta painel em manutenção, sem permissão ou de outro item do menu", async () => {
      const { paineis } = montar(COM_MATRIZ);
      await carregar(paineis, [...PAINEIS, LOOKER]);
      paineis.definirLiberados(["4"]);
      paineis.completarLiberados();
      paineis.preconectar("recrutamento");
      paineis.preconectar("manut");
      const parar = paineis.preconectarAoApontar();
      const item = document.createElement("button");
      item.dataset.view = "dashboard";
      document.body.append(item);
      item.dispatchEvent(new Event("pointerover", { bubbles: true }));
      expect(links()).toEqual([]);
      parar();
    });

    it("no ócio depois da entrada: só os painéis em iframe que a pessoa vê", async () => {
      vi.useFakeTimers();
      const { paineis } = montar();
      await carregar(paineis, [
        ...PAINEIS,
        LOOKER,
        {
          ...LOOKER,
          id: "8",
          codigo: "aba",
          url: "https://aba.exemplo",
          tipo_abertura: "aba_interna",
        },
      ]);
      paineis.completarLiberados();
      const ocioso = window.requestIdleCallback;
      Reflect.set(window, "requestIdleCallback", undefined);
      try {
        paineis.preconectarNoOcioso();
        expect(links()).toEqual([]);
        vi.advanceTimersByTime(2_000);
      } finally {
        window.requestIdleCallback = ocioso;
        vi.useRealTimers();
      }
      const origens = links().filter((l) => l.startsWith("preconnect"));
      expect(origens).toContain("preconnect https://bi.exemplo");
      expect(origens).toContain("preconnect https://obras.exemplo");
      expect(origens).toContain("preconnect https://datastudio.google.com");
      expect(origens.join()).not.toContain("aba.exemplo");
      expect(origens.join()).not.toContain("https://y");
    });
  });
});

bloco("app/perfil", () => {
  /* Quem entrou (src/app/perfil.ts): cópia da sessão e o que o app mostra dele. */

  function sessaoFalsa() {
    let estado: EstadoDaSessaoDoPerfil = {
      usuario: null,
      perfil: null,
      painelIds: [],
    };
    const ouvintes = new Set<() => void>();
    return {
      obter: () => estado,
      assinar: (ouvinte: () => void) => {
        ouvintes.add(ouvinte);
        return () => ouvintes.delete(ouvinte);
      },
      definir(parcial: Partial<EstadoDaSessaoDoPerfil>) {
        estado = { ...estado, ...parcial };
        ouvintes.forEach((ouvinte) => ouvinte());
      },
    };
  }

  function montarPagina() {
    document.body.className = "access-request-mode";
    document.body.innerHTML = `
    <section id="appScreen" class="app hidden"></section>
    <strong id="userName"></strong><strong id="topUserPopoverName"></strong>
    <small id="userEmail"></small><small id="userProfileBadge"></small>
    <span id="topUserPopoverProfile"></span>`;
  }

  /* O usuário do Supabase Auth: o id e o e-mail do teste, o resto neutro. */
  const ANA: User = {
    id: "u1",
    email: "ana@agenciasus.org.br",
    app_metadata: {},
    user_metadata: {},
    aud: "",
    created_at: "",
  };
  const GESTOR = {
    id: "p1",
    ativo: true,
    perfil: "edital_gestor",
    nome_completo: "Ana Souza",
    permissoes: { dashboard: "leitor" },
  };

  describe("perfil", () => {
    it("segue a sessão e avisa só quando o perfil muda", () => {
      const sessao = sessaoFalsa();
      const perfil = criarPerfil({ sessao });
      const ouvinte = vi.fn<OuvinteDoPerfil>();
      perfil.aoMudarPerfil(ouvinte);
      perfil.acompanharSessao();
      sessao.definir({ usuario: ANA, perfil: GESTOR, painelIds: ["7"] });
      expect(perfil.obterUsuario()).toBe(ANA);
      expect(perfil.obterPerfil()).toBe(GESTOR);
      expect(ouvinte).toHaveBeenCalledTimes(1);
      expect(ouvinte.mock.calls[0]?.[0].painelIds).toEqual(["7"]);
      sessao.definir({ usuario: { ...ANA } });
      expect(ouvinte).toHaveBeenCalledTimes(1);
      expect(perfil.pode("ind")).toBe(true);
      expect(perfil.pode("cores")).toBe(false);
    });

    it("mostra quem entrou no cabeçalho, com o rótulo do perfil", () => {
      montarPagina();
      const sessao = sessaoFalsa();
      const perfil = criarPerfil({ sessao });
      perfil.acompanharSessao();
      sessao.definir({ usuario: ANA, perfil: GESTOR });
      perfil.mostrarNaBarra();
      expect(document.getElementById("userEmail")?.textContent).toBe(ANA.email);
      // Sem estilo escrito no elemento: mostrar é do CSS (a faixa compacta o esconde).
      expect(document.getElementById("userProfileBadge")?.style.display).toBe(
        "",
      );
      expect(document.getElementById("userProfileBadge")?.textContent).toBe(
        "Gestor",
      );
      expect(
        document.getElementById("topUserPopoverProfile")?.textContent,
      ).toBe("Gestor");
      expect(document.getElementById("userName")?.textContent).not.toBe("");
    });

    it("abre e esconde o app", () => {
      montarPagina();
      const perfil = criarPerfil({ sessao: sessaoFalsa() });
      perfil.mostrarApp();
      expect(document.getElementById("appScreen")?.classList).not.toContain(
        "hidden",
      );
      expect(document.body.classList).not.toContain("access-request-mode");
      perfil.esconderApp();
      expect(document.getElementById("appScreen")?.classList).toContain(
        "hidden",
      );
    });
  });
});

bloco("app/presenca", () => {
  /*
  Presença e acesso (src/app/presenca.ts): uma chamada por batida
  (registrar_navegacao_monitora, migration 20261103230000) com a presença, o
  evento que coincide com ela, os de carona e, quando vencida, a lista de
  "Pessoas online".
*/

  const USUARIO = { id: "u1" };
  const GESTOR = { id: "g", ativo: true, perfil: "edital_gestor" };
  const USUARIO_COMUM = { id: "c", ativo: true, perfil: "usuario" };
  const BATIDA = "registrar_navegacao_monitora";
  const LISTA = "listar_presenca_online_monitora";
  const PRESENCA = "registrar_presenca_monitora";
  const EVENTO = "registrar_evento_acesso";

  type Argumentos = Record<string, unknown>;
  type RpcDaPresenca = (
    nome: string,
    args?: Argumentos,
  ) => Promise<{ data: unknown; error: unknown }>;

  /* Documento falso: a visibilidade da aba muda pelo teste. */
  function criarDocumento() {
    const ouvintes = new Set<() => void>();
    const documento = {
      visibilityState: "visible",
      title: "MONITORA",
      addEventListener: (_nome: string, ouvinte: () => void) =>
        ouvintes.add(ouvinte),
      removeEventListener: (_nome: string, ouvinte: () => void) =>
        ouvintes.delete(ouvinte),
      mudar(estado: string) {
        documento.visibilityState = estado;
        ouvintes.forEach((ouvinte) => ouvinte());
      },
    };
    return documento;
  }

  /*
  O cliente e o documento de mentira só têm o que a presença usa; os tipos
  do Supabase e de Document descrevem muito mais. A guarda confere a forma
  mínima e devolve o próprio objeto do teste.
*/
  function comoSupabase(cliente: object): SupabaseClient {
    if (!ehClienteSupabase(cliente)) throw new TypeError("cliente sem rpc");
    return cliente;
  }
  function ehClienteSupabase(cliente: object): cliente is SupabaseClient {
    return "rpc" in cliente;
  }
  function comoDocumento(documento: object): Document {
    if (!ehDocumento(documento))
      throw new TypeError("documento sem visibilityState");
    return documento;
  }
  function ehDocumento(documento: object): documento is Document {
    return "visibilityState" in documento && "addEventListener" in documento;
  }

  interface OpcoesDaMontagem {
    perfil?: unknown;
    lista?: unknown[];
    erroNaLista?: { message: string } | null;
    banco?: string;
    respostaDaNavegacao?: Argumentos;
    usuario?: { id: string } | null;
  }

  /*
  `banco`: "batida" (com 20261103230000), "navegacao" (só 20261029121700: a
  chamada com p_eventos/p_listar é recusada com PGRST202) ou "antiga" (sem a
  função).
*/
  function montar({
    perfil = GESTOR,
    lista = [],
    erroNaLista = null,
    banco = "batida",
    respostaDaNavegacao = { status: "OK", versao_do_catalogo: "c1" },
    usuario = USUARIO,
  }: OpcoesDaMontagem = {}) {
    const ouvintesDaNavegacao = new Set<
      (evento: EventoDaNavegacaoNaPresenca) => void
    >();
    const documento = criarDocumento();
    let view = "recursos";
    let lugar = "Recursos · Saúde Indígena";
    const quem = { atual: usuario };
    const cliente = {
      rpc: vi.fn<RpcDaPresenca>(async (nome, args = {}) => {
        if (nome === LISTA)
          return erroNaLista
            ? { data: null, error: erroNaLista }
            : { data: lista, error: null };
        if (nome === BATIDA) {
          const nova = "p_eventos" in args || "p_listar" in args;
          if (banco === "antiga" || (banco === "navegacao" && nova))
            return { data: null, error: { code: "PGRST202" } };
          const dados = { ...respostaDaNavegacao };
          if (args.p_listar)
            Object.assign(
              dados,
              erroNaLista
                ? { pessoas_erro: { codigo: "42501" } }
                : { pessoas: lista },
            );
          return { data: dados, error: null };
        }
        return { data: null, error: null };
      }),
    };
    const navegacao = {
      obter: () => ({ view }),
      assinar: (ouvinte: (evento: EventoDaNavegacaoNaPresenca) => void) => {
        ouvintesDaNavegacao.add(ouvinte);
        return () => ouvintesDaNavegacao.delete(ouvinte);
      },
    };
    const presenca = criarPresenca({
      cliente: () => comoSupabase(cliente),
      documento: comoDocumento(documento),
      agente: () => "teste",
      obterUsuario: () => quem.atual,
      obterPerfil: () => perfil,
      configuracao: { inteiro: () => 5, versao: () => "V9" },
      navegacao,
      local: () => lugar,
    });
    return {
      presenca,
      cliente,
      documento,
      quem,
      avisarNavegacao: (evento: EventoDaNavegacaoNaPresenca) =>
        ouvintesDaNavegacao.forEach((ouvinte) => ouvinte(evento)),
      mudar: (novaView: string, novoLugar: string) => {
        view = novaView;
        lugar = novoLugar;
      },
    };
  }

  type ClienteFalso = ReturnType<typeof montar>["cliente"];
  const chamadas = (cliente: ClienteFalso, nome: string) =>
    cliente.rpc.mock.calls.filter(([rpc]) => rpc === nome);
  const batidas = (cliente: ClienteFalso) =>
    chamadas(cliente, BATIDA).filter(([, args]) => definido(args).p_presenca);

  afterEach(() => vi.useRealTimers());

  describe("intervalos e limite de online", () => {
    it("batida a cada 150 s; o banco conta online por duas batidas e um minuto", () => {
      expect(INTERVALO_DA_PRESENCA_MS).toBe(150_000);
      expect(ONLINE_NO_BANCO_MS).toBe(6 * 60_000);
      // Uma batida perdida não derruba ninguém.
      expect(ONLINE_NO_BANCO_MS).toBeGreaterThanOrEqual(
        2 * INTERVALO_DA_PRESENCA_MS + 60_000,
      );
      expect(LISTA_FECHADA_MS).toBe(10 * 60_000);
    });

    it("chamadas por hora de uma pessoa com a aba visível: 24 batidas, nada a mais", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar();
      presenca.iniciarHeartbeat();
      presenca.iniciar({ nome: "login_google", tela: "login" });
      await vi.advanceTimersByTimeAsync(60 * 60_000);
      // A entrada (t=0) e uma a cada 150 s: 1 + 24. Heartbeat e lista vão dentro.
      expect(cliente.rpc).toHaveBeenCalledTimes(25);
      expect(chamadas(cliente, BATIDA)).toHaveLength(25);
      const heartbeats = chamadas(cliente, BATIDA).filter(
        ([, args]) => definido(args).p_evento === "heartbeat",
      );
      // Heartbeat de 5 min: a cada duas batidas.
      expect(heartbeats).toHaveLength(12);
      const comLista = chamadas(cliente, BATIDA).filter(
        ([, args]) => definido(args).p_listar,
      );
      // Lista fechada: a da entrada e uma a cada 10 min.
      expect(comLista).toHaveLength(7);
      presenca.parar();
    });
  });

  describe("auditoria", () => {
    it("registra o evento com a tela atual, a aba e a versão", async () => {
      const { presenca, cliente } = montar();
      await presenca.registrarEvento("logout", { detalhes: { x: 1 } });
      expect(cliente.rpc).toHaveBeenCalledWith(EVENTO, {
        p_evento: "logout",
        p_tela: "recursos",
        p_origem: "index",
        p_detalhes: { x: 1 },
        p_client_session_id: idDaAba(),
        p_user_agent: "teste",
        p_app_version: "V9",
      });
    });

    it("o id da aba é o mesmo durante a sessão da aba", () => {
      expect(idDaAba()).toBe(idDaAba());
    });

    it("heartbeat a cada N minutos da configuração, de carona na batida; para quando pedido", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar({ perfil: USUARIO_COMUM });
      presenca.iniciarHeartbeat();
      presenca.iniciar();
      const heartbeats = () =>
        chamadas(cliente, BATIDA).filter(
          ([, args]) => definido(args).p_evento === "heartbeat",
        );
      // Batidas aos 150 e 300 s; o heartbeat (5 min) vai na de 300 s.
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
      expect(heartbeats()).toHaveLength(1);
      expect(heartbeats()[0]?.[1]).toMatchObject({
        p_tela: "recursos",
        p_detalhes: { current_view: "recursos", page_title: "MONITORA" },
        p_presenca: true,
        p_current_view: "Recursos · Saúde Indígena",
        p_listar: false,
      });
      expect(chamadas(cliente, EVENTO)).toHaveLength(0);
      // A batida da entrada e as de 150 e 300 s (esta com o heartbeat): nada a mais.
      expect(cliente.rpc).toHaveBeenCalledTimes(3);
      presenca.pararHeartbeat();
      await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
      expect(heartbeats()).toHaveLength(1);
    });

    it("heartbeat com o banco sem registrar_navegacao_monitora: as duas chamadas de antes", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar({
        perfil: USUARIO_COMUM,
        banco: "antiga",
      });
      presenca.iniciarHeartbeat();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
      const eventos = chamadas(cliente, EVENTO);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]?.[1]).toMatchObject({
        p_evento: "heartbeat",
        p_detalhes: { current_view: "recursos", page_title: "MONITORA" },
      });
      expect(chamadas(cliente, PRESENCA)).toHaveLength(3);
    });

    it("com a aba oculta, nem batida nem heartbeat", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, documento } = montar({
        perfil: USUARIO_COMUM,
      });
      presenca.acompanhar();
      presenca.iniciarHeartbeat();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      const antes = cliente.rpc.mock.calls.length;
      documento.mudar("hidden");
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
      expect(cliente.rpc).toHaveBeenCalledTimes(antes);
    });

    it("a navegação avisa a abertura de tela (só quando muda), numa chamada", async () => {
      const { presenca, cliente, avisarNavegacao } = montar();
      presenca.acompanhar();
      avisarNavegacao({
        tipo: "abertura",
        view: "nucleo",
        anterior: "dashboard",
      });
      avisarNavegacao({ tipo: "abertura", view: "nucleo", anterior: "nucleo" });
      await Promise.resolve();
      const eventos = chamadas(cliente, BATIDA);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]?.[1]).toMatchObject({
        p_evento: "abertura_tela",
        p_tela: "nucleo",
        p_origem: "index",
        p_client_session_id: idDaAba(),
        p_user_agent: "teste",
        p_app_version: "V9",
        // A presença não estava ligada: só o evento.
        p_presenca: false,
        p_eventos: [],
        p_listar: false,
      });
      expect(chamadas(cliente, EVENTO)).toHaveLength(0);
    });

    it("abrir outra tela com a presença ligada: evento e lugar numa chamada só", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, avisarNavegacao, mudar } = montar();
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      const antes = cliente.rpc.mock.calls.length;
      mudar("nucleo", "Editais · SEDE");
      avisarNavegacao({
        tipo: "abertura",
        view: "nucleo",
        anterior: "recursos",
      });
      await vi.advanceTimersByTimeAsync(0);
      const depois = cliente.rpc.mock.calls.slice(antes);
      expect(depois.map(([nome]) => nome)).toEqual([BATIDA]);
      expect(depois[0]?.[1]).toMatchObject({
        p_evento: "abertura_tela",
        p_tela: "nucleo",
        p_presenca: true,
        p_current_view: "Editais · SEDE",
      });
    });

    it("abrir tela pelo menu (menu + abertura no mesmo instante): uma chamada só", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, avisarNavegacao, mudar } = montar();
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      // O que navegacao.ts faz ao abrir: marcarMenu (menu) e depois abriu (abertura).
      const abrir = async (view: string, lugar: string, anterior: string) => {
        const antes = cliente.rpc.mock.calls.length;
        mudar(view, lugar);
        avisarNavegacao({ tipo: "menu" });
        avisarNavegacao({ tipo: "abertura", view, anterior });
        await vi.advanceTimersByTimeAsync(0);
        return cliente.rpc.mock.calls.slice(antes);
      };
      const primeira = await abrir(
        "aprovados",
        "Lista de aprovados · SEDE",
        "recursos",
      );
      expect(primeira.map(([nome]) => nome)).toEqual([BATIDA]);
      expect(primeira[0]?.[1]).toMatchObject({
        p_evento: "abertura_tela",
        p_tela: "aprovados",
        p_presenca: true,
        p_current_view: "Lista de aprovados · SEDE",
      });
      const segunda = await abrir("nucleo", "Editais · SEDE", "aprovados");
      expect(segunda.map(([nome]) => nome)).toEqual([BATIDA]);
      expect(segunda[0]?.[1]).toMatchObject({ p_tela: "nucleo" });
      presenca.parar();
    });

    it("a entrada vai junto com a primeira batida, com a lista", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar({
        lista: [{ user_id: "u2", full_name: "Bia Lima", perfil: "Admin" }],
      });
      presenca.iniciar({ nome: "sessao_restaurada", tela: "boot" });
      await vi.advanceTimersByTimeAsync(0);
      expect(cliente.rpc).toHaveBeenCalledTimes(1);
      expect(chamadas(cliente, BATIDA)[0]?.[1]).toMatchObject({
        p_evento: "sessao_restaurada",
        p_tela: "boot",
        p_presenca: true,
        p_current_view: "Recursos · Saúde Indígena",
        p_listar: true,
      });
      expect(presenca.obter()).toMatchObject({
        visivel: true,
        sincronizado: true,
      });
      expect(presenca.obter().pessoas[0]).toMatchObject({
        fullName: "Bia Lima",
      });
      presenca.parar();
    });

    it("banco sem registrar_navegacao_monitora: as duas chamadas de antes", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, avisarNavegacao, mudar } = montar({
        banco: "antiga",
      });
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      mudar("nucleo", "Editais · SEDE");
      avisarNavegacao({
        tipo: "abertura",
        view: "nucleo",
        anterior: "recursos",
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(chamadas(cliente, EVENTO)[0]?.[1]).toMatchObject({
        p_evento: "abertura_tela",
        p_tela: "nucleo",
      });
      expect(chamadas(cliente, PRESENCA).at(-1)?.[1]).toEqual({
        p_current_view: "Editais · SEDE",
      });
      // A lista, à parte.
      expect(chamadas(cliente, LISTA)).toHaveLength(1);
      // Descoberto uma vez (um degrau por recusa): depois, direto às antigas.
      const recusas = chamadas(cliente, BATIDA).length;
      expect(recusas).toBe(2);
      mudar("dashboard", "Visão geral · SEDE");
      avisarNavegacao({
        tipo: "abertura",
        view: "dashboard",
        anterior: "nucleo",
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(chamadas(cliente, BATIDA)).toHaveLength(recusas);
      presenca.parar();
    });

    it("banco sem p_eventos/p_listar: a batida pelos nove nomes e a lista à parte", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar({ banco: "navegacao" });
      presenca.iniciar({ nome: "login_google", tela: "login" });
      await vi.advanceTimersByTimeAsync(0);
      const aceitas = chamadas(cliente, BATIDA).filter(
        ([, args]) => !("p_listar" in definido(args)),
      );
      expect(aceitas).toHaveLength(1);
      expect(aceitas[0]?.[1]).toMatchObject({
        p_evento: "login_google",
        p_presenca: true,
      });
      expect(chamadas(cliente, LISTA)).toHaveLength(1);
      // Depois de descoberto, a próxima batida já vai sem os dois.
      const antes = chamadas(cliente, BATIDA).length;
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
      const novas = chamadas(cliente, BATIDA).slice(antes);
      expect(novas).toHaveLength(1);
      expect("p_listar" in definido(definido(novas[0])[1])).toBe(false);
      presenca.parar();
    });

    it("presença recusada na navegação (perfil inativo): o lugar não conta como gravado", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, avisarNavegacao, mudar } = montar({
        respostaDaNavegacao: {
          evento_id: 1,
          presenca_erro: {
            codigo: "P0002",
            mensagem: "Perfil institucional nao localizado.",
          },
        },
      });
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      const antes = chamadas(cliente, BATIDA).length;
      mudar("nucleo", "Editais · SEDE");
      avisarNavegacao({ tipo: "menu" });
      await vi.advanceTimersByTimeAsync(0);
      // A próxima troca de menu, com o mesmo lugar, tenta de novo.
      avisarNavegacao({ tipo: "menu" });
      await vi.advanceTimersByTimeAsync(0);
      expect(chamadas(cliente, BATIDA).length - antes).toBe(2);
      presenca.parar();
    });
  });

  describe("eventos de carona", () => {
    const RETRATO = {
      evento: "frontend_performance",
      tela: "monitora",
      origem: "frontend",
      detalhes: { lcp: 1200 },
      client_session_id: "performance-monitor",
      app_version: "frontend-performance-v1",
    };

    it("vai com a próxima batida, sem chamada própria", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar({ perfil: USUARIO_COMUM });
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      presenca.enfileirarEvento(RETRATO);
      await vi.advanceTimersByTimeAsync(0);
      expect(cliente.rpc).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
      expect(cliente.rpc).toHaveBeenCalledTimes(2);
      expect(chamadas(cliente, BATIDA)[1]?.[1]).toMatchObject({
        p_presenca: true,
        p_eventos: [RETRATO],
      });
      // Foi uma vez só.
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
      expect(chamadas(cliente, BATIDA)[2]?.[1]?.p_eventos).toEqual([]);
      expect(chamadas(cliente, EVENTO)).toHaveLength(0);
      presenca.parar();
    });

    it("vai com a navegação, se ela vier antes da batida", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, avisarNavegacao, mudar } = montar();
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      presenca.enfileirarEvento(RETRATO);
      mudar("nucleo", "Editais · SEDE");
      avisarNavegacao({
        tipo: "abertura",
        view: "nucleo",
        anterior: "recursos",
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(chamadas(cliente, BATIDA).at(-1)?.[1]).toMatchObject({
        p_evento: "abertura_tela",
        p_eventos: [RETRATO],
      });
      presenca.parar();
    });

    it("a aba que fica oculta despacha a fila na hora (sem presença)", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, documento } = montar();
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      presenca.enfileirarEvento(RETRATO);
      documento.mudar("hidden");
      await vi.advanceTimersByTimeAsync(0);
      expect(chamadas(cliente, BATIDA).at(-1)?.[1]).toMatchObject({
        p_evento: null,
        p_presenca: false,
        p_eventos: [RETRATO],
      });
    });

    it("antes da pessoa ser conhecida, espera a primeira batida; no máximo 10", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, quem } = montar({ usuario: null });
      for (let i = 0; i < CARONA_MAXIMA + 2; i += 1)
        presenca.enfileirarEvento({ ...RETRATO, detalhes: { i } });
      await vi.advanceTimersByTimeAsync(0);
      expect(cliente.rpc).not.toHaveBeenCalled();
      quem.atual = USUARIO;
      presenca.iniciar({ nome: "login_google", tela: "login" });
      await vi.advanceTimersByTimeAsync(0);
      const primeira = definido(definido(chamadas(cliente, BATIDA)[0])[1]);
      // Os eventos de carona que a batida levou (o teste confere a forma).
      const eventos = primeira.p_eventos as { detalhes?: unknown }[];
      expect(primeira.p_evento).toBe("login_google");
      expect(eventos).toHaveLength(CARONA_MAXIMA);
      expect(eventos[0]?.detalhes).toEqual({ i: 2 });
      presenca.parar();
    });

    it("banco sem p_eventos: cada evento numa chamada à parte, com a origem dele", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar({ banco: "navegacao" });
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      presenca.enfileirarEvento(RETRATO);
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS);
      expect(chamadas(cliente, EVENTO)).toHaveLength(1);
      expect(chamadas(cliente, EVENTO)[0]?.[1]).toEqual({
        p_evento: "frontend_performance",
        p_tela: "monitora",
        p_origem: "frontend",
        p_detalhes: { lcp: 1200 },
        p_client_session_id: "performance-monitor",
        p_user_agent: "teste",
        p_app_version: "frontend-performance-v1",
      });
      presenca.parar();
    });

    it("a saída leva a fila junto", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      presenca.enfileirarEvento(RETRATO);
      await presenca.registrarEvento("logout");
      expect(chamadas(cliente, EVENTO)).toHaveLength(0);
      expect(chamadas(cliente, BATIDA).at(-1)?.[1]).toMatchObject({
        p_evento: "logout",
        p_presenca: false,
        p_eventos: [RETRATO],
      });
      presenca.parar();
    });
  });

  describe("presença", () => {
    it("Gestor vê a lista, que vem na própria batida com o lugar da pessoa", async () => {
      const { presenca, cliente } = montar({
        lista: [{ user_id: "u2", full_name: "Bia Lima", perfil: "Admin" }],
      });
      await presenca.sincronizar();
      expect(cliente.rpc).toHaveBeenCalledTimes(1);
      expect(chamadas(cliente, BATIDA)[0]?.[1]).toMatchObject({
        p_presenca: true,
        p_current_view: "Recursos · Saúde Indígena",
        p_listar: true,
      });
      expect(presenca.obter()).toMatchObject({
        visivel: true,
        sincronizado: true,
      });
      expect(presenca.obter().pessoas[0]).toMatchObject({
        fullName: "Bia Lima",
        profileLabel: "Administrador global",
      });
    });

    it("quem não pode ver: bate a presença sem pedir a lista; o indicador fica escondido", async () => {
      const { presenca, cliente } = montar({ perfil: USUARIO_COMUM });
      await presenca.sincronizar();
      expect(batidas(cliente)).toHaveLength(1);
      expect(batidas(cliente)[0]?.[1]?.p_listar).toBe(false);
      expect(chamadas(cliente, LISTA)).toHaveLength(0);
      expect(presenca.obter().visivel).toBe(false);
    });

    it("lista recusada na batida: fica visível, sem sincronizar", async () => {
      const { presenca } = montar({ erroNaLista: { message: "x" } });
      await presenca.sincronizar();
      expect(presenca.obter()).toMatchObject({
        visivel: true,
        sincronizado: false,
        pessoas: [],
      });
    });

    it("falha na lista à parte (banco sem p_listar): fica visível, sem sincronizar", async () => {
      const { presenca } = montar({
        banco: "navegacao",
        erroNaLista: { message: "x" },
      });
      await presenca.sincronizar();
      expect(presenca.obter()).toMatchObject({
        visivel: true,
        sincronizado: false,
      });
    });

    it("Gestor desativado não consulta nem exibe pessoas online", async () => {
      const { presenca, cliente } = montar({
        perfil: { ...GESTOR, ativo: false },
      });
      await presenca.sincronizar();
      expect(chamadas(cliente, LISTA)).toHaveLength(0);
      expect(batidas(cliente)[0]?.[1]?.p_listar).toBe(false);
      expect(presenca.obter().visivel).toBe(false);
    });

    it("bate a cada 150 s e avisa na hora a troca de lugar", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, avisarNavegacao, mudar } = montar();
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      expect(batidas(cliente)).toHaveLength(1);
      // Marcação do menu sem troca de lugar: nada sai.
      avisarNavegacao({ tipo: "menu" });
      expect(batidas(cliente)).toHaveLength(1);
      mudar("nucleo", "Editais · SEDE");
      avisarNavegacao({ tipo: "menu" });
      await vi.advanceTimersByTimeAsync(0);
      expect(batidas(cliente)).toHaveLength(2);
      expect(batidas(cliente)[1]?.[1]).toMatchObject({
        p_evento: null,
        p_presenca: true,
        p_current_view: "Editais · SEDE",
      });
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS - 1);
      expect(batidas(cliente)).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(batidas(cliente)).toHaveLength(3);
      presenca.parar();
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 3);
      expect(batidas(cliente)).toHaveLength(3);
      expect(presenca.obter()).toMatchObject({ visivel: false, aberto: false });
    });

    it("abrir a lista sem a presença batendo relê só a lista; Esc/fechar fecha", async () => {
      const { presenca, cliente } = montar();
      presenca.alternar();
      await Promise.resolve();
      expect(presenca.obter().aberto).toBe(true);
      expect(chamadas(cliente, LISTA)).toHaveLength(1);
      expect(chamadas(cliente, BATIDA)).toHaveLength(0);
      presenca.fechar();
      expect(presenca.obter().aberto).toBe(false);
    });

    it("abrir a lista com a presença batendo: uma batida adiantada com a lista; o relógio recomeça", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(batidas(cliente)).toHaveLength(1);
      presenca.alternar();
      await vi.advanceTimersByTimeAsync(0);
      expect(batidas(cliente)).toHaveLength(2);
      expect(batidas(cliente)[1]?.[1]?.p_listar).toBe(true);
      expect(chamadas(cliente, LISTA)).toHaveLength(0);
      // A próxima, 150 s depois da abertura (não aos 150 s da entrada).
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS - 1);
      expect(batidas(cliente)).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(batidas(cliente)).toHaveLength(3);
      // Aberta: cada batida traz a lista.
      expect(batidas(cliente)[2]?.[1]?.p_listar).toBe(true);
      presenca.parar();
    });

    it("aba oculta pausa a batida; a volta bate uma vez só, sem dobrar", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, documento } = montar();
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      expect(batidas(cliente)).toHaveLength(1);
      documento.mudar("hidden");
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 4);
      expect(cliente.rpc).toHaveBeenCalledTimes(1);
      documento.mudar("visible");
      // Um segundo aviso de visível (o Supabase e o ciclo de fundo também avisam) não dobra.
      documento.mudar("visible");
      await vi.advanceTimersByTimeAsync(0);
      expect(batidas(cliente)).toHaveLength(2);
      // O relógio recomeça da volta: a próxima, 150 s depois.
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS - 1);
      expect(batidas(cliente)).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(batidas(cliente)).toHaveLength(3);
    });

    it("volta rápida (antes do intervalo) não bate na hora", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, documento } = montar();
      presenca.acompanhar();
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      documento.mudar("hidden");
      await vi.advanceTimersByTimeAsync(10_000);
      documento.mudar("visible");
      await vi.advanceTimersByTimeAsync(0);
      expect(batidas(cliente)).toHaveLength(1);
    });

    it("iniciada com a aba oculta, só começa quando ela fica visível", async () => {
      vi.useFakeTimers();
      const { presenca, cliente, documento } = montar();
      presenca.acompanhar();
      documento.visibilityState = "hidden";
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
      expect(cliente.rpc).not.toHaveBeenCalled();
      documento.mudar("visible");
      await vi.advanceTimersByTimeAsync(0);
      expect(batidas(cliente)).toHaveLength(1);
    });

    it("lista fechada: a contagem relida no máximo a cada 10 min; aberta, a cada batida — sempre na batida", async () => {
      vi.useFakeTimers();
      const { presenca, cliente } = montar();
      const listas = () =>
        batidas(cliente).filter(([, args]) => definido(args).p_listar).length;
      presenca.iniciar();
      await vi.advanceTimersByTimeAsync(0);
      expect(listas()).toBe(1);
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 3);
      expect(batidas(cliente)).toHaveLength(4);
      expect(listas()).toBe(1);
      await vi.advanceTimersByTimeAsync(LISTA_FECHADA_MS);
      expect(listas()).toBe(2);
      presenca.alternar();
      await vi.advanceTimersByTimeAsync(0);
      const aoAbrir = listas();
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_PRESENCA_MS * 2);
      expect(listas()).toBe(aoAbrir + 2);
      // Nenhuma chamada à parte para a lista.
      expect(chamadas(cliente, LISTA)).toHaveLength(0);
    });
  });
});

bloco("app/sessao", () => {
  /*
  A sessão do app (src/app/sessao.ts): entrar, sair, sessão expirada, troca de
  usuário, sem acesso → pedido, domínio não permitido, login Google. O
  Supabase e a janela são falsos; o legado é o adaptador `sistema`.
*/

  /* A sessão do Supabase com o token, o id, o e-mail e o nome do teste. */
  const sessaoDe = (id: string, email = `${id}@agenciasus.org.br`): Session => {
    const base = sessaoFalsa(`token-${id}`);
    return {
      ...base,
      user: {
        ...base.user,
        id,
        email,
        user_metadata: { full_name: `Pessoa ${id}` },
      },
    };
  };

  const CONTEXTO = {
    profile: { id: "perfil-1", nome: "Ana", ativo: true, permissoes: {} },
    panel_ids: ["painel-1"],
  };

  type RespostaDaRpc = { data: unknown; error: unknown };
  type RpcFalsa = (
    nome: string,
    argumentos?: Record<string, unknown>,
  ) => Promise<RespostaDaRpc>;
  type OuvinteDaAutenticacao = (evento: string, sessao: Session | null) => void;

  interface OpcoesDoCliente {
    guardada?: Session | null;
    contexto?: unknown;
    erroNoContexto?: { message: string } | null;
    meuUsuario?: unknown;
    troca?: Session | Error | null;
  }

  function clienteFalso({
    guardada = null,
    contexto = CONTEXTO,
    erroNoContexto = null,
    meuUsuario = null,
    troca = null,
  }: OpcoesDoCliente = {}) {
    let atual = guardada;
    let ouvinte: OuvinteDaAutenticacao | null = null;
    const cliente = {
      emitir: (evento: string, sessao: Session | null) =>
        ouvinte?.(evento, sessao),
      definirSessao: (sessao: Session | null) => (atual = sessao),
      auth: {
        onAuthStateChange: vi.fn((funcao: OuvinteDaAutenticacao) => {
          ouvinte = funcao;
          return { data: { subscription: { unsubscribe() {} } } };
        }),
        getSession: vi.fn(async () => ({
          data: { session: atual },
          error: null,
        })),
        signOut: vi.fn(
          async (_opcoes?: {
            scope?: string;
          }): Promise<{ error: Error | null }> => {
            atual = null;
            ouvinte?.("SIGNED_OUT", null);
            return { error: null };
          },
        ),
        signInWithOAuth: vi.fn<
          (pedido?: unknown) => Promise<{ data?: unknown; error: unknown }>
        >(async () => ({
          data: { url: "https://accounts.google.com/o/oauth2" },
          error: null,
        })),
        exchangeCodeForSession: vi.fn(async (_codigo: string) =>
          troca instanceof Error
            ? { data: null, error: troca }
            : { data: { session: troca }, error: null },
        ),
      },
      rpc: vi.fn<RpcFalsa>(async (nome) => {
        if (nome === "obter_contexto_monitora")
          return erroNoContexto
            ? { data: null, error: erroNoContexto }
            : { data: contexto, error: null };
        if (nome === "meu_usuario") return { data: meuUsuario, error: null };
        return { data: null, error: null };
      }),
    };
    return cliente;
  }
  type ClienteFalso = ReturnType<typeof clienteFalso>;

  /*
  O cliente e a janela de mentira só têm o que a sessão usa; os tipos do
  Supabase e de Window descrevem muito mais. A guarda confere a forma
  mínima e devolve o próprio objeto do teste (sem cópia: o teste troca
  `rpc` e `signInWithOAuth` depois de montar).
*/
  function comoSupabase(cliente: ClienteFalso): SupabaseClient {
    if (!ehClienteSupabase(cliente))
      throw new TypeError("cliente sem auth/rpc");
    return cliente;
  }
  function ehClienteSupabase(cliente: object): cliente is SupabaseClient {
    return "auth" in cliente && "rpc" in cliente;
  }

  type PopupFalso = {
    closed: boolean;
    location: { replace: (endereco: string) => void };
    close: () => void;
  };
  type OuvinteDaJanela = (evento: Record<string, unknown>) => unknown;

  function janelaFalsa({
    search = "",
    caminho = "/",
    largura = 1280,
    popup = null,
  }: {
    search?: string;
    caminho?: string;
    largura?: number;
    popup?: PopupFalso | null;
  } = {}) {
    const ouvintes: Record<string, OuvinteDaJanela> = {};
    return {
      location: {
        search,
        hash: "",
        pathname: caminho,
        origin: "https://monitora.test",
        href: `https://monitora.test${caminho}${search}`,
      },
      history: { replaceState: vi.fn() },
      document: { title: "MONITORA" },
      innerWidth: largura,
      screenX: 0,
      screenY: 0,
      outerWidth: largura,
      outerHeight: 900,
      open: vi.fn(() => popup),
      setInterval: vi.fn((_vigia: () => unknown, _ms?: number) => 1),
      clearInterval: vi.fn(),
      sessionStorage: window.sessionStorage,
      addEventListener: vi.fn(
        (tipo: string, funcao: OuvinteDaJanela) => (ouvintes[tipo] = funcao),
      ),
      ouvintes,
    };
  }
  type JanelaFalsa = ReturnType<typeof janelaFalsa>;

  function comoJanela(janela: JanelaFalsa): Window {
    if (!ehJanela(janela)) throw new TypeError("janela sem location");
    return janela;
  }
  function ehJanela(janela: object): janela is Window {
    return "location" in janela && "addEventListener" in janela;
  }

  function sistemaFalso(sobre: GanchosDoSistema = {}) {
    return {
      carregarConfiguracao: vi.fn(async () => {}),
      mostrarEsqueleto: vi.fn(),
      aoVerificar: vi.fn(),
      abrir: vi.fn(async () => true),
      aoFicarSemAcesso: vi.fn(),
      aoFalharNaEntrada: vi.fn(),
      aoAtualizarPerfil: vi.fn(),
      antesDeSair: vi.fn(async () => {}),
      aoSair: vi.fn(),
      aoLimparSessao: vi.fn(async () => {}),
      encerrarEspera: vi.fn(),
      ...sobre,
    };
  }

  interface OpcoesDaMontagem {
    cliente?: ClienteFalso;
    janela?: JanelaFalsa;
    sistema?: ReturnType<typeof sistemaFalso>;
    celular?: boolean;
    temAmbiente?: boolean;
    armazenamento?: { clearAuthState: () => void };
    perfilGuardado?: PerfilGuardado | null;
  }

  function montar({
    cliente = clienteFalso(),
    janela = janelaFalsa(),
    sistema = sistemaFalso(),
    celular = false,
    temAmbiente = true,
    armazenamento = { clearAuthState: vi.fn() },
    perfilGuardado = null,
  }: OpcoesDaMontagem = {}) {
    const sessao = criarSessao({
      perfilGuardado: () => perfilGuardado,
      cliente: () => comoSupabase(cliente),
      armazenamento: () => armazenamento,
      janela: comoJanela(janela),
      temAmbiente: () => temAmbiente,
      celular: () => celular,
      esperar: async () => {},
    });
    sessao.ligarSistema(sistema);
    return { sessao, cliente, janela, sistema };
  }

  const proximoCiclo = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    reiniciarEstadoDeSaidaParaTestes();
    sessionStorage.clear();
  });

  describe("entrar", () => {
    it("sessão guardada: confere o perfil e abre o sistema", async () => {
      const { sessao, sistema } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u1") }),
      });
      await sessao.iniciar();

      expect(sistema.carregarConfiguracao).toHaveBeenCalled();
      expect(sistema.aoVerificar).toHaveBeenCalledWith(
        expect.objectContaining({ origem: "boot" }),
      );
      expect(sistema.abrir).toHaveBeenCalledWith(
        expect.objectContaining({
          origem: "boot",
          perfil: expect.objectContaining({ id: "perfil-1" }),
          painelIds: ["painel-1"],
          contextoCarregado: true,
        }),
      );
      const estado = sessao.obter();
      expect(estado.fase).toBe(FASES.CONECTADO);
      expect(estado.usuario?.id).toBe("u1");
      expect(sistema.encerrarEspera).toHaveBeenCalled();
    });

    it("o skeleton e a cópia (aoVerificar) começam antes da consulta do perfil", async () => {
      const ordem: unknown[] = [];
      const cliente = clienteFalso({ guardada: sessaoDe("u1") });
      const rpcOriginal = cliente.rpc;
      cliente.rpc = vi.fn<RpcFalsa>((...args) => {
        ordem.push(args[0]);
        return rpcOriginal(...args);
      });
      const { sessao } = montar({
        cliente,
        sistema: sistemaFalso({ aoVerificar: () => ordem.push("aoVerificar") }),
      });
      await sessao.iniciar();
      expect(ordem.slice(0, 2)).toEqual([
        "aoVerificar",
        "obter_contexto_monitora",
      ]);
    });

    it("sem contexto unificado, usa meu_usuario (sem reviver permissões amplas)", async () => {
      const { sessao, sistema } = montar({
        cliente: clienteFalso({
          guardada: sessaoDe("u1"),
          contexto: null,
          meuUsuario: [{ id: "p2", nome: "Bia", ativo: null }],
        }),
      });
      await sessao.iniciar();
      expect(sistema.abrir).toHaveBeenCalledWith(
        expect.objectContaining({
          perfil: { id: "p2", nome: "Bia", ativo: true, permissoes: {} },
          contextoCarregado: false,
        }),
      );
    });

    it("os dados não vieram: volta à tela de acesso, sem abrir", async () => {
      const { sessao } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u1") }),
        sistema: sistemaFalso({ abrir: vi.fn(async () => false) }),
      });
      await sessao.iniciar();
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    });

    it("sem sessão guardada: tela de acesso, sem perfil", async () => {
      const { sessao, sistema, cliente } = montar();
      await sessao.iniciar();
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
      expect(cliente.rpc).not.toHaveBeenCalled();
      expect(sistema.encerrarEspera).toHaveBeenCalled();
    });

    it("link interno com rede e sem sessão: tela de acesso, sem abrir o sistema nem mexer no endereço; entrar abre", async () => {
      const cliente = clienteFalso();
      const { sessao, sistema, janela } = montar({
        cliente,
        janela: janelaFalsa({ caminho: "/saude-indigena/mapa" }),
      });
      await sessao.iniciar();
      expect(sessao.obter()).toMatchObject({
        fase: FASES.DESLOGADO,
        usuario: null,
        perfil: null,
      });
      expect(sistema.aoVerificar).not.toHaveBeenCalled();
      expect(sistema.abrir).not.toHaveBeenCalled();
      expect(cliente.rpc).not.toHaveBeenCalled();
      // O endereço pedido fica: a navegação o abre depois de entrar.
      expect(janela.history.replaceState).not.toHaveBeenCalled();

      cliente.definirSessao(sessaoDe("u1"));
      cliente.emitir("SIGNED_IN", sessaoDe("u1"));
      await vi.waitFor(() => expect(sessao.obter().fase).toBe(FASES.CONECTADO));
      expect(sistema.abrir).toHaveBeenCalledTimes(1);
    });

    it("sem as variáveis do Supabase: aviso de configuração", async () => {
      const { sessao } = montar({ temAmbiente: false });
      await sessao.iniciar();
      expect(sessao.obter().erroDeConfiguracao).toContain("VITE_SUPABASE_URL");
    });

    it("volta do Google com ?code=: troca o código (PKCE) e abre", async () => {
      const cliente = clienteFalso({ troca: sessaoDe("u3") });
      const { sessao, sistema, janela } = montar({
        cliente,
        janela: janelaFalsa({ search: "?code=abc" }),
      });
      await sessao.iniciar();
      expect(cliente.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
      expect(sistema.mostrarEsqueleto).toHaveBeenCalled();
      expect(sistema.abrir).toHaveBeenCalledWith(
        expect.objectContaining({ origem: "oauth_callback" }),
      );
      expect(janela.history.replaceState).toHaveBeenCalled();
    });

    it("código recusado: mensagem e tela de acesso", async () => {
      const { sessao } = montar({
        cliente: clienteFalso({ troca: new Error("invalid grant") }),
        janela: janelaFalsa({ search: "?code=abc" }),
      });
      await sessao.iniciar();
      expect(sessao.obter().mensagem).toEqual({
        texto: MENSAGENS.falhaNoRetorno,
        tom: "error",
      });
    });

    it("?auth_error=: a mensagem do retorno aparece", async () => {
      const { sessao } = montar({
        janela: janelaFalsa({ search: "?auth_error=oauth_callback" }),
      });
      await sessao.iniciar();
      expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.falhaNoRetorno);
    });

    it("link de recuperação de senha: sai e mostra a mensagem configurada", async () => {
      const sistema = sistemaFalso({
        carregarConfiguracao: vi.fn(async () =>
          sessao.definirConfiguracao({
            password_reset_message: "Peça a redefinição ao administrador.",
          }),
        ),
      });
      const { sessao, cliente } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u1") }),
        janela: janelaFalsa({ search: "?type=recovery" }),
        sistema,
      });
      await sessao.iniciar();
      expect(cliente.auth.signOut).toHaveBeenCalled();
      expect(sessao.obter().mensagem.texto).toBe(
        "Peça a redefinição ao administrador.",
      );
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    });
  });

  describe("sem acesso → pedido", () => {
    it("sem perfil ativo: fase do pedido, o legado esconde o sistema", async () => {
      const { sessao, sistema } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u1"), contexto: null }),
      });
      await sessao.iniciar();
      const estado = sessao.obter();
      expect(estado.fase).toBe(FASES.SEM_ACESSO);
      expect(estado.consultarPedido).toBe(true);
      expect(estado.perfil).toBeNull();
      expect(sistema.aoFicarSemAcesso).toHaveBeenCalled();
      expect(sistema.abrir).not.toHaveBeenCalled();
    });

    it("contexto com erro: falha na entrada (Tentar de novo), não o pedido", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { sessao, sistema } = montar({
        cliente: clienteFalso({
          guardada: sessaoDe("u1"),
          erroNoContexto: { message: "falhou" },
        }),
      });
      await sessao.iniciar();
      const estado = sessao.obter();
      expect(estado.fase).toBe(FASES.FALHA_NA_ENTRADA);
      expect(estado.mensagem).toEqual({
        texto: MENSAGENS.permissoes,
        tom: "error",
      });
      expect(sistema.aoFalharNaEntrada).toHaveBeenCalled();
      expect(sistema.aoFicarSemAcesso).not.toHaveBeenCalled();
      expect(sistema.abrir).not.toHaveBeenCalled();
      vi.mocked(console.warn).mockRestore();
    });

    it("Tentar de novo relê o perfil com a mesma sessão e abre o sistema", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const cliente = clienteFalso({
        guardada: sessaoDe("u1"),
        erroNoContexto: { message: "falhou" },
      });
      const { sessao, sistema } = montar({ cliente });
      await sessao.iniciar();
      cliente.rpc.mockImplementation(async (nome) =>
        nome === "obter_contexto_monitora"
          ? { data: CONTEXTO, error: null }
          : { data: null, error: null },
      );
      await sessao.tentarDeNovo();
      expect(sessao.obter().fase).toBe(FASES.CONECTADO);
      expect(sistema.abrir).toHaveBeenCalledTimes(1);
      vi.mocked(console.warn).mockRestore();
    });

    it("perfil ilegível com o sistema aberto: fica o perfil que estava", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const cliente = clienteFalso({ guardada: sessaoDe("u1") });
      const { sessao, sistema } = montar({ cliente });
      await sessao.iniciar();
      cliente.rpc.mockImplementation(async () => ({
        data: null,
        error: { message: "sem rede" },
      }));
      await sessao.recarregarPerfil(sessaoDe("u1"));
      expect(sessao.obter().fase).toBe(FASES.CONECTADO);
      expect(sessao.obter().perfil).toEqual(CONTEXTO.profile);
      expect(sistema.aoFicarSemAcesso).not.toHaveBeenCalled();
      vi.mocked(console.warn).mockRestore();
    });

    it("a carga do login quebrou: falha na entrada, não o pedido de acesso", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { sessao } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u1") }),
        sistema: sistemaFalso({
          abrir: vi.fn(async () => {
            throw new Error("quebrou");
          }),
        }),
      });
      await sessao.iniciar();
      const estado = sessao.obter();
      expect(estado.fase).toBe(FASES.FALHA_NA_ENTRADA);
      expect(estado.mensagem.texto).toBe(MENSAGENS.falhaAoAbrir);
      vi.mocked(console.error).mockRestore();
    });

    it("o nome do Google preenche o pedido", () => {
      expect(nomeDoUsuario({ user_metadata: { name: "Caio" } })).toBe("Caio");
      expect(nomeDoUsuario({ email: "dani@agsus.org.br" })).toBe("dani");
      expect(nomeDoUsuario(null)).toBe("");
    });
  });

  describe("domínio permitido", () => {
    it("e-mail fora dos domínios: sai e diz qual conta usar", async () => {
      const { sessao, sistema, cliente } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u9", "u9@gmail.com") }),
      });
      await sessao.iniciar();
      expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(sistema.abrir).not.toHaveBeenCalled();
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
      expect(sessao.obter().mensagem).toEqual({
        texto:
          "Use uma conta institucional (@agenciasus.org.br ou @agsus.org.br).",
        tom: "error",
      });
    });

    it("os domínios vêm da configuração", async () => {
      const sistema = sistemaFalso({
        carregarConfiguracao: vi.fn(async () =>
          sessao.definirConfiguracao({
            auth_google_allowed_domains: "@gmail.com",
          }),
        ),
      });
      const { sessao } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u9", "u9@gmail.com") }),
        sistema,
      });
      await sessao.iniciar();
      expect(sessao.obter().fase).toBe(FASES.CONECTADO);
    });

    it("configuração da entrada: padrões e o que veio do banco", () => {
      expect(configuracaoDaEntrada()).toMatchObject({
        googleAtivo: true,
        dominios: ["agenciasus.org.br", "agsus.org.br"],
      });
      expect(
        configuracaoDaEntrada({
          auth_google_enabled: "não",
          auth_google_button_text: " Entrar ",
          auth_google_domain_hint: "agenciasus.org.br",
        }),
      ).toMatchObject({
        googleAtivo: false,
        textoDoBotao: "Entrar",
        dicaDeDominio: "agenciasus.org.br",
      });
    });
  });

  describe("sair e sessão expirada", () => {
    async function conectado(sobre: OpcoesDaMontagem = {}) {
      const montado = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u1") }),
        ...sobre,
      });
      await montado.sessao.iniciar();
      expect(montado.sessao.obter().fase).toBe(FASES.CONECTADO);
      return montado;
    }

    it("sair: auditoria antes, signOut, tela de acesso sem mensagem de falha", async () => {
      const { sessao, sistema, cliente } = await conectado();
      await sessao.sair();
      expect(sistema.antesDeSair).toHaveBeenCalled();
      expect(cliente.auth.signOut).toHaveBeenCalled();
      expect(sistema.aoSair).toHaveBeenCalledTimes(1);
      const estado = sessao.obter();
      expect(estado.fase).toBe(FASES.DESLOGADO);
      expect(estado.usuario).toBeNull();
      expect(estado.perfil).toBeNull();
      expect(estado.mensagem.texto).toBe("");

      // Um segundo SIGNED_OUT continua sendo a mesma saída (não "expirou").
      cliente.emitir("SIGNED_OUT", null);
      expect(sessao.obter().mensagem.texto).toBe("");
      expect(sistema.aoSair).toHaveBeenCalledTimes(1);
    });

    it("sair volta ao endereço inicial", async () => {
      const { sessao, janela } = await conectado({
        janela: janelaFalsa({ caminho: "/saude-indigena/visao-geral" }),
      });
      janela.history.replaceState.mockClear();
      await sessao.sair();
      expect(janela.history.replaceState).toHaveBeenCalledWith(
        {},
        "MONITORA",
        "/",
      );
    });

    it("sessão expirada guarda o endereço (a navegação o reabre ao entrar)", async () => {
      const expirada = await conectado({
        janela: janelaFalsa({ caminho: "/saude-indigena/mapa" }),
      });
      expirada.janela.history.replaceState.mockClear();
      declararSaida(SAIDA_EXPIRADA);
      expirada.cliente.emitir("SIGNED_OUT", null);
      expect(expirada.sessao.obter().fase).toBe(FASES.DESLOGADO);
      expect(expirada.janela.history.replaceState).not.toHaveBeenCalled();
    });

    it("sair continua mesmo se a auditoria falhar", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { sessao } = await conectado({
        sistema: sistemaFalso({
          antesDeSair: vi.fn(async () => {
            throw new Error("rede");
          }),
        }),
      });
      await sessao.sair();
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
      vi.mocked(console.warn).mockRestore();
    });

    it("sair com signOut devolvendo erro (rede fora, token vencido) apaga o token local", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const armazenamento = { clearAuthState: vi.fn() };
      const { sessao, cliente } = await conectado({ armazenamento });
      armazenamento.clearAuthState.mockClear();
      // A auth-js devolve o erro sem apagar a sessão nem emitir SIGNED_OUT.
      cliente.auth.signOut.mockImplementationOnce(async () => ({
        error: new Error("Failed to fetch"),
      }));
      await sessao.sair();
      expect(armazenamento.clearAuthState).toHaveBeenCalled();
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
      vi.mocked(console.warn).mockRestore();
    });

    it("sair com signOut lançando exceção também apaga o token local", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const armazenamento = { clearAuthState: vi.fn() };
      const { sessao, cliente } = await conectado({ armazenamento });
      armazenamento.clearAuthState.mockClear();
      cliente.auth.signOut.mockImplementationOnce(async () => {
        throw new Error("rede");
      });
      await sessao.sair();
      expect(armazenamento.clearAuthState).toHaveBeenCalled();
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
      vi.mocked(console.warn).mockRestore();
    });

    it("sair com signOut bem-sucedido não precisa apagar à mão", async () => {
      const armazenamento = { clearAuthState: vi.fn() };
      const { sessao } = await conectado({ armazenamento });
      armazenamento.clearAuthState.mockClear();
      await sessao.sair();
      expect(armazenamento.clearAuthState).not.toHaveBeenCalled();
    });

    it("sessão expirada (com prova): a mensagem de expiração", async () => {
      const { sessao, cliente } = await conectado();
      declararSaida(SAIDA_EXPIRADA);
      cliente.emitir("SIGNED_OUT", null);
      expect(sessao.obter().mensagem).toEqual({
        texto: "Sessão encerrada. Faça login novamente.",
        tom: "warn",
      });
      expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    });

    it("aviso de inatividade (session-lifecycle) chega pela mensagem", () => {
      const { sessao } = montar();
      sessao.mostrarMensagem(
        "Sua sessão foi encerrada após 1 hora de inatividade.",
        "warn",
      );
      expect(sessao.obter().mensagem.tom).toBe("warn");
    });

    it("voltar ao login: limpa a cópia e diz que a sessão foi limpa", async () => {
      const { sessao, sistema } = await conectado();
      await sessao.limparSessao();
      expect(sistema.aoLimparSessao).toHaveBeenCalled();
      expect(sessao.obter().mensagem).toEqual({
        texto: MENSAGENS.sessaoLimpa,
        tom: "ok",
      });
    });

    it("token renovado só atualiza o usuário", async () => {
      const { sessao, cliente, sistema } = await conectado();
      const renovada = sessaoDe("u1");
      renovada.user.email = "u1.novo@agenciasus.org.br";
      cliente.emitir("TOKEN_REFRESHED", renovada);
      expect(sessao.obter().usuario?.email).toBe("u1.novo@agenciasus.org.br");
      expect(sistema.abrir).toHaveBeenCalledTimes(1);
    });

    it("perfil atualizado (USER_UPDATED) com o sistema aberto avisa o legado", async () => {
      const { sessao, cliente, sistema } = await conectado();
      cliente.emitir("USER_UPDATED", sessaoDe("u1"));
      await proximoCiclo();
      await proximoCiclo();
      expect(sistema.aoAtualizarPerfil).toHaveBeenCalledWith(
        expect.objectContaining({ painelIds: ["painel-1"] }),
      );
      expect(sessao.obter().fase).toBe(FASES.CONECTADO);
    });
  });

  describe("troca de usuário na mesma aba", () => {
    it("SIGNED_IN do mesmo usuário não recarrega; de outro, recarrega tudo", async () => {
      const cliente = clienteFalso({ guardada: sessaoDe("u1") });
      const { sessao, sistema } = montar({ cliente });
      await sessao.iniciar();
      expect(sistema.abrir).toHaveBeenCalledTimes(1);

      cliente.emitir("SIGNED_IN", sessaoDe("u1"));
      await proximoCiclo();
      expect(sistema.abrir).toHaveBeenCalledTimes(1);

      cliente.definirSessao(sessaoDe("u2"));
      cliente.emitir("SIGNED_IN", sessaoDe("u2"));
      await proximoCiclo();
      await proximoCiclo();
      expect(sistema.abrir).toHaveBeenCalledTimes(2);
      expect(sistema.abrir).toHaveBeenLastCalledWith(
        expect.objectContaining({
          origem: "oauth",
          usuario: expect.objectContaining({ id: "u2" }),
        }),
      );
      expect(sessao.obter().usuario?.id).toBe("u2");
    });

    it("duas chegadas da mesma sessão ao mesmo tempo carregam uma vez só", async () => {
      let liberar: ((aberto: boolean) => void) | undefined;
      const sistema = sistemaFalso({
        abrir: vi.fn(
          () => new Promise<boolean>((resolve) => (liberar = resolve)),
        ),
      });
      const { sessao } = montar({ sistema });
      await sessao.iniciar();
      const primeira = sessao.entrar(sessaoDe("u1"), "oauth_popup");
      const segunda = sessao.entrar(sessaoDe("u1"), "oauth_popup");
      await proximoCiclo();
      definido(liberar)(true);
      await Promise.all([primeira, segunda]);
      expect(sistema.abrir).toHaveBeenCalledTimes(1);
    });
  });

  describe("login Google", () => {
    it("no computador: popup no clique, sessão local limpa, escolha de conta", async () => {
      const popup: PopupFalso = {
        closed: false,
        location: { replace: vi.fn() },
        close: vi.fn(),
      };
      const janela = janelaFalsa({ popup });
      const { sessao, cliente } = montar({ janela });
      sessao.definirConfiguracao({
        auth_google_domain_hint: "agenciasus.org.br",
      });
      await sessao.entrarComGoogle();

      expect(janela.open).toHaveBeenCalled();
      expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(cliente.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "https://monitora.test/auth/callback.html",
          queryParams: { prompt: "select_account", hd: "agenciasus.org.br" },
          skipBrowserRedirect: true,
        },
      });
      expect(popup.location.replace).toHaveBeenCalledWith(
        "https://accounts.google.com/o/oauth2",
      );
      // O botão fica ocupado enquanto a janela do Google está aberta.
      expect(sessao.obter().entrando).toBe(true);
      expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.escolherConta);
    });

    it("o popup avisa o fim do login: a sessão entra", async () => {
      const janela = janelaFalsa();
      const cliente = clienteFalso();
      const { sessao, sistema } = montar({ janela, cliente });
      await sessao.iniciar();
      cliente.definirSessao(sessaoDe("u5"));
      await definido(janela.ouvintes.message)({
        origin: "https://monitora.test",
        data: { type: "agsus-monitora:login-concluido", result: "success" },
      });
      expect(sistema.abrir).toHaveBeenCalledWith(
        expect.objectContaining({ origem: "oauth_popup" }),
      );
    });

    it("o popup avisa que falhou: mensagem certa na hora e o vigia da janela sai", async () => {
      const popup: PopupFalso = {
        closed: false,
        location: { replace: vi.fn() },
        close: vi.fn(),
      };
      const janela = janelaFalsa({ popup });
      janela.setInterval = vi.fn(() => 7);
      const { sessao, cliente } = montar({ janela });
      await sessao.iniciar();
      await sessao.entrarComGoogle();
      const vigia = definido(janela.setInterval.mock.calls[0])[0];
      const consultas = cliente.auth.getSession.mock.calls.length;

      await definido(janela.ouvintes.message)({
        origin: "https://monitora.test",
        data: {
          type: "agsus-monitora:login-concluido",
          result: "oauth_callback",
        },
      });
      expect(janela.clearInterval).toHaveBeenCalledWith(7);
      expect(sessao.obter().entrando).toBe(false);
      expect(sessao.obter().mensagem).toEqual({
        texto: MENSAGENS.falhaNoRetorno,
        tom: "error",
      });
      // Sem esperar sessão que não vem.
      expect(cliente.auth.getSession).toHaveBeenCalledTimes(consultas);

      // A janela fechou por conclusão: nada de "fechada antes de concluir".
      popup.closed = true;
      await vigia();
      expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.falhaNoRetorno);
    });

    it("janela fechada e a sessão não pôde ser lida: o botão volta", async () => {
      const popup: PopupFalso = {
        closed: false,
        location: { replace: vi.fn() },
        close: vi.fn(),
      };
      const janela = janelaFalsa({ popup });
      const { sessao, cliente } = montar({ janela });
      await sessao.iniciar();
      await sessao.entrarComGoogle();
      const vigia = definido(janela.setInterval.mock.calls[0])[0];
      const erro = vi.spyOn(console, "error").mockImplementation(() => {});
      cliente.auth.getSession.mockRejectedValue(new Error("armazenamento"));
      popup.closed = true;
      vigia();
      await proximoCiclo();
      expect(sessao.obter().entrando).toBe(false);
      expect(sessao.obter().mensagem).toEqual({
        texto: MENSAGENS.falhaNoPopup,
        tom: "error",
      });
      erro.mockRestore();
    });

    it("mensagem de outra origem é ignorada", async () => {
      const janela = janelaFalsa();
      const { sessao, cliente } = montar({ janela });
      await sessao.iniciar();
      await definido(janela.ouvintes.message)({
        origin: "https://outro.site",
        data: { type: "agsus-monitora:login-concluido" },
      });
      expect(cliente.auth.getSession).toHaveBeenCalledTimes(1);
    });

    it("falha ao iniciar: o botão volta e a mensagem diz o motivo", async () => {
      const cliente = clienteFalso();
      cliente.auth.signInWithOAuth = vi.fn(async () => ({
        data: null,
        error: { message: "provedor desligado" },
      }));
      const { sessao } = montar({ cliente });
      await sessao.entrarComGoogle();
      expect(sessao.obter().entrando).toBe(false);
      expect(sessao.obter().mensagem).toEqual({
        texto: "Falha ao iniciar login Google: provedor desligado",
        tom: "error",
      });
    });

    it("no celular: redirecionamento, sem popup e sem signOut", async () => {
      const janela = janelaFalsa({ largura: 390 });
      const { sessao, cliente } = montar({ janela, celular: true });
      await sessao.entrarComGoogle();
      expect(janela.open).not.toHaveBeenCalled();
      expect(cliente.auth.signOut).not.toHaveBeenCalled();
      expect(cliente.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            queryParams: { prompt: "select_account consent", max_age: "0" },
          }),
        }),
      );
    });

    it("no celular, se o OAuth não inicia: botão volta e o erro aparece", async () => {
      const cliente = clienteFalso();
      cliente.auth.signInWithOAuth = vi.fn(async () => ({
        error: new Error("OAuth indisponível"),
      }));
      const { sessao } = montar({ cliente, celular: true });
      await sessao.entrarComGoogle();
      expect(sessao.obter().entrando).toBe(false);
      expect(sessao.obter().mensagem.texto).toBe("OAuth indisponível");
    });

    it("Google desligado nas configurações: não abre nada", async () => {
      const janela = janelaFalsa();
      const { sessao, cliente } = montar({ janela });
      sessao.definirConfiguracao({ auth_google_enabled: "false" });
      await sessao.entrarComGoogle();
      expect(janela.open).not.toHaveBeenCalled();
      expect(cliente.auth.signInWithOAuth).not.toHaveBeenCalled();
      expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.googleDesligado);
    });

    it("voltar do Google pelo histórico sem sessão: o botão volta", async () => {
      const janela = janelaFalsa();
      const { sessao } = montar({ janela, celular: true });
      await sessao.iniciar();
      await sessao.entrarComGoogle();
      expect(sessao.obter().entrando).toBe(true);
      definido(janela.ouvintes.pageshow)({ persisted: true });
      await proximoCiclo();
      expect(sessao.obter().entrando).toBe(false);
    });
  });

  describe("entrar sem rede (até 48 h, com o perfil guardado)", () => {
    const SEM_REDE = { message: "TypeError: Failed to fetch" };

    function perfilEmMemoria() {
      const dados = new Map<string, unknown>();
      return criarPerfilGuardado({
        ler: async (chave) => structuredClone(dados.get(chave) ?? null),
        guardar: async (chave, valor) =>
          void dados.set(chave, structuredClone(valor)),
        apagarTudo: async () => dados.clear(),
        apagar: async (chave) => void dados.delete(chave),
      });
    }

    async function entrarComRede(perfilGuardado: PerfilGuardado) {
      const { sessao } = montar({
        cliente: clienteFalso({ guardada: sessaoDe("u1") }),
        perfilGuardado,
      });
      await sessao.iniciar();
      await proximoCiclo();
      expect(sessao.obter().semRede).toBe(false);
    }

    it("abre com o perfil guardado e, com a rede de volta, confere no banco", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const perfilGuardado = perfilEmMemoria();
      await entrarComRede(perfilGuardado);

      const cliente = clienteFalso({
        guardada: sessaoDe("u1"),
        erroNoContexto: SEM_REDE,
      });
      const { sessao, sistema, janela } = montar({ cliente, perfilGuardado });
      await sessao.iniciar();
      expect(sessao.obter()).toMatchObject({
        fase: FASES.CONECTADO,
        semRede: true,
      });
      expect(sistema.abrir).toHaveBeenCalledWith(
        expect.objectContaining({
          perfil: expect.objectContaining({ id: "perfil-1" }),
          painelIds: ["painel-1"],
        }),
      );

      // A rede voltou e o acesso foi revogado: o app fecha (e as cópias saem).
      cliente.rpc.mockImplementation(async () => ({ data: null, error: null }));
      await definido(janela.ouvintes.online)({});
      await vi.waitFor(() =>
        expect(sistema.aoFicarSemAcesso).toHaveBeenCalled(),
      );
      vi.mocked(console.warn).mockRestore();
    });

    it("com a rede de volta e o acesso mantido, sai do modo sem rede", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const perfilGuardado = perfilEmMemoria();
      await entrarComRede(perfilGuardado);
      const cliente = clienteFalso({
        guardada: sessaoDe("u1"),
        erroNoContexto: SEM_REDE,
      });
      const { sessao, sistema, janela } = montar({ cliente, perfilGuardado });
      await sessao.iniciar();
      expect(sessao.obter().semRede).toBe(true);

      cliente.rpc.mockImplementation(async (nome) =>
        nome === "obter_contexto_monitora"
          ? { data: CONTEXTO, error: null }
          : { data: null, error: null },
      );
      await definido(janela.ouvintes.online)({});
      await vi.waitFor(() => expect(sessao.obter().semRede).toBe(false));
      expect(sistema.aoFicarSemAcesso).not.toHaveBeenCalled();
      expect(sessao.obter().fase).toBe(FASES.CONECTADO);
      vi.mocked(console.warn).mockRestore();
    });

    it("sem rede e sem perfil guardado: a falha na entrada de sempre", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { sessao, sistema } = montar({
        cliente: clienteFalso({
          guardada: sessaoDe("u1"),
          erroNoContexto: SEM_REDE,
        }),
        perfilGuardado: perfilEmMemoria(),
      });
      await sessao.iniciar();
      expect(sessao.obter().fase).toBe(FASES.FALHA_NA_ENTRADA);
      expect(sistema.abrir).not.toHaveBeenCalled();
      vi.mocked(console.warn).mockRestore();
    });

    it("erro do banco (não de rede) não usa o perfil guardado", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const perfilGuardado = perfilEmMemoria();
      await entrarComRede(perfilGuardado);
      const { sessao, sistema } = montar({
        cliente: clienteFalso({
          guardada: sessaoDe("u1"),
          erroNoContexto: { message: "permission denied" },
        }),
        perfilGuardado,
      });
      await sessao.iniciar();
      expect(sessao.obter().fase).toBe(FASES.FALHA_NA_ENTRADA);
      expect(sistema.abrir).not.toHaveBeenCalled();
      vi.mocked(console.warn).mockRestore();
    });

    it("link interno sem rede, com o perfil guardado: continua entrando, no mesmo endereço", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const perfilGuardado = perfilEmMemoria();
      await entrarComRede(perfilGuardado);
      const { sessao, sistema, janela } = montar({
        cliente: clienteFalso({
          guardada: sessaoDe("u1"),
          erroNoContexto: SEM_REDE,
        }),
        janela: janelaFalsa({ caminho: "/saude-indigena/mapa" }),
        perfilGuardado,
      });
      await sessao.iniciar();
      expect(sessao.obter()).toMatchObject({
        fase: FASES.CONECTADO,
        semRede: true,
      });
      expect(sistema.abrir).toHaveBeenCalledWith(
        expect.objectContaining({
          perfil: expect.objectContaining({ id: "perfil-1" }),
        }),
      );
      expect(janela.history.replaceState).not.toHaveBeenCalled();
      vi.mocked(console.warn).mockRestore();
    });

    it("o perfil guardado é de um usuário só", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const perfilGuardado = perfilEmMemoria();
      await entrarComRede(perfilGuardado);
      const { sessao } = montar({
        cliente: clienteFalso({
          guardada: sessaoDe("u2"),
          erroNoContexto: SEM_REDE,
        }),
        perfilGuardado,
      });
      await sessao.iniciar();
      expect(sessao.obter().fase).toBe(FASES.FALHA_NA_ENTRADA);
      vi.mocked(console.warn).mockRestore();
    });
  });
});

bloco("app/sistema", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // O jsdom não tem matchMedia (a moldura pergunta a largura).
  // Só `matches` é lido: o resto do MediaQueryList fica de fora, como antes.
  window.matchMedia ||= () => ({ matches: false }) as MediaQueryList;

  /*
  A ligação do sistema (src/app/sistema.ts): os contratos em window que o
  index.html, a barra lateral, a Aya e as telas usam, os ganchos da
  sessão e a busca global.
*/

  describe("ligarSistema", () => {
    it("publica os contratos em window e liga os ganchos da sessão", async () => {
      document.body.innerHTML = `
      <section id="appScreen" class="app hidden"></section>
      <i id="fullscreenActionIcon"></i>`;
      const { sessaoDoApp } = await import("../src/app/sessao.ts");
      const ligar = vi.spyOn(sessaoDoApp, "ligarSistema");
      const sistema = await import("../src/app/sistema.ts");
      await act(async () => sistema.ligarSistema());

      for (const nome of [
        "getMonitoraProfile",
        "monitoraToast",
        "monitoraLoader",
        "exitExternalPanel",
        "navigate",
        "refreshData",
        "reloadExternal",
        "toggleBrowserFullscreen",
        "toggleDarkMode",
        "toggleSidebar",
      ])
        expect(typeof Reflect.get(window, nome), nome).toBe("function");
      expect(window.navigate).toBe(sistema.navegacao.irPara);
      expect(window.getMonitoraProfile?.()).toBeNull();

      const ganchos = definido(definido(ligar.mock.calls[0])[0]);
      expect(Object.keys(ganchos).sort()).toEqual(
        [
          "abrir",
          "antesDeSair",
          "aoAtualizarPerfil",
          "aoFalharNaEntrada",
          "aoFicarSemAcesso",
          "aoLimparSessao",
          "aoSair",
          "aoVerificar",
          "carregarConfiguracao",
          "encerrarEspera",
          "mostrarEsqueleto",
        ].sort(),
      );

      // Pessoas online (filha da casca, src/app/casca/pecas.tsx) fica escondido até a primeira batida.
      expect(sistema.presenca.obter().visivel).toBe(false);

      // Sair esconde o app e limpa o que era da pessoa (os avisos de conferência lidos também).
      const { memoriaDosAvisos } =
        await import("../src/modulos/conferencias/memoria-dos-avisos.ts");
      memoriaDosAvisos.set("|", { lista: null, versao: "v1" });
      definido(document.getElementById("appScreen")).classList.remove("hidden");
      await act(async () => ganchos.aoSair?.());
      expect(document.getElementById("appScreen")?.classList).toContain(
        "hidden",
      );
      expect(memoriaDosAvisos.size).toBe(0);

      // Sem acesso: a memória sai e a presença para inteira (heartbeat e a batida de Pessoas online).
      const esquecer = vi.spyOn(sistema.carga, "esquecer");
      const pararTudo = vi.spyOn(sistema.presenca, "pararTudo");
      // Chamado sem os dados, como no teste em JavaScript.
      await act(async () =>
        Reflect.apply(definido(ganchos.aoFicarSemAcesso), ganchos, []),
      );
      expect(esquecer).toHaveBeenCalled();
      expect(pararTudo).toHaveBeenCalled();
    });

    it("a busca global sem linha carregada não navega", async () => {
      const sistema = await import("../src/app/sistema.ts");
      const ir = vi.spyOn(sistema.navegacao, "irPara");
      sistema.localizarLinhaDoMonitoramento("999");
      expect(ir).not.toHaveBeenCalled();
    });
  });
});

bloco("app/usar-filtros-na-url", () => {
  /*
  Os filtros das telas da seleção na URL (Triagem, Avaliação documental,
  Classificação): link copiado abre filtrado, voltar/avançar do navegador
  volta aos filtros, a busca por nome/CPF nunca vai à URL.
*/

  const TRIAGEM = "/projetos/triagem";
  type CampoDaTriagem = "aba" | "situacao" | "busca";
  const ESQUEMA: EsquemaDosFiltros<CampoDaTriagem> = Object.freeze({
    aba: {
      padrao: "resumo",
      aceita: (v: string) => ["resumo", "pessoas", "vagas"].includes(v),
      empilha: true,
    },
    situacao: { padrao: "TODAS" },
    busca: { padrao: "", naUrl: false },
  });

  const url = () => location.pathname + location.search;
  const voltarPara = async (endereco: string) => {
    await act(async () => {
      history.replaceState(null, "", endereco);
      dispatchEvent(new PopStateEvent("popstate"));
    });
  };

  let raiz: Root | null = null;
  async function montar(elemento: ReactElement, tela = "pre-classificacao") {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    const novaRaiz = createRoot(caixa);
    raiz = novaRaiz;
    await act(async () =>
      novaRaiz.render(h(TelaNaUrl.Provider, { value: tela }, elemento)),
    );
  }

  beforeEach(() => {
    esquecerFiltrosDasTelas();
    sessionStorage.clear();
    history.replaceState(null, "", TRIAGEM);
  });
  afterEach(async () => {
    const montada = raiz;
    if (montada) await act(async () => montada.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  describe("regras dos filtros no endereço", () => {
    it("lê só os da URL, recusa o inválido e diz quando não há nenhum", () => {
      expect(filtrosDaBusca(ESQUEMA, "?outro=1")).toBeNull();
      expect(filtrosDaBusca(ESQUEMA, "?aba=xyz&busca=Maria")).toEqual({
        aba: "resumo",
        situacao: "TODAS",
      });
      expect(
        filtrosDaBusca(ESQUEMA, "?aba=pessoas&situacao=ELIMINADOS"),
      ).toEqual({ aba: "pessoas", situacao: "ELIMINADOS" });
    });

    it("escreve sem o padrão e sem a busca; `manter` leva o resto embora", () => {
      expect(
        buscaComFiltros("?edital=e1&vaga=7", ESQUEMA, {
          aba: "resumo",
          situacao: "ELIMINADOS",
          busca: "123.456.789-00",
        }),
      ).toBe("?edital=e1&vaga=7&situacao=ELIMINADOS");
      expect(
        buscaComFiltros(
          "?edital=e1&vaga=7&visao=x",
          ESQUEMA,
          { aba: "vagas" },
          ["edital"],
        ),
      ).toBe("?edital=e1&visao=x&aba=vagas");
      expect(buscaComFiltros("?aba=pessoas", ESQUEMA, { aba: "resumo" })).toBe(
        "",
      );
    });

    it("normaliza o guardado e sabe o que empilha", () => {
      expect(normalizarFiltros(ESQUEMA, { aba: "nada", busca: 5 })).toEqual({
        aba: "resumo",
        situacao: "TODAS",
        busca: "",
      });
      const antes = { aba: "resumo", situacao: "TODAS", busca: "" };
      expect(mudouOQueEmpilha(ESQUEMA, antes, { situacao: "X" })).toBe(false);
      expect(mudouOQueEmpilha(ESQUEMA, antes, { aba: "vagas" })).toBe(true);
    });

    it("a rota leva os filtros, sem a visão", () => {
      const destino = destinoDoCaminho(TRIAGEM, "?visao=v&edital=e1&aba=vagas");
      expect(destino).toMatchObject({
        view: "pre-classificacao",
        visao: "v",
        filtros: "edital=e1&aba=vagas",
      });
      expect(
        caminhoDoDestino({
          view: "pre-classificacao",
          area: "projetos",
          filtros: "edital=e1",
        }),
      ).toBe(`${TRIAGEM}?edital=e1`);
      guardarFiltrosDaTela("classificacao", "?visao=v&aba=agenda");
      expect(filtrosGuardadosDaTela("classificacao")).toBe("aba=agenda");
    });
  });

  describe("usarFiltrosNaUrl", () => {
    let filtros: ValoresDosFiltros<CampoDaTriagem>;
    let mudar: MudarFiltros<CampoDaTriagem>;
    function Tela({ sessao = "" }: { sessao?: string }) {
      [filtros, mudar] = usarFiltrosNaUrl(ESQUEMA, {
        sessao,
        manter: ["edital"],
      });
      return h("output", null, `${filtros.aba}|${filtros.situacao}`);
    }

    it("abre com os filtros do link", async () => {
      history.replaceState(null, "", `${TRIAGEM}?aba=pessoas&situacao=X`);
      await montar(h(Tela));
      expect(filtros).toMatchObject({ aba: "pessoas", situacao: "X" });
    });

    it("filtro troca a entrada; a aba empilha e deixa só o edital", async () => {
      history.replaceState(null, "", `${TRIAGEM}?edital=e1&vaga=9`);
      await montar(h(Tela));
      const tamanho = history.length;
      await act(async () => mudar({ situacao: "ELIMINADOS" }));
      expect(url()).toBe(`${TRIAGEM}?edital=e1&vaga=9&situacao=ELIMINADOS`);
      expect(history.length).toBe(tamanho);
      await act(async () => mudar({ aba: "vagas" }));
      expect(url()).toBe(`${TRIAGEM}?edital=e1&situacao=ELIMINADOS&aba=vagas`);
      expect(history.length).toBe(tamanho + 1);
    });

    it("a busca fica fora da URL (e na sessão)", async () => {
      await montar(h(Tela, { sessao: "k" }));
      await act(async () => mudar({ busca: "Maria 123.456.789-00" }));
      expect(location.search).toBe("");
      expect(filtros.busca).toBe("Maria 123.456.789-00");
      expect(JSON.parse(String(sessionStorage.getItem("k"))).busca).toBe(
        "Maria 123.456.789-00",
      );
    });

    it("voltar do navegador devolve os filtros; o padrão some da URL", async () => {
      await montar(h(Tela));
      await act(async () => mudar({ aba: "pessoas", situacao: "X" }));
      await voltarPara(TRIAGEM);
      expect(filtros).toMatchObject({ aba: "resumo", situacao: "TODAS" });
      await voltarPara(`${TRIAGEM}?aba=vagas`);
      expect(filtros.aba).toBe("vagas");
    });

    it("sem filtro na URL, vale a sessão (por edital), e a URL passa a mostrá-lo", async () => {
      sessionStorage.setItem("e1", JSON.stringify({ situacao: "S1" }));
      sessionStorage.setItem("e2", JSON.stringify({ situacao: "S2" }));
      await montar(h(Tela, { sessao: "e1" }));
      expect(filtros.situacao).toBe("S1");
      expect(location.search).toBe("?situacao=S1");
      await act(async () =>
        definido(raiz).render(
          h(
            TelaNaUrl.Provider,
            { value: "pre-classificacao" },
            h(Tela, { sessao: "e2" }),
          ),
        ),
      );
      expect(filtros.situacao).toBe("S2");
      expect(location.search).toBe("?situacao=S2");
    });

    it("com a URL de outra tela, só guarda; o voltar de lá não mexe aqui", async () => {
      await montar(h(Tela));
      await act(async () => mudar({ situacao: "X" }));
      history.replaceState(null, "", "/projetos/cronograma");
      await act(async () => mudar({ situacao: "Y" }));
      expect(location.search).toBe("");
      expect(filtrosGuardadosDaTela("pre-classificacao")).toBe("situacao=Y");
      await voltarPara("/projetos/cronograma?x=1");
      expect(filtros.situacao).toBe("Y");
    });

    it("fora de <TelaNaUrl>, nada vai à URL", async () => {
      await montar(h(Tela), "");
      await act(async () => mudar({ aba: "vagas" }));
      expect(location.search).toBe("");
      expect(filtros.aba).toBe("vagas");
    });
  });

  describe("usarLojaNaUrl e usarEditalNaUrl", () => {
    const EDITAIS = [{ id: "e1" }, { id: "e2" }];

    function criarLoja(inicial: string) {
      let valor = inicial;
      const ouvintes = new Set<() => void>();
      return {
        obter: () => valor,
        assinar: (f: () => void) => (ouvintes.add(f), () => ouvintes.delete(f)),
        escolher: vi.fn((id: string) => {
          valor = id;
          ouvintes.forEach((f) => f());
        }),
      };
    }

    let escolher: (id: string) => void;
    function Tela({
      loja,
      carregado,
    }: {
      loja: ReturnType<typeof criarLoja>;
      carregado: boolean;
    }) {
      const editalId = useSyncExternalStore(loja.assinar, loja.obter);
      escolher = usarEditalNaUrl({
        editalId,
        editais: EDITAIS,
        carregado,
        escolher: loja.escolher,
      });
      return h("output", null, editalId);
    }

    it("o edital do link vale depois de carregado; a escolha automática não ganha dele", async () => {
      history.replaceState(null, "", `${TRIAGEM}?edital=e2&aba=pessoas`);
      const loja = criarLoja("e1");
      await montar(h(Tela, { loja, carregado: false }));
      expect(loja.escolher).not.toHaveBeenCalled();
      await act(async () =>
        definido(raiz).render(
          h(
            TelaNaUrl.Provider,
            { value: "pre-classificacao" },
            h(Tela, { loja, carregado: true }),
          ),
        ),
      );
      expect(loja.escolher).toHaveBeenCalledWith("e2");
      expect(url()).toBe(`${TRIAGEM}?edital=e2&aba=pessoas`);
    });

    it("edital fora da lista não abre; a URL fica com o da loja", async () => {
      history.replaceState(null, "", `${TRIAGEM}?edital=e9`);
      const loja = criarLoja("e1");
      await montar(h(Tela, { loja, carregado: true }));
      expect(loja.escolher).not.toHaveBeenCalled();
      expect(location.search).toBe("?edital=e1");
    });

    it("escolher outro edital empilha, mantém a aba e leva os filtros", async () => {
      history.replaceState(
        null,
        "",
        `${TRIAGEM}?edital=e1&aba=pessoas&situacao=X`,
      );
      const loja = criarLoja("e1");
      await montar(h(Tela, { loja, carregado: true }));
      const tamanho = history.length;
      await act(async () => escolher("e2"));
      expect(loja.escolher).toHaveBeenCalledWith("e2");
      expect(url()).toBe(`${TRIAGEM}?edital=e2&aba=pessoas`);
      expect(history.length).toBe(tamanho + 1);
      await voltarPara(`${TRIAGEM}?edital=e1&aba=pessoas&situacao=X`);
      expect(loja.escolher).toHaveBeenLastCalledWith("e1");
    });

    it("a loja muda sozinha (sem link): a URL acompanha, trocando a entrada", async () => {
      const esquema: EsquemaDosFiltros<"etapa"> = {
        etapa: { padrao: "lote", empilha: true },
      };
      let valores = { etapa: "lote" };
      const aplicar = vi.fn();
      function Fila({ etapa }: { etapa: string }) {
        usarLojaNaUrl(esquema, { etapa }, aplicar);
        return null;
      }
      await montar(h(Fila, valores));
      const tamanho = history.length;
      valores = { etapa: "concluidas" };
      await act(async () =>
        definido(raiz).render(
          h(
            TelaNaUrl.Provider,
            { value: "pre-classificacao" },
            h(Fila, valores),
          ),
        ),
      );
      expect(location.search).toBe("?etapa=concluidas");
      expect(history.length).toBe(tamanho);
      expect(aplicar).not.toHaveBeenCalled();
    });
  });
});

bloco("arte-leve-no-acesso", () => {
  /*
  A ARTE LEVE NA TELA DE ACESSO (13/11/2026: "por que demora para carregar em
  processadores fracos?")

  A arte original (3200×1370, 689 KB) era baixada, decodificada e desenhada
  duas vezes, uma delas com blur(28px) em tela cheia. A tela passa a pedir ao
  Storage do Supabase as versões redimensionadas: a nítida com 1200 px de
  altura (~157 KB) e a miniatura de 64 px (~2 KB) para o fundo desfocado. A
  configuração continua com o endereço original.
*/

  const ORIGINAL =
    "https://exemplo.supabase.co/storage/v1/object/public/platform-assets/branding/acesso-1.jpg";
  const BASE =
    "https://exemplo.supabase.co/storage/v1/render/image/public/platform-assets/branding/acesso-1.jpg";

  describe("enderecosDaArteNaTela", () => {
    it("arte do Storage: a nítida com 1200 px de altura e a miniatura de 64 px", () => {
      expect(enderecosDaArteNaTela(` ${ORIGINAL} `)).toEqual({
        nitida: `${BASE}?height=1200&quality=75`,
        desfocada: `${BASE}?width=64&quality=50`,
      });
    });

    it("outro endereço (arte padrão, https qualquer, já com parâmetros) fica como está", () => {
      for (const url of [
        "/assets/access-background-default.svg",
        "https://outro.exemplo.org/arte.jpg",
        `${ORIGINAL}?v=2`,
      ])
        expect(enderecosDaArteNaTela(url)).toEqual({
          nitida: url,
          desfocada: url,
        });
    });
  });

  describe("o primeiro quadro usa as mesmas versões leves", () => {
    const html = readFileSync("index.html", "utf8");
    const raiz = () => document.documentElement.style;

    afterEach(() => {
      limparMarcaGuardada();
      for (const nome of [
        "--login-background-image",
        "--login-background-image-desfocada",
        "--login-arte-proporcao",
      ])
        raiz().removeProperty(nome);
      document.documentElement.classList.remove(
        "arte-esperando",
        "arte-pronta",
        "arte-atrasada",
      );
    });

    function rodarScriptDoHead() {
      const inicio = html.indexOf("(function aplicarMarcaAntesDoPrimeiroPaint");
      new Function(html.slice(inicio, html.indexOf("</script>", inicio)))();
    }

    it("o script do <head> põe as duas versões e acha a medida pela nítida", () => {
      const { nitida, desfocada } = enderecosDaArteNaTela(ORIGINAL);
      guardarMarca({
        backgroundUrl: ORIGINAL,
        arteMedidaDe: nitida,
        arteProporcao: "2.3358",
      });
      rodarScriptDoHead();
      expect(raiz().getPropertyValue("--login-background-image")).toBe(
        `url("${nitida}")`,
      );
      expect(
        raiz().getPropertyValue("--login-background-image-desfocada"),
      ).toBe(`url("${desfocada}")`);
      expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("2.3358");
      const guardada: unknown = Reflect.get(window, "__agsusArteDoAcesso");
      expect(guardada instanceof HTMLImageElement ? guardada.src : "").toBe(
        nitida,
      );
    });

    it("o fundo desfocado usa a miniatura, sem o blur(28px) em tela cheia", () => {
      const css = readFileSync("src/styles/platform-shell.css", "utf8");
      const antes = css.slice(css.indexOf(".login-screen::before {"));
      const regra = antes.slice(0, antes.indexOf("}"));
      expect(regra).toContain("--login-background-image-desfocada");
      expect(regra).not.toContain("blur(28px)");
    });
  });
});

bloco("arte-no-primeiro-quadro", () => {
  /*
  A ARTE NO PRIMEIRO QUADRO (13/11/2026: "ainda pisca forte a tela de login")

  Medido quadro a quadro no site publicado: o fundo da tela de acesso era o
  claro da página até a arte aparecer, e a arte nítida começava na posição de
  16:9 e pulava quando a proporção real (2,34:1) era medida. A cada carga, a
  tela clareava e a arte mudava de lugar.

  Agora marca.ts guarda a proporção e a cor da borda esquerda com o endereço
  da arte, e o script do <head> as aplica antes do primeiro quadro, só se a
  medida for da arte guardada.
*/

  const html = readFileSync("index.html", "utf8");

  /* O script clássico do <head> que aplica a marca antes do primeiro paint. */
  function rodarScriptDoHead() {
    const inicio = html.indexOf("(function aplicarMarcaAntesDoPrimeiroPaint");
    const fim = html.indexOf("</script>", inicio);
    expect(inicio).toBeGreaterThan(-1);
    new Function(html.slice(inicio, fim))();
  }

  const ARTE = "https://exemplo.test/arte.jpg";
  const raiz = () => document.documentElement.style;

  afterEach(() => {
    limparMarcaGuardada();
    raiz().removeProperty("--login-arte-proporcao");
    raiz().removeProperty("--login-arte-cor");
    raiz().removeProperty("--login-background-image");
    document.documentElement.classList.remove(
      "arte-esperando",
      "arte-pronta",
      "arte-atrasada",
    );
    vi.useRealTimers();
  });

  describe("o cache guarda a medida da arte", () => {
    it("proporção, cor e endereço medido sobrevivem à mescla", () => {
      guardarMarca({ backgroundUrl: ARTE, panelColor: "#002f2f" });
      guardarMarca({
        arteMedidaDe: ARTE,
        arteProporcao: "2.3358",
        arteCor: "#043231",
      });
      expect(lerMarcaGuardada()).toMatchObject({
        backgroundUrl: ARTE,
        panelColor: "#002f2f",
        arteMedidaDe: ARTE,
        arteProporcao: "2.3358",
        arteCor: "#043231",
      });
    });
  });

  describe("o script do <head> aplica a medida no primeiro quadro", () => {
    it("medida da arte guardada: proporção e cor vão na raiz", () => {
      guardarMarca({
        backgroundUrl: ARTE,
        arteMedidaDe: ARTE,
        arteProporcao: "2.3358",
        arteCor: "#043231",
      });
      rodarScriptDoHead();
      expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("2.3358");
      expect(raiz().getPropertyValue("--login-arte-cor")).toBe("#043231");
    });

    it("medida de outra arte: não aplica (a arte mudou)", () => {
      guardarMarca({
        backgroundUrl: "https://exemplo.test/nova.jpg",
        arteMedidaDe: ARTE,
        arteProporcao: "2.3358",
        arteCor: "#043231",
      });
      rodarScriptDoHead();
      expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("");
      expect(raiz().getPropertyValue("--login-arte-cor")).toBe("");
    });

    it("valor fora do formato não entra no CSS", () => {
      guardarMarca({
        backgroundUrl: ARTE,
        arteMedidaDe: ARTE,
        arteProporcao: "2; color: red",
        arteCor: "red",
      });
      rodarScriptDoHead();
      expect(raiz().getPropertyValue("--login-arte-proporcao")).toBe("");
      expect(raiz().getPropertyValue("--login-arte-cor")).toBe("");
    });
  });

  /*
  13/11/2026, gravado em vídeo no site publicado: a cada atualização, o cartão
  e o fundo na cor da arte apareciam primeiro e a arte entrava uns 230 ms
  depois, de uma vez (a imagem, 3200×1370, só era decodificada na hora de
  pintar). O script do <head> pede e decodifica a arte antes do CSS; enquanto
  ela não está pronta, `arte-esperando` deixa as camadas transparentes, e elas
  entram com transição.
*/
  describe("a arte decodificada antes do CSS", () => {
    it("com arte guardada, pede a imagem e esconde o cartão até ela ficar pronta", () => {
      vi.useFakeTimers();
      guardarMarca({ backgroundUrl: ARTE });
      rodarScriptDoHead();
      const guardada: unknown = Reflect.get(window, "__agsusArteDoAcesso");
      const imagem =
        guardada instanceof HTMLImageElement ? guardada : undefined;
      expect(imagem?.src).toBe(ARTE);
      const classes = document.documentElement.classList;
      expect(classes.contains("arte-esperando")).toBe(true);
      imagem?.onload?.(new Event("load"));
      expect(classes.contains("arte-esperando")).toBe(false);
      expect(classes.contains("arte-pronta")).toBe(true);
      vi.advanceTimersByTime(600);
      expect(classes.contains("arte-atrasada")).toBe(false);
    });

    it("arte que passa de 600 ms: o cartão aparece e a arte entra depois", () => {
      vi.useFakeTimers();
      guardarMarca({ backgroundUrl: ARTE });
      rodarScriptDoHead();
      const classes = document.documentElement.classList;
      vi.advanceTimersByTime(600);
      expect(classes.contains("arte-esperando")).toBe(false);
      expect(classes.contains("arte-atrasada")).toBe(true);
      expect(classes.contains("arte-pronta")).toBe(false);
      vi.advanceTimersByTime(2400);
      expect(classes.contains("arte-pronta")).toBe(true);
    });

    it("sem arte guardada, não espera nada", () => {
      rodarScriptDoHead();
      expect(
        document.documentElement.classList.contains("arte-esperando"),
      ).toBe(false);
    });

    /*
    13/11/2026, terceiro vídeo: com a arte já pronta, um quadro de 33 ms
    mostrava a arte e ainda não o cartão (o HTML do cartão vem depois).
  */
    it("a arte só aparece depois de o cartão provisório ser lido", () => {
      const fimDoCartao = html.indexOf('<div class="login-stripe"></div>');
      const marca = html.indexOf(
        'document.documentElement.classList.add("cartao-lido")',
      );
      expect(fimDoCartao).toBeGreaterThan(-1);
      expect(marca).toBeGreaterThan(fimDoCartao);
      expect(marca).toBeLessThan(html.indexOf("</section>", fimDoCartao));
      const css = readFileSync("src/styles/platform-shell.css", "utf8");
      expect(css).toContain(
        "html:not(.cartao-lido) .login-screen::before,\nhtml:not(.cartao-lido) .login-screen::after,",
      );
    });

    it("o CSS esconde o cartão e a arte enquanto espera; atrasada, a arte entra com transição", () => {
      const css = readFileSync("src/styles/platform-shell.css", "utf8");
      expect(css).toContain(
        "html.arte-esperando #loginScreen > *,\nhtml.marca-esperando #loginScreen > * {\n  visibility: hidden;\n}",
      );
      expect(css).toContain(
        "html.arte-atrasada:not(.arte-pronta) .login-screen::after {\n  opacity: 0;\n}",
      );
      const atrasada = css.slice(
        css.indexOf(
          "html.arte-atrasada .login-screen::before,\nhtml.arte-atrasada .login-screen::after {",
        ),
      );
      expect(atrasada.slice(0, 260)).toContain("opacity var(--duration-slow)");
    });
  });
});

bloco("componentes/area-atual", () => {
  /*
  A área atual (Saúde Indígena, SEDE ou Projetos) mora no store dos dados do
  monitoramento: o menu a define, e Editais, Cronograma e Lista de aprovados
  recortam por ela.
*/

  const CHAVE = "agsus_monitora_area_atual_v1";

  beforeEach(() => sessionStorage.clear());
  afterEach(() => redefinirDadosDoMonitoramento());

  describe("linhasDaArea", () => {
    const LINHAS = [
      { id: 1, CO_AREA: "saude-indigena" },
      { id: 2, CO_AREA: "sede" },
      { id: 3, CO_AREA: "projetos" },
      // Sem CO_AREA (cache antigo): a regra local reconhece a Saúde Indígena…
      { id: 4, unidade: "DSEI Manaus", responsavel: "USI" },
      // …e nada mais: unidade do CORES fica fora de todas as áreas.
      { id: 5, unidade: "SEDE", responsavel: "CORES" },
    ];

    it("filtra por CO_AREA; sem a coluna, só a Saúde Indígena é reconhecida", () => {
      expect(
        linhasDaArea(LINHAS, "saude-indigena").map((linha) => linha.id),
      ).toEqual([1, 4]);
      expect(linhasDaArea(LINHAS, "sede").map((linha) => linha.id)).toEqual([
        2,
      ]);
      expect(linhasDaArea(LINHAS, "projetos").map((linha) => linha.id)).toEqual(
        [3],
      );
      expect(areaDaLinha(LINHAS[4])).toBe("");
      expect(linhasDaArea(undefined, "sede")).toEqual([]);
    });

    it("o recorte de cronograma e listas é pelo conjunto de ids", () => {
      const ids = idsDasLinhas(linhasDaArea(LINHAS, "sede"));
      expect([...ids]).toEqual(["2"]);
      // O id vem número numa fonte e texto na outra.
      expect(
        soDosEditais(
          [
            { editalId: "1", atividade: "a" },
            { editalId: "2", atividade: "b" },
          ],
          ids,
          "editalId",
        ).map((etapa) => etapa.atividade),
      ).toEqual(["b"]);
      expect(
        soDosEditais(
          [
            { lista_id: "L1", edital_id: 1 },
            { lista_id: "L2", edital_id: 2 },
          ],
          ids,
        ).map((lista) => lista.lista_id),
      ).toEqual(["L2"]);
      expect(soDosEditais(null, ids)).toEqual([]);
    });
  });

  describe("a área atual", () => {
    it("começa na Saúde Indígena e vira a primeira área do usuário", () => {
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
      definirAreasDoUsuario(["sede", "projetos"]);
      expect(obterDadosDoMonitoramento()).toMatchObject({
        areas: ["sede", "projetos"],
        areaAtual: "sede",
      });
    });

    it("continua a mesma se o usuário a tem, e fica guardada na aba", () => {
      definirAreasDoUsuario(["saude-indigena", "sede", "projetos"]);
      definirAreaAtual("projetos");
      expect(sessionStorage.getItem(CHAVE)).toBe("projetos");

      definirAreasDoUsuario(["saude-indigena", "projetos"]);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("projetos");

      definirAreasDoUsuario([]);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
    });
  });

  describe("resumoDasLinhas", () => {
    it("os indicadores do Núcleo contam só os editais da tabela", () => {
      const resumo = [
        { id: 1, unidade: "DSEI Manaus", edital: "10/2026" },
        { id: 2, unidade: "SEDE", edital: "11/2026" },
        { id: 9, unidade: "DSEI Xingu", edital: "12/2026" },
      ];
      expect(
        resumoDasLinhas(resumo, [
          { id: 2 },
          // Casa por unidade + edital, como a tabela.
          { id: 77, unidade: "DSEI Xingu", edital: "12/2026" },
        ]).map((item) => item.id),
      ).toEqual([2, 9]);
      expect(resumoDasLinhas(resumo, [])).toEqual([]);
    });
  });

  describe("as leituras de editais pedem a área", () => {
    // As colunas são listadas uma a uma; sem CO_AREA, SEDE e Projetos ficavam vazios.
    it("src/app/carga.ts", () => {
      expect(readFileSync("src/app/carga.ts", "utf8")).toContain(
        '"listar_monitoramento_operacional"',
      );
      expect(COLUNAS_DO_MONITORAMENTO.split(",")).toContain("CO_AREA");
    });
  });
});

bloco("componentes/aviso-de-versao", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const NOVIDADE = {
    id: "2026-10-22-motivo",
    data: "2026-10-22",
    texto: "motivo padronizado na reabertura",
    visivel: true,
  };

  function documentoFalso(visibilidade: DocumentVisibilityState = "visible") {
    const alvo = new EventTarget();
    return {
      visibilityState: visibilidade,
      addEventListener: alvo.addEventListener.bind(alvo),
      removeEventListener: alvo.removeEventListener.bind(alvo),
      mudar(estado: DocumentVisibilityState) {
        this.visibilityState = estado;
        alvo.dispatchEvent(new Event("visibilitychange"));
      },
    };
  }

  function armazenamentoFalso() {
    const dados = new Map<string, string>();
    return {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) =>
        dados.set(chave, String(valor)),
    };
  }

  /* O cenário: o que o servidor publica (ou uma função que responde), a aba e o armazenamento. */
  interface Cenario {
    publicada?: unknown;
    visibilidade?: DocumentVisibilityState;
    temPendencia?: () => boolean;
    armazenamento?: ReturnType<typeof armazenamentoFalso>;
  }

  function montarCenario({
    publicada = { versao: "v2", novidades: [] },
    visibilidade = "visible",
    temPendencia = () => false,
    armazenamento = armazenamentoFalso(),
  }: Cenario = {}) {
    const documento = documentoFalso(visibilidade);
    const janela = new EventTarget();
    const recarregar = vi.fn();
    let tempo = 1_000_000;
    const buscar = vi.fn(async () =>
      typeof publicada === "function" ? publicada() : publicada,
    );
    const aviso = criarAvisoDeVersao({
      versaoAtual: "v1",
      buscar,
      documento,
      janela,
      armazenamento: () => armazenamento,
      novidadesDesteBuild: [],
      temPendencia,
      recarregar,
      agora: () => tempo,
    });
    return {
      aviso,
      documento,
      janela,
      recarregar,
      buscar,
      armazenamento,
      passar(ms: number) {
        tempo += ms;
      },
    };
  }

  describe("detecção de versão nova", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("confere a cada 5 minutos com a aba visível e para com a aba oculta", async () => {
      const c = montarCenario({ publicada: { versao: "v1", novidades: [] } });
      c.aviso.iniciar();
      expect(c.buscar).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS);
      expect(c.buscar).toHaveBeenCalledTimes(1);
      expect(c.buscar).toHaveBeenCalledWith("/versao.json");

      c.documento.mudar("hidden");
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS * 3);
      expect(c.buscar).toHaveBeenCalledTimes(1);

      // Volta para a aba: confere na hora (passou mais de um minuto) e o relógio recomeça.
      c.passar(INTERVALO_DA_CONFERENCIA_MS * 3);
      c.documento.mudar("visible");
      await vi.advanceTimersByTimeAsync(0);
      expect(c.buscar).toHaveBeenCalledTimes(2);
      c.aviso.parar();
    });

    it("voltar o foco confere de novo, no máximo uma vez por minuto", async () => {
      const c = montarCenario();
      c.aviso.iniciar();
      c.passar(61_000);
      c.janela.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
      c.janela.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
      expect(c.buscar).toHaveBeenCalledTimes(1);
      expect(c.aviso.obter().versaoNova).toBe("v2");
      c.aviso.parar();
    });

    it("começa parado com a aba oculta", async () => {
      const c = montarCenario({ visibilidade: "hidden" });
      c.aviso.iniciar();
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS * 2);
      expect(c.buscar).not.toHaveBeenCalled();
      c.aviso.parar();
    });

    it("mesma versão, arquivo inválido ou sem rede: nada muda", async () => {
      const c = montarCenario({ publicada: { versao: "v1" } });
      expect(await c.aviso.conferir()).toBe(false);
      const d = montarCenario({ publicada: "<html>" });
      expect(await d.aviso.conferir()).toBe(false);
      const e = montarCenario({
        publicada: () => {
          throw new Error("Failed to fetch");
        },
      });
      expect(await e.aviso.conferir()).toBe(false);
      expect(e.aviso.obter().versaoNova).toBeNull();
    });

    it("sem versão gravada no build (dev, teste) não confere nada", async () => {
      const buscar = vi.fn();
      const aviso = criarAvisoDeVersao({ versaoAtual: null, buscar });
      aviso.iniciar();
      await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS * 2);
      expect(await aviso.conferir()).toBe(false);
      expect(buscar).not.toHaveBeenCalled();
    });
  });

  describe("cartão de versão nova", () => {
    let elemento: HTMLDivElement;
    let montado: ReturnType<typeof desenharNoTeste> | null = null;

    beforeEach(() => {
      elemento = document.createElement("div");
      document.body.append(elemento);
    });
    afterEach(() => {
      act(() => montado?.desmontar());
      montado = null;
      elemento.remove();
    });

    async function montar(aviso: ControleDoAviso) {
      await act(async () => {
        montado = desenharNoTeste(
          elemento,
          createElement(AvisoDeVersao, { aviso }),
        );
      });
    }
    const cartao = () => elemento.querySelector(".aviso-de-versao");
    const botao = (acao: string) =>
      elemento.querySelector<HTMLButtonElement>(`[data-acao="${acao}"]`);

    it("não aparece enquanto a versão aberta é a vigente", async () => {
      const c = montarCenario({ publicada: { versao: "v1" } });
      await montar(c.aviso);
      await act(() => c.aviso.conferir());
      expect(cartao()).toBeNull();
    });

    it("aparece discreto, com título, Agora não e Atualizar", async () => {
      const c = montarCenario();
      await montar(c.aviso);
      await act(() => c.aviso.conferir());

      expect(cartao()?.getAttribute("role")).toBe("status");
      expect(cartao()?.getAttribute("data-tone")).toBe("info");
      const idDoTitulo = cartao()?.getAttribute("aria-labelledby") ?? "";
      expect(document.getElementById(idDoTitulo)?.textContent).toBe(
        "O Yeendé foi atualizado",
      );
      expect(cartao()?.textContent).not.toContain("Novo:");
      expect(botao("fechar-aviso-de-versao")?.textContent).toBe("Agora não");
      expect(botao("atualizar-versao")?.textContent).toBe("Atualizar");
      expect(botao("atualizar-versao")?.disabled).toBe(false);
    });

    it("Agora não fecha só para aquela versão", async () => {
      let publicada = { versao: "v2", novidades: [] };
      const c = montarCenario({ publicada: () => publicada });
      await montar(c.aviso);
      await act(() => c.aviso.conferir());

      await clicar(definido(botao("fechar-aviso-de-versao")));
      expect(cartao()).toBeNull();
      expect(c.armazenamento.getItem(CHAVE_DO_FECHAMENTO)).toBe("v2");
      expect(c.recarregar).not.toHaveBeenCalled();

      // Outra página (ou recarga) com a mesma v2: continua fechado.
      const outra = montarCenario({ armazenamento: c.armazenamento });
      await act(() => outra.aviso.conferir());
      expect(outra.aviso.obter().fechado).toBe(true);

      // Versão mais nova: volta.
      publicada = { versao: "v3", novidades: [] };
      await act(() => c.aviso.conferir());
      expect(cartao()?.textContent).toContain("O Yeendé foi atualizado");
    });

    it("mostra a novidade só quando marcada como visível", async () => {
      const c = montarCenario({
        publicada: { versao: "v2", novidades: [NOVIDADE] },
      });
      await montar(c.aviso);
      await act(() => c.aviso.conferir());
      expect(cartao()?.textContent).toContain(
        "Novo: motivo padronizado na reabertura",
      );

      const d = montarCenario({
        publicada: {
          versao: "v2",
          novidades: [{ ...NOVIDADE, visivel: false }],
        },
      });
      await act(() => d.aviso.conferir());
      expect(d.aviso.obter().novidade).toBeNull();
    });

    it("Atualizar sem pendência recarrega uma vez e fica Atualizando…, com o ícone girando", async () => {
      const c = montarCenario();
      await montar(c.aviso);
      await act(() => c.aviso.conferir());
      await clicar(definido(botao("atualizar-versao")));
      expect(c.recarregar).toHaveBeenCalledTimes(1);

      const atualizar = definido(botao("atualizar-versao"));
      expect(atualizar.textContent).toBe("Atualizando…");
      expect(atualizar.disabled).toBe(true);
      expect(atualizar.getAttribute("aria-busy")).toBe("true");
      expect(
        atualizar.querySelector(".aviso-de-versao-girando"),
      ).not.toBeNull();
      expect(botao("fechar-aviso-de-versao")?.disabled).toBe(true);

      // Um segundo pedido (duplo clique, atalho) não recarrega de novo.
      expect(c.aviso.atualizarAgora()).toBe(false);
      expect(c.recarregar).toHaveBeenCalledTimes(1);
    });

    it("Atualizar com alteração não salva pede para salvar e não recarrega", async () => {
      let pendente = true;
      const c = montarCenario({ temPendencia: () => pendente });
      await montar(c.aviso);
      await act(() => c.aviso.conferir());
      await clicar(definido(botao("atualizar-versao")));
      expect(c.recarregar).not.toHaveBeenCalled();
      expect(cartao()?.textContent).toContain(AVISO_DE_PENDENCIA);
      expect(
        elemento
          .querySelector(".aviso-de-versao-pendencia")
          ?.getAttribute("role"),
      ).toBe("alert");
      expect(botao("atualizar-versao")?.textContent).toBe("Atualizar");

      pendente = false;
      await clicar(definido(botao("atualizar-versao")));
      expect(c.recarregar).toHaveBeenCalledTimes(1);
      expect(cartao()?.textContent).not.toContain(AVISO_DE_PENDENCIA);
    });

    it("a guarda de saída com pergunta pode cancelar a recarga", () => {
      const recarregar = vi.fn();
      const aviso = criarAvisoDeVersao({
        versaoAtual: "v1",
        temPendencia: () => false,
        confirmarSaida: () => false,
        recarregar,
      });
      expect(aviso.atualizarAgora()).toBe(false);
      expect(recarregar).not.toHaveBeenCalled();
      expect(aviso.obter().atualizando).toBe(false);
    });
  });

  describe("aviso forte: a versão aberta quebrou", () => {
    let elemento: HTMLDivElement;
    let montado: ReturnType<typeof desenharNoTeste> | null = null;

    beforeEach(() => {
      elemento = document.createElement("div");
      document.body.append(elemento);
    });
    afterEach(() => {
      act(() => montado?.desmontar());
      elemento.remove();
    });

    it("PGRST202 com versão nova publicada vira 'Atualize para continuar', sem fechar", async () => {
      const c = montarCenario();
      await act(async () => {
        montado = desenharNoTeste(
          elemento,
          createElement(AvisoDeVersao, { aviso: c.aviso }),
        );
      });
      c.aviso.iniciar();
      await act(async () => {
        c.janela.dispatchEvent(
          new CustomEvent(EVENTO_TELA_ANTIGA, {
            detail: { rpc: "reabrir_analise", codigo: "PGRST202" },
          }),
        );
        await vi.waitFor(() => expect(c.aviso.obter().telaAntiga).toBe(true));
      });
      const cartao = elemento.querySelector(".aviso-de-versao");
      expect(cartao?.textContent).toContain("Atualize para continuar");
      expect(cartao?.textContent).toContain(
        "Esta tela é de uma versão anterior do Yeendé.",
      );
      expect(cartao?.getAttribute("data-tone")).toBe("warning");
      expect(cartao?.getAttribute("role")).toBe("alert");
      expect(
        elemento.querySelector('[data-acao="atualizar-versao"]')?.textContent,
      ).toBe("Atualizar");
      expect(
        elemento.querySelector('[data-acao="fechar-aviso-de-versao"]'),
      ).toBeNull();
      // Não recarrega sozinho.
      expect(c.recarregar).not.toHaveBeenCalled();
      c.aviso.parar();
    });

    it("pedaço sob demanda que não baixou (vite:preloadError) com versão nova vira 'Atualize para continuar'", async () => {
      const c = montarCenario();
      c.aviso.iniciar();
      await act(async () => {
        c.janela.dispatchEvent(new Event(EVENTO_PEDACO_QUE_SUMIU));
        await vi.waitFor(() => expect(c.aviso.obter().telaAntiga).toBe(true));
      });
      expect(c.recarregar).not.toHaveBeenCalled();
      c.aviso.parar();
    });

    it("aparece mesmo com o aviso fechado para aquela versão", async () => {
      const c = montarCenario();
      await c.aviso.conferir();
      c.aviso.fechar();
      expect(c.aviso.obter().fechado).toBe(true);
      await c.aviso.aoSinalDeTelaAntiga();
      await act(async () => {
        montado = desenharNoTeste(
          elemento,
          createElement(AvisoDeVersao, { aviso: c.aviso }),
        );
      });
      expect(elemento.textContent).toContain("Atualize para continuar");
    });

    it("sem versão nova confirmada (front antes da migration), nada muda", async () => {
      const c = montarCenario({ publicada: { versao: "v1" } });
      await c.aviso.aoSinalDeTelaAntiga();
      expect(c.buscar).toHaveBeenCalledTimes(1);
      expect(c.aviso.obter().telaAntiga).toBe(false);
      expect(c.aviso.obter().versaoNova).toBeNull();
    });
  });
});

bloco("componentes/busca-global", async () => {
  /*
  Busca global (React): Ctrl+K abre só com usuário conectado, Esc e o fundo
  fecham, digitar filtra as linhas do monitoramento, setas + Enter e clique
  escolhem, e a escolha vai ao legado pelo evento com o id da linha.
*/

  const { BuscaGlobal, avisarEscolha } =
    await import("../src/componentes/busca-global/busca-global.tsx");
  const { desenharNoTeste } = await import("./montar-tela.ts");

  const LINHAS = [
    {
      id: 10,
      edital: "Edital 01/2026",
      unidade: "DSEI Xavante",
      etapa: "Inscrições",
      uf: "MT",
      risco: "Alto",
    },
    {
      id: 11,
      edital: "Edital 02/2026",
      unidade: "DSEI Yanomami",
      etapa: "Resultado",
      uf: "RR",
      risco: "Médio",
    },
    {
      id: 12,
      edital: "Edital 03/2026",
      unidade: "DSEI Xingu",
      etapa: "Homologação",
      uf: "MT",
      risco: "Baixo",
    },
  ];

  let raiz: HTMLDivElement | undefined;
  let controlador: ReturnType<typeof desenharNoTeste> | undefined;
  let conectado = false;
  let escolhidos: unknown[] = [];
  const aoEvento = (evento: Event) => {
    if (evento instanceof CustomEvent) escolhidos.push(evento.detail.id);
  };

  async function montar() {
    const lugar = document.createElement("div");
    raiz = lugar;
    document.body.append(lugar);
    await act(async () => {
      controlador = desenharNoTeste(
        lugar,
        createElement(BuscaGlobal, {
          estaConectado: () => conectado,
          aoEscolher: avisarEscolha,
        }),
      );
    });
  }

  const dialogo = () => document.querySelector('[role="dialog"].search-modal');
  const campo = () => dialogo()?.querySelector("input");
  const itens = () => [...document.querySelectorAll(".search-result-item")];
  const ativo = () => document.querySelector(".search-result-item.active");
  const ctrlK = (opcoes: KeyboardEventInit = { ctrlKey: true }) =>
    teclar(document, "k", opcoes);

  beforeEach(async () => {
    conectado = true;
    escolhidos = [];
    document.addEventListener(EVENTO_ESCOLHA_DA_BUSCA, aoEvento);
    publicarLinhasDoMonitoramento(LINHAS);
    await montar();
  });

  afterEach(async () => {
    document.removeEventListener(EVENTO_ESCOLHA_DA_BUSCA, aoEvento);
    await act(async () => controlador?.raiz?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    redefinirDadosDoMonitoramento();
  });

  describe("Busca global", () => {
    it("Ctrl+K abre com o campo vazio e em foco, trava a rolagem e não lista nada", async () => {
      expect(dialogo()).toBeNull();
      await ctrlK();
      expect(dialogo()).not.toBeNull();
      expect(dialogo()?.getAttribute("aria-label")).toBe("Busca global");
      expect(document.activeElement).toBe(campo());
      expect(campo()?.value).toBe("");
      expect(itens()).toHaveLength(0);
      expect(document.body.textContent).not.toContain("Nenhum resultado");
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("Cmd+K também abre, e o atalho com a busca aberta fecha", async () => {
      await ctrlK({ metaKey: true });
      expect(dialogo()).not.toBeNull();
      await ctrlK();
      expect(dialogo()).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("sem usuário conectado, o atalho não abre", async () => {
      conectado = false;
      await ctrlK();
      expect(dialogo()).toBeNull();
    });

    it("Esc e o botão Esc fecham; o clique no fundo não", async () => {
      await ctrlK();
      await teclar(definido(campo()), "Escape");
      expect(dialogo()).toBeNull();

      await ctrlK();
      await clicar(document.querySelector(".search-modal-fechar"));
      expect(dialogo()).toBeNull();

      await ctrlK();
      await clicar(dialogo());
      expect(dialogo()).not.toBeNull();
    });

    it("digitar filtra, mostra título, subtítulo e risco e realça o termo", async () => {
      await ctrlK();
      await digitar(campo(), "xavante");
      expect(itens()).toHaveLength(1);
      const item = itens()[0];
      expect(item?.querySelector(".search-result-title")?.textContent).toBe(
        "Edital 01/2026 — DSEI Xavante",
      );
      expect(item?.querySelector(".search-result-sub")?.textContent).toBe(
        "Inscrições · MT",
      );
      expect(item?.querySelector(".search-result-chip")?.textContent).toBe(
        "Alto",
      );
      expect(item?.querySelector(".search-result-chip")?.className).toContain(
        "risco-red",
      );
      expect(item?.querySelector("mark")?.textContent).toBe("Xavante");

      await digitar(campo(), "mt");
      expect(itens()).toHaveLength(2);
    });

    it("o resultado marcado ganha Abrir página do edital, na área dele", async () => {
      const navigate = vi.fn(() => true);
      vi.stubGlobal("navigate", navigate);
      await ctrlK();
      await digitar(campo(), "xingu");
      expect(document.querySelector(".search-modal-acoes")).toBeNull();
      await teclar(definido(campo()), "ArrowDown");
      const botao = document.querySelector(".search-modal-acoes button");
      expect(botao?.textContent).toContain("Abrir página do edital");
      await clicar(botao);
      expect(navigate).toHaveBeenCalledWith("edital", { edital: "3-2026" });
      expect(dialogo()).toBeNull();
      // Não é a escolha de antes (localizar na Visão geral).
      expect(escolhidos).toEqual([]);
      vi.unstubAllGlobals();
    });

    it("sem resultado, mensagem curta", async () => {
      await ctrlK();
      await digitar(campo(), "nada disso");
      expect(itens()).toHaveLength(0);
      expect(document.body.textContent).toContain(
        "Nenhum resultado encontrado",
      );
    });

    it("linhas ainda não carregadas: Carregando, não Nenhum resultado", async () => {
      redefinirDadosDoMonitoramento();
      await ctrlK();
      await digitar(campo(), "xavante");
      expect(document.body.textContent).toContain("Carregando…");
      expect(document.body.textContent).not.toContain("Nenhum resultado");
      await act(async () => publicarLinhasDoMonitoramento(LINHAS));
      expect(itens()).toHaveLength(1);
    });

    it("setas movem a escolha sem passar das pontas e Enter escolhe", async () => {
      await ctrlK();
      await digitar(campo(), "dsei");
      expect(ativo()).toBeNull();
      await teclar(definido(campo()), "Enter");
      expect(escolhidos).toEqual([]);
      expect(dialogo()).not.toBeNull();

      await teclar(definido(campo()), "ArrowDown");
      await teclar(definido(campo()), "ArrowDown");
      await teclar(definido(campo()), "ArrowDown");
      await teclar(definido(campo()), "ArrowDown");
      expect(ativo()).toBe(itens()[2]);
      expect(campo()?.getAttribute("aria-activedescendant")).toBe(
        itens()[2]?.id,
      );
      await teclar(definido(campo()), "ArrowUp");
      expect(ativo()).toBe(itens()[1]);
      expect(itens()[1]?.getAttribute("aria-selected")).toBe("true");

      await teclar(definido(campo()), "Enter");
      expect(dialogo()).toBeNull();
      expect(escolhidos).toEqual([11]);
    });

    it("digitar de novo desmarca a escolha", async () => {
      await ctrlK();
      await digitar(campo(), "dsei");
      await teclar(definido(campo()), "ArrowDown");
      expect(ativo()).not.toBeNull();
      await digitar(campo(), "dsei x");
      expect(ativo()).toBeNull();
    });

    it("passar o mouse marca e o clique escolhe", async () => {
      await ctrlK();
      await digitar(campo(), "edital");
      await act(async () => {
        definido(itens()[2]).dispatchEvent(
          new MouseEvent("mouseover", { bubbles: true }),
        );
      });
      expect(ativo()).toBe(itens()[2]);
      await clicar(itens()[0]);
      expect(dialogo()).toBeNull();
      expect(escolhidos).toEqual([10]);
    });

    it("reabrir começa do zero", async () => {
      await ctrlK();
      await digitar(campo(), "xingu");
      await teclar(definido(campo()), "Escape");
      await ctrlK();
      expect(campo()?.value).toBe("");
      expect(itens()).toHaveLength(0);
    });

    it("acompanha as linhas que o legado publica depois de aberta", async () => {
      await ctrlK();
      await digitar(campo(), "kayapó");
      expect(itens()).toHaveLength(0);
      await act(async () => {
        publicarLinhasDoMonitoramento([
          ...LINHAS,
          { id: 13, edital: "Edital 04", unidade: "DSEI Kayapó", risco: "" },
        ]);
      });
      expect(itens()).toHaveLength(1);
      expect(
        itens()[0]?.querySelector(".search-result-chip")?.textContent,
      ).toBe("Baixo");
    });
  });

  describe("o legado recebe a escolha", () => {
    const legado = readFileSync("src/app/sistema.ts", "utf8");

    it("escuta o evento e localiza a linha no painel", () => {
      expect(legado).toMatch(
        /addEventListener\(EVENTO_ESCOLHA_DA_BUSCA,[\s\S]{0,80}localizarLinhaDoMonitoramento\(\s*\(?evento( as [^)]*\))?\.detail\?\.id/,
      );
      const corpo = legado.slice(
        legado.indexOf("function localizarLinhaDoMonitoramento"),
      );
      expect(corpo).toMatch(/if \(!perfil\.pode\("ind"\)\)/);
      expect(corpo).toMatch(/irPara\("dashboard"\)/);
      // O recorte (unidade e edital da linha) e o destaque são da Visão geral.
      expect(corpo).toMatch(/estadoDaVisaoGeral\.localizar\(linha\)/);
    });

    it("a busca antiga saiu", () => {
      const html = readFileSync("index.html", "utf8");
      expect(html).not.toContain("searchModal");
      // A busca é filha da raiz do app (src/app/casca/pecas.tsx), sem ponto próprio no HTML.
      expect(html).not.toContain('id="buscaGlobalApp"');
      for (const nome of [
        "openSearchModal",
        "closeSearchModal",
        "runGlobalSearch",
        "searchModalKey",
        "selectSearchResult",
        "highlightSearchItems",
        "searchIdx",
      ])
        expect(legado).not.toContain(nome);
    });
  });
});

bloco("componentes/casos-dos-avisos-dos-modulos", async () => {
  /*
  Casos de um aviso da Lista de aprovados na gaveta (20261007240000): cada
  caso mostra a pessoa (nome, código, edital, vaga, situação) e as vagas dela;
  registro removido aparece como "Registro removido", nunca o UUID; clicar
  deixa o pedido para a Lista de aprovados nas vagas da pessoa.
*/

  const { SeloDeAvisos } =
    await import("../src/modulos/conferencias/avisos-de-conferencia.tsx");

  const APROVADO = "b44c58f2-41de-448e-b6c6-88932524fa19";
  const OUTRA_VAGA = "b44c58f2-41de-448e-b6c6-88932524fa20";

  const aviso = {
    id: "av1",
    conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
    escopo: "area:saude-indigena",
    gravidade: "CRITICA",
    modulo: "aprovados",
    area: "saude-indigena",
    quantidade: 2,
    exemplos: [APROVADO],
    resumo: "2 pessoas contratadas em mais de uma vaga.",
    situacao: "ABERTO",
    primeira_vez: "2026-10-05T09:00:00Z",
    pode_ignorar: false,
  };

  const casos = [
    {
      aviso_id: "av1",
      conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
      ordem: 1,
      tipo: "candidato_aprovado",
      resolucao: "ok",
      aprovado_id: APROVADO,
      codigo: "4512",
      nome: "Maria Fictícia",
      edital: "Edital 12/2025",
      codigo_vaga: "1777",
      nome_vaga: "Enfermeiro",
      status: "Contratado",
      data_contratacao: "2026-02-03T13:00:00+00:00",
      referencia: null,
      detalhe: { vagas: 2, vinculos: 2 },
      vinculos: [
        {
          id: APROVADO,
          edital: "Edital 12/2025",
          codigo_vaga: "1777",
          nome_vaga: "Enfermeiro",
          status: "Contratado",
          data_contratacao: "2026-02-03T13:00:00+00:00",
        },
        {
          id: OUTRA_VAGA,
          edital: "Edital 40/2026",
          codigo_vaga: "1900",
          nome_vaga: "Técnico de enfermagem",
          status: "Contratado",
          data_contratacao: "2026-05-20T13:00:00+00:00",
        },
      ],
    },
    {
      aviso_id: "av1",
      conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
      ordem: 2,
      tipo: "candidato_aprovado",
      resolucao: "removido",
      referencia: null,
      detalhe: {},
    },
  ];

  function supabaseFalso() {
    return {
      rpc: vi.fn(async (nome: string) => {
        if (nome === "listar_avisos_conferencia_se_mudou")
          return { data: { avisos: [aviso] }, error: null };
        if (nome === "listar_casos_aviso_conferencia")
          return { data: { total: casos.length, casos }, error: null };
        return { data: null, error: null };
      }),
    };
  }

  let raiz: HTMLDivElement | undefined;
  let montagem: Root | undefined;

  async function abrirCasos(
    props: Partial<Parameters<typeof SeloDeAvisos>[0]> = {},
  ) {
    const supabase = supabaseFalso();
    raiz = document.createElement("div");
    document.body.append(raiz);
    const nova = createRoot(raiz);
    montagem = nova;
    await act(async () =>
      nova.render(
        createElement(SeloDeAvisos, {
          modulo: "aprovados",
          supabase,
          ...props,
        }),
      ),
    );
    await esperar();
    await clicar(document.querySelector(".conf-selo-do-modulo"));
    const botao = [...document.querySelectorAll(".conf-aviso button")].find(
      (b) => b.textContent?.includes("2 casos"),
    );
    await clicar(botao);
    await esperar();
  }

  beforeEach(() => {
    definirAreasDoUsuario(["saude-indigena"]);
    definirAreaAtual("saude-indigena");
  });

  afterEach(async () => {
    await act(async () => montagem?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
    consumirPedidoDeFiltro("approved");
  });

  describe("casos do aviso Duas matrículas no mesmo edital", () => {
    it("mostra a pessoa, a situação e as vagas — nunca o UUID", async () => {
      await abrirCasos();
      const itens = document.querySelectorAll(".conf-caso");
      expect(itens).toHaveLength(2);
      const primeiro = itens[0]?.textContent;
      expect(primeiro).toContain("4512 · Maria Fictícia");
      expect(primeiro).toContain("2 matrículas no mesmo edital");
      expect(primeiro).toContain(
        "Edital 40/2026 · 1900 · Técnico de enfermagem · Contratado em 20/05/2026",
      );
      expect(itens[1]?.textContent).toContain("Registro removido");
      expect(document.querySelector(".conf-casos")?.textContent).not.toMatch(
        /b44c58f2|Referência/,
      );
      // Só o caso resolvido abre a lista.
      expect(document.querySelectorAll(".conf-caso--clicavel")).toHaveLength(1);
    });

    it("clicar deixa o pedido para a Lista de aprovados nas vagas da pessoa (sem navegar)", async () => {
      const aoAbrirCaso = vi.fn();
      await abrirCasos({ aoAbrirCaso });
      await clicar(document.querySelector(".conf-caso--clicavel"));
      expect(aoAbrirCaso).toHaveBeenCalledWith(
        expect.objectContaining({ aprovadoId: APROVADO }),
        { navegar: false },
      );
    });

    it("sem aoAbrirCaso, o pedido de filtro leva à aba Pendências da Lista de aprovados", async () => {
      await abrirCasos();
      await clicar(document.querySelector(".conf-caso--clicavel"));
      expect(consumirPedidoDeFiltro("approved")).toEqual({
        candidatos: [APROVADO, OUTRA_VAGA],
        nome: "Maria Fictícia",
        pendencias: true,
        edital: expect.any(String),
      });
    });
  });
});

bloco("componentes/confirmacao-de-saida", () => {
  /*
  O Sair confirmado e o seletor de tema do rodapé. Eram o legado
  `src/modules/nielsen-shell-ux.js` (diálogo por `insertAdjacentHTML`,
  ouvintes no documento); agora o diálogo é React, nos avisos da casca
  (`confirmacao-de-saida.tsx`), com o estado em `saida.ts`. Os ids, as
  classes e os `data-shell-logout-*` são os mesmos (CSS e e2e).
*/

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  let montagem: ReturnType<typeof desenharNoTeste> | null = null;
  const dialogo = () => document.getElementById("shellLogoutDialog");
  const saindo = () => document.getElementById("shellSignoutBusy");

  beforeEach(async () => {
    document.body.innerHTML =
      '<div id="avisosApp"></div><button id="quemAbriu" type="button">Sair</button><details id="topUserMenu" open></details>';
    await act(async () => {
      // Como a raiz do app (src/app/raiz.tsx): os avisos, na hora, em #avisosApp.
      montagem = desenharNoTeste(
        document.getElementById("avisosApp"),
        createElement(Avisos),
        { sincrono: true },
      );
    });
  });

  afterEach(async () => {
    await act(async () => montagem?.desmontar());
    montagem = null;
    await act(async () => redefinirSaida());
    delete window.monitoraToast;
    vi.restoreAllMocks();
  });

  /* Pede o Sair com o foco no botão que abriu, como o rodapé da barra faz. */
  async function pedirSaida(encerrar = vi.fn()) {
    definido(document.getElementById("quemAbriu")).focus();
    let resultado: Promise<boolean> | undefined;
    await act(async () => {
      resultado = sairDoSistema({ encerrar });
    });
    return { resultado, encerrar };
  }

  describe("o diálogo do Sair", () => {
    it("nasce fechado, com a marcação de sempre", () => {
      expect(dialogo()).not.toBeNull();
      expect(dialogo()?.hidden).toBe(true);
      expect(saindo()?.hidden).toBe(true);
      expect(
        dialogo()?.querySelector('[role="dialog"]')?.getAttribute("aria-modal"),
      ).toBe("true");
      expect(
        document.querySelector("[data-shell-logout-confirm]")?.textContent,
      ).toBe("Sair");
      expect(document.getElementById("shellLogoutTitle")?.textContent).toBe(
        "Deseja realmente sair?",
      );
    });

    it("abre com o foco em Continuar no sistema; cancelar não encerra e devolve o foco", async () => {
      const { resultado, encerrar } = await pedirSaida();
      expect(dialogo()?.hidden).toBe(false);
      expect(document.activeElement?.textContent).toBe("Continuar no sistema");

      await clicar(document.querySelector(".shell-confirm-cancel"));
      await expect(resultado).resolves.toBe(false);
      expect(encerrar).not.toHaveBeenCalled();
      expect(dialogo()?.hidden).toBe(true);
      expect(document.activeElement?.id).toBe("quemAbriu");
    });

    it("Esc cancela; clicar no fundo não fecha", async () => {
      const primeiro = await pedirSaida();
      await clicar(document.querySelector(".shell-confirm-backdrop"));
      expect(dialogo()?.hidden).toBe(false);
      expect(primeiro.encerrar).not.toHaveBeenCalled();

      await teclar(document, "Escape");
      await expect(primeiro.resultado).resolves.toBe(false);
      expect(dialogo()?.hidden).toBe(true);
    });

    it("confirmar fecha o menu do perfil, mostra 'Saindo do sistema…' e encerra a sessão", async () => {
      let terminar: (() => void) | undefined;
      const encerrar = vi.fn(
        () =>
          new Promise<void>((resolver) => {
            terminar = resolver;
          }),
      );
      const { resultado } = await pedirSaida(encerrar);
      await clicar(document.querySelector("[data-shell-logout-confirm]"));

      expect(encerrar).toHaveBeenCalledTimes(1);
      expect(dialogo()?.hidden).toBe(true);
      expect(saindo()?.hidden).toBe(false);
      expect(document.getElementById("topUserMenu")?.hasAttribute("open")).toBe(
        false,
      );

      // Um Sair por vez: outro pedido enquanto sai não abre o diálogo.
      await expect(sairDoSistema({ encerrar })).resolves.toBe(false);
      expect(dialogo()?.hidden).toBe(true);

      await act(async () => definido(terminar)());
      await expect(resultado).resolves.toBe(true);
      expect(saindo()?.hidden).toBe(true);
    });

    it("com o diálogo aberto, um segundo pedido não abre outro", async () => {
      const primeiro = await pedirSaida();
      await expect(sairDoSistema()).resolves.toBe(false);
      expect(document.querySelectorAll("#shellLogoutDialog")).toHaveLength(1);
      await clicar(document.querySelector(".shell-confirm-cancel"));
      await expect(primeiro.resultado).resolves.toBe(false);
    });

    it("falha ao encerrar avisa e some com o 'Saindo'", async () => {
      window.monitoraToast = vi.fn();
      vi.spyOn(console, "error").mockImplementation(() => {});
      const encerrar = vi.fn(() => Promise.reject(new Error("rede")));
      const { resultado } = await pedirSaida(encerrar);
      await clicar(document.querySelector("[data-shell-logout-confirm]"));
      await expect(resultado).resolves.toBe(false);
      expect(window.monitoraToast).toHaveBeenCalledWith(
        "Não foi possível encerrar esta sessão. Tente novamente.",
        "error",
      );
      expect(saindo()?.hidden).toBe(true);
      expect(obterSaida().saindo).toBe(false);
    });

    /*
    O aviso de "alterações não salvas" do Sair procurava um indicador que não
    existe mais (#configWorkspaceDirtyTop) e nunca aparecia. Agora pergunta ao
    estado das Configurações, o mesmo que o navigate consulta.
  */
    it("o aviso do Sair segue as alterações não salvas das Configurações", () => {
      const estado = criarEstadoDasConfiguracoes({ supabase: () => null });
      estado.definirValoresCarregados({ page_title: "Saúde Indígena" });
      expect(temConfiguracaoNaoSalva(estado)).toBe(false);
      estado.mudarCampo("page_title", "Outro título");
      expect(temConfiguracaoNaoSalva(estado)).toBe(true);
      estado.mudarCampo("page_title", "Saúde Indígena");
      expect(temConfiguracaoNaoSalva(estado)).toBe(false);
      expect(temConfiguracaoNaoSalva(null)).toBe(false);
    });

    it("sem rascunho em Configurações, o aviso fica escondido", async () => {
      await pedirSaida();
      expect(document.getElementById("shellLogoutUnsavedWarning")?.hidden).toBe(
        true,
      );
    });
  });

  describe("o seletor de tema do rodapé", () => {
    it("expõe o estado e a próxima ação do tema", () => {
      expect(estadoDoSeletorDeTema(false)).toMatchObject({
        tema: "claro",
        icone: "sun",
        rotulo: "Tema claro ativo. Alternar para tema escuro.",
      });
      expect(estadoDoSeletorDeTema(true)).toMatchObject({
        tema: "escuro",
        icone: "moon",
        rotulo: "Tema escuro ativo. Alternar para tema claro.",
      });
    });

    /*
    O seletor Claro/Escuro mora no rodapé da barra. `toggleDarkMode` inverte o
    tema, então clicar no segmento que já vale não pode chamá-lo.
  */
    it("o seletor de tema tem Claro e Escuro, e o segmento ativo não inverte", () => {
      expect(OPCOES_DE_TEMA.map((opcao) => opcao.rotulo)).toEqual([
        "Claro",
        "Escuro",
      ]);
      expect(deveAlternarTema("escuro", false)).toBe(true);
      expect(deveAlternarTema("claro", true)).toBe(true);
      expect(deveAlternarTema("claro", false)).toBe(false);
      expect(deveAlternarTema("escuro", true)).toBe(false);
    });
  });
});

bloco("componentes/dados-do-monitoramento", () => {
  afterEach(() => {
    redefinirDadosDoMonitoramento();
    sessionStorage.clear();
  });

  describe("fronteira dos dados compartilhados", () => {
    it("valida linhas externas e preserva colunas extras sem interpretar seu conteúdo", () => {
      publicarLinhasDoMonitoramento([
        null,
        [],
        "linha",
        { id: {} },
        { id: NaN },
        { id: " " },
        { id: 1, unidade: {} },
        { id: 0, unidade: "DSEI Xingu", etapa: null, vagas: 10 },
        {
          id: "uuid",
          CO_AREA: "sede",
          observacoes: null,
          extra: { campo: true },
        },
      ]);
      const snapshot = obterDadosDoMonitoramento();
      expect(snapshot.carregado).toBe(true);
      expect(snapshot.linhas.map((linha) => linha.id)).toEqual([0, "uuid"]);
      expect(snapshot.linhas[0]).toMatchObject({
        unidade: "DSEI Xingu",
        vagas: 10,
      });
      expect(definido(snapshot.linhas[0]).etapa).toBeUndefined();
      expect(snapshot.linhas[1]).toMatchObject({ extra: { campo: true } });
      expect(definido(snapshot.linhas[1]).observacoes).toBeUndefined();
      publicarLinhasDoMonitoramento({ linhas: [] });
      expect(obterDadosDoMonitoramento()).toMatchObject({
        linhas: [],
        carregado: true,
      });
    });

    it("normaliza o catálogo sem assumir o formato das colunas extras", () => {
      publicarUnidadesDoCatalogo([
        null,
        [],
        2,
        { unidade: "Xingu", codigo: 1 },
      ]);
      expect(obterDadosDoMonitoramento().unidades).toEqual([
        { unidade: "Xingu", codigo: 1 },
      ]);
      publicarUnidadesDoCatalogo(null);
      expect(obterDadosDoMonitoramento().unidades).toEqual([]);
    });

    it("mantém o snapshot entre leituras e encerra a assinatura", () => {
      const ouvinte = vi.fn();
      const cancelar = assinarDadosDoMonitoramento(ouvinte);
      const anterior = obterDadosDoMonitoramento();
      expect(obterDadosDoMonitoramento()).toBe(anterior);
      publicarLinhasDoMonitoramento([]);
      expect(ouvinte).toHaveBeenCalledTimes(1);
      expect(obterDadosDoMonitoramento()).not.toBe(anterior);
      cancelar();
      publicarLinhasDoMonitoramento([]);
      expect(ouvinte).toHaveBeenCalledTimes(1);
    });

    it("sair limpa as linhas e a carga, mantendo a área da aba", () => {
      definirAreasDoUsuario(["sede", "projetos"]);
      definirAreaAtual("projetos");
      publicarLinhasDoMonitoramento([{ id: "uuid", CO_AREA: "projetos" }]);
      esquecerLinhasDoMonitoramento();
      expect(obterDadosDoMonitoramento()).toMatchObject({
        linhas: [],
        carregado: false,
        areaAtual: "projetos",
      });
    });

    it("descarta áreas que não são texto e corrige a área fora do perfil", () => {
      definirAreaAtual("projetos");
      definirAreasDoUsuario([null, {}, 1, " sede "]);
      expect(obterDadosDoMonitoramento()).toMatchObject({
        areas: ["sede"],
        areaAtual: "sede",
      });
    });

    it("ids ausentes e inválidos não ligam registros de outro edital", () => {
      const ids = idsDasLinhas([
        { id: 0 },
        { id: "uuid" },
        {},
        // @ts-expect-error -- id nulo vindo do banco, de propósito.
        { id: null },
        // @ts-expect-error -- id que não é texto nem número, de propósito.
        { id: {} },
      ]);
      expect([...ids]).toEqual(["0", "uuid"]);
      expect(
        soDosEditais(
          [{ edital_id: 0 }, { edital_id: "uuid" }, {}, { edital_id: {} }],
          ids,
        ),
      ).toEqual([{ edital_id: 0 }, { edital_id: "uuid" }]);
      expect(
        soDosEditais(
          [{}, { edital_id: {} }],
          new Set(["undefined", "[object Object]"]),
        ),
      ).toEqual([]);
    });
  });
});

bloco("componentes/esc-no-menu-dentro-do-modal", () => {
  /*
  Esc com o menu de escolha múltipla aberto dentro de um modal (ex.: "Áreas
  que a pessoa vê" em "Adicionar pessoa"): fechava o modal inteiro e perdia o
  que já estava digitado. Deve fechar só o menu; o próximo Esc fecha o modal.
*/
  let raiz: Root | null = null;

  function Tela({ aoFechar }: { aoFechar: () => void }) {
    const [selecionados, setSelecionados] = useState<string[]>([]);
    return createElement(
      Modal,
      { rotulo: "Adicionar pessoa", aoFechar },
      createElement(MultiSelectBusca, {
        id: "areas",
        opcoes: ["Sede", "Projetos"],
        selecionados,
        aoMudar: setSelecionados,
      }),
    );
  }

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  describe("Esc no menu dentro do modal", () => {
    it("fecha só o menu; o Esc seguinte fecha o modal", async () => {
      document.body.innerHTML = `<div id="raiz"></div>`;
      const aoFechar = vi.fn();
      await act(async () => {
        raiz = createRoot(definido(document.getElementById("raiz")));
        raiz.render(createElement(Tela, { aoFechar }));
      });
      const gatilho = document.querySelector(".multi-select-trigger");
      const menu = document.querySelector<HTMLElement>(".multi-select-menu");

      await clicar(gatilho);
      expect(menu?.hidden).toBe(false);

      await teclar(definido(document.activeElement), "Escape");
      expect(menu?.hidden).toBe(true);
      expect(aoFechar).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(gatilho);

      await teclar(definido(document.activeElement), "Escape");
      expect(aoFechar).toHaveBeenCalledTimes(1);
    });
  });
});

bloco("ui/modal-padrao", () => {
  /*
    Todo modal do sistema (src/ui/modal.tsx): clicar no fundo não fecha; Esc
    e os botões de fechar fecham. Com `alterado`, fechar pergunta "Descartar
    as alterações?": "Continuar editando" mantém, "Descartar alterações" fecha.
  */
  let raiz: Root | null = null;

  function Formulario({
    aoFechar,
    aoDescartar,
    gaveta = false,
  }: {
    aoFechar: () => void;
    aoDescartar?: () => void;
    gaveta?: boolean;
  }) {
    const [nome, setNome] = useState("");
    const conteudo = [
      h("input", {
        key: "nome",
        id: "nome",
        value: nome,
        onChange: (evento: ChangeEvent<HTMLInputElement>) =>
          setNome(evento.target.value),
      }),
      h(FecharModal, { key: "cancelar", className: "btn" }, "Cancelar"),
    ];
    return gaveta
      ? h(
          Gaveta,
          {
            id: "janela",
            titulo: "Detalhe",
            aoFechar,
            aoDescartar,
            alterado: nome !== "",
          },
          conteudo,
        )
      : h(
          Modal,
          {
            id: "janela",
            rotulo: "Formulário",
            aoFechar,
            aoDescartar,
            alterado: nome !== "",
          },
          conteudo,
        );
  }

  async function desenhar(elemento: ReactElement) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      raiz = createRoot(definido(document.getElementById("raiz")));
      raiz.render(elemento);
    });
  }
  const janela = () => document.getElementById("janela");
  const pergunta = () => document.querySelector(".ui-modal-descarte");
  const botao = (texto: string) =>
    [...document.querySelectorAll<HTMLElement>("#janela button")].find(
      (b) => b.textContent?.trim() === texto,
    ) ?? null;

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  describe("fechar o modal", () => {
    it("clicar no fundo escuro não fecha, nem com o modal intocado", async () => {
      const aoFechar = vi.fn();
      await desenhar(h(Formulario, { aoFechar }));
      await clicar(janela());
      expect(aoFechar).not.toHaveBeenCalled();
      expect(pergunta()).toBeNull();
    });

    it("sem alteração, Esc e Cancelar fecham direto", async () => {
      const aoFechar = vi.fn();
      await desenhar(h(Formulario, { aoFechar }));
      await teclar(document, "Escape");
      expect(aoFechar).toHaveBeenCalledTimes(1);
      await clicar(botao("Cancelar"));
      expect(aoFechar).toHaveBeenCalledTimes(2);
      expect(pergunta()).toBeNull();
    });

    it("com alteração, Esc pergunta; Continuar editando mantém o que foi digitado", async () => {
      const aoFechar = vi.fn();
      await desenhar(h(Formulario, { aoFechar }));
      await digitar(document.getElementById("nome"), "Maria");
      await teclar(document, "Escape");
      expect(aoFechar).not.toHaveBeenCalled();
      const faixa = definido(pergunta());
      expect(faixa.getAttribute("role")).toBe("alertdialog");
      expect(faixa.textContent).toContain("Descartar as alterações?");
      expect(document.activeElement).toBe(botao("Continuar editando"));

      await clicar(botao("Continuar editando"));
      expect(pergunta()).toBeNull();
      expect(aoFechar).not.toHaveBeenCalled();
      expect((document.getElementById("nome") as HTMLInputElement).value).toBe(
        "Maria",
      );

      // Esc com a pergunta na tela também volta à edição.
      await clicar(botao("Cancelar"));
      expect(pergunta()).not.toBeNull();
      await teclar(document, "Escape");
      expect(pergunta()).toBeNull();
      expect(aoFechar).not.toHaveBeenCalled();
    });

    it("com alteração, Descartar alterações fecha (por aoDescartar, se houver)", async () => {
      const aoFechar = vi.fn();
      const aoDescartar = vi.fn();
      await desenhar(h(Formulario, { aoFechar, aoDescartar }));
      await digitar(document.getElementById("nome"), "Maria");
      await clicar(botao("Cancelar"));
      await clicar(botao("Descartar alterações"));
      expect(aoDescartar).toHaveBeenCalledTimes(1);
      expect(aoFechar).not.toHaveBeenCalled();
    });

    it("um filho com formulário próprio avisa com usarAlteradoNoModal", async () => {
      function Anotacao() {
        const [texto, setTexto] = useState("");
        usarAlteradoNoModal(texto !== "");
        return h("textarea", {
          id: "anotacao",
          value: texto,
          onChange: (evento: ChangeEvent<HTMLTextAreaElement>) =>
            setTexto(evento.target.value),
        });
      }
      const aoFechar = vi.fn();
      await desenhar(
        h(Modal, { id: "janela", rotulo: "Detalhe", aoFechar }, h(Anotacao)),
      );
      await digitar(document.getElementById("anotacao"), "nota");
      await teclar(document, "Escape");
      expect(aoFechar).not.toHaveBeenCalled();
      expect(pergunta()).not.toBeNull();

      // Apagar o que digitou desfaz o aviso: fecha direto.
      await clicar(botao("Continuar editando"));
      await digitar(document.getElementById("anotacao"), "");
      await teclar(document, "Escape");
      expect(aoFechar).toHaveBeenCalledTimes(1);
    });

    it("na gaveta, o ✕ do topo passa pela mesma pergunta", async () => {
      const aoFechar = vi.fn();
      await desenhar(h(Formulario, { aoFechar, gaveta: true }));
      await clicar(janela());
      expect(aoFechar).not.toHaveBeenCalled();
      await digitar(document.getElementById("nome"), "Maria");
      await clicar(document.querySelector<HTMLElement>(".ui-gaveta-fechar"));
      expect(pergunta()).not.toBeNull();
      await clicar(botao("Descartar alterações"));
      expect(aoFechar).toHaveBeenCalledTimes(1);
    });
  });
});

bloco("ui/navegacao-da-ficha", () => {
  /*
    Anterior e Próximo na ficha aberta de uma lista (src/ui/navegacao-da-ficha.tsx):
    segue a lista como está na tela (filtro e ordem), para nas pontas, ← →
    fora de campos e, com alteração não salva, trocar pergunta antes.
  */
  interface Pessoa {
    id: string;
    nome: string;
  }
  const TODAS: readonly Pessoa[] = [
    { id: "p1", nome: "Ana" },
    { id: "p2", nome: "Bruno" },
    { id: "p3", nome: "Carla" },
    { id: "p4", nome: "Davi" },
  ];
  let raiz: Root | null = null;
  let mostrar: (itens: readonly Pessoa[]) => void = () => undefined;

  function Anotacao() {
    const [texto, setTexto] = useState("");
    usarAlteradoNoModal(texto !== "");
    return h("textarea", {
      id: "anotacao",
      value: texto,
      onChange: (evento: ChangeEvent<HTMLTextAreaElement>) =>
        setTexto(evento.target.value),
    });
  }

  function Tela({
    inicial,
    abertoInicial,
  }: {
    inicial: readonly Pessoa[];
    abertoInicial: string;
  }) {
    const [itens, setItens] = useState(inicial);
    const [aberto, setAberto] = useState<string | null>(abertoInicial);
    mostrar = setItens;
    const navegacao = usarNavegacaoDaLista(
      itens,
      aberto,
      (pessoa) => pessoa.id,
      (pessoa) => setAberto(pessoa.id),
    );
    const pessoa = TODAS.find((p) => p.id === aberto);
    if (!pessoa) return null;
    return h(
      Gaveta,
      {
        id: "ficha",
        titulo: pessoa.nome,
        aoFechar: () => setAberto(null),
        navegacao,
      },
      // Sem `key` aqui: a gaveta recomeça o corpo a cada item.
      h(Anotacao, { key: "anotacao" }),
      h("div", { key: "abas", role: "tablist", id: "abas", tabIndex: 0 }),
    );
  }

  async function desenhar(inicial: readonly Pessoa[], abertoInicial: string) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      raiz = createRoot(definido(document.getElementById("raiz")));
      raiz.render(h(Tela, { inicial, abertoInicial }));
    });
  }
  const titulo = () => document.querySelector("#ficha h2")?.textContent ?? "";
  const posicao = () =>
    document.querySelector(".ui-navegacao-da-ficha-posicao")?.textContent ?? "";
  const anterior = () =>
    definido(
      document.querySelector<HTMLElement>('[data-acao="ficha-anterior"]'),
    );
  const proximo = () =>
    definido(
      document.querySelector<HTMLElement>('[data-acao="ficha-proximo"]'),
    );
  const pergunta = () => document.querySelector(".ui-modal-descarte");
  const botao = (texto: string) =>
    [...document.querySelectorAll<HTMLElement>("#ficha button")].find(
      (b) => b.textContent?.trim() === texto,
    ) ?? null;

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  it("Próximo e Anterior trocam o item, com a posição, sem fechar a ficha", async () => {
    await desenhar(TODAS, "p2");
    expect(titulo()).toBe("Bruno");
    expect(posicao()).toBe("2 de 4");
    expect(proximo().getAttribute("aria-label")).toBe("Próximo");

    await clicar(proximo());
    expect(titulo()).toBe("Carla");
    expect(posicao()).toBe("3 de 4");
    expect(document.querySelectorAll("#ficha").length).toBe(1);

    await clicar(anterior());
    await clicar(anterior());
    expect(titulo()).toBe("Ana");
    expect(posicao()).toBe("1 de 4");
  });

  it("segue o filtro da lista e para nas pontas", async () => {
    const filtradas = [TODAS[3]!, TODAS[1]!]; // Davi, Bruno: filtro e ordem da tela
    await desenhar(filtradas, "p4");
    expect(posicao()).toBe("1 de 2");
    expect(anterior().getAttribute("aria-disabled")).toBe("true");
    await clicar(anterior());
    expect(titulo()).toBe("Davi");

    await clicar(proximo());
    expect(titulo()).toBe("Bruno");
    expect(posicao()).toBe("2 de 2");
    expect(proximo().getAttribute("aria-disabled")).toBe("true");
    await clicar(proximo());
    await teclar(document.body, "ArrowRight");
    expect(titulo()).toBe("Bruno");
  });

  it("o item que sai da lista (decidido no filtro de pendentes) leva ao seguinte", async () => {
    await desenhar(TODAS, "p2");
    await act(async () => mostrar([TODAS[0]!, TODAS[2]!, TODAS[3]!]));
    expect(titulo()).toBe("Bruno");
    expect(posicao()).toBe("3 na lista");
    await clicar(proximo());
    expect(titulo()).toBe("Carla");
    expect(posicao()).toBe("2 de 3");
  });

  it("ao abrir, o foco vai ao fechar, não à navegação", async () => {
    await desenhar(TODAS, "p2");
    expect(document.activeElement).toBe(
      document.querySelector(".ui-gaveta-fechar:not([data-acao])"),
    );
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Fechar");
  });

  it("lista de um item só não mostra a navegação", async () => {
    await desenhar([TODAS[0]!], "p1");
    expect(document.querySelector(".ui-navegacao-da-ficha")).toBeNull();
  });

  it("← e → navegam, mas não dentro de campo de texto nem de abas", async () => {
    await desenhar(TODAS, "p2");
    await teclar(document.body, "ArrowRight");
    expect(titulo()).toBe("Carla");
    await teclar(document.body, "ArrowLeft");
    expect(titulo()).toBe("Bruno");

    await teclar(definido(document.getElementById("anotacao")), "ArrowRight");
    expect(titulo()).toBe("Bruno");
    await teclar(definido(document.getElementById("abas")), "ArrowRight");
    expect(titulo()).toBe("Bruno");
    await teclar(document.body, "ArrowRight", { altKey: true });
    expect(titulo()).toBe("Bruno");
  });

  it("com alteração, trocar pergunta; Continuar editando fica, Descartar troca", async () => {
    await desenhar(TODAS, "p2");
    await digitar(document.getElementById("anotacao"), "nota");
    await clicar(proximo());
    expect(titulo()).toBe("Bruno");
    expect(definido(pergunta()).textContent).toContain(
      "Descartar as alterações?",
    );
    // Com a pergunta na tela, as setas não trocam.
    await teclar(document.body, "ArrowRight");
    expect(titulo()).toBe("Bruno");

    await clicar(botao("Continuar editando"));
    expect(pergunta()).toBeNull();
    expect(
      (document.getElementById("anotacao") as HTMLTextAreaElement).value,
    ).toBe("nota");

    await teclar(document.body, "ArrowRight");
    expect(pergunta()).not.toBeNull();
    await clicar(botao("Descartar alterações"));
    expect(titulo()).toBe("Carla");
    expect(pergunta()).toBeNull();
    expect(
      (document.getElementById("anotacao") as HTMLTextAreaElement).value,
    ).toBe("");
    // O formulário voltou limpo: a próxima troca não pergunta.
    await clicar(proximo());
    expect(titulo()).toBe("Davi");
  });
});

bloco("componentes/fluxo-das-etapas", async () => {
  /*
    A faixa das etapas (src/componentes/fluxo-das-etapas.tsx): "Documental do
    93/2026" e os atalhos às outras etapas do mesmo edital, com o edital e a
    vaga seguindo junto (o destino da aba "Candidatos" da página do edital).
  */
  const { FluxoDasEtapas } =
    await import("../src/componentes/fluxo-das-etapas.tsx");
  const { desenharNoTeste } = await import("./montar-tela.ts");
  const { MarcaDaBuscaNaPagina, textoDaBuscaNaPagina } =
    await import("../src/ui/linha-do-recorte.tsx");

  const ID = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
  let desenho: { desmontar: () => void } | undefined;
  let navigate = vi.fn((_view: string, _extras?: unknown) => true);

  async function montar(
    props: Parameters<typeof FluxoDasEtapas>[0],
  ): Promise<HTMLElement> {
    desenho?.desmontar();
    const lugar = document.createElement("div");
    document.body.append(lugar);
    await act(async () => {
      desenho = desenharNoTeste(lugar, createElement(FluxoDasEtapas, props));
    });
    return lugar;
  }
  const etapas = (lugar: HTMLElement) =>
    [...lugar.querySelectorAll("[data-etapa]")].map((el) =>
      el.getAttribute("data-etapa"),
    );

  beforeEach(() => {
    navigate = vi.fn((_view: string, _extras?: unknown) => true);
    vi.stubGlobal("navigate", navigate);
    vi.stubGlobal("getMonitoraProfile", () => ({
      id: "a",
      ativo: true,
      perfil: "admin",
      permissoes: {
        avaliacao_documental: "editor",
        recursos: "editor",
        entrevistas: "editor",
        classificacao: "editor",
        aprovados: "editor",
      },
    }));
  });
  afterEach(() => {
    desenho?.desmontar();
    desenho = undefined;
    for (const view of ["classificacao", "analisar-recursos", "approved"])
      consumirPedidoDeFiltro(view);
    redefinirDadosDoMonitoramento();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("mostra a etapa e o edital, a atual marcada, e leva o edital e a vaga à Classificação", async () => {
    const lugar = await montar({
      view: "avaliacao-documental",
      edital: { id: ID, numero: "93/2026" },
      vaga: "179698",
    });
    expect(lugar.querySelector(".fluxo-das-etapas-titulo")?.textContent).toBe(
      "Documental do 93/2026vaga 179698",
    );
    expect(etapas(lugar)).toEqual([
      "pre-classificacao",
      "avaliacao-documental",
      "analisar-recursos",
      "conduzir-entrevistas",
      "classificacao",
      "approved",
    ]);
    const atual = lugar.querySelector('[aria-current="step"]');
    expect(atual?.getAttribute("data-etapa")).toBe("avaliacao-documental");
    expect(atual?.tagName).toBe("SPAN");

    await clicar(lugar.querySelector('[data-etapa="classificacao"]'));
    expect(navigate).toHaveBeenLastCalledWith("classificacao", { edital: ID });
    expect(consumirPedidoDeFiltro("classificacao")).toEqual({
      editalId: ID,
      vaga: "179698",
    });
  });

  it("Recursos e Aprovados recebem o número e o id num pedido; a vaga não vai", async () => {
    const lugar = await montar({
      view: "classificacao",
      edital: { id: ID, numero: "93/2026" },
      vaga: "179698",
    });
    await clicar(lugar.querySelector('[data-etapa="analisar-recursos"]'));
    expect(navigate).toHaveBeenLastCalledWith("analisar-recursos");
    expect(consumirPedidoDeFiltro("analisar-recursos")).toEqual({
      edital: "93/2026",
      editalId: ID,
    });
    await clicar(lugar.querySelector('[data-etapa="approved"]'));
    expect(navigate).toHaveBeenLastCalledWith("approved");
    expect(consumirPedidoDeFiltro("approved")).toEqual({
      edital: "93/2026",
      editalId: ID,
    });
  });

  it("ida e volta: da Triagem à Documental e de volta, sempre no mesmo edital e na mesma vaga", async () => {
    let lugar = await montar({
      view: "pre-classificacao",
      edital: { id: ID, numero: "93/2026" },
      vaga: "179698",
    });
    await clicar(lugar.querySelector('[data-etapa="avaliacao-documental"]'));
    expect(navigate).toHaveBeenLastCalledWith("avaliacao-documental", {
      edital: ID,
    });
    expect(consumirPedidoDeFiltro("avaliacao-documental")).toEqual({
      editalId: ID,
      vaga: "179698",
    });
    // A Documental, aberta no edital e na vaga, desenha a faixa dela.
    lugar = await montar({
      view: "avaliacao-documental",
      edital: { id: ID, numero: "93/2026" },
      vaga: "179698",
    });
    await clicar(lugar.querySelector('[data-etapa="pre-classificacao"]'));
    expect(navigate).toHaveBeenLastCalledWith("pre-classificacao", {
      edital: ID,
    });
    expect(consumirPedidoDeFiltro("pre-classificacao")).toEqual({
      editalId: ID,
      vaga: "179698",
    });
  });

  it("só com o id (Recursos, Aprovados), o número sai das linhas do monitoramento", async () => {
    definirAreaAtual("saude-indigena");
    publicarLinhasDoMonitoramento([
      { id: ID, edital: "Edital 93/2026", CO_AREA: "saude-indigena" },
    ]);
    const lugar = await montar({ view: "approved", edital: { id: ID } });
    expect(lugar.querySelector(".fluxo-das-etapas-titulo")?.textContent).toBe(
      "Aprovados do 93/2026",
    );
  });

  it("só as etapas que o perfil abre (e a atual)", async () => {
    vi.stubGlobal("getMonitoraProfile", () => ({
      id: "c",
      ativo: true,
      permissoes: { classificacao: "leitor" },
    }));
    const lugar = await montar({
      view: "avaliacao-documental",
      edital: { id: ID, numero: "93/2026" },
    });
    expect(etapas(lugar)).toEqual(["avaliacao-documental", "classificacao"]);
  });

  it("o título mostra o número como o edital o escreve (03/2025, não 3/2025)", async () => {
    definirAreaAtual("saude-indigena");
    publicarLinhasDoMonitoramento([
      { id: ID, edital: "03/2025", CO_AREA: "saude-indigena" },
    ]);
    const lugar = await montar({ view: "classificacao", edital: { id: ID } });
    expect(lugar.querySelector(".fluxo-das-etapas-titulo")?.textContent).toBe(
      "Classificação do 03/2025",
    );
    // A navegação continua com o número normalizado (o que as telas comparam).
    await clicar(lugar.querySelector('[data-etapa="approved"]'));
    expect(consumirPedidoDeFiltro("approved")).toEqual({
      edital: "3/2025",
      editalId: ID,
    });
  });

  it("a etapa desligada pela coordenação na área não aparece (sem atalho para Página desativada)", async () => {
    definirAreaAtual("saude-indigena");
    const triagem = ABAS_DO_MENU.find((aba) =>
      aba.areas.some((item) => (item.view || aba.view) === "pre-classificacao"),
    );
    expect(triagem).toBeDefined();
    await carregarCatalogoDeAbas({
      consulta: Promise.resolve({
        data: ABAS_DO_MENU.map((aba) => ({
          co_aba: aba.id,
          no_aba: aba.rotulo,
          ds_icone: aba.icone,
          nu_ordem: aba.ordem,
          co_view: aba.view,
          co_recurso: aba.recurso,
          tp_aba: aba.tipo,
          areas: aba.areas
            .filter(
              ({ area }) =>
                !(aba.id === triagem?.id && area === "saude-indigena"),
            )
            .map(({ area }) => ({ co_area: area, nu_ordem: aba.ordem })),
        })),
        error: null,
      }),
    });
    try {
      const lugar = await montar({
        view: "classificacao",
        edital: { id: ID, numero: "03/2025" },
      });
      expect(etapas(lugar)).not.toContain("pre-classificacao");
      expect(etapas(lugar)).toContain("avaliacao-documental");
      // Em outra área, onde a Triagem está ligada, ela volta.
      definirAreaAtual("projetos");
      const outra = await montar({
        view: "classificacao",
        edital: { id: ID, numero: "03/2025" },
      });
      expect(etapas(outra)).toContain("pre-classificacao");
    } finally {
      await carregarCatalogoDeAbas({ consulta: null });
    }
  });

  it("sem edital, não há faixa", async () => {
    const lugar = await montar({ view: "classificacao", edital: {} });
    expect(lugar.querySelector(".fluxo-das-etapas")).toBeNull();
  });

  it("a busca que recorta a página toda ganha a marca no recorte", async () => {
    expect(textoDaBuscaNaPagina("  Maria ")).toBe(
      "Busca “Maria” filtrando a página toda",
    );
    expect(textoDaBuscaNaPagina("")).toBe("");
    desenho?.desmontar();
    const lugar = document.createElement("div");
    document.body.append(lugar);
    await act(async () => {
      desenho = desenharNoTeste(
        lugar,
        createElement(MarcaDaBuscaNaPagina, { busca: "Maria" }),
      );
    });
    expect(
      lugar.querySelector('[data-marca="busca-na-pagina"]')?.textContent,
    ).toContain("Busca “Maria” filtrando a página toda");
  });
});

bloco("componentes/multi-select-busca", () => {
  /*
  O select com busca e escolha múltipla, em React. Controlado: o teste faz de
  tela, guardando a seleção e passando-a de volta, como fazem as abas da Lista
  de Aprovados.
*/

  let raiz: Root | null = null;

  interface PropriedadesDaTela {
    opcoes: PropriedadesDoMultiSelectBusca["opcoes"];
    inicial?: string[];
    aoMudar?: (valores: string[]) => void;
    id?: string;
  }

  function Tela({
    opcoes,
    inicial = [],
    aoMudar = () => {},
    id = "f",
  }: PropriedadesDaTela) {
    const [selecionados, setSelecionados] = useState(inicial);
    return createElement(MultiSelectBusca, {
      id,
      opcoes,
      selecionados,
      placeholder: "Todos os editais",
      aoMudar: (valores: string[]) => {
        setSelecionados(valores);
        aoMudar(valores);
      },
    });
  }

  async function montar(elemento: ReactElement) {
    document.body.innerHTML = `<div class="form-row"><label for="f">Edital</label><div id="raiz"></div></div>`;
    await act(async () => {
      const novaRaiz = createRoot(definido(document.getElementById("raiz")));
      raiz = novaRaiz;
      novaRaiz.render(elemento);
    });
  }

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  const rotulo = () =>
    document.querySelector(".multi-select-label")?.textContent;
  const opcoesVisiveis = () =>
    [...document.querySelectorAll(".multi-select-option span")].map(
      (item) => item.textContent,
    );
  const caixaDe = (texto: string) =>
    definido(
      [...document.querySelectorAll(".multi-select-option")].find(
        (item) => definido(item.querySelector("span")).textContent === texto,
      ),
    ).querySelector("input");
  const marcar = (texto: string) => clicar(caixaDe(texto));
  const menu = () =>
    definido(document.querySelector<HTMLElement>(".multi-select-menu"));
  const gatilho = () =>
    definido(document.querySelector<HTMLElement>(".multi-select-trigger"));

  describe("MultiSelectBusca", () => {
    it("mostra o placeholder quando não há escolha, e lista as opções", async () => {
      await montar(
        createElement(Tela, { opcoes: [{ value: "10", label: "03/2025" }] }),
      );
      expect(rotulo()).toBe("Todos os editais");
      expect(opcoesVisiveis()).toEqual(["03/2025"]);
    });

    it("devolve os valores marcados, em ordem de rótulo", async () => {
      const aoMudar = vi.fn();
      await montar(
        createElement(Tela, {
          opcoes: [
            { value: "20", label: "04/2025" },
            { value: "10", label: "03/2025" },
          ],
          aoMudar,
        }),
      );
      await marcar("04/2025");
      await marcar("03/2025");
      expect(aoMudar).toHaveBeenLastCalledWith(["10", "20"]);
      expect(caixaDe("03/2025")?.checked).toBe(true);
    });

    it("busca ignorando acento e caixa", async () => {
      await montar(createElement(Tela, { opcoes: ["Migração", "Contratado"] }));
      await digitar(document.querySelector(".multi-select-search"), "MIGRACAO");
      expect(opcoesVisiveis()).toEqual(["Migração"]);
    });

    it("'Selecionar visíveis' pega só o que a busca deixou na lista", async () => {
      const aoMudar = vi.fn();
      await montar(
        createElement(Tela, {
          opcoes: [
            { value: "a", label: "Enfermeiro" },
            { value: "b", label: "Enfermeiro Indígena" },
            { value: "c", label: "Médico" },
          ],
          aoMudar,
        }),
      );
      await digitar(
        document.querySelector(".multi-select-search"),
        "enfermeiro",
      );
      await clicar(document.querySelector('[data-acao="visiveis"]'));
      expect(aoMudar).toHaveBeenLastCalledWith(["a", "b"]);
    });

    it("avisa a tela a cada mudança, e 'Limpar' devolve a lista vazia", async () => {
      const aoMudar = vi.fn();
      await montar(createElement(Tela, { opcoes: ["03/2025"], aoMudar }));
      await marcar("03/2025");
      expect(aoMudar).toHaveBeenLastCalledWith(["03/2025"]);
      await clicar(document.querySelector('[data-acao="limpar"]'));
      expect(aoMudar).toHaveBeenLastCalledWith([]);
      expect(rotulo()).toBe("Todos os editais");
    });

    /*
    O caso que mais dói na Lista de Aprovados: escolher um edital encolhe a
    lista de cargos. Um cargo que deixou de existir não aparece marcado nem
    conta no gatilho — estaria a filtrar sem estar na tela.
  */
    it("não mostra como escolhido o que deixou de ser opção", async () => {
      await montar(
        createElement(MultiSelectBusca, {
          id: "f",
          opcoes: ["Enfermeiro"],
          selecionados: ["Enfermeiro", "Médico"],
        }),
      );
      expect(rotulo()).toBe("Enfermeiro");
      expect(document.querySelector(".multi-select-count")?.textContent).toBe(
        "1",
      );
    });

    it("resume a contagem quando há muitas escolhas", async () => {
      await montar(createElement(Tela, { opcoes: ["A", "B", "C"] }));
      await marcar("A");
      await marcar("B");
      expect(rotulo()).toBe("A, B");
      await marcar("C");
      expect(rotulo()).toBe("3 selecionados");
      expect(document.querySelector(".multi-select-count")?.textContent).toBe(
        "3",
      );
    });

    it("escreve o rótulo como texto, sem interpretar HTML", async () => {
      await montar(
        createElement(Tela, {
          opcoes: [{ value: "x", label: "<img src=x onerror=1>" }],
        }),
      );
      expect(document.querySelector(".multi-select-options img")).toBeNull();
      expect(opcoesVisiveis()).toEqual(["<img src=x onerror=1>"]);
    });

    it("o id vai no gatilho, para o rótulo da linha apontar para ele", async () => {
      await montar(createElement(Tela, { opcoes: ["A"] }));
      expect(document.querySelector('label[for="f"]')).not.toBeNull();
      expect(document.getElementById("f")).toBe(gatilho());
    });

    describe("abrir e fechar", () => {
      it("abre com clique e fecha com Esc, devolvendo o foco ao gatilho", async () => {
        await montar(createElement(Tela, { opcoes: ["A"] }));
        await clicar(gatilho());
        expect(menu().hidden).toBe(false);
        expect(gatilho().getAttribute("aria-expanded")).toBe("true");
        expect(document.activeElement).toBe(
          document.querySelector(".multi-select-search"),
        );

        await teclar(document, "Escape");
        expect(menu().hidden).toBe(true);
        expect(document.activeElement).toBe(gatilho());
      });

      it("fecha com clique fora, e não com clique numa opção", async () => {
        await montar(createElement(Tela, { opcoes: ["A", "B"] }));
        await clicar(gatilho());
        await marcar("A");
        expect(menu().hidden).toBe(false);

        await clicar(document.body);
        expect(menu().hidden).toBe(true);
      });

      it("o clique fora numa linha clicável só fecha (não abre o candidato); num botão, vale", async () => {
        const aoClicarNaLinha = vi.fn();
        const aoAplicar = vi.fn();
        document.body.innerHTML = `<div id="raiz"></div>`;
        await act(async () => {
          const novaRaiz = createRoot(
            definido(document.getElementById("raiz")),
          );
          raiz = novaRaiz;
          novaRaiz.render(
            createElement(
              "div",
              null,
              createElement(Tela, { opcoes: ["A"] }),
              createElement(
                "table",
                null,
                createElement(
                  "tbody",
                  null,
                  createElement(
                    "tr",
                    { onClick: aoClicarNaLinha },
                    createElement("td", { id: "celula" }, "Fulana"),
                  ),
                ),
              ),
              createElement(
                "button",
                { type: "button", id: "aplicar", onClick: aoAplicar },
                "Aplicar",
              ),
            ),
          );
        });
        const celula = definido(document.getElementById("celula"));
        await clicar(gatilho());
        await clicar(celula);
        expect(menu().hidden).toBe(true);
        expect(aoClicarNaLinha).not.toHaveBeenCalled();
        // Com o menu fechado, a linha abre no primeiro clique.
        await clicar(celula);
        expect(aoClicarNaLinha).toHaveBeenCalledTimes(1);
        // Escolher e já clicar num botão: fecha e o botão vale.
        await clicar(gatilho());
        await clicar(definido(document.getElementById("aplicar")));
        expect(menu().hidden).toBe(true);
        expect(aoAplicar).toHaveBeenCalledTimes(1);
      });

      it("abrir um fecha o outro", async () => {
        document.body.innerHTML = `<div id="raiz"></div>`;
        await act(async () => {
          const novaRaiz = createRoot(
            definido(document.getElementById("raiz")),
          );
          raiz = novaRaiz;
          novaRaiz.render(
            createElement(
              "div",
              null,
              createElement(Tela, { id: "um", opcoes: ["A"] }),
              createElement(Tela, { id: "dois", opcoes: ["B"] }),
            ),
          );
        });
        const multiSelects = document.querySelectorAll(".multi-select");
        const primeiro = definido(multiSelects[0]);
        const segundo = definido(multiSelects[1]);
        await clicar(primeiro.querySelector(".multi-select-trigger"));
        await clicar(segundo.querySelector(".multi-select-trigger"));
        expect(
          primeiro.querySelector<HTMLElement>(".multi-select-menu")?.hidden,
        ).toBe(true);
        expect(
          segundo.querySelector<HTMLElement>(".multi-select-menu")?.hidden,
        ).toBe(false);
      });

      it("seta para baixo no gatilho abre e vai direto à primeira opção", async () => {
        await montar(createElement(Tela, { opcoes: ["A", "B"] }));
        await teclar(gatilho(), "ArrowDown");
        expect(menu().hidden).toBe(false);
        expect(document.activeElement).toBe(caixaDe("A"));

        await teclar(definido(document.activeElement), "ArrowDown");
        expect(document.activeElement).toBe(caixaDe("B"));
        await teclar(definido(document.activeElement), "ArrowUp");
        await teclar(definido(document.activeElement), "ArrowUp");
        expect(document.activeElement).toBe(
          document.querySelector(".multi-select-search"),
        );
      });
    });
  });
});

bloco("componentes/pessoas-online", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /*
  "Pessoas online" no menu da conta (src/componentes/pessoas-online/): a linha, a
  lista com o rótulo do perfil (não o código), sem rolagem lateral.
*/

  function presencaFalsa(inicial: Partial<EstadoDaPresenca> = {}) {
    let estado: EstadoDaPresenca = {
      visivel: true,
      aberto: false,
      sincronizado: true,
      desde: Date.now(),
      pessoas: [],
      ...inicial,
    };
    const ouvintes = new Set<() => void>();
    const definir = (parcial: Partial<EstadoDaPresenca>) => {
      estado = { ...estado, ...parcial };
      ouvintes.forEach((ouvinte) => ouvinte());
    };
    return {
      obter: () => estado,
      assinar: (ouvinte: () => void) => {
        ouvintes.add(ouvinte);
        return () => ouvintes.delete(ouvinte);
      },
      alternar: vi.fn(() => definir({ aberto: !estado.aberto })),
      fechar: vi.fn(() => definir({ aberto: false })),
      definir,
    };
  }

  const PESSOAS = normalizeOnlinePresenceList([
    {
      user_id: "eu",
      full_name: "Yassury Suira",
      profile_label: "Admin",
      current_view: "analises",
    },
    {
      user_id: "u2",
      full_name: "Maria Aparecida dos Santos Nascimento Ferreira",
      profile_label: "Edital_gestor",
      current_view: "Recursos · Saúde Indígena",
    },
    { user_id: "u3", full_name: "Caio", profile_label: "Master" },
  ]);

  let montado: ReturnType<typeof desenharNoTeste> | null = null;
  async function montar<P extends PresencaDoCabecalho>(presenca: P) {
    document.body.innerHTML = `<div class="actions"><div id="pessoasOnlineApp"></div></div>`;
    await act(async () => {
      montado = desenharNoTeste(
        document.getElementById("pessoasOnlineApp"),
        createElement(PessoasOnline, { presenca }),
      );
    });
    return presenca;
  }

  const $ = (id: string) => definido(document.getElementById(id), id);

  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });
  afterEach(() => {
    act(() => montado?.desmontar());
    montado = null;
    vi.useRealTimers();
  });

  describe("botão", () => {
    it("mostra a contagem e abre a lista", async () => {
      const presenca = await montar(presencaFalsa({ pessoas: PESSOAS }));
      expect($("onlinePresenceLabel").textContent).toBe("3 online");
      expect($("onlinePresence").dataset.presenceState).toBe("ready");
      expect($("onlinePresenceBtn").getAttribute("aria-label")).toBe(
        "3 pessoas online. Ver lista.",
      );
      expect($("onlinePresencePopover").hidden).toBe(true);
      await act(async () => $("onlinePresenceBtn").click());
      expect(presenca.alternar).toHaveBeenCalled();
      expect($("onlinePresencePopover").hidden).toBe(false);
      expect($("onlinePresenceBtn").getAttribute("aria-expanded")).toBe("true");
    });

    it("escondido quando o perfil não vê (estado.visivel = false)", async () => {
      await montar(presencaFalsa({ visivel: false }));
      expect($("onlinePresence").classList.contains("hidden")).toBe(true);
    });

    it("Sincronizando vira Presença indisponível depois da espera", async () => {
      vi.useFakeTimers();
      await montar(
        presencaFalsa({ sincronizado: false, desde: Date.now(), aberto: true }),
      );
      expect($("onlinePresenceLabel").textContent).toBe("Sincronizando");
      expect($("onlinePresenceList").textContent).toBe(
        "Sincronizando presença…",
      );
      await act(async () => vi.advanceTimersByTime(13_000));
      expect($("onlinePresenceLabel").textContent).toBe(
        "Presença indisponível",
      );
      expect($("onlinePresence").dataset.presenceState).toBe("error");
      expect($("onlinePresenceList").textContent).toBe(
        "Não foi possível atualizar a presença agora.",
      );
    });

    it("sem internet: Offline", async () => {
      await montar(presencaFalsa({ pessoas: PESSOAS }));
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
      await act(async () => window.dispatchEvent(new Event("offline")));
      expect($("onlinePresenceLabel").textContent).toBe("Offline");
      expect($("onlinePresence").dataset.presenceState).toBe("offline");
    });

    it("Esc fecha a lista", async () => {
      const presenca = await montar(presencaFalsa({ aberto: true }));
      await act(async () =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
      );
      expect(presenca.fechar).toHaveBeenCalled();
    });
  });

  describe("lista", () => {
    it("mostra o rótulo do perfil, não o código do banco", async () => {
      await montar(presencaFalsa({ pessoas: PESSOAS, aberto: true }));
      const linhas = [...document.querySelectorAll(".online-presence-person")];
      const perfis = linhas.map(
        (linha) => linha.querySelector("small")?.textContent,
      );
      expect(perfis).toEqual([
        "Administrador global",
        "Gestor · Recursos · Saúde Indígena",
        "Administrador global · Painel das análises",
      ]);
      const texto = $("onlinePresenceList").textContent;
      expect(texto).not.toMatch(/Edital_gestor|\bAdmin\b|Master/);
    });

    it("só a pessoa e o lugar (sem botão), com o texto que encolhe", async () => {
      await montar(presencaFalsa({ pessoas: PESSOAS, aberto: true }));
      expect(document.querySelector("#onlinePresenceList button")).toBeNull();
      // Regras que mantêm a lista sem rolagem lateral.
      const shell = readFileSync("src/styles/platform-shell.css", "utf8");
      expect(shell).toMatch(
        /\.online-presence-texto \{\s*flex: 1 1 auto;\s*min-width: 0;/,
      );
      expect(shell).toMatch(
        /\.online-presence-list \{[^}]*overflow-x: hidden;/,
      );
    });

    /* 13/11/2026: o "3 online" saiu do cabeçalho e foi para o menu da conta. */
    it("fica no menu da conta, como uma linha, e a lista abre logo abaixo", () => {
      const topo = readFileSync("src/app/casca/topo.tsx", "utf8");
      const menu = topo.slice(
        topo.indexOf('<div className="top-user-popover">'),
      );
      const acoes = topo.slice(
        topo.indexOf('<div className="actions">'),
        topo.indexOf("</header>"),
      );
      expect(menu).toContain('<div id="pessoasOnlineApp"');
      expect(acoes).not.toContain("pessoasOnlineApp");
      const shell = readFileSync("src/styles/platform-shell.css", "utf8");
      expect(shell).toMatch(/\.online-presence-button \{[^}]*width: 100%;/);
      expect(shell).not.toMatch(/\.online-presence-popover \{/);
    });

    it("ninguém mais: o aviso curto", async () => {
      await montar(presencaFalsa({ aberto: true }));
      expect($("onlinePresenceList").textContent).toBe(
        "Ninguém mais com a plataforma aberta agora.",
      );
    });
  });

  describe("situacaoDaPresenca", () => {
    it("pronta, carregando, indisponível e offline", () => {
      expect(situacaoDaPresenca({ sincronizado: true, quantos: 1 })).toEqual({
        estado: "ready",
        rotulo: "1 online",
        detalhe: "1 pessoa online.",
      });
      expect(situacaoDaPresenca({ esperaMs: 2_000 }).estado).toBe("loading");
      expect(situacaoDaPresenca({ esperaMs: 15_000 }).rotulo).toBe(
        "Presença indisponível",
      );
      expect(situacaoDaPresenca({ online: false }).rotulo).toBe("Offline");
    });
  });
});

bloco("componentes/previa-da-barra-lateral", () => {
  const definirAreaAtual = definirAreaAtual__1;
  const redefinirDadosDoMonitoramento = redefinirDadosDoMonitoramento__2;
  /* A barra como a casca a desenha (src/app/casca/casca.tsx): na hora, no <aside>. */
  function montarBarraLateral(aside: Element) {
    return desenharNoTeste(aside, createElement(BarraLateral), {
      sincrono: true,
      nome: "a barra lateral",
    }).raiz;
  }

  /*
  A prévia da barra lateral (Configurações › Marca) é a barra de verdade, em
  miniatura: as mesmas peças (`PecasDaBarraLateral`) dentro de um quadro. O
  primeiro teste desenha as duas e compara a estrutura — mudou a barra,
  mudou a prévia; se este teste quebrar, a prévia deixou de usar a barra.
  Pedido de 08/10/2026: "a prévia não está refletindo o real".
*/

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const VERSAO = { rotulo: "Versão", valor: "V2.9.35" };

  function arvoreDaPessoa() {
    return montarArvoreDoMenu({
      permitidas: {
        dashboard: true,
        nucleo: true,
        recursos: true,
        "analisar-recursos": true,
        approved: true,
        config: true,
      },
      areas: ["saude-indigena", "projetos"],
      paineis: [{ codigo: "x", titulo: "Painel X" }],
      secoesDeConfiguracao: SECOES,
    });
  }

  const raizes: Root[] = [];

  async function montarBarraDeVerdade() {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<section id="appScreen" class="app">
       <aside class="sidebar" aria-label="Navegação principal"></aside>
       <main class="main"><header class="top"><div class="title-row"></div></header></main>
     </section>`,
    );
    await act(async () => {
      raizes.push(
        montarBarraLateral(
          definido(document.querySelector("#appScreen .sidebar")),
        ),
      );
    });
    return definido(document.querySelector("#appScreen .sidebar"));
  }

  async function desenhar(elemento: ReactElement) {
    const lugar = document.createElement("div");
    document.body.append(lugar);
    const raiz = createRoot(lugar);
    raizes.push(raiz);
    await act(async () => raiz.render(elemento));
    return lugar;
  }

  async function montarPrevia(
    props: Partial<Parameters<typeof PreviaDaBarraLateral>[0]> = {},
  ) {
    const lugar = await desenhar(
      createElement(PreviaDaBarraLateral, {
        logo: "/assets/agsus-logo.webp",
        cor: "#ffffff",
        versao: VERSAO,
        ...props,
      }),
    );
    const quadro = definido(lugar.querySelector("iframe"));
    return { lugar, quadro, documento: definido(quadro.contentDocument) };
  }

  const barraDaPrevia = (documento: Document) =>
    definido(documento.querySelector(".sidebar"));

  /*
  A estrutura: tag, classes e os atributos que o CSS e o app leem, de cada
  elemento, na ordem. Fica de fora o que muda de propósito na prévia: o `src`
  da logo (rascunho) e o texto da versão (que o legado escreve na barra).
*/
  const ATRIBUTOS = [
    "id",
    "data-view",
    "data-secao",
    "data-area",
    "data-icone",
    "data-seletor-de-area",
    "data-cor-da-area",
    "data-opcao-de-area",
    "data-tema",
    "aria-pressed",
    "aria-current",
    "aria-expanded",
    "aria-label",
  ];
  function estrutura(elemento: Element) {
    return [...elemento.querySelectorAll("*")].map((no) =>
      [
        no.tagName.toLowerCase(),
        [...no.classList].sort().join("."),
        ...ATRIBUTOS.map((nome) =>
          no.hasAttribute(nome) ? `${nome}=${no.getAttribute(nome)}` : "",
        ),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(async () => {
    for (const raiz of raizes.splice(0)) await act(async () => raiz.unmount());
    document.body.innerHTML = "";
    await act(async () => redefinirBarraLateral());
    await act(async () => redefinirDadosDoMonitoramento());
  });

  describe("a prévia é a barra lateral de verdade", () => {
    it("desenha a mesma estrutura da barra: marca, área, itens, Administração e rodapé", async () => {
      const real = await montarBarraDeVerdade();
      await act(async () => {
        definirAreaAtual("projetos");
        atualizarMenuLateral(arvoreDaPessoa());
        marcarItemAtivoNoMenu("config", "marca");
      });
      const { documento } = await montarPrevia();
      const previa = barraDaPrevia(documento);

      expect(estrutura(previa)).toEqual(estrutura(real));
      // O que a pessoa vê na barra está na prévia.
      expect(previa.querySelector(".side-brand-copy")?.textContent).toBe(
        "Yeendé",
      );
      expect(
        previa.querySelector(".menu-seletor__rotulo strong")?.textContent,
      ).toBe("Projetos");
      expect(
        previa.querySelector(
          '.menu-item[data-view="analisar-recursos"] .menu-item__selo',
        )?.textContent,
      ).toBe("BETA");
      expect(
        previa.querySelector('.menu-item[data-view="recursos"]')?.textContent,
      ).toBe("Painel de recursos");
      expect(
        previa.querySelector<HTMLElement>(
          '.menu-item.active[aria-current="page"]',
        )?.dataset.secao,
      ).toBe("marca");
      expect(previa.querySelector(".side-recolher")?.textContent).toBe(
        "Recolher menu",
      );
      expect(previa.querySelector("#sidebarLogoutBtn")?.textContent).toBe(
        "Sair",
      );
      expect(previa.querySelector(".side-version")?.textContent).toBe(
        "VersãoV2.9.35",
      );
    });

    it("não tem o rodapé de equipe que a barra não tem", async () => {
      const estado = criarEstadoDasConfiguracoes();
      estado.definirValoresCarregados({ cogip_nome: "COGIP" });
      const lugar = await desenhar(createElement(SecaoMarca, { estado }));
      const documento = definido(
        definido(
          lugar.querySelector<HTMLIFrameElement>(".config-previa iframe"),
        ).contentDocument,
      );

      expect(documento.querySelector(".sidebar")).not.toBeNull();
      expect(documento.body.textContent).not.toContain("COGIP");
      expect(lugar.querySelector(".config-previa")?.textContent).not.toMatch(
        /Nome da equipe|Função/,
      );
    });

    it("sem menu ainda, mostra o catálogo de abas com os selos BETA", async () => {
      const { documento } = await montarPrevia();
      const previa = barraDaPrevia(documento);

      expect(
        previa.querySelectorAll(".menu-item__selo").length,
      ).toBeGreaterThan(0);
      expect(previa.querySelector(".menu-area--administracao")).not.toBeNull();
      expect(
        previa.querySelector<HTMLElement>('.menu-item[aria-current="page"]')
          ?.dataset.secao,
      ).toBe("marca");
    });
  });

  describe("a prévia mostra o rascunho, sem interação", () => {
    it("usa a cor do rascunho, com o contraste da barra de verdade", async () => {
      const { documento } = await montarPrevia({ cor: "#0B3D5C" });
      const raiz = documento.documentElement;

      expect(raiz.style.getPropertyValue("--sidebar-custom-bg")).toBe(
        "#0b3d5c",
      );
      expect(documento.body.classList.contains("sidebar-theme-dark")).toBe(
        true,
      );
      // A barra da página não muda até salvar.
      expect(document.body.classList.contains("sidebar-theme-dark")).toBe(
        false,
      );
    });

    it("usa a logo do rascunho; endereço inválido volta para a padrão", async () => {
      const { documento } = await montarPrevia({
        logo: "https://cdn.test/logo.png",
      });
      const logo = () => barraDaPrevia(documento).querySelector("#sideLogo");
      expect(logo()?.getAttribute("src")).toBe("https://cdn.test/logo.png");

      await act(async () => definido(logo()).dispatchEvent(new Event("error")));
      expect(logo()?.getAttribute("src")).toBe("/assets/agsus-logo.webp");
    });

    it("segue o tema do app, claro ou escuro", async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      const { documento } = await montarPrevia();

      expect(documento.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(
        barraDaPrevia(documento)
          .querySelector('.side-tema__opcao[aria-pressed="true"]')
          ?.getAttribute("data-tema"),
      ).toBe("escuro");
    });

    it("é inerte: fora da tabulação e da leitura", async () => {
      const { quadro, documento } = await montarPrevia();

      expect(quadro.getAttribute("tabindex")).toBe("-1");
      expect(quadro.getAttribute("aria-hidden")).toBe("true");
      expect(barraDaPrevia(documento).hasAttribute("inert")).toBe(true);
      // Os ids da barra ficam no documento do quadro, sem repetir os da página.
      expect(document.getElementById("nav")).toBeNull();
      expect(documento.getElementById("nav")).not.toBeNull();
    });
  });
});

bloco("componentes/rodar-com-opcoes", async () => {
  /*
  Status das atualizações › "Opções" dos robôs (React): a gaveta "Rodar com
  opções" (editais vigentes, códigos colados com validação e cargo, modo com
  explicação, limite e prévia), o pedido pela RPC disparar_robo com as
  opções, o acompanhamento depois do pedido e as últimas execuções em
  "Detalhes". Supabase falso; nada roda de verdade.
*/

  const { criarSaudeDasCargas } =
    await import("../src/componentes/saude-das-cargas/saude-das-cargas.tsx");

  const AGORA = new Date("2026-10-07T12:00:00Z");
  const ha = (min: number) =>
    new Date(AGORA.getTime() - min * 60000).toISOString();
  const ID_93 = "11111111-1111-4111-a111-111111111193";
  const ID_80 = "11111111-1111-4111-a111-111111111180";

  const SAUDE = {
    schema_version: 1,
    gerado_em: AGORA.toISOString(),
    analises: [],
    entrevistas: [],
    selecao: [],
    empregare: [
      {
        inicio: ha(60),
        fim: ha(30),
        situacao: "CONCLUIDA",
        linhas: 812,
        vagas_pedidas: 5,
        vagas_baixadas: 5,
        disparo: "MONITORA",
      },
    ],
    conferencias: [],
    pre_classificacao: [],
    tarefas: null,
  };

  const execucaoNova = {
    id: "gh-3",
    inicio: new Date(AGORA.getTime() + 60000).toISOString(),
    situacao: "EM_ANDAMENTO",
    disparo: "MONITORA",
    quem: "Pessoa Admin",
    filtro: { editais: [], vagas: ["179698", "180231"], limite: null },
    vagas_pedidas: 2,
    vagas_baixadas: 1,
    linhas: 210,
    execucao: "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/3",
    por_vaga: [
      {
        vaga: "179698",
        situacao: "GRAVADA",
        arquivo: 210,
        ativos: 208,
        com_link: 200,
      },
    ],
  };

  const PAINEL = {
    schema_version: 1,
    gerado_em: AGORA.toISOString(),
    areas: [
      { area: "projetos", nome: "Projetos" },
      { area: "saude-indigena", nome: "Saúde Indígena" },
    ],
    editais: [
      {
        id: ID_93,
        numero: "93/2026",
        area: "projetos",
        unidade: "SESMT",
        ativo: true,
        status: "Em andamento",
      },
      {
        id: ID_80,
        numero: "80/2026",
        area: "saude-indigena",
        unidade: "DSEI Yanomami",
        ativo: true,
        status: "Concluído",
      },
    ],
    empregare: [
      {
        id: "gh-1",
        inicio: ha(60),
        fim: ha(30),
        situacao: "CONCLUIDA",
        disparo: "MONITORA",
        quem: "Pessoa Admin",
        filtro: { editais: ["93/2026"], vagas: [], limite: 10 },
        vagas_pedidas: 5,
        vagas_baixadas: 5,
        linhas: 812,
        execucao:
          "https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/1",
        por_vaga: [
          {
            vaga: "180232",
            situacao: "RECUSADA",
            arquivo: 40,
            ativos: 120,
            com_link: 120,
          },
        ],
      },
    ],
    pre_classificacao: [],
  };

  const VAGAS = [
    {
      vaga: "179698",
      edital_id: ID_93,
      cargo: "Técnico de Segurança do Trabalho",
    },
    {
      vaga: "180231",
      edital_id: ID_93,
      cargo: "Engenheiro de Segurança do Trabalho",
    },
    { vaga: "180232", edital_id: ID_93, cargo: "Médico do Trabalho" },
  ];

  const montarSaude = (
    opcoes: Parameters<typeof criarSaudeDasCargas>[0] & { secao: HTMLElement },
  ) => montarTela(criarSaudeDasCargas, "", opcoes);

  let raiz: HTMLDivElement | undefined;
  let controlador: ReturnType<typeof montarSaude> | undefined;
  let depoisDoPedido = false;

  type ArgumentosDasVagas = {
    p_editais?: string[] | null;
    p_vagas?: string[] | null;
  };

  function supabaseFalso() {
    return {
      rpc: vi.fn(async (nome: string, args?: ArgumentosDasVagas) => {
        if (nome === "get_saude_das_cargas")
          return { data: SAUDE, error: null };
        if (nome === "get_painel_dos_robos")
          return {
            data: depoisDoPedido
              ? { ...PAINEL, empregare: [execucaoNova, ...PAINEL.empregare] }
              : PAINEL,
            error: null,
          };
        if (nome === "listar_vagas_dos_robos") {
          const editais = new Set(definido(args).p_editais || []);
          const codigos = new Set(definido(args).p_vagas || []);
          return {
            data: VAGAS.filter(
              (v) => editais.has(v.edital_id) || codigos.has(v.vaga),
            ),
            error: null,
          };
        }
        if (nome === "disparar_robo") {
          depoisDoPedido = true;
          return { data: 51, error: null };
        }
        if (nome === "situacao_do_disparo_robo")
          return {
            data: { disparo: 51, situacao: "ACEITO", http: 204 },
            error: null,
          };
        return { data: [], error: null };
      }),
    };
  }

  async function montar() {
    depoisDoPedido = false;
    const secao = document.createElement("div");
    raiz = secao;
    document.body.append(secao);
    const supabase = supabaseFalso();
    const agendar = vi.fn();
    await act(async () => {
      controlador = montarSaude({
        secao,
        supabase,
        getProfile: () => ({ id: "u", ativo: true, admin_global: true }),
        agora: () => AGORA,
        agendar,
      });
    });
    await act(async () => {
      await definido(controlador).render();
    });
    await esperar();
    return { supabase, agendar };
  }

  const gaveta = () => document.querySelector(".robos-opcoes");
  const botaoRodar = () =>
    gaveta()?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const textoDaPrevia = () =>
    gaveta()?.querySelector(".robos-opcoes__frase")?.textContent;
  const esperarBusca = () =>
    esperar(() => new Promise((r) => setTimeout(r, 420)));

  async function abrirOpcoes(id = "empregare") {
    await clicar(document.querySelector(`[data-carga="${id}"] .saude-opcoes`));
  }

  async function escolherEdital(rotulo: string) {
    await clicar(gaveta()?.querySelector(".multi-select-trigger"));
    const opcao = [
      ...definido(gaveta()).querySelectorAll(".multi-select-option"),
    ].find((o) => o.textContent.includes(rotulo));
    await clicar(definido(opcao).querySelector('input[type="checkbox"]'));
  }

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
  });

  describe("Rodar com opções", () => {
    it("só o robô da Empregare, a triagem e as conferências têm Opções", async () => {
      await montar();
      const comOpcoes = [...document.querySelectorAll(".saude-opcoes")].map(
        (b) => b.closest<HTMLElement>("[data-carga]")?.dataset.carga,
      );
      expect(comOpcoes.sort()).toEqual([
        "conferencias",
        "empregare",
        "pre_classificacao",
      ]);
      expect(
        document.querySelector('[data-carga="selecao"] .saude-opcoes'),
      ).toBeNull();
    });

    it("editais: só os vigentes por padrão; mostrar todos traz os outros", async () => {
      await montar();
      await abrirOpcoes();
      expect(gaveta()?.textContent).toContain("Robô da Empregare");
      await clicar(gaveta()?.querySelector(".multi-select-trigger"));
      const rotulos = () =>
        [...definido(gaveta()).querySelectorAll(".multi-select-option")].map(
          (o) => o.textContent.trim(),
        );
      expect(rotulos()).toEqual(["93/2026 · SESMT (Projetos)"]);
      expect(gaveta()?.textContent).toContain("Mostrar todos (1 não vigentes)");
      await clicar(gaveta()?.querySelector(".robos-opcoes__todos input"));
      expect(rotulos()).toHaveLength(2);
    });

    it("edital escolhido: sugere as vagas conhecidas com o cargo e a prévia lista os códigos", async () => {
      const { supabase } = await montar();
      await abrirOpcoes();
      await escolherEdital("93/2026");
      await esperarBusca();
      expect(supabase.rpc).toHaveBeenCalledWith("listar_vagas_dos_robos", {
        p_editais: [ID_93],
        p_vagas: null,
      });
      const sugestoes = gaveta()?.querySelector(".robos-opcoes__sugestoes");
      expect(sugestoes?.textContent).toContain("180231");
      expect(sugestoes?.textContent).toContain(
        "Engenheiro de Segurança do Trabalho",
      );
      expect(textoDaPrevia()).toBe(
        "3 vagas do 93/2026: 179698, 180231, 180232",
      );
      // Clicar numa sugestão põe o código no campo.
      await clicar(sugestoes?.querySelector(".robos-opcoes__sugestao"));
      expect(gaveta()?.querySelector("textarea")?.value).toBe("179698");
    });

    it("códigos colados: recusa o que não é só dígito, mostra o cargo e bloqueia o Rodar", async () => {
      await montar();
      await abrirOpcoes();
      await digitar(
        gaveta()?.querySelector("textarea"),
        "179698, 17797x\n999999",
      );
      await esperarBusca();
      expect(gaveta()?.querySelector(".ui-campo-erro")?.textContent).toContain(
        "Código inválido: 17797x (só dígitos).",
      );
      expect(botaoRodar()?.disabled).toBe(true);
      const escolhidos = gaveta()?.querySelector(".robos-opcoes__codigos");
      expect(
        escolhidos?.querySelector('[data-vaga="179698"]')?.textContent,
      ).toContain("Técnico de Segurança do Trabalho");
      expect(
        escolhidos?.querySelector('[data-vaga="999999"]')?.textContent,
      ).toContain("não conhecida");
      await digitar(gaveta()?.querySelector("textarea"), "179698 999999");
      expect(botaoRodar()?.disabled).toBe(false);
      // Tirar um código pelo ×.
      await clicar(
        gaveta()?.querySelector('[aria-label="Tirar a vaga 999999"]'),
      );
      expect(gaveta()?.querySelector("textarea")?.value).toBe("179698");
    });

    it("modo com explicação curta; limite fora de 1 a 500 bloqueia", async () => {
      await montar();
      await abrirOpcoes();
      expect(gaveta()?.textContent).toContain(
        "Exporta, baixa e grava os candidatos de cada vaga.",
      );
      await clicar(gaveta()?.querySelector('[data-valor="fumaca"]'));
      expect(gaveta()?.textContent).toContain("Só testa o login na Empregare");
      expect(textoDaPrevia()).toBe("Só o teste de login na Empregare.");
      await clicar(gaveta()?.querySelector('[data-valor="seco"]'));
      expect(gaveta()?.textContent).toContain(
        "Só lista as vagas que exportaria",
      );
      await digitar(gaveta()?.querySelector('input[type="number"]'), "900");
      expect(gaveta()?.textContent).toContain("Limite de 1 a 500 vagas.");
      expect(botaoRodar()?.disabled).toBe(true);
      await digitar(gaveta()?.querySelector('input[type="number"]'), "20");
      expect(botaoRodar()?.disabled).toBe(false);
      expect(textoDaPrevia()).toBe(
        "As vagas dos editais em curso, até 20 (as nunca carregadas primeiro).",
      );
    });

    it("confirma: pede pela RPC disparar_robo com as opções, fecha e acompanha a execução", async () => {
      const { supabase, agendar } = await montar();
      await abrirOpcoes();
      await escolherEdital("93/2026");
      await digitar(gaveta()?.querySelector("textarea"), "179698, 180231");
      await clicar(gaveta()?.querySelector('[data-valor="forcar"]'));
      await digitar(gaveta()?.querySelector('input[type="number"]'), "2");
      await esperarBusca();
      await clicar(botaoRodar());
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "empregare",
        p_inputs: {
          modo: "forcar",
          editais: ["93/2026"],
          vagas: ["179698", "180231"],
          limite: "2",
        },
      });
      expect(gaveta()).toBeNull();
      const acompanhamento = () =>
        document.querySelector(
          '[data-carga="empregare"] .robos-acompanhamento',
        );
      expect(acompanhamento()?.textContent).toContain(
        "Pedido enviado. Aguardando o GitHub.",
      );
      expect(acompanhamento()?.textContent).toContain(
        "2 vagas do 93/2026: 179698, 180231",
      );
      // A conferência do pedido (3 s) e a releitura (20 s).
      expect(agendar).toHaveBeenCalledTimes(2);
      await act(async () => {
        await definido(agendar.mock.calls[0])[0]();
      });
      await esperar();
      expect(acompanhamento()?.textContent).toContain(
        "Aceito pelo GitHub. Na fila ou rodando.",
      );

      // A releitura agendada traz a execução do banco: rodando, por vaga e o link do GitHub.
      await act(async () => {
        await definido(agendar.mock.calls[1])[0]();
      });
      await esperar();
      expect(acompanhamento()?.textContent).toContain("Rodando.");
      expect(acompanhamento()?.textContent).toContain(
        "1 de 2 vagas baixadas · 210 candidatos",
      );
      expect(
        acompanhamento()?.querySelector('[data-vaga="179698"]')?.textContent,
      ).toContain("Gravada");
      expect(
        acompanhamento()?.querySelector("a.robos-github")?.getAttribute("href"),
      ).toBe("https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/3");
      // Enquanto roda, relê de novo.
      expect(agendar).toHaveBeenCalledTimes(3);
      await clicar(
        acompanhamento()?.querySelector(".robos-acompanhamento__fechar"),
      );
      expect(acompanhamento()).toBeNull();
    });

    it("Detalhes: as últimas execuções com quem pediu, parâmetros, resultado e por vaga", async () => {
      await montar();
      await clicar(
        document.querySelector('[data-carga="empregare"] [aria-expanded]'),
      );
      const tabela = document.querySelector(
        '[data-carga="empregare"] .robos-execucoes',
      );
      expect(tabela?.textContent).toContain("Pessoa Admin");
      expect(tabela?.textContent).toContain("Edital 93/2026 · limite 10");
      expect(tabela?.textContent).toContain(
        "5 de 5 vagas baixadas · 812 candidatos",
      );
      expect(
        tabela?.querySelector('[data-vaga="180232"]')?.textContent,
      ).toContain("Recusada pela trava");
      expect(
        tabela?.querySelector("a.robos-github")?.getAttribute("href"),
      ).toContain("/runs/1");
    });

    it("Só anexos: avisa que não mexe em situação nem lote, pede vagas e manda candidatos e seco", async () => {
      const { supabase } = await montar();
      await abrirOpcoes();
      expect(gaveta()?.querySelector(".robos-opcoes__so-anexos")).toBeNull();
      await clicar(gaveta()?.querySelector('[data-valor="anexos"]'));
      const bloco = gaveta()?.querySelector(".robos-opcoes__so-anexos");
      expect(bloco?.textContent).toContain(
        "Não exporta: situação, ativos, lote e triagem não mudam.",
      );
      expect(gaveta()?.querySelector(".robos-opcoes__frase")?.textContent).toBe(
        "O modo Só anexos pede vagas ou editais.",
      );
      expect(botaoRodar()?.disabled).toBe(true);
      await digitar(gaveta()?.querySelector("textarea"), "182514");
      const candidatos = bloco?.querySelector("textarea");
      await digitar(candidatos, "2160872, 21608x");
      expect(bloco?.querySelector(".ui-campo-erro")?.textContent).toContain(
        "Código inválido: 21608x (só dígitos).",
      );
      expect(botaoRodar()?.disabled).toBe(true);
      await digitar(candidatos, "2160872");
      await clicar(bloco?.querySelector('input[type="checkbox"]'));
      await esperarBusca();
      expect(textoDaPrevia()).toBe(
        "Compara, sem gravar, só os anexos de 1 candidato (2160872) em 1 vaga: 182514",
      );
      await clicar(botaoRodar());
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "empregare",
        p_inputs: {
          modo: "anexos",
          vagas: ["182514"],
          candidatos: ["2160872"],
          seco: true,
        },
      });
    });

    it("triagem: editais pelo id, sem vagas nem limite", async () => {
      const { supabase } = await montar();
      await abrirOpcoes("pre_classificacao");
      expect(gaveta()?.querySelector("textarea")).toBeNull();
      expect(gaveta()?.querySelector('input[type="number"]')).toBeNull();
      await escolherEdital("93/2026");
      await clicar(gaveta()?.querySelector('[data-valor="refazer_lote"]'));
      expect(textoDaPrevia()).toBe("Refaz o lote de 1 edital: 93/2026.");
      await clicar(botaoRodar());
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "pre_classificacao",
        p_inputs: { modo: "refazer_lote", editais: [ID_93] },
      });
    });

    it("sem a função do painel no banco: avisa a migration e o resto continua", async () => {
      const secao = document.createElement("div");
      raiz = secao;
      document.body.append(secao);
      const supabase = {
        rpc: vi.fn(async (nome: string) =>
          nome === "get_saude_das_cargas"
            ? { data: SAUDE, error: null }
            : {
                data: null,
                error: { code: "PGRST202", message: "não existe" },
              },
        ),
      };
      await act(async () => {
        controlador = montarSaude({
          secao,
          supabase,
          getProfile: () => ({ id: "u", ativo: true, admin_global: true }),
          agora: () => AGORA,
          agendar: vi.fn(),
        });
      });
      await act(async () => {
        await definido(controlador).render();
      });
      await abrirOpcoes();
      expect(gaveta()?.textContent).toContain(
        "20261007190000_painel_dos_robos.sql",
      );
      expect(gaveta()?.querySelector("textarea")).not.toBeNull();
    });
  });
});

bloco("componentes/saude-das-cargas-chaves", async () => {
  type Resposta = {
    data: unknown;
    error: { message?: string; code?: string } | null;
  };
  type RespostasDasRpcs = Record<
    string,
    (argumentos: unknown) => Promise<Resposta>
  >;

  /*
  Status das atualizações com as chaves da automação (20261022190000): a
  carga de chave desligada mostra "Desligada pelo administrador" (com quem,
  quando e motivo), não pede atenção no resumo, e o Rodar agora dela pede
  confirmação antes de chamar disparar_robo. Sem a função das chaves no
  banco, a tela segue como antes.
*/

  const { criarSaudeDasCargas } =
    await import("../src/componentes/saude-das-cargas/saude-das-cargas.tsx");

  const AGORA = new Date("2026-10-22T14:00:00Z");
  const SAUDE = {
    schema_version: 1,
    gerado_em: AGORA.toISOString(),
    analises: [],
    // Última carga em 16/10: sem a chave seria "Atrasada".
    entrevistas: [
      {
        inicio: "2026-10-16T10:05:00Z",
        fim: "2026-10-16T10:05:30Z",
        situacao: "CONCLUIDA",
      },
    ],
    selecao: [],
    // A tarefa que pede as Entrevistas, ativa no pg_cron: dela sai o prazo.
    tarefas: [
      {
        nome: "agsus_robo_sincronizar_entrevistas",
        agenda: "5 0-10,15,21-23 * * *",
        ativa: true,
        execucoes: [],
      },
    ],
  };
  const CHAVES = {
    chaves: [
      {
        chave: "entrevistas",
        nome: "Entrevistas",
        ligada: false,
        motivo: "Pausa de propósito desde 16/10/2026",
        em: "2026-10-22T13:00:00Z",
        por: "Gestão da Informação de Pessoal",
        tarefas: [],
      },
    ],
  };
  const ADMIN = { id: "u", ativo: true, admin_global: true };

  let raiz: HTMLDivElement | undefined;
  let controlador: ReturnType<typeof montarSaude> | undefined;

  const montarSaude = (
    opcoes: Parameters<typeof criarSaudeDasCargas>[0] & { secao: HTMLElement },
  ) => montarTela(criarSaudeDasCargas, "", opcoes);

  async function montar(rpcs: RespostasDasRpcs) {
    const secao = document.createElement("div");
    raiz = secao;
    document.body.append(secao);
    const supabase = {
      rpc: vi.fn(
        async (nome: string, argumentos?: unknown): Promise<Resposta> => {
          const responder =
            rpcs[nome] ??
            (nome === "obter_catalogo_dos_robos"
              ? () => ({ data: CATALOGO_DOS_ROBOS, error: null })
              : undefined);
          return responder
            ? responder(argumentos)
            : { data: SAUDE, error: null };
        },
      ),
    };
    await act(async () => {
      controlador = montarSaude({
        secao,
        supabase,
        getProfile: () => ADMIN,
        agora: () => AGORA,
        agendar: vi.fn(),
      });
    });
    await act(async () => {
      await definido(controlador).render();
    });
    await esperar();
    return supabase;
  }

  const linhaDe = (id: string) =>
    document.querySelector(`[data-carga="${id}"]`);

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  describe("Status das atualizações com as chaves da automação", () => {
    it("a carga desligada diz isso, com quem e o motivo, e não pede atenção", async () => {
      await montar({
        get_saude_das_cargas: async () => ({ data: SAUDE, error: null }),
        obter_chaves_da_automacao: async () => ({ data: CHAVES, error: null }),
      });
      const linha = linhaDe("entrevistas");
      expect(linha?.textContent).toContain("Desligada pelo administrador");
      expect(linha?.textContent).not.toContain("Atrasada");
      expect(linha?.querySelector(".saude-desligada")?.textContent).toContain(
        "Gestão da Informação de Pessoal · Pausa de propósito desde 16/10/2026",
      );
      expect(document.querySelector(".saude-resumo")?.textContent).toContain(
        "Tudo em dia.",
      );
    });

    it("o Rodar agora da carga desligada pede confirmação", async () => {
      const confirmar = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
      const supabase = await montar({
        get_saude_das_cargas: async () => ({ data: SAUDE, error: null }),
        obter_chaves_da_automacao: async () => ({ data: CHAVES, error: null }),
        disparar_robo: async () => ({ data: 7, error: null }),
        situacao_do_disparo_robo: async () => ({
          data: { situacao: "PEDIDO" },
          error: null,
        }),
      });
      const botao = linhaDe("entrevistas")?.querySelector(".saude-rodar");
      await clicar(botao);
      expect(confirmar).toHaveBeenCalledWith(
        "A automação de Entrevistas está desligada pelo administrador. Rodar agora mesmo assim?",
      );
      expect(supabase.rpc.mock.calls.map(([nome]) => nome)).not.toContain(
        "disparar_robo",
      );

      confirmar.mockReturnValue(true);
      await clicar(botao);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "entrevistas",
        p_inputs: {},
      });
    });

    it("sem a função das chaves no banco, segue como antes (atrasada)", async () => {
      await montar({
        get_saude_das_cargas: async () => ({ data: SAUDE, error: null }),
        obter_chaves_da_automacao: async () => ({
          data: null,
          error: { code: "PGRST202", message: "not found" },
        }),
      });
      expect(linhaDe("entrevistas")?.textContent).toContain("Atrasada");
    });
  });
});

bloco("componentes/saude-das-cargas", async () => {
  type Resposta = {
    data: unknown;
    error: { message?: string; code?: string } | null;
  };
  type RespostasDasRpcs = Record<
    string,
    (argumentos: unknown) => Promise<Resposta>
  >;

  /*
  Configurações › Status das atualizações (React): carrega ao abrir a seção, mostra o
  resumo e um selo por carga, abre o histórico, mostra o erro da última falha
  como texto, avisa quem não é administrador global e a função que falta.
  "Rodar agora" (Empregare, Seleção, Entrevistas) pela RPC disparar_robo falsa.
*/

  const { criarSaudeDasCargas } =
    await import("../src/componentes/saude-das-cargas/saude-das-cargas.tsx");

  const AGORA = new Date("2026-10-01T12:00:00Z");
  const ha = (min: number) =>
    new Date(AGORA.getTime() - min * 60000).toISOString();

  const PAYLOAD: Record<string, unknown> = {
    schema_version: 1,
    gerado_em: AGORA.toISOString(),
    analises: [
      {
        origem: "apps_script_analises_incremental_v1",
        area: "saude-indigena",
        tipo: "INCREMENTAL",
        execucoes: [
          {
            inicio: ha(6),
            fim: ha(5),
            situacao: "erro",
            mensagem: "<b>Timeout</b>",
          },
          { inicio: ha(26), fim: ha(25), situacao: "processado", linhas: 120 },
        ],
      },
    ],
    entrevistas: [
      { inicio: ha(61), fim: ha(60), situacao: "CONCLUIDA", linhas: 3404 },
    ],
    selecao: [],
    tarefas: null,
  };

  const ADMIN = { id: "u", ativo: true, admin_global: true };
  const supabaseFalso = (resposta: Resposta, rpcs: RespostasDasRpcs = {}) => ({
    rpc: vi.fn(
      async (nome: string, argumentos?: unknown): Promise<Resposta> => {
        // O catálogo dos robôs (20261109180000) responde como o banco, salvo quando o teste troca.
        const responder =
          rpcs[nome] ??
          (nome === "obter_catalogo_dos_robos"
            ? () => ({ data: CATALOGO_DOS_ROBOS, error: null })
            : undefined);
        return responder ? responder(argumentos) : resposta;
      },
    ),
  });

  const montarSaude = (
    opcoes: Parameters<typeof criarSaudeDasCargas>[0] & { secao: HTMLElement },
  ) => montarTela(criarSaudeDasCargas, "", opcoes);

  let raiz: HTMLDivElement | undefined;
  let controlador: ReturnType<typeof montarSaude> | undefined;

  interface OpcoesDaMontagem {
    resposta?: Resposta;
    perfil?: Record<string, unknown>;
    rpcs?: RespostasDasRpcs;
    agendar?: (fn: () => void, ms: number) => unknown;
  }

  async function montar({
    resposta = { data: PAYLOAD, error: null },
    perfil = ADMIN,
    rpcs = {},
    agendar = vi.fn(),
  }: OpcoesDaMontagem = {}) {
    const secao = document.createElement("div");
    raiz = secao;
    document.body.append(secao);
    const supabase = supabaseFalso(resposta, rpcs);
    await act(async () => {
      controlador = montarSaude({
        secao,
        supabase,
        getProfile: () => perfil,
        agora: () => AGORA,
        agendar,
      });
    });
    await act(async () => {
      await definido(controlador).render();
    });
    await esperar();
    return supabase;
  }

  const naTela = (texto: string) => document.body.textContent.includes(texto);

  afterEach(async () => {
    await act(async () => controlador?.raiz?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
  });

  describe("Status das atualizações", () => {
    it("consulta ao abrir e responde primeiro se está tudo em dia", async () => {
      const supabase = await montar();
      expect(supabase.rpc).toHaveBeenCalledWith("get_saude_das_cargas");
      const resumo = document.querySelector(".saude-resumo");
      expect(resumo?.textContent).toContain(
        "1 atualização precisa de atenção.",
      );
      expect(resumo?.textContent).toContain(
        "Análises curriculares · Saúde Indígena (falhou)",
      );
      expect(
        [...document.querySelectorAll(".saude-item__nome strong")].map(
          (n) => n.textContent,
        ),
      ).toEqual([
        "Análises curriculares · Saúde Indígena",
        "Entrevistas",
        "Seleção",
        "Atualização automática do banco",
      ]);
      // Seleção sem nenhuma carga: neutro, e fora do aviso do topo.
      const selecao = document.querySelector('[data-carga="selecao"]');
      expect(selecao?.textContent).toContain("Ainda sem carga");
      expect(selecao?.textContent).toContain("Ainda não houve carga");
      expect(naTela("Entrevistas") && naTela("Atualizado há 1 h")).toBe(true);
    });

    it("mostra o erro como texto e abre os detalhes com o histórico", async () => {
      await montar();
      const erro = document.querySelector(".saude-erro");
      expect(erro?.textContent).toContain("<b>Timeout</b>");
      expect(erro?.querySelector("b")).toBeNull();
      const analises = document.querySelector(
        '[data-carga="analises:saude-indigena"]',
      );
      expect(analises?.querySelector(".saude-historico")).toBeNull();
      await clicar(analises?.querySelector(".saude-botao"));
      const linhas = definido(analises).querySelectorAll(
        ".saude-historico tbody tr",
      );
      expect(linhas).toHaveLength(2);
      expect(linhas[0]?.textContent).toContain("Falhou");
      expect(linhas[1]?.textContent).toContain("Concluída");
    });

    it("tudo em dia vira uma frase só", async () => {
      await montar({
        resposta: {
          data: {
            ...PAYLOAD,
            analises: [],
            selecao: [
              {
                inicio: ha(31),
                fim: ha(30),
                situacao: "CONCLUIDA",
                linhas: 3146,
              },
            ],
            tarefas: [],
          },
          error: null,
        },
      });
      expect(document.querySelector(".saude-resumo")?.textContent).toContain(
        "Tudo em dia.",
      );
    });

    it("quem não é administrador global não consulta e vê o aviso", async () => {
      const supabase = await montar({
        perfil: { id: "x", ativo: true, admin_global: false },
      });
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(
        naTela("Só o administrador global vê o status das atualizações."),
      ).toBe(true);
    });

    it("sem a função no banco, diz qual migration aplicar", async () => {
      await montar({
        resposta: { data: null, error: { code: "PGRST202", message: "x" } },
      });
      expect(naTela("20261001120000_saude_das_cargas.sql")).toBe(true);
    });
  });

  describe("Rodar agora (pelo banco: disparar_robo)", () => {
    const COM_ROBO = {
      ...PAYLOAD,
      empregare: [
        {
          inicio: ha(40),
          fim: ha(30),
          situacao: "CONCLUIDA",
          linhas: 812,
          vagas_pedidas: 12,
          vagas_baixadas: 12,
          disparo: "AGENDA",
        },
      ],
    };
    const botaoDe = (id: string) =>
      document.querySelector<HTMLButtonElement>(
        `[data-carga="${id}"] .saude-rodar`,
      );
    const linhaDe = (id: string) =>
      document.querySelector(`[data-carga="${id}"]`);

    it("só as cargas do GitHub têm o botão, liberado sem consultar nada fora do banco", async () => {
      const supabase = await montar({
        resposta: { data: COM_ROBO, error: null },
      });
      expect(botaoDe("empregare")).not.toBeNull();
      expect(botaoDe("selecao")).not.toBeNull();
      expect(botaoDe("entrevistas")).not.toBeNull();
      expect(botaoDe("analises:saude-indigena")).toBeNull();
      expect(botaoDe("tarefas")).toBeNull();
      expect(botaoDe("empregare")?.disabled).toBe(false);
      expect(linhaDe("empregare")?.textContent).toContain("Robô da Empregare");
      expect(supabase.rpc.mock.calls.map(([nome]) => nome)).not.toContain(
        "disparar_robo",
      );
    });

    it("clicar chama disparar_robo, desabilita e acompanha até o GitHub aceitar", async () => {
      const agendar = vi.fn();
      const supabase = await montar({
        resposta: { data: COM_ROBO, error: null },
        rpcs: {
          disparar_robo: async () => ({ data: 41, error: null }),
          situacao_do_disparo_robo: async () => ({
            data: { disparo: 41, situacao: "ACEITO", http: 204 },
            error: null,
          }),
        },
        agendar,
      });
      await clicar(botaoDe("empregare"));
      expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
        p_robo: "empregare",
        p_inputs: {},
      });
      expect(botaoDe("empregare")?.disabled).toBe(true);
      expect(botaoDe("empregare")?.textContent).toContain("Pedido enviado");
      expect(linhaDe("empregare")?.textContent).toContain(
        "Pedido enviado. Aguardando o GitHub.",
      );
      // A primeira conferência (3 s) e a releitura (60 s).
      expect(agendar.mock.calls.map(([, ms]) => ms)).toEqual([3000, 60000]);
      await act(async () => {
        definido(agendar.mock.calls[0])[0]();
      });
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("situacao_do_disparo_robo", {
        p_disparo: 41,
      });
      expect(linhaDe("empregare")?.textContent).toContain(
        "Aceito pelo GitHub. Na fila ou rodando.",
      );
      // As outras cargas continuam liberadas.
      expect(botaoDe("selecao")?.disabled).toBe(false);
    });

    it("chave do cofre vencida: a linha diz o que fazer e o botão volta", async () => {
      const agendar = vi.fn();
      await montar({
        resposta: { data: COM_ROBO, error: null },
        rpcs: {
          disparar_robo: async () => ({ data: 42, error: null }),
          situacao_do_disparo_robo: async () => ({
            data: {
              disparo: 42,
              situacao: "FALHOU",
              http: 401,
              mensagem: "GitHub 401: Bad credentials",
            },
            error: null,
          }),
        },
        agendar,
      });
      await clicar(botaoDe("selecao"));
      await act(async () => {
        definido(agendar.mock.calls[0])[0]();
      });
      await esperar();
      expect(linhaDe("selecao")?.textContent).toContain(
        "A chave de disparo dos robôs expirou ou foi recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos.",
      );
      expect(botaoDe("selecao")?.disabled).toBe(false);
    });

    it("desabilitado enquanto a carga roda (registro do banco)", async () => {
      await montar({
        resposta: {
          data: {
            ...COM_ROBO,
            selecao: [{ inicio: ha(2), situacao: "EM_ANDAMENTO" }],
          },
          error: null,
        },
      });
      expect(botaoDe("selecao")?.disabled).toBe(true);
      expect(botaoDe("selecao")?.textContent).toContain("Rodando…");
      expect(botaoDe("empregare")?.disabled).toBe(false);
    });

    it("recusa do banco aparece na linha e libera o botão", async () => {
      await montar({
        resposta: { data: COM_ROBO, error: null },
        rpcs: {
          disparar_robo: async () => ({
            data: null,
            error: {
              code: "42501",
              message: "Só o administrador global roda as cargas.",
            },
          }),
        },
      });
      await clicar(botaoDe("entrevistas"));
      expect(
        linhaDe("entrevistas")?.querySelector('[role="alert"]')?.textContent,
      ).toBe("Só o administrador global roda as cargas.");
      expect(botaoDe("entrevistas")?.disabled).toBe(false);
    });

    it("pedido repetido em 2 min: aviso informativo, sem erro", async () => {
      await montar({
        resposta: { data: COM_ROBO, error: null },
        rpcs: {
          disparar_robo: async () => ({
            data: null,
            error: {
              code: "55006",
              message:
                "Esta carga acabou de ser pedida. Aguarde alguns minutos.",
            },
          }),
        },
      });
      await clicar(botaoDe("entrevistas"));
      expect(
        linhaDe("entrevistas")?.querySelector('[role="alert"]'),
      ).toBeNull();
      expect(linhaDe("entrevistas")?.textContent).toContain(
        "Esta carga acabou de ser pedida.",
      );
    });
  });

  describe("a seção na Administração", async () => {
    const { SECOES } = await import("../src/modulos/configuracoes/secoes.ts");
    const { secaoDeConfiguracaoPermitida } =
      await import("../src/lib/acessos/access-roles.ts");

    it("existe e é só do administrador global", () => {
      expect(SECOES.find((s) => s.id === "cargas")).toMatchObject({
        rotulo: "Status das atualizações",
        iconeDoMenu: "activity",
      });
      expect(secaoDeConfiguracaoPermitida(ADMIN, "cargas")).toBe(true);
      expect(
        secaoDeConfiguracaoPermitida(
          { id: "x", ativo: true, admin_global: false },
          "cargas",
        ),
      ).toBe(false);
    });
  });

  describe("Agenda dos robôs (20261008140000)", () => {
    const comAgenda = (agenda: Record<string, unknown>) => ({
      resposta: { data: { ...PAYLOAD, agenda_dos_robos: agenda }, error: null },
    });

    it("mostra o último pedido aceito e as falhas das últimas 24 h", async () => {
      await montar(
        comAgenda({
          chave_cadastrada: true,
          ultimo_aceito: ha(20),
          falhas_24h: 2,
          sem_chave_24h: 0,
          disparos: [
            {
              workflow: "sincronizar-entrevistas.yml",
              inicio: ha(20),
              fim: ha(20),
              situacao: "ACEITO",
              http: 204,
            },
          ],
        }),
      );
      const linha = document.querySelector('[data-carga="agenda_dos_robos"]');
      expect(linha?.querySelector("strong")?.textContent).toBe(
        "Agenda dos robôs",
      );
      expect(linha?.querySelector(".saude-agenda")?.textContent).toMatch(
        /^Último pedido aceito: .+ · 2 falhas em 24 h$/,
      );
      expect(linha?.querySelector('[role="alert"]')).toBeNull();
      await clicar(linha?.querySelector(".saude-botao"));
      expect(
        linha?.querySelector(".saude-historico tbody")?.textContent,
      ).toContain("Entrevistas · HTTP 204");
    });

    it("sem a chave no Vault, avisa e pede o cadastro", async () => {
      await montar(
        comAgenda({
          chave_cadastrada: false,
          ultimo_aceito: null,
          falhas_24h: 0,
          sem_chave_24h: 3,
          disparos: [],
        }),
      );
      const linha = document.querySelector('[data-carga="agenda_dos_robos"]');
      const aviso = linha?.querySelector('.saude-agenda[role="alert"]');
      expect(aviso?.textContent).toBe(
        "Sem chave no Vault: os robôs não rodam sozinhos. Cadastre github_disparo_robos.",
      );
      expect(linha?.textContent).toContain("Falhou");
      expect(document.querySelector(".saude-resumo")?.textContent).toContain(
        "Agenda dos robôs (falhou)",
      );
    });
  });
});

bloco("lib/sanitize", () => {
  describe("sanitize", () => {
    it("escapa HTML e atributos", () => {
      expect(escapeHtml("<script>alert(1)</script>")).toBe(
        "&lt;script&gt;alert(1)&lt;/script&gt;",
      );
    });

    it("remove scripts ao sanitizar HTML", () => {
      expect(sanitizeHtml("<img src=x onerror=alert(1)>")).not.toContain(
        "onerror",
      );
    });

    it("bloqueia URLs perigosas", () => {
      expect(safeHttpUrl("javascript:alert(1)")).toBe("");
      expect(safeHttpUrl("https://agsus.example/app")).toBe(
        "https://agsus.example/app",
      );
    });
  });
});

bloco("lib/supabase-auth-flow", () => {
  function source(path: string) {
    return readFileSync(path, "utf8");
  }

  /*
  A janela de mentira: os campos que o teste dá e, fora deles, a do jsdom.
  O fluxo só lê `open`, as medidas e a posição, todas dadas pelo teste.
*/
  function janelaCom(campos: Record<string, unknown>): Window {
    return new Proxy(window, {
      get: (alvo, chave) =>
        chave in campos ? Reflect.get(campos, chave) : Reflect.get(alvo, chave),
    });
  }

  describe("fluxo de autenticação Supabase", () => {
    it("mantém o cliente partilhado configurado com PKCE e troca explícita do código", () => {
      const clientSource = source("src/lib/sessao/supabaseClient.ts");

      expect(clientSource).toContain('flowType: "pkce"');
      expect(clientSource).toContain("detectSessionInUrl: false");
      expect(clientSource).not.toContain('flowType: "implicit"');
    });

    it("mantém o callback independente do CDN e do global window.supabase", () => {
      const callbackHtml = source("auth/callback.html");
      const callbackSource = source("src/auth/callback.ts");

      expect(callbackHtml).not.toContain(
        "cdn.jsdelivr.net/npm/@supabase/supabase-js",
      );
      expect(callbackSource).toContain(
        'import { getSupabaseClient } from "../lib/sessao/supabaseClient"',
      );
      expect(callbackSource).not.toContain("window.supabase.createClient");
    });

    it("gera URLs de retorno previsíveis para sucesso e falhas", () => {
      expect(callbackResultUrl("success")).toBe("/?auth=google");
      expect(callbackResultUrl("missing_env")).toBe("/?auth_error=missing_env");
      expect(callbackResultUrl("missing_code")).toBe(
        "/?auth_error=missing_code",
      );
      expect(callbackResultUrl("supabase_unavailable")).toBe(
        "/?auth_error=supabase_unavailable",
      );
      expect(callbackResultUrl("unexpected")).toBe(
        "/?auth_error=oauth_callback",
      );
    });

    it("abre o Google em uma janela centralizada no desktop, como o SIGAV", () => {
      let opened = null as unknown[] | null;
      const windowRef = janelaCom({
        innerWidth: 1440,
        outerWidth: 1440,
        outerHeight: 900,
        screenX: 40,
        screenY: 20,
        open: (...args: unknown[]) => {
          opened = args;
          return { closed: false };
        },
      });

      expect(supportsLoginPopup(windowRef)).toBe(true);
      expect(openLoginPopup(windowRef)).toEqual({ closed: false });
      expect(opened?.[0]).toBe("about:blank");
      expect(opened?.[1]).toBe("agsus-monitora-login");
      expect(opened?.[2]).toContain("width=520");
      expect(LOGIN_POPUP_MESSAGE).toBe("agsus-monitora:login-concluido");
    });

    it("preserva o redirecionamento tradicional em telas pequenas", () => {
      expect(
        supportsLoginPopup(janelaCom({ innerWidth: 600, open() {} })),
      ).toBe(false);
      expect(
        openLoginPopup(janelaCom({ innerWidth: 600, open() {} })),
      ).toBeNull();
    });

    it("mantém o cabeçalho sem horário e a barra sem identificação repetida", () => {
      const html = htmlDaPagina();
      expect(html).not.toContain('id="updatedPill"');
      // O nome da Agência fica só no rodapé da tela de acesso (#loginScreen).
      const inicioDoLogin = html.indexOf('id="loginScreen"');
      const foraDoLogin =
        html.slice(0, inicioDoLogin) +
        html.slice(html.indexOf("</section>", inicioDoLogin));
      expect(foraDoLogin).not.toContain(
        "Agência Brasileira de Apoio à Gestão do SUS",
      );
      // A barra lateral e o botão de recolher são React; o index.html só tem o <aside>.
      expect(html).toContain('<aside class="sidebar"');
      expect(
        source("src/componentes/barra-lateral/alca-de-recolher.tsx"),
      ).toContain('id="globalSidebarToggle"');
      expect(html).toContain('id="topUserMenu"');
    });
  });
});

bloco("ui/carga-continua", () => {
  /*
  O carregamento contínuo das listas em blocos e cartões (pente fino de
  16/11/2026): 50 itens por vez, "Carregar mais" (ou rolar perto do fim) traz
  mais 50, e recorte novo (outro filtro) volta aos 50 no mesmo desenho.
*/

  let raiz: Root | null = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  function Lista({ itens }: { itens: readonly number[] }) {
    const carga = usarCargaContinua(itens, itens.length);
    return createElement(
      "div",
      null,
      createElement(
        "ul",
        null,
        itens
          .slice(0, carga.limite)
          .map((i) => createElement("li", { key: i }, String(i))),
      ),
      createElement(MaisDaCarga, { carga, oQue: "pessoas" }),
    );
  }

  function desenhar(itens: readonly number[]) {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const alvo = document.createElement("div");
    document.body.append(alvo);
    raiz = createRoot(alvo);
    act(() => raiz?.render(createElement(Lista, { itens })));
    return alvo;
  }

  const numeros = (quantos: number) =>
    Array.from({ length: quantos }, (_, i) => i);

  describe("usarCargaContinua + MaisDaCarga", () => {
    it("desenha 50 e diz quanto falta", () => {
      const alvo = desenhar(numeros(130));
      expect(alvo.querySelectorAll("li")).toHaveLength(50);
      expect(alvo.querySelector("[role=status]")?.textContent).toBe(
        "50 de 130 pessoas",
      );
      expect(
        alvo.querySelector("[data-acao=carregar-mais]")?.textContent,
      ).toContain("Carregar mais 50");
    });

    it("Carregar mais traz mais 50 e some quando não falta nada", () => {
      const alvo = desenhar(numeros(130));
      const mais = () =>
        alvo.querySelector<HTMLButtonElement>("[data-acao=carregar-mais]");
      act(() => mais()?.click());
      expect(alvo.querySelectorAll("li")).toHaveLength(100);
      expect(mais()?.textContent).toContain("Carregar mais 30");
      act(() => mais()?.click());
      expect(alvo.querySelectorAll("li")).toHaveLength(130);
      expect(mais()).toBeNull();
      expect(alvo.querySelector("[data-carga-continua]")).toBeNull();
    });

    it("recorte novo volta aos 50", () => {
      const alvo = desenhar(numeros(130));
      act(() =>
        alvo
          .querySelector<HTMLButtonElement>("[data-acao=carregar-mais]")
          ?.click(),
      );
      expect(alvo.querySelectorAll("li")).toHaveLength(100);
      act(() => raiz?.render(createElement(Lista, { itens: numeros(120) })));
      expect(alvo.querySelectorAll("li")).toHaveLength(50);
    });

    it("lista curta: tudo à vista, sem botão", () => {
      const alvo = desenhar(numeros(12));
      expect(alvo.querySelectorAll("li")).toHaveLength(12);
      expect(alvo.querySelector("[data-carga-continua]")).toBeNull();
    });
  });
});

bloco("ui/carregando-conteudo", () => {
  /*
  Carregando não é cartão em branco (pedido de 10/11/2026): ao escolher o
  edital na Avaliação documental, a tela ficava ~4 s com um cartão vazio. As
  linhas `.ui-esqueleto-linha` não tinham a classe base `.ui-esqueleto` e não
  desenhavam nada; o mesmo em Classificação, Entrevistas, Triagem e Regras do
  edital. `CarregandoConteudo` diz o que carrega, com o indicador, e é
  anunciado ao leitor de tela; o CSS desenha a linha mesmo sem a classe base.
*/

  let raiz: Root | null = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  function desenhar(props: Parameters<typeof CarregandoConteudo>[0]) {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const alvo = document.createElement("div");
    document.body.append(alvo);
    raiz = createRoot(alvo);
    act(() => raiz?.render(createElement(CarregandoConteudo, props)));
    return alvo.firstElementChild as HTMLElement;
  }

  describe("CarregandoConteudo", () => {
    it("diz o que carrega, num cartão anunciado ao leitor de tela", () => {
      const bloco = desenhar({ rotulo: "Carregando o edital 93/2026…" });
      expect(bloco.getAttribute("role")).toBe("status");
      expect(bloco.getAttribute("aria-busy")).toBe("true");
      expect(bloco.classList.contains("ui-card")).toBe(true);
      expect(bloco.textContent).toBe("Carregando o edital 93/2026…");
      expect(bloco.querySelector(".ui-carregando-indicador")).not.toBeNull();
      const linhas = bloco.querySelectorAll(".ui-esqueleto.ui-esqueleto-linha");
      expect(linhas).toHaveLength(2);
    });

    it("sem moldura, quantas linhas pedir e o texto padrão", () => {
      const bloco = desenhar({ semMoldura: true, linhas: 1 });
      expect(bloco.classList.contains("ui-card")).toBe(false);
      expect(bloco.textContent).toBe("Carregando…");
      expect(bloco.querySelectorAll(".ui-esqueleto-linha")).toHaveLength(1);
    });
  });

  describe("o esqueleto não volta a sair invisível", () => {
    const css = readFileSync("src/ui/ui.css", "utf8");

    it("a linha desenha mesmo sem a classe base, com a cor da borda padrão", () => {
      const regra = css.match(
        /\.ui-esqueleto,\s*\.ui-esqueleto-linha\s*\{[^}]*\}/,
      );
      expect(regra?.[0]).toContain("background: var(--color-border-default)");
      expect(regra?.[0]).toContain("animation: ui-esqueleto-pulso");
    });

    it("nenhuma tela desenha cartão em branco: cartão com aria-busy usa CarregandoConteudo", () => {
      const arquivos: string[] = [];
      const percorrer = (pasta: string) => {
        for (const nome of readdirSync(pasta)) {
          const caminho = join(pasta, nome);
          if (statSync(caminho).isDirectory()) percorrer(caminho);
          else if (caminho.endsWith(".tsx")) arquivos.push(caminho);
        }
      };
      percorrer("src/modulos");
      const vazios = arquivos.filter((arquivo) =>
        /className="ui-card[^"]*" aria-busy="true">\s*<div className="ui-esqueleto-linha"/.test(
          readFileSync(arquivo, "utf8"),
        ),
      );
      expect(vazios).toEqual([]);
    });
  });
});

bloco("ui/estados-e-botao-pressionado", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const CSS = readFileSync("src/ui/ui.css", "utf8");

  const montados: HTMLElement[] = [];
  afterEach(() => {
    for (const no of montados.splice(0)) no.remove();
  });

  async function montar(elemento: ReturnType<typeof h>): Promise<HTMLElement> {
    const no = document.createElement("div");
    document.body.append(no);
    montados.push(no);
    await act(async () => {
      createRoot(no).render(elemento);
    });
    return no;
  }

  describe("estados de bloco (DS 12 e 17)", () => {
    it("o carregamento é anunciado ao leitor de tela; o vazio não", async () => {
      const carregando = await montar(h(Carregando));
      expect(carregando.querySelector('[role="status"]')?.textContent).toBe(
        "Carregando…",
      );
      const vazio = await montar(h(EstadoVazio, null, "Nada aqui."));
      expect(vazio.querySelector("[role]")).toBeNull();
    });

    it("o botão de fechar da gaveta tem nome acessível mesmo sem rótulo", async () => {
      const no = await montar(h(TopoDaGaveta, { titulo: "Detalhe" }));
      expect(
        no.querySelector(".ui-gaveta-fechar")?.getAttribute("aria-label"),
      ).toBe("Fechar");
    });
  });

  describe("botão pressionado (DS 11.1)", () => {
    it("encolhe a 0,98 ao pressionar, só habilitado, e some com movimento reduzido", () => {
      expect(CSS).toMatch(
        /\.btn:active:not\(:disabled\)\s*\{\s*transform:\s*scale\(0\.98\);/,
      );
      expect(CSS).toMatch(
        /\.btn\s*\{\s*transition:\s*transform var\(--duration-fast\) var\(--ease-standard\);/,
      );
      expect(CSS).toMatch(
        /prefers-reduced-motion: reduce\)\s*\{\s*\.btn,\s*\.btn:active:not\(:disabled\)\s*\{\s*transition:\s*none;\s*transform:\s*none;/,
      );
    });
  });
});

bloco("ui/familia-da-selecao", () => {
  /*
  As peças compartilhadas das telas da seleção (Triagem, Avaliação
  documental e Classificação): a barra de "encontrar a pessoa", as ações da
  linha (principal + "⋯"), o complemento do KPI, o filtro guardado na sessão
  e o seletor de edital.
*/

  let raiz: Root | null = null;
  async function montar(elemento: ReactElement) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      const novaRaiz = createRoot(definido(document.getElementById("raiz")));
      raiz = novaRaiz;
      novaRaiz.render(elemento);
    });
  }
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
    sessionStorage.clear();
  });
  const $ = <E extends Element = HTMLElement>(seletor: string) =>
    document.querySelector<E>(seletor);

  describe("AcoesDaLinha", () => {
    it("o principal com rótulo direto e o ⋯ com o nome da pessoa; ocupado troca o texto", async () => {
      const abrir = vi.fn();
      const copiar = vi.fn();
      await montar(
        h(AcoesDaLinha, {
          pessoa: "7000123",
          principal: { rotulo: "Abrir", acao: "abrir", aoClicar: abrir },
          outras: [
            {
              id: "copiar",
              rotulo: "Copiar código",
              aoEscolher: copiar,
              atalho: "C",
              dados: { "data-acao": "copiar" },
            },
          ],
        }),
      );
      await clicar($("[data-acao='abrir']"));
      expect(abrir).toHaveBeenCalledTimes(1);
      const mais = definido(
        $<HTMLElement>(".ui-menu-compacto [data-acao='abrir-menu']"),
      );
      expect(mais.className).toBe("ui-menu-reticencias");
      expect(mais.getAttribute("aria-label")).toBe("Mais ações de 7000123");
      expect(mais.textContent).toBe("");
      await clicar(mais);
      const lista = definido($<HTMLElement>("[role='menu']"));
      // Presa à janela: a rolagem da tabela não corta a lista.
      expect(lista.style.position).toBe("fixed");
      expect($("[data-acao='copiar'] kbd.ui-menu-atalho")?.textContent).toBe(
        "C",
      );
      expect($("[data-acao='copiar']")?.getAttribute("aria-keyshortcuts")).toBe(
        "C",
      );
      await clicar($("[data-acao='copiar']"));
      expect(copiar).toHaveBeenCalledTimes(1);
      expect($("[role='menu']")).toBeNull();
    });

    it("a lista fixa fecha quando a página rola; sem nada, nada é desenhado", async () => {
      await montar(
        h(MenuDeAcoes, {
          compacto: true,
          rotulo: "Mais ações de 1",
          acoes: [{ id: "a", rotulo: "A", aoEscolher: () => {} }],
        }),
      );
      await clicar($("[data-acao='abrir-menu']"));
      expect($("[role='menu']")).not.toBeNull();
      await act(async () => {
        document.dispatchEvent(new Event("scroll"));
      });
      expect($("[role='menu']")).toBeNull();

      await act(async () =>
        definido(raiz).render(h(AcoesDaLinha, { pessoa: "1" })),
      );
      expect($(".ui-acoes-da-linha")).toBeNull();
    });

    it("principal ocupado: o texto da ação e o botão desligado", async () => {
      await montar(
        h(AcoesDaLinha, {
          pessoa: "1",
          principal: {
            rotulo: "PDF",
            icone: "fa-file-pdf",
            ocupado: "Gerando PDF…",
            aoClicar: () => {},
          },
        }),
      );
      const botao = definido($<HTMLButtonElement>(".ui-acoes-da-linha button"));
      expect(botao.textContent?.trim()).toBe("Gerando PDF…");
      expect(botao.disabled).toBe(true);
      expect($(".ui-menu")).toBeNull();
    });
  });

  describe("Kpi com detalhe", () => {
    it("o complemento fica ao lado do número, menor; vazio não aparece", async () => {
      await montar(
        h(
          "div",
          null,
          h(Kpi, {
            chave: "a",
            rotulo: "Concluídas",
            valor: "120",
            detalhe: "45%",
          }),
          h(Kpi, { chave: "b", rotulo: "Pendentes", valor: "3", detalhe: "" }),
        ),
      );
      // O número continua sozinho no .ui-kpi-valor (contrato das telas).
      expect($("[data-kpi='a'] .ui-kpi-valor")?.textContent).toBe("120");
      expect(
        $("[data-kpi='a'] .ui-kpi-linha .ui-kpi-detalhe")?.textContent,
      ).toBe("45%");
      expect($("[data-kpi='b'] .ui-kpi-linha")).toBeNull();
      expect($("[data-kpi='b'] .ui-kpi-detalhe")).toBeNull();
    });
  });

  describe("estado guardado na sessão", () => {
    // O guardado pode ser qualquer coisa: só o `busca` de um objeto conta.
    const normalizar = (v: unknown) => ({
      busca: String(
        v && typeof v === "object" ? (Reflect.get(v, "busca") ?? "") : "",
      ),
    });
    it("lê e grava por chave; o inicial apaga; sem chave, não guarda", () => {
      expect(lerDaSessao("k", { busca: "" }, normalizar)).toEqual({
        busca: "",
      });
      gravarNaSessao("k", { busca: "ana" }, { busca: "" });
      expect(sessionStorage.getItem("k")).toBe('{"busca":"ana"}');
      expect(lerDaSessao("k", { busca: "" }, normalizar)).toEqual({
        busca: "ana",
      });
      gravarNaSessao("k", { busca: "" }, { busca: "" });
      expect(sessionStorage.getItem("k")).toBeNull();
      gravarNaSessao("", { busca: "x" }, { busca: "" });
      expect(sessionStorage.length).toBe(0);
      sessionStorage.setItem("ruim", "{nao é json");
      expect(lerDaSessao("ruim", { busca: "" }, normalizar)).toEqual({
        busca: "",
      });
    });

    it("o hook volta com o guardado e troca junto com a chave", async () => {
      sessionStorage.setItem("tela:e1", '{"busca":"guardada"}');
      let mudar: ((novo: { busca: string }) => void) | undefined;
      function Tela({ chave }: { chave: string }) {
        const [f, setF] = usarEstadoDaSessao(chave, { busca: "" }, normalizar);
        mudar = setF;
        return h("output", null, f.busca);
      }
      await montar(h(Tela, { chave: "tela:e1" }));
      expect($("output")?.textContent).toBe("guardada");
      await act(async () =>
        definido(raiz).render(h(Tela, { chave: "tela:e2" })),
      );
      expect($("output")?.textContent).toBe("");
      await act(async () => definido(mudar)({ busca: "nova" }));
      expect(sessionStorage.getItem("tela:e2")).toBe('{"busca":"nova"}');
      await act(async () =>
        definido(raiz).render(h(Tela, { chave: "tela:e1" })),
      );
      expect($("output")?.textContent).toBe("guardada");
    });
  });

  describe("SeletorDeEdital", () => {
    const EDITAIS = [
      { id: "e1", edital: "93/2026", unidade: "Boa Vista", ativo: true },
      {
        id: "e2",
        edital: "50/2025",
        unidade: "Manaus",
        ativo: false,
      },
      { id: "e3", edital: "Treino", treinamento: true, ativo: true },
    ];

    it("em linha no cabeçalho: campo Edital, selo de treinamento e a classe da tela", async () => {
      const escolheu = vi.fn();
      await montar(
        h(SeletorDeEdital, {
          className: "avd-edital",
          tour: "seletor",
          editais: EDITAIS,
          escolhido: "e3",
          carregado: true,
          aoEscolher: escolheu,
        }),
      );
      const card = definido(
        $<HTMLElement>("section.ui-seletor-de-edital.avd-edital"),
      );
      expect(card.classList.contains("ui-card")).toBe(false);
      expect(card.getAttribute("aria-label")).toBe("Edital");
      const opcoes = [...card.querySelectorAll("option")].map(
        (o) => o.textContent,
      );
      expect(opcoes).toEqual([
        "Escolha o edital",
        "93/2026 - Boa Vista",
        "50/2025 - Manaus",
        "Treino · Treinamento",
      ]);
      expect(card.querySelector(".selo-de-treinamento")).not.toBeNull();
      expect(card.querySelector("input[type='checkbox']")).toBeNull();
      await escolher(card.querySelector("select[data-tour='seletor']"), "e1");
      expect(escolheu).toHaveBeenCalledWith("e1");
    });

    it("só vigentes: o inativo sai e volta com Mostrar todos; carregando e vazio", async () => {
      await montar(
        h(SeletorDeEdital, {
          editais: EDITAIS,
          escolhido: "",
          carregado: true,
          soVigentes: true,
          aoEscolher: () => {},
        }),
      );
      const valores = () =>
        [...document.querySelectorAll("option")].map((o) => o.value);
      expect(valores()).not.toContain("e2");
      await clicar($(".ui-seletor-todos input"));
      expect(valores()).toContain("e2");

      await act(async () =>
        definido(raiz).render(
          h(SeletorDeEdital, {
            editais: [],
            escolhido: "",
            carregado: false,
            aoEscolher: () => {},
          }),
        ),
      );
      expect($("option")?.textContent).toBe("Carregando…");
      expect($<HTMLSelectElement>("select")?.disabled).toBe(true);
      await act(async () =>
        definido(raiz).render(
          h(SeletorDeEdital, {
            editais: [],
            escolhido: "",
            carregado: true,
            vazio: "Nenhum edital com análises nesta área",
            aoEscolher: () => {},
          }),
        ),
      );
      expect($("option")?.textContent).toBe(
        "Nenhum edital com análises nesta área",
      );
    });
  });

  describe("Kpi com número grande", () => {
    it("o número é formatado pela tela; o detalhe longo leva o texto inteiro no title", async () => {
      await montar(
        h(Kpi, {
          chave: "lote",
          rotulo: "Lote",
          valor: (1512).toLocaleString("pt-BR"),
          detalhe: "1.511 pela regra · 1 por decisão",
        }),
      );
      expect($(".ui-kpi-valor")?.textContent).toBe("1.512");
      expect($(".ui-kpi-detalhe")?.title).toBe(
        "1.511 pela regra · 1 por decisão",
      );
    });
  });
});

bloco("ui/layout-da-selecao", () => {
  /*
  O layout das telas da seleção (Triagem, Avaliação documental e
  Classificação): o cabeçalho da tela, a faixa de situação com os
  números-filtro e a barra da distribuição, a barra da lista com "Filtros" e
  a tabela com 50 e mais 50 ao chegar no fim da rolagem ("Mostrando N de M").
*/

  let raiz: Root | null = null;
  async function montar(elemento: ReactElement) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      const novaRaiz = createRoot(definido(document.getElementById("raiz")));
      raiz = novaRaiz;
      novaRaiz.render(elemento);
    });
  }
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });
  const $ = <E extends Element = HTMLElement>(seletor: string) =>
    document.querySelector<E>(seletor);
  const $$ = <E extends Element = HTMLElement>(seletor: string) => [
    ...document.querySelectorAll<E>(seletor),
  ];

  describe("CabecalhoDaTela", () => {
    it("trilha, título, edital, seções e o Atualizar só com o ícone", async () => {
      const aoAtualizar = vi.fn();
      await montar(
        h(CabecalhoDaTela, {
          trilha: "Projetos / Seleção",
          titulo: "Avaliação documental",
          edital: h("select", { "aria-label": "Edital" }),
          secoes: h("nav", { "data-secoes": "" }),
          aoAtualizar,
        }),
      );
      expect($(".ui-cabecalho-trilha")?.textContent).toBe("Projetos / Seleção");
      expect($(".ui-cabecalho-titulo")?.textContent).toBe(
        "Avaliação documental",
      );
      expect($(".ui-cabecalho-edital select")).not.toBeNull();
      const atualizar = definido($("[data-acao='atualizar']"));
      expect(atualizar.getAttribute("aria-label")).toBe("Atualizar");
      expect(atualizar.textContent).toBe("");
      await clicar(atualizar);
      expect(aoAtualizar).toHaveBeenCalledTimes(1);
    });
  });

  describe("FaixaDeSituacao", () => {
    function Faixa() {
      const [ativo, setAtivo] = useState("lote");
      const linhas: [string, string, number, string][] = [
        ["lote", "No lote", 1512, "neutro"],
        ["pendentes", "Pendentes", 214, "alerta"],
        ["concluidas", "Concluídas", 1248, "sucesso"],
      ];
      const itens = linhas.map(([chave, rotulo, valor, tom]): ItemDaFaixa => ({
        chave,
        rotulo,
        valor,
        tom,
        contexto: chave === "lote" ? "" : porcentagemDe(valor, 1512),
        ativo: ativo === chave,
        aoClicar: () => setAtivo(chave),
      }));
      return h(
        FaixaDeSituacao,
        {
          rotulo: "Situação do lote",
          itens,
          rotuloDaDistribuicao: "Distribuição do lote",
          totalDaDistribuicao: 1512,
          distribuicao: [
            { chave: "c", rotulo: "Concluídas", valor: 1248, tom: "sucesso" },
            { chave: "p", rotulo: "Pendentes", valor: 214, tom: "alerta" },
          ],
        },
        h("a", { href: "#" }, "fora do lote"),
      );
    }

    it("cada número é um filtro (aria-pressed), com o contexto embaixo; a barra diz a proporção", async () => {
      await montar(h(Faixa));
      const item = (chave: string) =>
        definido($(`.ui-faixa-item[data-valor='${chave}']`));
      expect(item("lote").getAttribute("aria-pressed")).toBe("true");
      expect(item("lote").querySelector(".ui-faixa-numero")?.textContent).toBe(
        "1.512",
      );
      expect(
        item("pendentes").querySelector(".ui-faixa-contexto")?.textContent,
      ).toBe("14,1%");
      await clicar(item("pendentes"));
      expect(item("pendentes").getAttribute("aria-pressed")).toBe("true");
      expect(item("lote").getAttribute("aria-pressed")).toBe("false");
      const barra = definido($(".ui-faixa-barra"));
      expect(barra.getAttribute("role")).toBe("img");
      expect(barra.getAttribute("aria-label")).toBe(
        "Distribuição do lote: 82,5% concluídas, 14,1% pendentes",
      );
      // O que as partes não cobrem (3,3% do lote) fica vazio na barra.
      expect(
        $$(".ui-faixa-barra > span").map((s) => s.style.width.slice(0, 5)),
      ).toEqual(["82.53", "14.15"]);
      expect($(".ui-faixa-linha a")?.textContent).toBe("fora do lote");
    });

    it("número carregando vira skeleton; distribuição sem dados", async () => {
      await montar(
        h(FaixaDeSituacao, {
          rotulo: "Situação",
          itens: [
            { chave: "x", rotulo: "Inscritos", valor: null, tom: "info" },
          ],
        }),
      );
      expect($(".ui-faixa-numero.ui-esqueleto")).not.toBeNull();
      // Sem aoClicar, o número não é botão.
      expect($("button.ui-faixa-item")).toBeNull();
      expect($(".ui-faixa-linha")).toBeNull();
      expect(textoDaDistribuicao([], "Distribuição")).toBe(
        "Distribuição: sem dados",
      );
    });
  });

  describe("Selo com ponto", () => {
    it("a bolinha na cor do texto antes do rótulo", async () => {
      await montar(h(Selo, { tom: "pendente", ponto: true }, "Pendente"));
      expect($(".ui-selo .ui-ponto")).not.toBeNull();
      expect($(".ui-selo")?.textContent).toBe("Pendente");
    });
  });

  describe("BarraDaLista", () => {
    function Barra() {
      const [busca, setBusca] = useState("");
      const [vaga, setVaga] = useState("");
      const [modalidade, setModalidade] = useState("");
      return h(
        BarraDaLista,
        {
          rotulo: "Encontrar a pessoa",
          busca: {
            valor: busca,
            aoMudar: setBusca,
            placeholder: "Buscar por código ou nome",
            rotulo: "Buscar pessoa",
          },
          quantos: [busca, vaga, modalidade].filter(Boolean).length,
          aoLimpar: () => {
            setBusca("");
            setVaga("");
            setModalidade("");
          },
          quantosSecundarios: modalidade ? 1 : 0,
          secundarios: h(
            "select",
            {
              "aria-label": "Modalidade",
              value: modalidade,
              onChange: (ev: ChangeEvent<HTMLSelectElement>) =>
                setModalidade(ev.target.value),
            },
            h("option", { value: "" }, "Todas as modalidades"),
            h("option", { value: "PCD" }, "PcD"),
          ),
          acoes: h("button", { type: "button", "data-principal": "" }, "Pegar"),
        },
        h(
          "select",
          {
            "aria-label": "Vaga",
            value: vaga,
            onChange: (ev: ChangeEvent<HTMLSelectElement>) =>
              setVaga(ev.target.value),
          },
          h("option", { value: "" }, "Todas as vagas"),
          h("option", { value: "10" }, "10"),
        ),
      );
    }

    it("busca, filtros em linha, Filtros com os secundários e Limpar só com filtro", async () => {
      await montar(h(Barra));
      expect($(".ui-barra-da-lista")?.getAttribute("role")).toBe("search");
      expect($("[data-acao='limpar-filtros']")).toBeNull();
      expect($("select[aria-label='Modalidade']")).toBeNull();
      await clicar($("[data-acao='mais-filtros']"));
      const modalidade = $<HTMLSelectElement>(
        "select[aria-label='Modalidade']",
      );
      expect(modalidade).not.toBeNull();
      await act(async () => {
        const set = definido(
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")
            ?.set,
        );
        set.call(modalidade, "PCD");
        definido(modalidade).dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      });
      expect($("[data-acao='mais-filtros'] .ui-contagem")?.textContent).toBe(
        "1",
      );
      await digitar($(".ui-barra-busca input"), "Maria");
      await clicar($("[data-acao='limpar-filtros']"));
      expect($<HTMLInputElement>(".ui-barra-busca input")?.value).toBe("");
      expect($("[data-acao='limpar-filtros']")).toBeNull();
      expect($(".ui-barra-da-lista-acoes [data-principal]")).not.toBeNull();
    });
  });

  it('BarraDaLista: "/" leva à busca de fora de um campo; dentro de um campo, é só um caractere; Esc apaga', async () => {
    function Barra() {
      const [busca, setBusca] = useState("");
      return h(
        BarraDaLista,
        {
          rotulo: "Encontrar a pessoa",
          busca: {
            valor: busca,
            aoMudar: setBusca,
            placeholder: "Buscar",
            rotulo: "Buscar pessoa",
            acao: "buscar",
          },
          quantos: busca ? 1 : 0,
          aoLimpar: () => setBusca(""),
        },
        h(
          "select",
          { "aria-label": "Vaga" },
          h("option", { value: "" }, "Todas"),
        ),
      );
    }
    await montar(h(Barra));
    const busca = definido($<HTMLInputElement>("[data-acao='buscar']"));
    expect(busca.getAttribute("aria-keyshortcuts")).toBe("/");
    // O jsdom não calcula layout: a barra "está à vista" pelo offsetParent.
    Object.defineProperty(busca, "offsetParent", {
      configurable: true,
      get: () => document.body,
    });
    await teclar(document.body, "/");
    expect(document.activeElement).toBe(busca);
    const select = definido($<HTMLElement>(".ui-barra-da-lista select"));
    select.focus();
    await teclar(select, "/");
    expect(document.activeElement).toBe(select);
    await digitar(busca, "maria");
    await teclar(busca, "Escape");
    expect(busca.value).toBe("");
  });

  describe("TabelaDaLista (rolagem de 50 em 50)", () => {
    type Pessoa = { id: string; grupo?: string };
    const pessoas = (n: number): Pessoa[] =>
      Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));
    const colunas = [{ rotulo: "Código", chave: "codigo" }];
    const linha = (p: Pessoa) =>
      h("tr", { key: p.id, "data-id": p.id }, h("td", null, p.id));
    function Lista({
      itens,
      recorte = "a",
      ...resto
    }: { itens: Pessoa[]; recorte?: string } & Partial<
      PropriedadesDaTabelaDaLista<Pessoa>
    >) {
      return h(
        CardDaLista,
        { rotulo: "Pessoas" },
        h(TabelaDaLista<Pessoa>, {
          rotulo: "Pessoas",
          colunas,
          itens,
          linha,
          carregado: true,
          vazio: "Nenhuma pessoa com esses filtros.",
          chaveDoRecorte: recorte,
          ...resto,
        }),
      );
    }
    const ids = () => $$("tbody tr[data-id]").map((tr) => tr.dataset.id);

    /*
    IntersectionObserver falso: guarda os observadores vivos; `chegarAoFim`
    avisa que o fim da caixa entrou à vista (o que a rolagem faria).
  */
    class ObservadorFalso implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];
      aviso: IntersectionObserverCallback;
      opcoes: IntersectionObserverInit | undefined;
      alvos: Element[];
      constructor(
        aviso: IntersectionObserverCallback,
        opcoes?: IntersectionObserverInit,
      ) {
        this.aviso = aviso;
        this.opcoes = opcoes;
        this.alvos = [];
        observadores.push(this);
      }
      observe(alvo: Element) {
        this.alvos.push(alvo);
      }
      disconnect() {
        observadores = observadores.filter((o) => o !== this);
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    }
    let observadores: ObservadorFalso[] = [];
    const original = globalThis.IntersectionObserver;
    beforeEach(() => {
      observadores = [];
      globalThis.IntersectionObserver = ObservadorFalso;
    });
    afterEach(() => {
      globalThis.IntersectionObserver = original;
    });
    const chegarAoFim = () =>
      act(async () => {
        for (const o of [...observadores])
          // Só `target` e `isIntersecting`, os campos que a tabela lê.
          Reflect.apply(o.aviso, o, [
            o.alvos.map((target) => ({ target, isIntersecting: true })),
          ]);
      });

    it("mostra 50 e mais 50 ao chegar no fim da rolagem; o recorte novo volta ao começo", async () => {
      const itens = pessoas(120);
      await montar(h(Lista, { itens }));
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 50 de 120");
      expect(ids()).toHaveLength(50);
      // Sem botões de página: só a rolagem.
      expect($("[data-acao='pagina-proxima']")).toBeNull();
      // O sentinela fica no fim da caixa que rola, que é a raiz do observador.
      const [observador] = observadores;
      expect(observador?.alvos[0]?.className).toBe("ui-lista-fim");
      expect(observador?.opcoes?.root).toBe($(".ui-lista-rolagem"));
      await chegarAoFim();
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 100 de 120");
      expect(ids()).toHaveLength(100);
      expect(ids()[0]).toBe("1");
      await chegarAoFim();
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 120 de 120");
      // Tudo à vista: ninguém mais observa o fim.
      expect(observadores).toHaveLength(0);
      // Releitura (a mesma lista, o mesmo recorte): continua com o que estava à vista.
      await act(async () =>
        definido(raiz).render(h(Lista, { itens: [...itens] })),
      );
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 120 de 120");
      // Filtro novo: volta às primeiras 50.
      await act(async () =>
        definido(raiz).render(h(Lista, { itens: pessoas(60), recorte: "b" })),
      );
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 50 de 60");
      // A tabela rola de lado no celular (não vira cartões).
      expect($("table")?.dataset.mobileTable).toBe("scroll");
    });

    it("vazia: Ninguém por aqui e a linha da tela; exportar desligado", async () => {
      const excel = vi.fn();
      await montar(h(Lista, { itens: [], exportacao: { excel } }));
      expect($(".ui-lista-vazia")?.textContent).toBe(
        "Ninguém por aquiNenhuma pessoa com esses filtros.",
      );
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 0 de 0");
      expect(
        $<HTMLButtonElement>("[data-acao='exportar-excel']")?.disabled,
      ).toBe(true);
    });

    it("no banco: chegar ao fim pede a página seguinte, uma vez enquanto ela vem", async () => {
      const carregarMais = vi.fn();
      const servidor = {
        total: 75,
        temMais: true,
        carregando: false,
        carregarMais,
      };
      await montar(h(Lista, { itens: pessoas(50), servidor }));
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 50 de 75");
      await chegarAoFim();
      expect(carregarMais).toHaveBeenCalledTimes(1);
      // Carregando: o rodapé diz e o fim não pede de novo.
      await act(async () =>
        definido(raiz).render(
          h(Lista, {
            itens: pessoas(50),
            servidor: { ...servidor, carregando: true },
          }),
        ),
      );
      expect($(".ui-lista-contagem")?.textContent).toBe(
        "Carregando mais… 50 de 75",
      );
      await chegarAoFim();
      expect(carregarMais).toHaveBeenCalledTimes(1);
      await act(async () =>
        definido(raiz).render(
          h(Lista, {
            itens: pessoas(75),
            servidor: { ...servidor, temMais: false },
          }),
        ),
      );
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 75 de 75");
      expect(ids()).toHaveLength(75);
    });

    it("agrupada: o cabeçalho de cada grupo; o recolhido só pelo cabeçalho", async () => {
      const itens = [
        ...pessoas(3).map((p) => ({ ...p, grupo: "A" })),
        ...pessoas(2).map((p) => ({ id: `b${p.id}`, grupo: "B" })),
      ];
      const grupo = {
        chave: (p: Pessoa) => definido(p.grupo),
        cabecalho: (chave: string, quantos: number) => `${chave} (${quantos})`,
        recolhidos: new Set(["A"]),
        aoAlternar: vi.fn(),
      };
      await montar(h(Lista, { itens, grupo }));
      expect($$("tr.ui-tabela-grupo").map((tr) => tr.textContent)).toEqual([
        "A (3)",
        "B (2)",
      ]);
      expect(ids()).toEqual(["b1", "b2"]);
      expect($(".ui-lista-contagem")?.textContent).toBe("Mostrando 2 de 2");
      await clicar($("tr.ui-tabela-grupo button"));
      expect(grupo.aoAlternar).toHaveBeenCalledWith("A");
    });
  });
});

bloco("ui/tabela-com-erro", () => {
  /*
  TabelaInfinita com a leitura falha (norma 12.3): o erro toma o lugar do
  esqueleto, com "Tentar novamente"; sem erro e sem carga, o esqueleto continua.
*/
  interface Linha {
    nome: string;
  }

  let raiz: Root | null = null;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });
  const $ = (seletor: string) => document.querySelector<HTMLElement>(seletor);

  const props = (
    extra: Partial<PropriedadesDaTabelaInfinita<Linha>> = {},
  ): PropriedadesDaTabelaInfinita<Linha> => ({
    idDoTitulo: "tabelaTitulo",
    titulo: "Fila",
    carregado: false,
    itens: [],
    filtrarPelaBusca: (itens) => itens,
    colunas: [{ rotulo: "Nome" }],
    linha: (item) => h("tr", { key: item.nome }, h("td", null, item.nome)),
    informacao: (quantos) => (quantos === null ? "Carregando…" : `${quantos}`),
    total: 0,
    vazio: "Nada carregado.",
    ...extra,
  });

  async function montar(elemento: ReactElement) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      const novaRaiz = createRoot(definido(document.getElementById("raiz")));
      raiz = novaRaiz;
      novaRaiz.render(elemento);
    });
  }

  describe("TabelaInfinita com erro de leitura", () => {
    it("com erro, mostra a mensagem no lugar do esqueleto e o botão tenta de novo", async () => {
      const tentarDeNovo = vi.fn();
      await montar(
        h(
          TabelaInfinita<Linha>,
          props({
            erro: {
              mensagem: "Falha simulada",
              oQue: "os editais",
              tentarDeNovo,
            },
          }),
        ),
      );
      const aviso = definido($('[role="alert"]'));
      expect(aviso.textContent).toContain(
        "Não foi possível carregar os editais",
      );
      expect(aviso.textContent).toContain("Falha simulada");
      expect(document.querySelector(".ui-esqueleto")).toBeNull();
      expect($("[data-tabela-contagem]")?.textContent).toBe("");
      expect($("[data-tabela-mostrando]")?.textContent).toBe("");

      await clicar($('[data-acao="tentar-novamente"]'));
      expect(tentarDeNovo).toHaveBeenCalledTimes(1);
    });

    it("sem tentarDeNovo, a mensagem aparece sem botão", async () => {
      await montar(
        h(TabelaInfinita<Linha>, props({ erro: { mensagem: "Falha" } })),
      );
      expect($('[role="alert"]')?.textContent).toContain("esta lista");
      expect($('[data-acao="tentar-novamente"]')).toBeNull();
    });

    it("sem erro e sem carga, continua o esqueleto", async () => {
      await montar(h(TabelaInfinita<Linha>, props({ erro: null })));
      expect($('[role="alert"]')).toBeNull();
      expect(document.querySelector(".ui-esqueleto")).not.toBeNull();
      expect($("[data-tabela-mostrando]")?.textContent).toBe(
        "Mostrando 0 de 0 registros",
      );
      expect($("[data-tabela-contagem]")?.textContent).toBe("Carregando…");
    });
  });
});

bloco("ui/tabela-no-servidor", () => {
  /*
  TabelaInfinita com o banco (usarListaNoServidor): 50 linhas por vez, "N de
  M" com o total do recorte que o banco manda, a próxima página ao rolar (ou
  "Carregar mais"), recomeço quando a chave (filtro) muda e resposta velha
  descartada.
*/
  let raiz: Root | null = null;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });
  const $ = (seletor: string) => document.querySelector<HTMLElement>(seletor);
  const linhas = () => document.querySelectorAll(".ui-tabela-rolagem tbody tr");
  const esperar = () => act(async () => new Promise((r) => setTimeout(r, 0)));

  /* Um "banco" de 120 linhas, filtrável, com cursor = último número. */
  type Linha = { n: number };

  function criarBanco(total = 120) {
    const todos = Array.from({ length: total }, (_, i) => ({ n: i + 1 }));
    const pedidos: { filtro: string; apos: unknown; limite: number }[] = [];
    const buscar =
      (filtro: string): BuscarPagina<Linha> =>
      async (apos, limite) => {
        pedidos.push({ filtro, apos, limite });
        const recorte = filtro ? todos.filter((x) => x.n % 2 === 0) : todos;
        const inicio =
          apos === null ? 0 : recorte.findIndex((x) => x.n > Number(apos));
        const pagina = recorte.slice(inicio, inicio + limite);
        return {
          linhas: pagina,
          proximo:
            inicio + limite < recorte.length
              ? definido(pagina[pagina.length - 1]).n
              : null,
          total: recorte.length,
        };
      };
    return { buscar, pedidos };
  }

  function Tela({
    banco,
    filtroInicial = "",
  }: {
    banco: ReturnType<typeof criarBanco>;
    filtroInicial?: string;
  }) {
    const [filtro, setFiltro] = useState(filtroInicial);
    const lista = usarListaNoServidor(banco.buscar(filtro), `f:${filtro}`);
    return h(
      "div",
      null,
      h("button", { id: "pares", onClick: () => setFiltro("pares") }, "pares"),
      h(TabelaInfinita<Linha>, {
        idDoTitulo: "t",
        titulo: "Eliminados",
        colunas: [{ rotulo: "N" }],
        carregado: lista.carregado,
        itens: lista.itens,
        filtrarPelaBusca: (itens) => itens,
        linha: (x) => h("tr", { key: x.n }, h("td", null, x.n)),
        informacao: (quantos) =>
          quantos === null ? "" : `${quantos} no recorte`,
        total: 120,
        vazio: "Nada.",
        servidor: lista,
      }),
    );
  }

  async function montar(elemento: ReactElement) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      const novaRaiz = createRoot(definido(document.getElementById("raiz")));
      raiz = novaRaiz;
      novaRaiz.render(elemento);
    });
    await esperar();
  }

  describe("TabelaInfinita com o banco em páginas", () => {
    it("desenha a primeira página de 50 e diz o total do recorte", async () => {
      const banco = criarBanco();
      await montar(h(Tela, { banco }));
      expect(linhas()).toHaveLength(50);
      expect($("[data-tabela-mostrando]")?.textContent).toBe(
        "Mostrando 50 de 120 registros",
      );
      expect($("[data-tabela-contagem]")?.textContent).toBe("120 no recorte");
      expect(banco.pedidos).toEqual([{ filtro: "", apos: null, limite: 50 }]);
    });

    it("pede a próxima página ao rolar até o fim e para quando acaba", async () => {
      const banco = criarBanco();
      await montar(h(Tela, { banco }));
      const rolagem = definido($(".ui-tabela-rolagem"));
      Object.defineProperty(rolagem, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(rolagem, "clientHeight", {
        value: 400,
        configurable: true,
      });
      rolagem.scrollTop = 600;
      await act(async () =>
        rolagem.dispatchEvent(new Event("scroll", { bubbles: true })),
      );
      await esperar();
      expect(linhas()).toHaveLength(100);
      expect(banco.pedidos[1]).toEqual({ filtro: "", apos: 50, limite: 50 });
      await clicar($('[data-acao="carregar-mais"]'));
      await esperar();
      expect(linhas()).toHaveLength(120);
      expect($('[data-acao="carregar-mais"]')).toBeNull();
      expect($(".ui-tabela-status")?.textContent).toBe(
        "Todos os 120 registros do recorte foram carregados",
      );
      expect(banco.pedidos).toHaveLength(3);
    });

    it("filtro novo recomeça da primeira página", async () => {
      const banco = criarBanco();
      await montar(h(Tela, { banco }));
      await clicar($('[data-acao="carregar-mais"]'));
      await esperar();
      await clicar($("#pares"));
      await esperar();
      expect(linhas()).toHaveLength(50);
      expect($("[data-tabela-mostrando]")?.textContent).toBe(
        "Mostrando 50 de 60 registros",
      );
      expect(banco.pedidos.at(-1)).toEqual({
        filtro: "pares",
        apos: null,
        limite: 50,
      });
    });

    it("descarta a resposta de um filtro que já mudou", async () => {
      let soltarPrimeira: (() => void) | undefined;
      const lenta = vi.fn(
        (_apos: unknown, _limite: number) =>
          new Promise<PaginaDoServidor<Linha>>((r) => {
            soltarPrimeira = () =>
              r({ linhas: [{ n: 999 }], proximo: null, total: 1 });
          }),
      );
      const rapida = criarBanco(3).buscar("");
      function Troca() {
        const [qual, setQual] = useState("lenta");
        const lista = usarListaNoServidor(
          qual === "lenta" ? lenta : rapida,
          qual,
        );
        return h(
          "div",
          null,
          h("button", { id: "trocar", onClick: () => setQual("rapida") }, "t"),
          h("span", { id: "itens" }, lista.itens.map((x) => x.n).join(",")),
        );
      }
      await montar(h(Troca));
      await clicar($("#trocar"));
      await esperar();
      await act(async () => definido(soltarPrimeira)());
      await esperar();
      expect($("#itens")?.textContent).toBe("1,2,3");
    });
  });
});

bloco("ui/ui", () => {
  /* Uma linha das tabelas de teste. */
  type Linha = { nome: string; total?: number; vaga?: string };

  /*
  Os componentes de src/ui/ (o design system): render básico e a interação
  principal de cada um. Desenham para dentro do app: classes `.ui-*` e nenhum
  id fixo (o modo "no quadro", da transição da Etapa 2, saiu com a Seleção).
*/

  let raiz: Root | null = null;

  async function montarNoApp(elemento: ReactElement) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      const novaRaiz = createRoot(definido(document.getElementById("raiz")));
      raiz = novaRaiz;
      novaRaiz.render(elemento);
    });
  }

  async function redesenhar(elemento: ReactElement) {
    await act(async () => definido(raiz).render(elemento));
  }

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  const $ = <E extends Element = HTMLElement>(seletor: string) =>
    document.querySelector<E>(seletor);

  describe("TopoDoPainel", () => {
    it("sem exportacao, não mostra os botões de exportar; desativa Atualizar quando pedido", async () => {
      await montarNoApp(
        h(TopoDoPainel, {
          status: "",
          aoAtualizar: () => {},
          atualizarDesativado: true,
        }),
      );
      expect($(".ui-exportacao")).toBeNull();
      expect($<HTMLButtonElement>('[data-acao="atualizar"]')?.disabled).toBe(
        true,
      );
    });

    it("as visões entram antes do status e das ações", async () => {
      await montarNoApp(
        h(TopoDoPainel, {
          status: "Carga 01/10/2026",
          aoAtualizar: () => {},
          visoes: h("div", { className: "visoes" }, "abas"),
        }),
      );
      expect($(".ui-topo-titulo .visoes")?.textContent).toBe("abas");
      expect($(".ui-topo-titulo")?.nextElementSibling?.className).toBe(
        "ui-topo-acoes",
      );
    });
  });

  describe("PainelDeFiltros e chips", () => {
    it("recolhe e expande o corpo, avisa quem pediu, e resume os filtros", async () => {
      const aoRecolher = vi.fn();
      await montarNoApp(
        h(
          PainelDeFiltros,
          { idDoTitulo: "t", quantos: 2, aoRecolher },
          h("div", { className: "campos" }, "campos"),
        ),
      );
      expect($("section.ui-filtros")?.getAttribute("aria-labelledby")).toBe(
        "t",
      );
      expect($(".ui-filtros-resumo")?.textContent).toContain(
        "2 filtros adicionais",
      );
      expect($(".ui-filtros-corpo .campos")?.textContent).toBe("campos");
      // Nasce recolhido: os campos ficam no corpo, escondido até abrir.
      const recolher = definido(
        $<HTMLElement>('[data-acao="recolher-filtros"]'),
      );
      expect(recolher.getAttribute("aria-expanded")).toBe("false");
      expect($(".ui-filtros-corpo")?.hidden).toBe(true);
      await clicar(recolher);
      expect($(".ui-filtros-corpo")?.hidden).toBe(false);
      expect(aoRecolher).toHaveBeenLastCalledWith(false);
      await clicar(recolher);
      expect(recolher.getAttribute("aria-expanded")).toBe("false");
      expect(aoRecolher).toHaveBeenLastCalledWith(true);
    });

    it("sem filtro ativo, Limpar tudo fica desativado", async () => {
      await montarNoApp(h(PainelDeFiltros, { idDoTitulo: "t", quantos: 0 }));
      expect(
        $<HTMLButtonElement>('[data-acao="limpar-filtros"]')?.disabled,
      ).toBe(true);
      expect($(".ui-filtros-resumo")?.textContent).toContain(
        "nenhum filtro adicional",
      );
    });

    it("não recolhível: só o título e os filhos, sem ações", async () => {
      await montarNoApp(
        h(
          PainelDeFiltros,
          { idDoTitulo: "t", className: "extra", recolhivel: false },
          h("p", { id: "filho" }, "x"),
        ),
      );
      expect($("section")?.className).toBe("ui-card ui-filtros extra");
      expect($('[data-acao="recolher-filtros"]')).toBeNull();
      expect($(".ui-filtros-corpo")).toBeNull();
      expect($("section > #filho")).not.toBeNull();
    });

    it("o chip mostra rótulo e valor e diz o que tira", async () => {
      await montarNoApp(
        h(
          ChipsDeFiltro,
          null,
          h(ChipDeFiltro, { rotulo: "Edital", aoTirar: () => {} }, "03/2025"),
        ),
      );
      const chip = definido($<HTMLElement>(".ui-chips .ui-chip"));
      expect(chip.querySelector("b")?.textContent).toBe("Edital");
      expect(chip.textContent).toContain("03/2025");
      expect(chip.title).toBe("Tirar o filtro Edital");
    });
  });

  describe("Kpi e GradeDeKpis", () => {
    it("card estático: sem botão, com o título; a grade leva id, classe e rótulo", async () => {
      await montarNoApp(
        h(
          GradeDeKpis,
          { id: "grade", rotulo: "Indicadores", className: "x" },
          h(Kpi, {
            chave: "total",
            cor: "k-cyan",
            rotulo: "Total",
            valor: "10",
            titulo: "Soma",
          }),
        ),
      );
      expect($("#grade")?.className).toBe("ui-kpis x");
      expect($("#grade")?.getAttribute("aria-label")).toBe("Indicadores");
      const total = definido($<HTMLElement>('[data-kpi="total"]'));
      expect(total.className).toBe("ui-kpi");
      expect(total.title).toBe("Soma");
      expect(total.querySelector("button")).toBeNull();
    });

    it("o texto do rótulo fica num span próprio, com o texto inteiro no title", async () => {
      const longo = "Aprovados na análise sem entrevista";
      await montarNoApp(
        h(GradeDeKpis, { rotulo: "Indicadores" }, [
          h(Kpi, { key: "a", chave: "a", rotulo: longo, valor: "3" }),
          h(Kpi, {
            key: "b",
            chave: "b",
            rotulo: longo,
            valor: "4",
            aoClicar: () => {},
          }),
        ]),
      );
      for (const chave of ["a", "b"]) {
        const texto = definido(
          $<HTMLElement>(`[data-kpi="${chave}"] .ui-kpi-rotulo .ui-kpi-texto`),
        );
        expect(texto.textContent).toBe(longo);
        expect(texto.title).toBe(longo);
        expect(
          texto.parentElement?.querySelector(".ui-kpi-icone"),
        ).not.toBeNull();
      }
    });

    it("atalho (sem `ativo`) não leva aria-pressed", async () => {
      await montarNoApp(
        h(Kpi, {
          chave: "a",
          rotulo: "A",
          valor: "1",
          titulo: "Ver a lista",
          aoClicar: () => {},
        }),
      );
      const botao = definido($<HTMLElement>("button"));
      expect(botao.hasAttribute("aria-pressed")).toBe(false);
      expect(botao.title).toBe("Ver a lista");
    });
  });

  describe("CardDeGrafico", () => {
    it("título e corpo, sem dica; como seção, para o bloco da linha inteira", async () => {
      await montarNoApp(
        h(
          "div",
          null,
          h(
            CardDeGrafico,
            { titulo: "Situação", className: "extra" },
            h("canvas", { id: "c" }),
          ),
          h(CardDeGrafico, { titulo: "T", elemento: "section" }),
        ),
      );
      const card = definido($<HTMLElement>("article"));
      expect(card.className).toBe("ui-card ui-card-de-grafico extra");
      expect(card.querySelector(".ui-grafico > #c")).not.toBeNull();
      expect(
        card.querySelector(".ui-grafico")?.hasAttribute("data-altura"),
      ).toBe(false);
      expect(card.querySelector(".hint, .eyebrow")).toBeNull();
      expect($("section.ui-card-de-grafico")).not.toBeNull();
    });
  });

  describe("TabelaInfinita", () => {
    const colunas = [
      { rotulo: "Nome", largura: "70%" },
      { rotulo: "Total", largura: "30%", numero: true },
    ];
    const pelaBusca = (itens: readonly Linha[], busca: string) =>
      itens.filter((item) => item.nome.includes(busca));
    const props = (
      extra: Partial<PropriedadesDaTabelaInfinita<Linha>> = {},
    ): PropriedadesDaTabelaInfinita<Linha> => ({
      idDoTitulo: "tabelaTitulo",
      titulo: "Fila",
      busca: { placeholder: "Buscar", rotulo: "Buscar na fila" },
      carregado: true,
      itens: [],
      filtrarPelaBusca: pelaBusca,
      colunas,
      linha: (item: Linha) =>
        h(
          "tr",
          { key: item.nome },
          h("td", null, item.nome),
          h("td", null, item.total),
        ),
      informacao: (quantos: number | null) =>
        quantos === null ? "Carregando…" : `${quantos}`,
      total: 0,
      vazio: "Nada carregado.",
      ...extra,
    });
    const linhas = () =>
      document.querySelectorAll(".ui-tabela-rolagem tbody tr");

    it("recorte novo volta às 50 primeiras já no primeiro desenho (sem desenhar o limite antigo)", async () => {
      const muitos = Array.from({ length: 300 }, (_, i) => ({
        nome: `n${i}`,
        total: i,
      }));
      await montarNoApp(
        h(
          TabelaInfinita<Linha>,
          props({ itens: muitos, total: muitos.length }),
        ),
      );
      await clicar($('[data-acao="carregar-mais"]'));
      await clicar($('[data-acao="carregar-mais"]'));
      expect(linhas()).toHaveLength(150);
      const desenhadas: string[] = [];
      const invertidos = [...muitos].reverse();
      await redesenhar(
        h(
          TabelaInfinita<Linha>,
          props({
            itens: invertidos,
            total: invertidos.length,
            linha: (item: Linha) => {
              desenhadas.push(item.nome);
              return h("tr", { key: item.nome }, h("td", null, item.nome));
            },
          }),
        ),
      );
      expect(linhas()).toHaveLength(50);
      // Só as 50 do recorte novo foram desenhadas, e não 150.
      expect(desenhadas).toHaveLength(50);
    });

    it("carregando: esqueleto, busca desligada e a informação de carga", async () => {
      await montarNoApp(h(TabelaInfinita<Linha>, props({ carregado: false })));
      expect($<HTMLInputElement>(".ui-tabela-busca")?.disabled).toBe(true);
      expect($("[data-tabela-mostrando]")?.textContent).toBe(
        "Mostrando 0 de 0 registros",
      );
      expect($("[data-tabela-contagem]")?.textContent).toBe("Carregando…");
      expect(
        document.querySelectorAll('tbody tr[aria-hidden="true"] .ui-esqueleto')
          .length,
      ).toBe(16);
      expect($("th.num")?.textContent).toBe("Total");
      expect($(".ui-tabela-status")).toBeNull();
    });

    it("vazio: a mensagem de nada carregado, ou 'Nenhum registro' quando a busca esvazia", async () => {
      await montarNoApp(h(TabelaInfinita<Linha>, props()));
      expect($("tbody td.ui-vazio")?.textContent).toBe("Nada carregado.");
      expect($<HTMLTableCellElement>("tbody td.ui-vazio")?.colSpan).toBe(2);

      await redesenhar(
        h(
          TabelaInfinita<Linha>,
          props({ itens: [{ nome: "Ana", total: 1 }], total: 1 }),
        ),
      );
      await digitar($(".ui-tabela-busca"), "Zé");
      expect($("tbody td.ui-vazio")?.textContent).toBe(
        "Nenhum resultado para os filtros aplicados.",
      );
    });

    it("mostra 50 por vez e carrega mais ao rolar perto do fim", async () => {
      const itens = Array.from({ length: 120 }, (_, i) => ({
        nome: `Pessoa ${i}`,
        total: i,
      }));
      await montarNoApp(h(TabelaInfinita<Linha>, props({ itens, total: 120 })));
      expect(linhas().length).toBe(50);
      expect($("[data-tabela-mostrando]")?.textContent).toBe(
        "Mostrando 50 de 120 registros",
      );
      expect($("[data-tabela-contagem]")?.textContent).toBe("120");
      expect($(".ui-tabela-status")?.textContent).toBe("50 de 120 registros");

      const caixa = definido($<HTMLElement>(".ui-tabela-rolagem"));
      Object.defineProperty(caixa, "scrollHeight", { value: 1000 });
      Object.defineProperty(caixa, "clientHeight", { value: 400 });
      caixa.scrollTop = 500;
      await act(async () => {
        caixa.dispatchEvent(new Event("scroll"));
      });
      expect(linhas().length).toBe(100);
    });

    it("agrupada: cabeçalho por grupo com a contagem; recolher deixa só o cabeçalho; sem busca, sem o campo", async () => {
      const itens = [
        { nome: "Ana", total: 1, vaga: "A" },
        { nome: "Bia", total: 2, vaga: "A" },
        { nome: "Caio", total: 3, vaga: "B" },
      ];
      const aoAlternar = vi.fn();
      const grupo = (recolhidos = new Set<string>()): GrupoDaTabela<Linha> => ({
        chave: (item) => definido(item.vaga),
        cabecalho: (chave, quantos) => `Vaga ${chave} (${quantos})`,
        recolhidos,
        aoAlternar,
      });
      await montarNoApp(
        h(
          TabelaInfinita<Linha>,
          props({ itens, total: 3, busca: null, grupo: grupo() }),
        ),
      );
      expect($(".ui-tabela-busca")).toBeNull();
      const cabecalhos = () =>
        [...document.querySelectorAll("tbody tr.ui-tabela-grupo")].map(
          (tr) => tr.textContent,
        );
      expect(cabecalhos()).toEqual(["Vaga A (2)", "Vaga B (1)"]);
      expect(linhas()).toHaveLength(5);
      expect($<HTMLTableCellElement>("tr.ui-tabela-grupo th")?.colSpan).toBe(2);
      await clicar($("tr[data-grupo='A'] button"));
      expect(aoAlternar).toHaveBeenCalledWith("A");
      await redesenhar(
        h(
          TabelaInfinita<Linha>,
          props({ itens, total: 3, busca: null, grupo: grupo(new Set(["A"])) }),
        ),
      );
      expect(cabecalhos()).toEqual(["Vaga A (2)", "Vaga B (1)"]);
      expect(linhas()).toHaveLength(3);
      expect(
        $("tr[data-grupo='A'] button")?.getAttribute("aria-expanded"),
      ).toBe("false");
    });
  });

  describe("MenuDeAcoes", () => {
    it("abre a lista, escolhe a ação e fecha; desabilitada fica à vista; Esc fecha", async () => {
      const distribuir = vi.fn();
      await montarNoApp(
        h(MenuDeAcoes, {
          rotulo: "Ações da coordenação",
          contagem: 2,
          acoes: [
            {
              id: "d",
              rotulo: "Distribuir",
              aoEscolher: distribuir,
              dados: { "data-acao": "distribuir" },
            },
            {
              id: "l",
              rotulo: "Liberar",
              aoEscolher: () => {},
              desabilitado: true,
            },
          ],
        }),
      );
      const botao = definido($<HTMLElement>("[data-acao='abrir-menu']"));
      expect(botao.textContent).toContain("Ações da coordenação");
      expect($(".ui-contagem")?.textContent).toBe("2");
      expect($("[role='menu']")).toBeNull();
      await clicar(botao);
      expect(botao.getAttribute("aria-expanded")).toBe("true");
      const itens =
        document.querySelectorAll<HTMLButtonElement>("[role='menuitem']");
      expect([...itens].map((b) => b.textContent)).toEqual([
        "Distribuir",
        "Liberar",
      ]);
      expect(itens[1]?.disabled).toBe(true);
      expect(document.activeElement).toBe(itens[0]);
      await clicar($("[data-acao='distribuir']"));
      expect(distribuir).toHaveBeenCalledTimes(1);
      expect($("[role='menu']")).toBeNull();
      await clicar(botao);
      await teclar(definido($("[role='menu']")), "Escape");
      expect($("[role='menu']")).toBeNull();
    });
  });

  describe("MenuDeAcoes compacto (o ⋯ da linha)", () => {
    const caixaEm = (topo: number) => ({
      top: topo,
      bottom: topo + 30,
      left: 900,
      right: 930,
      width: 30,
      height: 30,
      x: 900,
      y: topo,
      toJSON: () => ({}),
    });

    it("perto do topo abre para baixo; perto do fim abre para cima, sem o top do CSS (16/11/2026)", async () => {
      vi.stubGlobal("innerHeight", 1000);
      vi.stubGlobal("innerWidth", 1600);
      const acoes = [
        { id: "c", rotulo: "Copiar código", aoEscolher: () => {} },
      ];
      await montarNoApp(
        h(MenuDeAcoes, { compacto: true, rotulo: "Mais ações", acoes }),
      );
      const botao = definido($<HTMLElement>("[data-acao='abrir-menu']"));

      botao.getBoundingClientRect = () => caixaEm(100) as DOMRect;
      await clicar(botao);
      let lista = definido($<HTMLElement>("[role='menu']"));
      expect(lista.style.position).toBe("fixed");
      expect(lista.style.top).toBe("134px");
      expect(lista.style.bottom).toBe("auto");
      expect(lista.style.right).toBe("auto");
      await clicar(botao);

      botao.getBoundingClientRect = () => caixaEm(800) as DOMRect;
      await clicar(botao);
      lista = definido($<HTMLElement>("[role='menu']"));
      expect(lista.style.bottom).toBe("204px");
      expect(lista.style.top).toBe("auto");
      expect(lista.style.right).toBe("auto");
      vi.unstubAllGlobals();
    });
  });

  describe("Gaveta", () => {
    it("classes extras no fundo e no cartão; sem sobretítulo nem resumo, eles não aparecem", async () => {
      await montarNoApp(
        h(
          Gaveta,
          {
            id: "g",
            tituloId: "gt",
            aoFechar: () => {},
            className: "extra",
            cartaoClassName: "larga",
            titulo: "Modelos",
            rotuloDoFechar: "Fechar",
          },
          h("p", { id: "corpo" }, "corpo"),
        ),
      );
      const fundo = definido(document.getElementById("g"));
      expect(fundo.className).toBe("modal ui-gaveta-fundo extra show");
      expect(fundo.getAttribute("aria-labelledby")).toBe("gt");
      expect(fundo.querySelector(".modal-card")?.className).toBe(
        "modal-card ui-gaveta larga",
      );
      expect($("#gt")?.textContent).toBe("Modelos");
      expect($("#corpo")).not.toBeNull();
      expect($(".ui-gaveta-sobretitulo")).toBeNull();
      expect($(".ui-gaveta-resumo")).toBeNull();
    });
  });

  describe("Aviso, Campo, Selo e estados", () => {
    it("Aviso: tom, papel e o elemento pedido", async () => {
      await montarNoApp(
        h(
          "div",
          null,
          h(Aviso, { tom: "danger", papel: "alert" }, "Falhou"),
          h(Aviso, { como: "p", className: "recursos-aviso" }, "Info"),
        ),
      );
      const [erro, info] = document.querySelectorAll<HTMLElement>(".ui-aviso");
      expect(erro?.tagName).toBe("DIV");
      expect(erro?.dataset.tone).toBe("danger");
      expect(erro?.getAttribute("role")).toBe("alert");
      expect(info?.tagName).toBe("P");
      expect(info?.className).toBe("ui-aviso recursos-aviso");
      expect(info?.hasAttribute("data-tone")).toBe(false);
    });

    it("Campo: liga o rótulo ao controle, marca o erro e mostra a dica", async () => {
      await montarNoApp(
        h(
          Campo,
          {
            rotulo: "Motivo",
            obrigatorio: true,
            dica: "3 a 500 caracteres",
            erro: "Obrigatório",
            largo: true,
          },
          h("textarea", { defaultValue: "" }),
        ),
      );
      const campo = definido($<HTMLElement>(".ui-campo"));
      expect(campo.classList.contains("ui-campo-largo")).toBe(true);
      const rotulo = definido(campo.querySelector("label"));
      const controle = definido(campo.querySelector("textarea"));
      expect(rotulo.htmlFor).toBe(controle.id);
      expect(rotulo.textContent).toBe("Motivo *");
      expect(controle.getAttribute("aria-invalid")).toBe("true");
      expect($(".ui-campo-dica")?.textContent).toBe("3 a 500 caracteres");
      expect($(".ui-campo-erro[role=alert]")?.textContent).toContain(
        "Obrigatório",
      );
    });

    it("Campo: mantém o id que o controle já tem", async () => {
      await montarNoApp(
        h(Campo, { rotulo: "Busca" }, h("input", { id: "filtro-busca" })),
      );
      expect($<HTMLLabelElement>("label")?.htmlFor).toBe("filtro-busca");
      expect($("input")?.hasAttribute("aria-invalid")).toBe(false);
    });

    it("Selo: neutro por padrão, título e classe extra", async () => {
      await montarNoApp(
        h(
          "div",
          null,
          h(Selo, null, "Sem análise"),
          h(
            Selo,
            { tom: "aprovado", titulo: "No prazo", className: "extra" },
            "OK",
          ),
        ),
      );
      const [neutro, aprovado] =
        document.querySelectorAll<HTMLElement>(".ui-selo");
      expect(neutro?.dataset.tom).toBe("neutro");
      expect(aprovado?.className).toBe("ui-selo extra");
      expect(aprovado?.title).toBe("No prazo");
    });

    it("Selo: `dados` vira data-*; valor indefinido não sai; o tom não é sobrescrito", async () => {
      await montarNoApp(
        h(
          Selo,
          {
            tom: "pendente",
            dados: { contratacao: "OUTRA_LISTA", vazio: undefined, tom: "x" },
          },
          "Convocado",
        ),
      );
      const selo = $<HTMLElement>(".ui-selo");
      expect(selo?.dataset.contratacao).toBe("OUTRA_LISTA");
      expect(selo?.hasAttribute("data-vazio")).toBe(false);
      expect(selo?.dataset.tom).toBe("alerta");
    });

    it("EstadoVazio e Carregando: a classe pedida no lugar de .ui-vazio", async () => {
      await montarNoApp(h(Carregando, { className: "ui-secao-vazio" }));
      expect($("#raiz > div")?.className).toBe("ui-secao-vazio");
    });
  });

  describe("Classes .ui-* e nenhum id fixo", () => {
    const IDS_DO_PAINEL_DE_ANALISES = [
      "topbar",
      "updatedText",
      "themeBtn",
      "fullBtn",
      "refreshBtn",
      "exportBtn",
      "filterSummary",
      "toggleFiltersBtn",
      "clearBtn",
      "filtersBody",
      "filterChips",
      "tableSearch",
      "tableInfo",
      "pageInfo",
      "tableBody",
    ];
    const idsDoPainelDeAnalises = () =>
      IDS_DO_PAINEL_DE_ANALISES.filter((id) => document.getElementById(id));

    it("TopoDoPainel: só status e ações; sem tema e tela cheia, sem esses botões", async () => {
      const aoAtualizar = vi.fn();
      const excel = vi.fn();
      const pdf = vi.fn();
      await montarNoApp(
        h(
          TopoDoPainel,
          {
            status: "Atualizado em 01/10/2026",
            aoAtualizar,
            exportacao: { excel, pdf },
          },
          h("button", { id: "extra" }, "Extra"),
        ),
      );
      const topo = definido($<HTMLElement>("header.ui-topo"));
      expect(topo).not.toBeNull();
      expect(topo.querySelector("h1, h2")).toBeNull();
      expect($(".ui-topo .status-discreto")?.textContent).toBe(
        "Atualizado em 01/10/2026",
      );
      expect($('[aria-label="Usar tema escuro"]')).toBeNull();
      expect($('[aria-label="Alternar tela cheia"]')).toBeNull();
      const excelBtn = definido($<HTMLElement>('[data-acao="exportar-excel"]'));
      const pdfBtn = definido($<HTMLElement>('[data-acao="salvar-pdf"]'));
      expect(excelBtn.textContent?.trim()).toBe("Exportar em Excel");
      expect(pdfBtn.textContent?.trim()).toBe("Salvar em PDF");
      expect(pdfBtn.closest(".ui-exportacao")?.nextElementSibling?.id).toBe(
        "extra",
      );
      await clicar($('[data-acao="atualizar"]'));
      await clicar(excelBtn);
      await clicar(pdfBtn);
      expect(aoAtualizar).toHaveBeenCalledTimes(1);
      expect(excel).toHaveBeenCalledTimes(1);
      expect(pdf).toHaveBeenCalledTimes(1);
      expect(idsDoPainelDeAnalises()).toEqual([]);
    });

    it("PainelDeFiltros e chips: card .ui-filtros, recolhe, limpa", async () => {
      const aoLimpar = vi.fn();
      const aoTirar = vi.fn();
      await montarNoApp(
        h(
          PainelDeFiltros,
          { idDoTitulo: "t", quantos: 1, aoLimpar },
          h(
            ChipsDeFiltro,
            null,
            h(ChipDeFiltro, { rotulo: "Edital", aoTirar }, "1"),
          ),
        ),
      );
      const painel = definido($<HTMLElement>("section.ui-card.ui-filtros"));
      expect(painel.querySelector("h2.ui-titulo")?.textContent).toBe(
        "Refinar resultados",
      );
      expect($(".ui-filtros-resumo.tem-filtros")?.textContent).toContain(
        "1 filtro adicional",
      );
      // Nasce recolhido; abre para mexer nos filtros e recolhe de novo.
      expect(painel.classList.contains("is-recolhido")).toBe(true);
      await clicar($('[data-acao="recolher-filtros"]'));
      expect($(".ui-filtros-corpo")?.hidden).toBe(false);
      await clicar($(".ui-chips .ui-chip"));
      expect(aoTirar).toHaveBeenCalledTimes(1);
      await clicar($('[data-acao="recolher-filtros"]'));
      expect(painel.classList.contains("is-recolhido")).toBe(true);
      expect($(".ui-filtros-corpo")?.hidden).toBe(true);
      await clicar($('[data-acao="limpar-filtros"]'));
      expect(aoLimpar).toHaveBeenCalledTimes(1);
      expect(idsDoPainelDeAnalises()).toEqual([]);
      expect($(".panel, .filter-panel, .chip-filter")).toBeNull();
    });

    it("Kpi: card compacto com tile no tom da cor, filtro e skeleton ao carregar", async () => {
      const aoClicar = vi.fn();
      await montarNoApp(
        h(
          GradeDeKpis,
          { rotulo: "Indicadores" },
          h(Kpi, {
            chave: "a",
            cor: "k-red",
            icone: "fa-clock",
            rotulo: "Atrasados",
            valor: "4",
            ativo: true,
            aoClicar,
          }),
          h(Kpi, { chave: "b", rotulo: "Total", valor: "9", carregando: true }),
        ),
      );
      expect($("section.ui-kpis")).not.toBeNull();
      const a = definido($<HTMLElement>('[data-kpi="a"]'));
      expect(a.className).toBe("ui-kpi ui-kpi-clicavel is-ativo");
      expect(a.dataset.tom).toBe("perigo");
      expect(a.querySelector(".ui-kpi-icone i")?.className).toContain(
        "fa-clock",
      );
      expect(a.querySelector(".ui-kpi-valor")?.textContent).toBe("4");
      const botao = definido(a.querySelector("button.ui-kpi-alvo"));
      expect(botao.getAttribute("aria-pressed")).toBe("true");
      await clicar(botao);
      expect(aoClicar).toHaveBeenCalledTimes(1);
      const b = definido($<HTMLElement>('[data-kpi="b"]'));
      expect(b.dataset.tom).toBe("info");
      expect(b.getAttribute("aria-busy")).toBe("true");
      expect(b.querySelector(".ui-kpi-valor.ui-esqueleto")?.textContent).toBe(
        "",
      );
      expect($(".kpi, .kpis")).toBeNull();
    });

    it("CardDeGrafico, Selo, Kv, Secao e estados com as classes .ui-*", async () => {
      await montarNoApp(
        h(
          "div",
          null,
          h(CardDeGrafico, { titulo: "G", altura: "short", carregando: true }),
          h(Selo, { tom: "aprovado" }, "No prazo"),
          h(
            Secao,
            { icone: "fa-list-check", titulo: "Etapas", secao: "e" },
            h(Kv, { rotulo: "Nota" }, ""),
          ),
          h(EstadoVazio, null, "Nada."),
          h(Carregando),
        ),
      );
      expect(
        $("article.ui-card.ui-card-de-grafico h2.ui-titulo")?.textContent,
      ).toBe("G");
      expect($(".ui-grafico.is-carregando")?.dataset.altura).toBe("short");
      expect($(".ui-selo")?.dataset.tom).toBe("sucesso");
      expect($(".ui-secao .ui-secao-topo")?.textContent).toBe("Etapas");
      expect($(".ui-kv[data-empty] .ui-kv-valor")?.textContent).toBe("—");
      expect(
        [...document.querySelectorAll(".ui-vazio")].map((e) => e.textContent),
      ).toEqual(["Nada.", "Carregando…"]);
      expect(
        $(".panel, .badge, .kv, .empty, .analises-detail-section"),
      ).toBeNull();
    });

    it("TabelaInfinita: .ui-tabela, sem ids, e avisa agsus:content-updated ao desenhar", async () => {
      const avisos = vi.fn();
      document.addEventListener("agsus:content-updated", avisos);
      await montarNoApp(
        h(TabelaInfinita<Linha>, {
          idDoTitulo: "tt",
          titulo: "Fila",
          busca: { placeholder: "Buscar", rotulo: "Buscar na fila" },
          carregado: true,
          itens: [{ nome: "Ana" }, { nome: "Bia" }],
          filtrarPelaBusca: (itens: readonly Linha[], busca: string) =>
            itens.filter((i) => i.nome.includes(busca)),
          colunas: [{ rotulo: "Nome" }],
          linha: (item: Linha) =>
            h("tr", { key: item.nome }, h("td", null, item.nome)),
          informacao: (quantos: number | null) => `${quantos}`,
          total: 2,
          vazio: "Nada.",
        }),
      );
      expect($("section.ui-card.ui-tabela h2.ui-titulo")?.textContent).toBe(
        "Fila",
      );
      expect(
        document.querySelectorAll(".ui-tabela-rolagem tbody tr"),
      ).toHaveLength(2);
      expect($("[data-tabela-mostrando]")?.textContent).toBe(
        "Mostrando 2 de 2 registros",
      );
      expect(avisos).toHaveBeenCalled();
      await digitar($(".ui-tabela-busca"), "Bi");
      expect($("[data-tabela-contagem]")?.textContent).toBe("1");
      expect($(".ui-tabela-status")?.textContent).toBe(
        "Todos os 1 registros do recorte foram carregados",
      );
      expect(idsDoPainelDeAnalises()).toEqual([]);
      document.removeEventListener("agsus:content-updated", avisos);
    });

    it("Gaveta: encostada à direita (.ui-gaveta), fecha pelo X e pelo Esc", async () => {
      const aoFechar = vi.fn();
      await montarNoApp(
        h(Gaveta, {
          id: "g",
          tituloId: "gt",
          aoFechar,
          sobretitulo: "Recurso nº 1",
          titulo: "Fulana",
          resumo: h("span", null, "Em análise"),
          rotuloDoFechar: "Fechar detalhe",
        }),
      );
      expect(document.getElementById("g")?.className).toBe(
        "modal ui-gaveta-fundo show",
      );
      expect(
        $(".modal-card.ui-gaveta .ui-gaveta-topo .ui-gaveta-sobretitulo")
          ?.textContent,
      ).toBe("Recurso nº 1");
      expect($(".ui-gaveta-resumo")?.textContent).toBe("Em análise");
      await clicar($('.ui-gaveta-fechar[aria-label="Fechar detalhe"]'));
      await teclar(document, "Escape");
      expect(aoFechar).toHaveBeenCalledTimes(2);
      expect($(".analises-drawer, .eyebrow")).toBeNull();
    });

    it("Campo: .ui-campo no lugar de .field", async () => {
      await montarNoApp(h(Campo, { rotulo: "Busca" }, h("input", null)));
      expect($<HTMLLabelElement>(".ui-campo label")?.htmlFor).toBe(
        $("input")?.id,
      );
      expect($(".field")).toBeNull();
    });
  });

  describe("peças de Análises curriculares e Recursos", () => {
    it("LinhaDoRecorte com `texto` e MarcasDoRecorte: marcas com tom (neutro por padrão)", async () => {
      await montarNoApp(
        h(
          LinhaDoRecorte,
          { texto: "Recorte ativo: Situação do processo: Ativo" },
          h(MarcasDoRecorte, {
            marcas: [
              { chave: "j", icone: "fa-calendar-days", texto: "Janela" },
              { chave: "f", tom: "alerta", texto: "2 fora" },
            ],
          }),
        ),
      );
      expect($("[data-recorte]")?.textContent).toBe(
        "Recorte ativo: Situação do processo: Ativo",
      );
      expect(
        [
          ...document.querySelectorAll<HTMLElement>(
            ".ui-recorte-marcas .ui-marca",
          ),
        ].map((m) => m.dataset.tom),
      ).toEqual(["neutro", "alerta"]);
      await act(async () =>
        definido(raiz).render(h(MarcasDoRecorte, { marcas: [] })),
      );
      expect($(".ui-recorte-marcas")).toBeNull();
    });

    it("MaisOpcoes: alterna o bloco e mostra quantos filtros adicionais estão em uso", async () => {
      const aoAlternar = vi.fn();
      await montarNoApp(
        h(
          MaisOpcoes,
          {
            id: "extra",
            aberto: false,
            aoAlternar,
            quantos: 2,
            titulo: "Mostrar mais",
          },
          h("span", null, "campo"),
        ),
      );
      const botao = definido($<HTMLElement>('[data-acao="mais-opcoes"]'));
      expect(botao.getAttribute("aria-controls")).toBe("extra");
      expect(botao.getAttribute("aria-expanded")).toBe("false");
      expect(botao.textContent).toContain("Mais opções");
      expect($(".ui-contagem")?.textContent).toBe("2");
      expect(document.getElementById("extra")?.hidden).toBe(true);
      await clicar(botao);
      expect(aoAlternar).toHaveBeenCalled();
    });

    it("PainelDeFiltros: o resumo começa pelo escopo e o Limpar segue `podeLimpar`", async () => {
      await montarNoApp(
        h(PainelDeFiltros, {
          idDoTitulo: "f",
          quantos: 0,
          escopo: "Inativo",
          podeLimpar: true,
          aoLimpar: vi.fn(),
        }),
      );
      expect($(".ui-filtros-resumo")?.textContent).toContain(
        "Inativo · nenhum filtro adicional",
      );
      expect(
        $<HTMLButtonElement>('[data-acao="limpar-filtros"]')?.disabled,
      ).toBe(false);
    });

    it("TabelaInfinita: busca controlada pela tela e Carregar mais", async () => {
      const aoMudar = vi.fn();
      const itens = Array.from({ length: 70 }, (_, i) => ({ nome: `P${i}` }));
      const props = (valor: string): PropriedadesDaTabelaInfinita<Linha> => ({
        idDoTitulo: "t",
        titulo: "Fila",
        busca: { placeholder: "Buscar", rotulo: "Buscar", valor, aoMudar },
        carregado: true,
        itens,
        filtrarPelaBusca: (lista: readonly Linha[], busca: string) =>
          lista.filter((i) => i.nome.includes(busca)),
        colunas: [{ rotulo: "Nome" }],
        linha: (item: Linha) =>
          h("tr", { key: item.nome }, h("td", null, item.nome)),
        informacao: () => "",
        total: 70,
        vazio: "Nada.",
      });
      await montarNoApp(h(TabelaInfinita<Linha>, props("")));
      expect(document.querySelectorAll("tbody tr")).toHaveLength(50);
      expect($('[data-acao="carregar-mais"]')?.textContent).toContain(
        "Carregar mais 20",
      );
      await clicar($('[data-acao="carregar-mais"]'));
      expect(document.querySelectorAll("tbody tr")).toHaveLength(70);
      expect($('[data-acao="carregar-mais"]')).toBeNull();

      await digitar($(".ui-tabela-busca"), "P6");
      expect(aoMudar).toHaveBeenCalledWith("P6");
      await act(async () =>
        definido(raiz).render(h(TabelaInfinita<Linha>, props("P69"))),
      );
      expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
      expect($<HTMLInputElement>(".ui-tabela-busca")?.value).toBe("P69");
    });

    it("Campo: `idDoControle` liga o rótulo a um controle que não é input/select", async () => {
      await montarNoApp(
        h(
          Campo,
          { rotulo: "Unidade", idDoControle: "x-unidade" },
          h("button", { id: "x-unidade", type: "button" }, "Todas"),
        ),
      );
      expect($<HTMLLabelElement>(".ui-campo label")?.htmlFor).toBe("x-unidade");
    });
  });

  describe("Segmentado, LinhaDoRecorte e ListaDePendencias (só dentro do app)", () => {
    const OPCOES = [
      { valor: "a", rotulo: "Alfa", icone: "fa-chart-column" },
      { valor: "b", rotulo: "Beta" },
      { valor: "c", rotulo: "Gama" },
    ];

    it("Segmentado: radiogroup, só a escolhida no Tab, setas movem e dão a volta", async () => {
      const aoMudar = vi.fn();
      await montarNoApp(
        h(Segmentado, {
          rotulo: "Visão",
          opcoes: OPCOES,
          valor: "a",
          aoMudar,
          className: "extra",
        }),
      );
      const grupo = definido(
        $<HTMLElement>(".ui-segmentado.extra[role=radiogroup]"),
      );
      expect(grupo.getAttribute("aria-label")).toBe("Visão");
      const botoes = [
        ...grupo.querySelectorAll<HTMLButtonElement>("button[role=radio]"),
      ];
      expect(botoes.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
      expect(botoes[0]?.getAttribute("aria-checked")).toBe("true");
      expect(botoes[0]?.classList.contains("is-ativo")).toBe(true);
      expect(botoes[0]?.querySelector("i.fa-chart-column")).not.toBeNull();
      await teclar(definido(botoes[0]), "ArrowLeft");
      expect(aoMudar).toHaveBeenLastCalledWith("c");
      expect(document.activeElement).toBe(botoes[2]);
      await teclar(definido(botoes[2]), "ArrowRight");
      expect(aoMudar).toHaveBeenLastCalledWith("a");
      await clicar(grupo.querySelector('[data-valor="b"]'));
      expect(aoMudar).toHaveBeenLastCalledWith("b");
    });

    it("Segmentado: sem escolha, a primeira entra no Tab; desabilitado não muda", async () => {
      const aoMudar = vi.fn();
      await montarNoApp(
        h(Segmentado, {
          rotulo: "Comparecimento",
          opcoes: OPCOES,
          // @ts-expect-error -- sem escolha (null), de propósito: a primeira entra no Tab.
          valor: null,
          aoMudar,
          desabilitado: true,
        }),
      );
      const botoes = [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".ui-segmentado button",
        ),
      ];
      expect(botoes.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
      expect(botoes.every((b) => b.disabled)).toBe(true);
      await teclar(definido(botoes[0]), "ArrowRight");
      expect(aoMudar).not.toHaveBeenCalled();
    });

    it("LinhaDoRecorte: diz os filtros ativos (ou 'Sem filtros') e leva os filhos", async () => {
      await montarNoApp(
        h(
          LinhaDoRecorte,
          {
            ativos: [
              ["edital", "Edital", "01/2026"],
              ["busca", "Busca", "ana"],
            ],
          },
          h("span", { className: "marca" }, "3 vencidos"),
        ),
      );
      expect($(".ui-card.ui-recorte [data-recorte]")?.textContent).toBe(
        "Recorte ativo: Edital: 01/2026 · Busca: ana",
      );
      expect($(".ui-recorte .marca")?.textContent).toBe("3 vencidos");
      expect(textoDoRecorte([])).toBe("Sem filtros");
    });

    it("ListaDePendencias: botões com tom, filtro com aria-pressed, atalho sem; skeleton e vazio", async () => {
      const filtrar = vi.fn();
      const abrir = vi.fn();
      const itens = [
        {
          chave: "x",
          titulo: "Sem edital",
          detalhe: "2 entrevistas",
          tom: "perigo",
          ativo: true,
          aoClicar: filtrar,
        },
        { chave: "y", titulo: "Sem entrevista", detalhe: "1", aoClicar: abrir },
      ];
      await montarNoApp(h(ListaDePendencias, { itens, vazio: "Nada" }));
      const [primeiro, segundo] =
        document.querySelectorAll<HTMLElement>(".ui-pendencia");
      expect(primeiro?.dataset.tom).toBe("perigo");
      expect(primeiro?.getAttribute("aria-pressed")).toBe("true");
      expect(primeiro?.classList.contains("is-ativo")).toBe(true);
      expect(primeiro?.textContent).toBe("Sem edital2 entrevistas");
      expect(segundo?.dataset.tom).toBe("alerta");
      expect(segundo?.hasAttribute("aria-pressed")).toBe(false);
      await clicar(primeiro);
      await clicar(segundo);
      expect(filtrar).toHaveBeenCalledTimes(1);
      expect(abrir).toHaveBeenCalledTimes(1);

      await act(async () =>
        definido(raiz).render(
          h(ListaDePendencias, { itens, carregando: true }),
        ),
      );
      expect(
        document.querySelectorAll(".ui-pendencias .ui-esqueleto"),
      ).toHaveLength(4);
      await act(async () =>
        definido(raiz).render(
          h(ListaDePendencias, { itens: [], vazio: "Nada" }),
        ),
      );
      expect($(".ui-pendencias .ui-vazio")?.textContent).toBe("Nada");
    });
  });

  describe("BotaoDeAcao, esqueletos e ErroAoCarregar", () => {
    function criarEstado(acao: AcaoEmCurso | null = null) {
      let atual = { acao };
      const ouvintes = new Set<() => void>();
      return {
        obter: () => atual,
        assinar: (ouvinte: () => void) => {
          ouvintes.add(ouvinte);
          return () => ouvintes.delete(ouvinte);
        },
        definir(nova: AcaoEmCurso) {
          atual = { acao: nova };
          ouvintes.forEach((ouvinte) => ouvinte());
        },
      };
    }

    it("BotaoDeAcao: mostra o rótulo da própria ação e desativa durante qualquer outra", async () => {
      const estado = criarEstado();
      await montarNoApp(
        h(
          "div",
          null,
          h(BotaoDeAcao, { estado, acao: "salvar", id: "a" }, "Salvar"),
          h(
            BotaoDeAcao,
            { estado, acao: "apagar", id: "b", soIcone: true },
            "X",
          ),
        ),
      );
      expect($<HTMLButtonElement>("#a")?.disabled).toBe(false);
      expect($<HTMLButtonElement>("#a")?.type).toBe("button");
      await act(async () =>
        estado.definir({ tipo: "salvar", rotulo: "Salvando…" }),
      );
      expect($("#a")?.textContent.trim()).toBe("Salvando…");
      expect($("#a")?.getAttribute("aria-busy")).toBe("true");
      expect($("#a .botao-girando")).not.toBeNull();
      expect($<HTMLButtonElement>("#b")?.disabled).toBe(true);
      expect($("#b")?.textContent).toBe("X");
      await act(async () =>
        estado.definir({ tipo: "apagar", rotulo: "Apagando…" }),
      );
      expect($("#b .sr-only")?.textContent).toBe("Apagando…");
    });

    it("LinhasEsqueleto e BlocosEsqueleto: o formato do conteúdo, escondido do leitor de tela", async () => {
      await montarNoApp(
        h(
          "div",
          null,
          h(
            "table",
            null,
            h("tbody", null, h(LinhasEsqueleto, { colunas: 3, linhas: 2 })),
          ),
          h(
            "ul",
            null,
            h(BlocosEsqueleto, { quantos: 4, como: "li", className: "extra" }),
          ),
          h("div", { id: "soltos" }, h(BlocosEsqueleto, {})),
        ),
      );
      const linhas = document.querySelectorAll("tr.ui-esqueleto-tr");
      expect(linhas).toHaveLength(2);
      expect(linhas[0]?.getAttribute("aria-hidden")).toBe("true");
      expect(
        linhas[0]?.querySelectorAll("td .ui-esqueleto-linha"),
      ).toHaveLength(3);
      const itens = document.querySelectorAll('ul li[aria-hidden="true"]');
      expect(itens).toHaveLength(4);
      expect(
        itens[0]?.querySelector(".ui-esqueleto.ui-esqueleto-bloco.extra"),
      ).not.toBeNull();
      expect(
        document.querySelectorAll("#soltos > .ui-esqueleto-bloco"),
      ).toHaveLength(3);
    });

    it("ErroAoCarregar: Aviso danger com a mensagem e o Tentar novamente", async () => {
      const aoTentar = vi.fn();
      await montarNoApp(
        h(ErroAoCarregar, {
          id: "erro",
          idDoBotao: "tentar",
          oQue: "os dados",
          mensagem: "sem rede",
          aoTentar,
        }),
      );
      const aviso = definido($<HTMLElement>(".ui-aviso"));
      expect(aviso.dataset.tone).toBe("danger");
      expect(aviso.getAttribute("role")).toBe("alert");
      expect($("#erro")?.textContent).toContain(
        "Não foi possível carregar os dados: sem rede",
      );
      expect($("#tentar")?.textContent.trim()).toBe("Tentar novamente");
      await clicar($("#tentar"));
      expect(aoTentar).toHaveBeenCalledTimes(1);
    });

    it("ErroAoCarregar: sem aoTentar, só a frase com ponto final", async () => {
      await montarNoApp(h(ErroAoCarregar, { oQue: "a lista" }));
      expect($(".ui-erro-ao-carregar")?.textContent).toBe(
        "Não foi possível carregar a lista.",
      );
      expect($("button")).toBeNull();
    });

    it("Kpi com idDoValor e TabelaInfinita com className, idDoCorpo e busca.id", async () => {
      await montarNoApp(
        h(
          "div",
          null,
          h(Kpi, {
            chave: "t",
            rotulo: "Total",
            valor: "3",
            idDoValor: "valorTotal",
          }),
          h(TabelaInfinita<Linha>, {
            idDoTitulo: "t",
            titulo: "T",
            className: "minha-tabela",
            idDoCorpo: "corpo",
            busca: { id: "busca", placeholder: "B", rotulo: "Buscar" },
            carregado: false,
            itens: [],
            filtrarPelaBusca: (itens) => itens,
            colunas: [{ rotulo: "A" }, { rotulo: "B" }],
            linha: () => null,
            informacao: () => "",
            total: 0,
            vazio: "Nada",
          }),
        ),
      );
      expect($("#valorTotal")?.textContent).toBe("3");
      expect($("section.ui-tabela.minha-tabela")).not.toBeNull();
      expect($("tbody#corpo")?.getAttribute("aria-busy")).toBe("true");
      expect($("#corpo tr.ui-esqueleto-tr")).not.toBeNull();
      expect($("input#busca.ui-tabela-busca")).not.toBeNull();
    });
  });
});

bloco("vidro-ajustavel-no-painel-de-acesso", () => {
  /*
  A COR E O DESFOQUE DO VIDRO, EM CONFIGURAÇÕES (pedido de 13/11/2026)

  O vidro da tela de acesso mudou quatro vezes no mesmo dia, cada uma com
  código. Agora a cor no vidro (0% a 90% da cor do painel) e o desfoque da arte
  (nenhum, leve ou forte) se escolhem em Configurações › Aparência. As chaves
  `auth_access_vidro_cor` e `auth_access_vidro_desfoque` chegam antes do login
  pela leitura pública (migration 20261113150000), vão para o cache da marca e
  viram `--vidro-cor` e `--vidro-desfoque` no #loginScreen.
*/

  const RAIZ = path.resolve(import.meta.dirname, "..");
  const ler = (relativo: string) =>
    fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

  describe("os valores", () => {
    it("cor no vidro: 0 a 90, de 10 em 10; o resto vira 0", () => {
      expect(porcentagemDaCorNoVidro("40")).toBe(40);
      expect(porcentagemDaCorNoVidro(" 90 ")).toBe(90);
      for (const valor of ["45", "100", "-10", "", null, "abc"])
        expect(porcentagemDaCorNoVidro(valor)).toBe(0);
      expect(normalizarCorNoVidro("70")).toBe("70");
      expect(normalizarCorNoVidro("75")).toBe("0");
    });

    it("desfoque: nenhum, leve ou forte; o resto vira nenhum", () => {
      expect(normalizarDesfoqueDoVidro(" Leve ")).toBe("leve");
      expect(normalizarDesfoqueDoVidro("forte")).toBe("forte");
      expect(normalizarDesfoqueDoVidro("muito")).toBe("nenhum");
      expect(DESFOQUE_DO_VIDRO_EM_PX).toEqual({
        nenhum: 0,
        leve: 8,
        forte: 18,
      });
    });

    it("os dois campos estão em Aparência, com as opções", () => {
      const campos = CAMPOS_DAS_SECOES.aparencia;
      const cor = campos.find((c) => c.chave === "auth_access_vidro_cor");
      const desfoque = campos.find(
        (c) => c.chave === "auth_access_vidro_desfoque",
      );
      expect(cor?.opcoes?.map(([valor]) => valor)).toEqual([
        "0",
        "10",
        "20",
        "30",
        "40",
        "50",
        "60",
        "70",
        "80",
        "90",
      ]);
      expect(desfoque?.opcoes?.map(([valor]) => valor)).toEqual([
        "nenhum",
        "leve",
        "forte",
      ]);
    });
  });

  describe("contraste com cor no vidro", () => {
    it("com cor, mede no pior trecho da arte, na proporção escolhida", () => {
      const setenta = avaliarCor("#002f2f", "claro", "vidro", "70");
      expect(setenta?.passa).toBe(true);
      expect(setenta?.mensagem).toContain("70% da cor");
      const quarenta = avaliarCor("#002f2f", "claro", "vidro", "40");
      expect(quarenta?.passa).toBe(false);
      expect(quarenta?.mensagem).toContain("Mais cor no vidro");
      expect(quarenta?.razao ?? 0).toBeLessThan(setenta?.razao ?? 0);
    });

    it("sem cor, o aviso de sempre: a arte decide", () => {
      const puro = avaliarCor("#002f2f", "claro", "vidro", "0");
      expect(puro?.passa).toBe(false);
      expect(puro?.mensagem).toContain("No vidro o painel fica sem cor");
    });

    it("no sólido, a cor no vidro não muda nada", () => {
      expect(avaliarCor("#002f2f", "auto", "solido", "40")).toEqual(
        avaliarCor("#002f2f", "auto", "solido"),
      );
    });
  });

  describe("a tela de acesso", () => {
    afterEach(() => {
      limparMarcaGuardada();
      for (const nome of ["--vidro-cor", "--vidro-desfoque"])
        document.documentElement.style.removeProperty(nome);
      document.body.innerHTML = "";
    });

    it("a leitura pública traz as duas chaves para o cache", () => {
      expect(
        mapearBrandingPublico({
          auth_access_vidro_cor: "30",
          auth_access_vidro_desfoque: "forte",
        }),
      ).toEqual({ vidroCor: "30", vidroDesfoque: "forte" });
    });

    it("vira --vidro-cor e --vidro-desfoque no #loginScreen", () => {
      const tela = document.createElement("section");
      aplicarAjusteDoVidro(tela, "40", "leve");
      expect(tela.style.getPropertyValue("--vidro-cor")).toBe("40%");
      expect(tela.style.getPropertyValue("--vidro-desfoque")).toBe("8px");
    });

    it("a configuração do banco aplica e guarda os dois", () => {
      const tela = document.createElement("section");
      tela.id = "loginScreen";
      document.body.append(tela);
      definirMarcaDaConfiguracao({
        valores: {
          auth_access_vidro_cor: "60",
          auth_access_vidro_desfoque: "forte",
        },
        carregou: true,
        chaves: new Set([
          "auth_access_vidro_cor",
          "auth_access_vidro_desfoque",
        ]),
      });
      expect(tela.style.getPropertyValue("--vidro-cor")).toBe("60%");
      expect(tela.style.getPropertyValue("--vidro-desfoque")).toBe("18px");
      expect(lerMarcaGuardada()).toMatchObject({
        vidroCor: "60",
        vidroDesfoque: "forte",
      });
    });

    /* O script clássico do <head>, que aplica a marca antes do primeiro paint. */
    const html = ler("index.html");
    function rodarScriptDoHead() {
      const inicio = html.indexOf("(function aplicarMarcaAntesDoPrimeiroPaint");
      new Function(html.slice(inicio, html.indexOf("</script>", inicio)))();
    }

    it("o primeiro quadro aplica a cor e o desfoque guardados", () => {
      guardarMarca({ vidroCor: "40", vidroDesfoque: "leve" });
      rodarScriptDoHead();
      const raiz = document.documentElement.style;
      expect(raiz.getPropertyValue("--vidro-cor")).toBe("40%");
      expect(raiz.getPropertyValue("--vidro-desfoque")).toBe("8px");
    });

    it("valor fora da lista não entra no CSS do primeiro quadro", () => {
      guardarMarca({ vidroCor: "45", vidroDesfoque: "muito" });
      rodarScriptDoHead();
      const raiz = document.documentElement.style;
      expect(raiz.getPropertyValue("--vidro-cor")).toBe("");
      expect(raiz.getPropertyValue("--vidro-desfoque")).toBe("");
    });

    it("a tabela de desfoque do <head> é a de contraste.ts", () => {
      const tabela = html.match(/var desfoques = (\{[^}]*\});/)?.[1] ?? "{}";
      expect(new Function(`return ${tabela};`)()).toEqual(
        DESFOQUE_DO_VIDRO_EM_PX,
      );
    });
  });
});
