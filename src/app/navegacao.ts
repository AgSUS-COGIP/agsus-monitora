import { aplicarAtualizacaoPendente } from "../modules/pwa-lifecycle.ts";
import { guardaDeAlteracoes } from "./guarda-de-alteracoes.ts";
import {
  aplicarManutencaoNaNavegacao,
  avisarNaFaixa,
  avisoNoLugarDaPagina,
  situacaoDoSistema,
} from "../modules/situacao-dos-modulos.ts";
import { abasDoMenu, catalogoDoBanco } from "../modules/catalogo-de-abas.ts";
import {
  filtrarAreasAtivas,
  situacaoEfetiva,
} from "../lib/situacao-dos-modulos.ts";
import {
  paginaDesligada,
  primeiraPaginaLigada,
  textoDaFaixaDeSaida,
} from "../lib/pagina-desligada.ts";
import {
  areasDoUsuario,
  montarArvoreDoMenu,
  nomeDaArea,
} from "../lib/menu-lateral.ts";
import {
  isAdminGlobal,
  paginasPermitidas,
  secaoDeConfiguracaoPermitida,
} from "../lib/access-roles.ts";
import {
  CHAVE_DA_TELA_GUARDADA,
  TELA_SEM_ACESSO,
  bloqueioDaTela,
  codigoDoPainel,
  destinoDaTela,
  ehPainelExterno,
  telaDeEntrada,
  telaInicialDoSistema,
  telaPermitida,
} from "../lib/navegacao";
import { definirPaginaDaAba } from "../lib/identidade-da-aba";
import { cabecalhoDaVisaoGeral } from "../lib/visao-geral-da-area.ts";
import { erroAmigavel } from "../lib/erro-amigavel";
import {
  assinarDadosDoMonitoramento,
  definirAreaAtual,
  definirAreasDoUsuario,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.ts";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
} from "../componentes/barra-lateral/estado.ts";
import {
  abrirSecaoDeConfiguracao,
  definirSecoesPermitidas,
  SECOES,
  secaoAtualDeConfiguracao,
} from "../modulos/configuracoes/secoes.ts";
import { estadoDasConfiguracoes } from "../modulos/configuracoes/estado.ts";
import { definirPaginaDaAya } from "../modulos/aya/estado.ts";
import type { PerfilDeAcesso } from "../lib/tipos-dos-acessos.ts";
import type { PaineisDaNavegacao } from "../lib/navegacao";
import type { ArvoreDoMenu } from "../componentes/barra-lateral/tipos.ts";

/*
  A navegação do app, sem React: qual tela está aberta, a troca de tela (a
  `.active` das `<section class="page">`, o título do cabeçalho, o menu
  marcado), as permissões por tela, a guarda de saída de Acessos, Módulos e
  abas e Configurações, a tela guardada para a próxima entrada e o menu da
  barra lateral que o perfil vê. As regras puras estão em src/lib/navegacao.ts.

  Contratos mantidos: `window.navigate(view)` (é `irPara`), os itens
  `#nav [data-view][data-area]` da barra lateral (React, pelo estado dela) e o
  `render()` dos controladores em `window` (`recursosController`…) ao abrir a
  tela de cada um.

  Página desligada pela coordenação (ou em manutenção) também fecha no meio
  da sessão: o vigia do catálogo (src/app/vigia-do-catalogo.ts) relê o
  catálogo quando ele muda e chama `reavaliarTelaAtual`, que troca a página
  pelo aviso — ou, com trabalho não salvo (`temTrabalhoNaoSalvo`), só mostra
  a faixa e espera salvar.

  Quem acompanha a navegação assina: `assinar(ouvinte)` recebe
  `{ tipo: "menu" }` a cada marcação do menu (o lugar da pessoa pode ter
  mudado), `{ tipo: "abertura", view, anterior }` quando uma tela abriu
  (auditoria e presença, em src/app/presenca.ts) e `{ tipo: "aviso", view }`
  quando, no lugar dela, ficou um aviso (sem acesso, desligada, manutenção).
  A página aberta decide o que se carrega (src/app/pagina-aberta.ts).
*/

