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
import {
  caminhoDoDestino,
  destinoDoCaminho,
  ehRaizDoApp,
  telaDaRota,
} from "../lib/rotas.ts";
import type { DestinoDaRota } from "../lib/rotas.ts";
import { definirPaginaDaAba } from "../lib/identidade-da-aba";
import { cabecalhoDaVisaoGeral } from "../lib/visao-geral-da-area.ts";
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
import { criarEndereco } from "./endereco.ts";
import type { Endereco } from "./endereco.ts";
import type { PerfilDeAcesso } from "../lib/tipos-dos-acessos.ts";
import type { PaineisDaNavegacao } from "../lib/navegacao";
import type { ArvoreDoMenu } from "../componentes/barra-lateral/tipos.ts";

/*
  A navegação do app, sem React e sem mexer nas telas pelo DOM: um store com
  a tela aberta (view, área, edital, visão, seção, título) que o React lê
  (src/app/telas.tsx desenha as `<section class="page">` e marca a ativa; o
  cabeçalho lê o título) e o endereço da página (src/app/endereco.ts, regras
  em src/lib/rotas.ts): a área e a tela ficam na URL, e o voltar/avançar do
  navegador, o recarregar e o link compartilhado funcionam.

  Também decide: as permissões por tela (src/lib/navegacao.ts), a guarda de
  saída de Acessos, Módulos e abas e Configurações, a versão nova esperando,
  a tela guardada para a próxima entrada e o menu da barra lateral que o
  perfil vê. `window.navigate(view)` (é `irPara`) continua sendo o contrato
  de quem troca de tela fora do React.

  Página desligada pela coordenação (ou em manutenção) também fecha no meio
  da sessão: o vigia do catálogo (src/app/vigia-do-catalogo.ts) relê o
  catálogo quando ele muda e chama `reavaliarTelaAtual`, que troca a página
  pelo aviso — ou, com trabalho não salvo (`temTrabalhoNaoSalvo`), só mostra
  a faixa e espera salvar.

  Quem acompanha assina: `assinar(ouvinte)` recebe `{ tipo: "abertura",
  view, anterior }` uma vez por tela aberta (auditoria e presença, em
  src/app/presenca.ts; a página aberta, em src/app/pagina-aberta.ts),
  `{ tipo: "aviso", view }` quando, no lugar dela, ficou um aviso (sem
  acesso, desligada, manutenção), `{ tipo: "menu" }` quando o menu mudou sem
  trocar de tela (menu refeito, seção de Configurações) e `{ tipo: "estado" }`
  nas outras mudanças do store. O React assina o mesmo canal
  (`useSyncExternalStore(assinar, obter)`).
*/

/** O que a navegação avisa a quem assina. */
export type EventoDaNavegacao =
  | { tipo: "menu" }
  | { tipo: "abertura"; view: string; anterior: string }
  | { tipo: "aviso"; view: string }
  | { tipo: "estado" };
export type OuvinteDaNavegacao = (evento: EventoDaNavegacao) => void;

/**
 * A tela aberta. `abertura` conta as aberturas (cada uma chama `render()`
 * da tela, como antes); `aviso` diz o que está no lugar da página.
 */
export interface EstadoDaNavegacao {
  readonly view: string;
  readonly area: string;
  readonly edital: string;
  readonly visao: string;
  readonly secao: string;
  readonly aviso: "" | "sem-acesso" | "fechada";
  readonly titulo: string;
  readonly subtitulo: string;
  readonly abertura: number;
}

/** O que o React lê da navegação (src/app/contexto-do-app.ts). */
export interface LeituraDaNavegacao {
  obter(): EstadoDaNavegacao;
  assinar(ouvinte: OuvinteDaNavegacao): () => void;
  /** O edital e a visão do endereço já foram abertos pela tela. */
  esquecerEditalEVisao(): void;
}

/** O que pergunta antes de sair (Acessos, Módulos e abas). */
interface ControleComSaida {
  confirmarSaida?(): unknown;
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
    )?.acessosController?.confirmarSaida?.() !== false &&
    (
      janela as JanelaComSaida | null | undefined
    )?.modulosController?.confirmarSaida?.() !== false &&
    estadoDasConfiguracoes.confirmarSaida()
  );
}

/** Os painéis externos, como a navegação os usa (src/app/paineis-externos.ts). */
export interface PaineisDoApp extends PaineisDaNavegacao {
  doMenu(): readonly { codigo?: string | null; titulo?: string | null }[];
  mostrar(codigo: string): { titulo: string } | null | void;
  esquecerAtual(): void;
}