/*
  Telas React de página inteira (montadas por src/main.ts na própria
  `#page-<view>`): título, subtítulo (depois da área) e o controlador.
*/
/** O controlador de uma tela React em `window` (montado por src/main.ts). */
export interface ControladorDaTela {
  render(): unknown;
  abrirVisao?(visao: string): unknown;
}

type NomeDoControlador =
  | "nucleoController"
  | "calendarioEditaisController"
  | "aprovadosController"
  | "recursosController"
  | "analisarRecursosController"
  | "entrevistasController"
  | "conduzirEntrevistasController"
  | "classificacaoController"
  | "analisesController"
  | "avaliacaoDocumentalController"
  | "selecaoController";

/** Os controladores das telas em `window` (cada um com o seu tipo lá). */
export type JanelaDasTelas = { readonly [nome in NomeDoControlador]?: unknown };

/** Título, subtítulo e controlador de uma tela React. */
export type TelaReact = (
  valor: (chave: string) => string,
  janela: JanelaDasTelas,
) => readonly [string, string, ControladorDaTela | undefined];

type Controle = ControladorDaTela | undefined;

export const TELAS_REACT: Readonly<Record<string, TelaReact>> = Object.freeze({
  nucleo: (valor, janela) => [
    "Editais",
    valor("nucleo_page_subtitle"),
    janela.nucleoController as Controle,
  ],
  calendario: (_valor, janela) => [
    "Cronograma",
    "Etapas dos editais, por data.",
    janela.calendarioEditaisController as Controle,
  ],
  approved: (_valor, janela) => [
    "Lista de Aprovados",
    "Candidatos por edital e situação de contratação.",
    janela.aprovadosController as Controle,
  ],
  recursos: (_valor, janela) => [
    "Painel de recursos",
    "",
    janela.recursosController as Controle,
  ],
  "analisar-recursos": (_valor, janela) => [
    "Analisar recursos",
    "",
    janela.analisarRecursosController as Controle,
  ],
  entrevistas: (_valor, janela) => [
    "Painel de entrevistas",
    "",
    janela.entrevistasController as Controle,
  ],
  "conduzir-entrevistas": (_valor, janela) => [
    "Conduzir entrevistas",
    "",
    janela.conduzirEntrevistasController as Controle,
  ],
  classificacao: (_valor, janela) => [
    "Classificação",
    "",
    janela.classificacaoController as Controle,
  ],
  analises: (_valor, janela) => [
    "Painel das análises",
    "",
    janela.analisesController as Controle,
  ],
  "avaliacao-documental": (_valor, janela) => [
    "Avaliação documental",
    "",
    janela.avaliacaoDocumentalController as Controle,
  ],
  selecao: (_valor, janela) => [
    "Seleção",
    "",
    janela.selecaoController as Controle,
  ],
});

/** O que pergunta antes de sair (Acessos, Módulos e abas). */
interface ControleComSaida {
  confirmarSaida(): unknown;
}
/** As telas de `window` que guardam alteração não salva. */
export type JanelaComSaida = {
  acessosController?: ControleComSaida;
  modulosController?: ControleComSaida;
};

/* Sair com alteração não salva (Acessos, Módulos e abas ou campos de Configurações) pergunta antes. */
export function confirmarSaidaPadrao(
  janela: object | null | undefined,
): boolean {
  return (
    (
      janela as JanelaComSaida | null | undefined
    )?.acessosController?.confirmarSaida() !== false &&
    (
      janela as JanelaComSaida | null | undefined
    )?.modulosController?.confirmarSaida() !== false &&
    estadoDasConfiguracoes.confirmarSaida()
  );
}

/** Os painéis externos, como a navegação os usa (src/app/paineis-externos.ts). */
export interface PaineisDoApp extends PaineisDaNavegacao {
  doMenu(): readonly { codigo?: string | null; titulo?: string | null }[];
  mostrar(codigo: string): { titulo: string } | null | void;
  esquecerAtual(): void;
}

/** O que a navegação avisa a quem assina. */
export type EventoDaNavegacao =
  | { tipo: "menu" }
  | { tipo: "abertura"; view: string; anterior: string }
  | { tipo: "aviso"; view: string };