/** A janela: a guarda de saída e a recarga. */
export type JanelaDaNavegacao = JanelaComSaida & {
  location: { reload(): void };
};

/** O que vai junto com a tela pedida. */
export interface ExtrasDaNavegacao {
  edital?: string | null | undefined;
  visao?: string | null | undefined;
  secao?: string | null | undefined;
}

export interface OpcoesDaNavegacao {
  documento?: Document;
  janela?: JanelaDaNavegacao;
  endereco?: Endereco;
  armazenamento?: () => Storage | null | undefined;
  armazenamentoDaAba?: () => Storage | null | undefined;
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

/** Endereço aberto antes de entrar (link compartilhado, volta do Google). */
export const CHAVE_DA_ROTA_PEDIDA = "monitora:rota-pedida";

export const TEXTO_ROTA_DESCONHECIDA =
  "Este endereço não é uma tela do MONITORA. Abrimos a tela inicial.";

export const ESTADO_INICIAL_DA_NAVEGACAO: EstadoDaNavegacao = Object.freeze({
  view: "dashboard",
  area: "",
  edital: "",
  visao: "",
  secao: "",
  aviso: "",
  titulo: "",
  subtitulo: "",
  abertura: 0,
});

/* O que fazer com o endereço ao abrir: nova entrada, trocar a atual. */
type ModoDoEndereco = "empilhar" | "substituir";

/**
 * Dependências: `obterPerfil` (perfil de quem entrou), `paineis` (painéis
 * externos: `podeAbrir(codigo)`, `primeiro()`, `doMenu()`, `mostrar(codigo)`
 * e `esquecerAtual()`), `configuracao` (valor de TB_CONFIGURACAO), `avisar`
 * (toast), `ajustarBarra` (barra lateral recolhida no celular) e `endereco`
 * (o histórico do navegador).
 */
export function criarNavegacao({
  documento = globalThis.document,
  janela = globalThis.window,
  endereco = criarEndereco(),
  armazenamento = () => globalThis.localStorage,
  armazenamentoDaAba = () => globalThis.sessionStorage,
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
  let estado: EstadoDaNavegacao = ESTADO_INICIAL_DA_NAVEGACAO;
  /* A última árvore do menu: dela sai a página do botão "Ir para a página inicial". */
  let arvore: ArvoreDoMenu = [];
  /* Fora do sistema (tela de acesso), o voltar do navegador não troca de tela. */
  let sistemaAberto = false;
  const ouvintes = new Set<OuvinteDaNavegacao>();

  const perfil = () => obterPerfil();
  const areaAtual = () => obterDadosDoMonitoramento().areaAtual;
  const view = () => estado.view;

  function avisarOuvintes(evento: EventoDaNavegacao) {
    ouvintes.forEach((ouvinte) => ouvinte(evento));
  }

  function publicar(mudancas: Partial<EstadoDaNavegacao>) {
    estado = Object.freeze({ ...estado, ...mudancas });
  }

  // ── Tela guardada e endereço pedido antes de entrar ────────────────────

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

  /*
    O endereço com que a página abriu (link compartilhado, F5) fica na aba:
    o retorno do Google volta para `/?auth=google`, e a tela pedida abre
    depois de entrar, se o perfil puder.
  */
  function anotarRotaPedida() {
    const { caminho, busca } = endereco.obter();
    if (ehRaizDoApp(caminho)) return;
    try {
      armazenamentoDaAba()?.setItem(CHAVE_DA_ROTA_PEDIDA, caminho + busca);
    } catch {
      // Sem sessionStorage: o link só abre direto com a sessão já guardada.
    }
  }
  anotarRotaPedida();

  function rotaPedida() {
    try {
      return armazenamentoDaAba()?.getItem(CHAVE_DA_ROTA_PEDIDA) || "";
    } catch {
      return "";
    }
  }

  function esquecerRotaPedida() {
    try {
      armazenamentoDaAba()?.removeItem(CHAVE_DA_ROTA_PEDIDA);
    } catch {
      // Nada a esquecer.
    }
  }

  /*
    O destino pedido: o do endereço; na raiz (volta do Google), o anotado
    quando a página abriu. `desconhecido`: havia um endereço, mas não é tela.
  */
  function destinoPedido(): {
    destino: DestinoDaRota | null;
    desconhecido: boolean;
  } {
    const { caminho, busca } = endereco.obter();
    const pedido = ehRaizDoApp(caminho) ? rotaPedida() : caminho + busca;
    if (!pedido) return { destino: null, desconhecido: false };
    const [so = "", ...resto] = pedido.split("?");
    const destino = destinoDoCaminho(so, resto.join("?"));
    return { destino, desconhecido: !destino && !ehRaizDoApp(so) };
  }

  // ── Permissões e páginas desligadas ────────────────────────────────────

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

  /* A área do endereço vale se for do usuário; senão, fica a atual. */
  function usarAreaDoEndereco(area: string | undefined) {
    if (area && obterDadosDoMonitoramento().areas.includes(area))
      definirAreaAtual(area);
  }

  /*
    A tela ao entrar: a do endereço (link, F5), se o perfil puder; senão a
    última aberta, se ainda for permitida; senão, a inicial do sistema.
  */
  function deEntrada() {
    const { destino } = destinoPedido();
    if (destino?.view && permitida(destino.view)) {
      usarAreaDoEndereco(destino.area);
      return ligadaOuPrimeira(destino.view);
    }
    return ligadaOuPrimeira(telaDeEntrada(telaGuardada(), perfil(), paineis));
  }

  /*
    A tela que deve abrir, antes do perfil chegar (o formato do skeleton da
    entrada): a do endereço, ou a guardada. Sem conferir permissão.
  */
  function telaEsperada() {
    return destinoPedido().destino?.view || telaGuardada();
  }

  /* O botão da página desativada (e da manutenção): a primeira página ligada do menu. */
  function irParaInicio() {
    const item = primeiraPaginaLigada(arvore, areaAtual(), view());
    if (!item) {
      irPara(inicialDoSistema());
      return;
    }
    if (item.area) definirAreaAtual(item.area);
    irPara(item.view);
  }

  // ── Cabeçalho e menu ──────────────────────────────────────────────────

  /* O título vai para o store (o cabeçalho React lê), a aba do navegador e a Aya. */
  function definirTitulo(titulo: string, subtitulo: string) {
    publicar({ titulo: titulo || "", subtitulo: subtitulo || "" });
    // O nome da aba tem um dono só; aqui entra apenas a metade da página.
    definirPaginaDaAba(titulo);
    // A Aya (src/modulos/aya/) acompanha a página: saudação, sugestões e contexto.
    definirPaginaDaAya(view(), titulo);
  }

  /* As telas das áreas mostram só a área atual; o subtítulo diz qual. */
  function subtituloDaArea(sub: string) {
    return [nomeDaArea(areaAtual()), sub].filter(Boolean).join(" · ");
  }

  /*
    A Visão geral é uma só para as três áreas (React, src/modulos/visao-geral/):
    daqui sai só o cabeçalho, que muda com a área.
  */
  function tituloDaVisaoGeral() {
    const { titulo, subtitulo } = cabecalhoDaVisaoGeral(areaAtual(), {
      titulo: configuracao("page_title"),
      subtitulo: configuracao("page_subtitle"),
    });
    definirTitulo(titulo, subtitulo);
  }

  function marcarMenu(tela: string = view()) {
    marcarItemAtivoNoMenu(tela, secaoAtualDeConfiguracao(documento));
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
      aoAbrirSecao: (_view, secao) => abrirSecao(secao),
      paginaAtiva: (tela) => estado.view === tela && !estado.aviso,
      textoVazio: configuracao("permissions_empty_text"),
    });
    marcarMenu();
    avisarOuvintes({ tipo: "menu" });
  }

  /*
    Seção de Configurações (o menu, com a página já aberta): a seção vai para
    o endereço. A seção pode recusar (saída de Acessos com alteração não salva).
  */
  function abrirSecao(secao: string): boolean {
    if (!abrirSecaoDeConfiguracao(documento, secao)) return false;
    publicar({ secao: secaoAtualDeConfiguracao(documento) });
    endereco.ir(caminhoAtual());
    marcarMenu();
    avisarOuvintes({ tipo: "menu" });
    return true;
  }

  // ── Endereço ───────────────────────────────────────────────────────────

  const caminhoAtual = () =>
    caminhoDoDestino(
      estado.aviso === "sem-acesso"
        ? { view: TELA_SEM_ACESSO }
        : {
            view: estado.view,
            area: estado.area,
            edital: estado.edital,
            visao: estado.visao,
            secao: estado.secao,
          },
    );

  // ── Troca de tela ─────────────────────────────────────────────────────

  /**
   * Abre a tela (o `navigate` de sempre). Sem permissão, avisa e fica onde
   * está. Devolve `false` quando a navegação foi recusada (saída não
   * confirmada ou sem permissão): quem trocou a área antes de navegar a
   * devolve. `extras` leva o edital e a visão (links "Ir para…").
   */
  function irPara(pedida: unknown, extras: ExtrasDaNavegacao = {}): boolean {
    // Link antigo (`entrevistas:conduzir`…) vai para a tela e a visão novas.
    const destino = destinoDaTela(pedida);
    return (
      abrir(
        {
          view: destino.view || deEntrada(),
          visao: extras.visao || destino.visao,
          edital: extras.edital || "",
          secao: extras.secao || "",
        },
        "empilhar",
      ) !== false
    );
  }