export type OuvinteDaNavegacao = (evento: EventoDaNavegacao) => void;

/** A janela: os controladores das telas e a recarga. */
export type JanelaDaNavegacao = JanelaDasTelas & {
  location: { reload(): void };
};

export interface OpcoesDaNavegacao {
  documento?: Document;
  janela?: JanelaDaNavegacao;
  armazenamento?: () => Storage | null | undefined;
  obterPerfil?: () => PerfilDeAcesso | null | undefined;
  paineis?: PaineisDoApp;
  configuracao?: (chave: string) => string;
  avisar?: (texto: string, tom?: string) => void;
  ajustarBarra?: () => void;
  confirmarSaida?: () => boolean;
  aplicarAtualizacao?: (recarregar: () => void) => boolean;
  podeRecarregar?: () => boolean;
  recarregar?: () => void;
  temTrabalhoNaoSalvo?: () => boolean;
}

const PAINEIS_VAZIOS: PaineisDoApp = Object.freeze({
  podeAbrir: () => false,
  primeiro: () => null,
  doMenu: () => [],
  mostrar: () => {},
  esquecerAtual: () => {},
});

const TEXTO_SEM_ACESSO =
  "Seu usuário ainda não tem módulos liberados. Solicite a liberação a um administrador.";

/**
 * Dependências: `obterPerfil` (perfil de quem entrou), `paineis` (painéis
 * externos: `podeAbrir(codigo)`, `primeiro()`, `doMenu()`, `mostrar(codigo)`
 * e `esquecerAtual()`), `configuracao` (valor de TB_CONFIGURACAO), `avisar`
 * (toast) e `ajustarBarra` (barra lateral recolhida no celular).
 */