  /*
    A tela de agora de novo ("Atualizar dados", catálogo novo): chama o
    `render()` outra vez, sem empilhar endereço nem perguntar nada.
  */
  function reabrir(): boolean {
    return (
      abrir({ view: estado.view, secao: estado.secao }, "substituir") !== false
    );
  }

  /* Depois de entrar: a tela do endereço (link, F5), a guardada ou a inicial. */
  function abrirEntrada(): boolean {
    sistemaAberto = true;
    const { destino, desconhecido } = destinoPedido();
    esquecerRotaPedida();
    if (desconhecido) avisar(TEXTO_ROTA_DESCONHECIDA, "warn");
    if (destino?.view && permitida(destino.view)) {
      usarAreaDoEndereco(destino.area);
      const tela = ligadaOuPrimeira(destino.view);
      if (
        abrir(
          tela === destino.view ? destino : { view: tela },
          "substituir",
        ) !== false
      )
        return true;
    } else if (destino?.view) {
      // Link para uma tela que o perfil não abre: o aviso de sempre.
      const bloqueio = bloqueioDaTela(destino.view, perfil(), paineis);
      if (bloqueio) avisar(bloqueio, "warn");
    }
    const tela = ligadaOuPrimeira(
      telaDeEntrada(telaGuardada(), perfil(), paineis),
    );
    return abrir({ view: tela }, "substituir") !== false;
  }

  /* Saiu (ou ficou sem acesso): o voltar do navegador não abre mais tela. */
  function fechar() {
    sistemaAberto = false;
  }

  function abrir(
    destino: DestinoDaRota,
    modo: ModoDoEndereco,
  ): boolean | undefined {
    const anterior = estado.view;
    const tela = destino.view;
    if (tela !== anterior && !confirmarSaida()) return false;
    // Versão nova do sistema esperando: entra agora, já no endereço da tela
    // pedida (e ela fica guardada; a tela de entrada confere a permissão).
    // Com rascunho ainda não guardado (ex.: a regra,
    // src/app/guarda-de-alteracoes.ts), a versão nova espera a próxima troca.
    if (
      tela !== anterior &&
      podeRecarregar() &&
      aplicarAtualizacao(() => {
        guardarTela(tela);
        endereco.ir(caminhoDoDestino({ ...destino, area: areaAtual() }));
        recarregar();
      })
    )
      return undefined;

    // A permissão vem antes de mudar a tela atual.
    const bloqueio = bloqueioDaTela(tela, perfil(), paineis);
    if (bloqueio) {
      avisar(bloqueio, "warn");
      return false;
    }

    documento.body.classList.remove("external-clean");
    documento.body.classList.remove("external-panel-mode");
    guardarTela(tela);
    if (!ehPainelExterno(tela)) paineis.esquecerAtual();
    ajustarBarra();
    publicar({
      view: tela,
      area: areaAtual(),
      edital: destino.edital || "",
      visao: destino.visao || "",
      secao: tela === "config" ? destino.secao || "" : "",
      aviso: "",
    });
    marcarMenu(tela);

    if (tela === TELA_SEM_ACESSO) {
      publicar({ aviso: "sem-acesso", abertura: estado.abertura + 1 });
      definirTitulo(
        "Acesso aos módulos",
        "Nenhum módulo disponível para seu perfil.",
      );
      return concluir(modo, { tipo: "aviso", view: tela });
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
      publicar({ aviso: "fechada", abertura: estado.abertura + 1 });
      definirTitulo(
        fechada ? "Página desativada" : "Em manutenção",
        subtituloDaArea(""),
      );
      return concluir(modo, { tipo: "aviso", view: tela });
    }

    publicar({ abertura: estado.abertura + 1 });
    const daRota = telaDaRota(tela);
    if (tela === "dashboard") tituloDaVisaoGeral();
    else if (daRota)
      definirTitulo(
        daRota.titulo,
        subtituloDaArea(daRota.subtitulo?.(configuracao) ?? ""),
      );
    else if (tela === "config") {
      definirTitulo(
        configuracao("config_nav_title"),
        configuracao("config_page_subtitle"),
      );
      // A seção do endereço, ou a guardada (ou a primeira permitida); em Acessos, carrega a tela React.
      abrirSecaoDeConfiguracao(
        documento,
        destino.secao || secaoAtualDeConfiguracao(documento),
      );
      publicar({ secao: secaoAtualDeConfiguracao(documento) });
      marcarMenu(tela);
    } else if (ehPainelExterno(tela)) {
      const painel = paineis.mostrar(codigoDoPainel(tela));
      if (painel)
        definirTitulo(painel.titulo, configuracao("external_default_title"));
    }
    return concluir(modo, { tipo: "abertura", view: tela, anterior });
  }