export function criarNavegacao({
  documento = globalThis.document,
  janela = globalThis.window,
  armazenamento = () => globalThis.localStorage,
  obterPerfil = () => null,
  paineis = PAINEIS_VAZIOS,
  configuracao = () => "",
  avisar = () => {},
  ajustarBarra = () => {},
  confirmarSaida = () => confirmarSaidaPadrao(janela),
  aplicarAtualizacao = aplicarAtualizacaoPendente,
  podeRecarregar = guardaDeAlteracoes.podeRecarregar,
  recarregar = () => janela.location.reload(),
  // Fechar a página agora perderia algo (ainda não guardado em lugar nenhum).
  temTrabalhoNaoSalvo = () => !guardaDeAlteracoes.podeRecarregar(),
}: OpcoesDaNavegacao = {}) {
  let view = "dashboard";
  let estado = Object.freeze({ view });
  /* A última árvore do menu: dela sai a página do botão "Ir para a página inicial". */
  let arvore: ArvoreDoMenu = [];
  const ouvintes = new Set<OuvinteDaNavegacao>();

  const $ = (id: string) => documento.getElementById(id);
  const perfil = () => obterPerfil();
  const areaAtual = () => obterDadosDoMonitoramento().areaAtual;

  function avisarOuvintes(evento: EventoDaNavegacao) {
    ouvintes.forEach((ouvinte) => ouvinte(evento));
  }

  function definirView(nova: string) {
    if (nova === view) return;
    view = nova;
    estado = Object.freeze({ view });
  }

  // ── Tela guardada ─────────────────────────────────────────────────────

  function guardarTela(tela: string) {
    if (!tela) return;
    try {
      armazenamento()?.setItem(CHAVE_DA_TELA_GUARDADA, tela);
    } catch {
      // Sem localStorage (aba privada, bloqueio): a próxima entrada abre a inicial.
    }
  }

  function telaGuardada() {
    try {
      return armazenamento()?.getItem(CHAVE_DA_TELA_GUARDADA) || "";
    } catch {
      return "";
    }
  }

  const permitida = (tela: string) => telaPermitida(tela, perfil(), paineis);

  /* A página (view) na área está desligada pela coordenação (src/lib/pagina-desligada.ts)? */
  const desligada = (tela: string, area: string = areaAtual()) =>
    paginaDesligada({
      abas: abasDoMenu(),
      doBanco: catalogoDoBanco(),
      situacao: situacaoDoSistema(),
      view: tela,
      area,
    });

  /*
    A tela de entrada (a guardada ou a inicial do sistema) desligada pela
    coordenação não abre: vale a primeira página ligada e permitida do menu
    (a árvore só tem essas), e a área dela passa a ser a atual. Assim quem tem
    a Visão geral liberada (o grupo Avaliador, por exemplo) mas a vê desligada
    na área entra direto na página que usa, sem passar pela Visão geral.
  */
  function ligadaOuPrimeira(tela: string) {
    if (!desligada(tela)) return tela;
    const item = primeiraPaginaLigada(arvore, areaAtual(), tela);
    if (!item) return tela;
    if (item.area) definirAreaAtual(item.area);
    return item.view;
  }

  const inicialDoSistema = () =>
    ligadaOuPrimeira(telaInicialDoSistema(perfil(), paineis));

  const deEntrada = () =>
    ligadaOuPrimeira(telaDeEntrada(telaGuardada(), perfil(), paineis));

  /* O botão da página desativada (e da manutenção): a primeira página ligada do menu. */
  function irParaInicio() {
    const item = primeiraPaginaLigada(arvore, areaAtual(), view);
    if (!item) {
      irPara(inicialDoSistema());
      return;
    }
    if (item.area) definirAreaAtual(item.area);
    irPara(item.view);
  }

  // ── Cabeçalho e menu ──────────────────────────────────────────────────

  function definirTitulo(titulo: string, subtitulo: string) {
    const h1 = $("pageTitle");
    const sub = $("pageSubtitle");
    if (h1) h1.textContent = titulo || "";
    if (sub) sub.textContent = subtitulo || "";
    // O nome da aba tem um dono só; aqui entra apenas a metade da página.
    definirPaginaDaAba(titulo);
    // A Aya (src/modulos/aya/) acompanha a página: saudação, sugestões e contexto.
    definirPaginaDaAya(view, titulo);
  }

  /* Editais, Cronograma e Aprovados mostram só a área atual; o subtítulo diz qual. */
  function subtituloDaArea(sub: string) {
    return [nomeDaArea(areaAtual()), sub].filter(Boolean).join(" · ");
  }

  /*
    A Visão geral é uma só para as três áreas (React, src/modulos/visao-geral/):
    daqui sai só o cabeçalho, que muda com a área.
  */
  function tituloDaVisaoGeral() {
    if (view !== "dashboard") return;
    const { titulo, subtitulo } = cabecalhoDaVisaoGeral(areaAtual(), {
      titulo: configuracao("page_title"),
      subtitulo: configuracao("page_subtitle"),
    });
    definirTitulo(titulo, subtitulo);
  }

  function marcarMenu(tela: string = view) {
    marcarItemAtivoNoMenu(tela, secaoAtualDeConfiguracao(documento));
    avisarOuvintes({ tipo: "menu" });
  }

  /*
    A barra lateral é React (src/componentes/barra-lateral/). Aqui só se decide
    o que o perfil vê; a árvore vai para o estado da barra, que desenha o menu.
  */
  function montarMenu() {
    const atual = perfil();
    // As mesmas regras do "Ver como" de Acessos (src/lib/access-roles.ts).
    const permitidas = paginasPermitidas(atual);
    // Seção "Acessos" só para quem gerencia acessos; as demais, para quem edita configurações.
    const secoes = SECOES.filter((secao) =>
      secaoDeConfiguracaoPermitida(atual, secao.id),
    );
    definirSecoesPermitidas(
      documento,
      secoes.map((secao) => secao.id),
    );
    // Um grupo por área do usuário; a área atual passa a ser uma delas.
    // Área desativada (Configurações › Módulos e abas) sai do menu.
    const situacao = situacaoDoSistema();
    const areas = areasDoUsuario(atual?.areas);
    const ativas = filtrarAreasAtivas(areas, situacao);
    definirAreasDoUsuario(ativas.length ? ativas : areas);
    arvore = montarArvoreDoMenu({
      permitidas,
      paineis: paineis.doMenu(),
      secoesDeConfiguracao: secoes,
      areas,
      abas: abasDoMenu(),
      situacao,
    });
    atualizarMenuLateral(arvore, {
      aoAbrirSecao: (_view, secao) =>
        abrirSecaoDeConfiguracao(documento, secao),
      textoVazio: configuracao("permissions_empty_text"),
    });
    marcarMenu(view);
  }

  // ── Troca de tela ─────────────────────────────────────────────────────

  function mostrarSemAcesso() {
    let vazia = $("page-sem-acesso");
    if (!vazia) {
      vazia = documento.createElement("section");
      vazia.id = "page-sem-acesso";
      vazia.className = "page";
      const aviso = documento.createElement("div");
      aviso.className = "alert warn";
      aviso.textContent = TEXTO_SEM_ACESSO;
      vazia.append(aviso);
      $("page-dashboard")?.parentElement?.append(vazia);
    }
    vazia.classList.add("active");
    definirTitulo(
      "Acesso aos módulos",
      "Nenhum módulo disponível para seu perfil.",
    );
  }

  function abriu(tela: string, anterior: string) {
    avisarOuvintes({ tipo: "abertura", view: tela, anterior });
  }

  /* No lugar da página ficou um aviso (sem acesso, desligada, manutenção). */
  function ficouAviso(tela: string) {
    avisarOuvintes({ tipo: "aviso", view: tela });
  }

  /**
   * Abre a tela (o `navigate` de sempre). Sem permissão, avisa e fica onde está.
   * Devolve `false` quando a navegação foi recusada (saída não confirmada ou
   * sem permissão): quem trocou a área antes de navegar a devolve.
   */
  function irPara(pedida: unknown): boolean {
    return abrirTela(pedida) !== false;
  }

  function abrirTela(pedida: unknown) {
    const anterior = view;
    // Link antigo (`entrevistas:conduzir`…) vai para a tela e a visão novas.
    const destino = destinoDaTela(pedida);
    const tela = destino.view || deEntrada();
    if (tela !== view && !confirmarSaida()) return false;
    // Versão nova do sistema esperando: entra agora. A tela pedida fica guardada
    // e abre depois da recarga (a tela de entrada confere a permissão). Com
    // rascunho ainda não guardado (ex.: a regra, src/app/guarda-de-alteracoes.ts),
    // a versão nova espera a próxima troca de tela.
    if (
      tela !== view &&
      podeRecarregar() &&
      aplicarAtualizacao(() => {
        guardarTela(tela);
        recarregar();
      })
    )
      return;

    // A permissão vem antes de mudar a tela atual e de esconder as páginas.
    const bloqueio = bloqueioDaTela(tela, perfil(), paineis);
    if (bloqueio) {
      avisar(bloqueio, "warn");
      return false;
    }

    documento.body.classList.remove("external-clean");
    documento.body.classList.remove("external-panel-mode");
    definirView(tela);
    guardarTela(tela);
    if (!ehPainelExterno(tela)) paineis.esquecerAtual();
    ajustarBarra();
    marcarMenu(tela);
    documento
      .querySelectorAll(".page")
      .forEach((pagina) => pagina.classList.remove("active"));

    if (tela === TELA_SEM_ACESSO) {
      mostrarSemAcesso();
      ficouAviso(tela);
      return;
    }

    // Página desligada pela coordenação: o aviso, para todos. Sistema, área ou
    // aba em manutenção: quem não é admin global vê a tela de manutenção.
    const fechada = desligada(tela);
    if (
      aplicarManutencaoNaNavegacao({
        documento,
        view: tela,
        area: areaAtual(),
        abas: abasDoMenu(),
        adminGlobal: isAdminGlobal(perfil()),
        desligada: fechada,
        aoIrParaInicio: irParaInicio,
      })
    ) {
      definirTitulo(
        fechada ? "Página desativada" : "Em manutenção",
        subtituloDaArea(""),
      );
      ficouAviso(tela);
      return;
    }

    if (tela === "dashboard") {
      $("page-dashboard")?.classList.add("active");
      // A página, com os mapas, é React (src/modulos/visao-geral/); aqui só o título.
      tituloDaVisaoGeral();
      abriu(tela, anterior);
      return;
    }
    if (Object.hasOwn(TELAS_REACT, tela)) {
      const [titulo, subtitulo, controlador] = TELAS_REACT[tela]!(
        configuracao,
        janela,
      );
      $("page-" + tela)?.classList.add("active");
      definirTitulo(titulo, subtituloDaArea(subtitulo));
      if (destino.visao) controlador?.abrirVisao?.(destino.visao);
      // O render das telas React costuma carregar dados: a falha vira aviso.
      Promise.resolve(controlador?.render()).catch((erro) => {
        console.error(`Falha ao abrir ${titulo}:`, erro);
        avisar(
          `Não foi possível abrir ${titulo}: ${erroAmigavel(erro)}`,
          "error",
        );
      });
      abriu(tela, anterior);
      return;
    }
    if (tela === "config") {
      $("page-config")?.classList.add("active");
      definirTitulo(
        configuracao("config_nav_title"),
        configuracao("config_page_subtitle"),
      );
      // Reabre a seção guardada (ou a primeira permitida); em Acessos, carrega a tela React.
      abrirSecaoDeConfiguracao(documento, secaoAtualDeConfiguracao(documento));
      abriu(tela, anterior);
      return;
    }
    if (ehPainelExterno(tela)) {
      const painel = paineis.mostrar(codigoDoPainel(tela));
      if (painel)
        definirTitulo(painel.titulo, configuracao("external_default_title"));
      abriu(tela, anterior);
    }
  }

  /*
    O catálogo ou a situação mudou no meio da sessão (src/app/vigia-do-catalogo.ts,
    já com o menu remontado). A página aberta que ficou desligada, ou em
    manutenção para quem não é administrador global, troca pelo aviso — a
    tela React fica escondida e não carrega mais nada. Com trabalho não salvo,
    a página fica com a faixa, e fecha numa próxima checagem, depois de salvo.
    Página religada não reabre sozinha: o menu já a mostra de novo.
  */
  function reavaliarTelaAtual() {
    if (view === TELA_SEM_ACESSO || avisoNoLugarDaPagina(documento)) return;
    const area = areaAtual();
    const situacao = situacaoDoSistema();
    const fechada = desligada(view, area);
    const manutencao =
      !fechada &&
      !isAdminGlobal(perfil()) &&
      !situacao.adminGlobal &&
      situacaoEfetiva({
        situacao,
        abas: abasDoMenu(),
        view,
        area,
      });
    if (!fechada && !manutencao) {
      // Continua aberta: só a faixa (a do administrador, ou nenhuma) se ajusta.
      aplicarManutencaoNaNavegacao({
        documento,
        view,
        area,
        abas: abasDoMenu(),
        adminGlobal: isAdminGlobal(perfil()),
      });
      return;
    }
    if (temTrabalhoNaoSalvo()) {
      avisarNaFaixa(
        documento,
        textoDaFaixaDeSaida(fechada ? "desligada" : "manutencao"),
        fechada ? "desligada" : "saida",
      );
      return;
    }
    irPara(view);
  }

  /*
    Trocou a área (menu): o cabeçalho da Visão geral muda (o estado dela tira o
    DSEI aberto, poda os filtros e troca o mapa). Devolve o cancelamento.
  */
  function acompanharArea() {
    let area = areaAtual();
    return assinarDadosDoMonitoramento(() => {
      const nova = areaAtual();
      if (nova === area) return;
      area = nova;
      tituloDaVisaoGeral();
    });
  }

  return {
    obter: () => estado,
    assinar(ouvinte: OuvinteDaNavegacao) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    irPara,
    montarMenu,
    reavaliarTelaAtual,
    marcarMenu,
    definirTitulo,
    acompanharArea,
    telaPermitida: permitida,
    telaInicialDoSistema: inicialDoSistema,
    telaDeEntrada: deEntrada,
    telaGuardada,
    guardarTela,
  };
}

export type Navegacao = ReturnType<typeof criarNavegacao>;