  /* Endereço escrito e quem assina avisado: uma vez por abertura. */
  function concluir(modo: ModoDoEndereco, evento: EventoDaNavegacao) {
    endereco.ir(caminhoAtual(), { substituir: modo === "substituir" });
    avisarOuvintes(evento);
    return true;
  }

  /*
    O edital e a visão do endereço valem uma vez: a tela os abriu
    (src/app/telas.tsx), e o endereço volta a ser o da tela, sem empilhar —
    escolher outro edital lá dentro não deixa a URL mentindo.
  */
  function esquecerEditalEVisao() {
    if (!estado.edital && !estado.visao) return;
    publicar({ edital: "", visao: "" });
    endereco.ir(caminhoAtual(), { substituir: true });
    avisarOuvintes({ tipo: "estado" });
  }

  /*
    Voltar/avançar do navegador: o endereço já mudou. Passa pelas mesmas
    guardas do clique; recusado (alteração não salva, sem permissão), o
    endereço volta a ser o da tela aberta. Rota que não existe vai para a
    tela de entrada, com aviso. O mesmo endereço (as Regras do edital marcam
    o histórico sem mudar a URL) não troca nada.
  */
  function aoMudarEndereco() {
    if (!sistemaAberto) return;
    const { caminho, busca } = endereco.obter();
    if (caminho + busca === caminhoAtual()) return;
    const destino = destinoDoCaminho(caminho, busca);
    if (!destino) {
      if (!ehRaizDoApp(caminho)) avisar(TEXTO_ROTA_DESCONHECIDA, "warn");
      abrir(
        {
          view: ligadaOuPrimeira(
            telaDeEntrada(telaGuardada(), perfil(), paineis),
          ),
        },
        "substituir",
      );
      return;
    }
    const areaAnterior = areaAtual();
    usarAreaDoEndereco(destino.area);
    if (abrir(destino, "substituir") === false) {
      definirAreaAtual(areaAnterior);
      endereco.ir(caminhoAtual());
    }
  }
  const pararDeOuvirOEndereco = endereco.assinar(aoMudarEndereco);

  /*
    O catálogo ou a situação mudou no meio da sessão (src/app/vigia-do-catalogo.ts,
    já com o menu remontado). A página aberta que ficou desligada, ou em
    manutenção para quem não é administrador global, troca pelo aviso — a
    tela React fica escondida e não carrega mais nada. Com trabalho não salvo,
    a página fica com a faixa, e fecha numa próxima checagem, depois de salvo.
    Página religada não reabre sozinha: o menu já a mostra de novo.
  */
  function reavaliarTelaAtual() {
    if (estado.aviso === "sem-acesso" || avisoNoLugarDaPagina(documento))
      return;
    const area = areaAtual();
    const situacao = situacaoDoSistema();
    const fechada = desligada(view(), area);
    const manutencao =
      !fechada &&
      !isAdminGlobal(perfil()) &&
      !situacao.adminGlobal &&
      situacaoEfetiva({
        situacao,
        abas: abasDoMenu(),
        view: view(),
        area,
      });
    if (!fechada && !manutencao) {
      // Continua aberta: só a faixa (a do administrador, ou nenhuma) se ajusta.
      aplicarManutencaoNaNavegacao({
        documento,
        view: view(),
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
    reabrir();
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
      if (view() !== "dashboard" || estado.aviso) return;
      tituloDaVisaoGeral();
      avisarOuvintes({ tipo: "estado" });
    });
  }

  return {
    obter: () => estado,
    assinar(ouvinte: OuvinteDaNavegacao) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    irPara,
    reabrir,
    abrirEntrada,
    abrirSecao,
    fechar,
    /** Para de ouvir o voltar/avançar (testes; o app tem uma navegação só). */
    desligar: pararDeOuvirOEndereco,
    esquecerEditalEVisao,
    montarMenu,
    reavaliarTelaAtual,
    marcarMenu,
    acompanharArea,
    telaPermitida: permitida,
    telaInicialDoSistema: inicialDoSistema,
    telaDeEntrada: deEntrada,
    telaGuardada,
    telaEsperada,
    guardarTela,
  };
}

export type Navegacao = ReturnType<typeof criarNavegacao>;
