import {
  avisar as avisarEvento,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../lib/eventos-da-barra-lateral.ts";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.ts";
import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.ts";
import { avisar as avisarPadrao } from "./avisos.ts";
import { irParaTela } from "./ir-para-tela.ts";

/*
  A moldura do app como store: a barra lateral recolhida (e aberta por cima
  no celular), o tema claro/escuro e a tela cheia; e o "Montar relatório" do
  menu da conta, que abre o montador da Visão geral. Sem DOM nas ações: elas
  só mudam o estado.

  Quem leva o estado para a página é a casca (src/app/casca/pecas.tsx,
  `MolduraNaPagina`): `ligarNaPagina()` aplica as classes de `body`
  (`sidebar-collapsed`, `sidebar-open`, `dark-mode`, `app-fullscreen-fallback`,
  `system-fullscreen-mode`) e o `html[data-theme]` a cada mudança, avisa a
  barra lateral pelos eventos de eventos-da-barra-lateral.ts e acompanha a
  largura da janela, o tema trocado em outra aba e a tela cheia do navegador
  — e desliga tudo ao desmontar. O ícone da tela cheia (menu da conta) é
  React e lê daqui.

  O primeiro quadro é do index.html: a classe `sidebar-collapsed` do `<body>`
  e o script do `<head>` (tema escuro de quem tem sessão guardada). O estado
  inicial é lido de lá, para o React não desfazer o que já está pintado.

  As chaves do localStorage são as que o script do <head> lê antes do
  primeiro quadro (barra e tema da visita anterior).

  Contratos: `window.toggleSidebar`, `toggleDarkMode`, `toggleBrowserFullscreen`
  e `exportPDF` (o "Montar relatório"; casca em src/app/casca/ e barra lateral React), publicados por
  src/app/sistema.ts.
*/

export const CHAVE_DA_BARRA_RECOLHIDA = "agsus_monitora_sidebar_collapsed_v1";
export const CHAVE_DO_TEMA = "agsus_dark_mode_v1";
const LARGURA_DO_CELULAR = 900;

export interface EstadoDaMoldura {
  readonly barraRecolhida: boolean;
  /** No celular, a gaveta aberta por cima. */
  readonly barraAberta: boolean;
  readonly temaEscuro: boolean;
  /** Sem a tela cheia do navegador: o app expandido dentro da janela. */
  readonly telaCheiaDoApp: boolean;
  readonly telaCheiaDoNavegador: boolean;
}

export interface OpcoesDaMoldura {
  documento?: Document;
  janela?: Window;
  armazenamento?: () => Storage | null | undefined;
  avisar?: (texto: string, tom?: string) => void;
  alvoDaTelaCheia?: () => Element | null | undefined;
  /** A Visão geral está aberta? (o montador abre nela) */
  naVisaoGeral?: () => boolean;
  irParaVisaoGeral?: () => unknown;
  abrirMontador?: () => void;
  areaAtual?: () => string;
}

/** Leva o estado para a página: classes, tema e os avisos da barra lateral. */
function aplicarNaPagina(
  documento: Document,
  estado: EstadoDaMoldura,
  anterior: EstadoDaMoldura | null,
) {
  const corpo = documento.body;
  const html = documento.documentElement;
  if (corpo) {
    corpo.classList.toggle("sidebar-collapsed", estado.barraRecolhida);
    corpo.classList.toggle("sidebar-open", estado.barraAberta);
    // O CSS antigo ainda lê `body.dark-mode`; o novo, `html[data-theme]`.
    corpo.classList.toggle("dark-mode", estado.temaEscuro);
    corpo.classList.toggle("app-fullscreen-fallback", estado.telaCheiaDoApp);
    corpo.classList.toggle(
      "system-fullscreen-mode",
      estado.telaCheiaDoApp || estado.telaCheiaDoNavegador,
    );
  }
  html.setAttribute("data-theme", estado.temaEscuro ? "dark" : "");
  html.style.colorScheme = estado.temaEscuro ? "dark" : "light";
  if (
    !anterior ||
    anterior.barraRecolhida !== estado.barraRecolhida ||
    anterior.barraAberta !== estado.barraAberta
  )
    avisarEvento(EVENTO_BARRA_ALTERNADA, undefined, documento);
  if (!anterior || anterior.temaEscuro !== estado.temaEscuro)
    avisarEvento(EVENTO_TEMA_ALTERADO, undefined, documento);
}

export function criarMoldura({
  documento = globalThis.document,
  janela = globalThis.window,
  armazenamento = () => globalThis.localStorage,
  avisar = avisarPadrao,
  alvoDaTelaCheia = () => null,
  naVisaoGeral = () => estadoDaVisaoGeral.obter().aberta,
  irParaVisaoGeral = () => irParaTela({ view: "dashboard" }),
  abrirMontador = () => estadoDaVisaoGeral.abrirMontador(),
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
}: OpcoesDaMoldura = {}) {
  // O que o primeiro quadro (index.html) já pintou.
  let estado: EstadoDaMoldura = Object.freeze({
    barraRecolhida:
      documento?.body?.classList.contains("sidebar-collapsed") ?? true,
    barraAberta: documento?.body?.classList.contains("sidebar-open") ?? false,
    temaEscuro:
      documento?.documentElement?.getAttribute("data-theme") === "dark",
    telaCheiaDoApp: false,
    telaCheiaDoNavegador: Boolean(documento?.fullscreenElement),
  });
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<EstadoDaMoldura>) {
    const novo = { ...estado, ...mudancas };
    const mudou = (Object.keys(mudancas) as (keyof EstadoDaMoldura)[]).some(
      (chave) => estado[chave] !== novo[chave],
    );
    if (!mudou) return;
    estado = Object.freeze(novo);
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  function guardar(chave: string, valor: string) {
    try {
      armazenamento()?.setItem(chave, valor);
    } catch {
      // Sem localStorage (aba privada, bloqueio): vale só nesta visita.
    }
  }
  function ler(chave: string) {
    try {
      return armazenamento()?.getItem(chave) ?? null;
    } catch {
      return null;
    }
  }

  // ── Barra lateral ─────────────────────────────────────────────────────

  const ehCelular = () =>
    Boolean(
      janela?.matchMedia?.(`(max-width:${LARGURA_DO_CELULAR}px)`)?.matches,
    );

  /* No celular, a barra só fica aberta quando a pessoa abriu (`sidebar-open`). */
  function ajustarBarra() {
    if (ehCelular() && !estado.barraAberta) publicar({ barraRecolhida: true });
  }

  function aplicarBarraGuardada() {
    if (ehCelular()) return;
    const guardada = ler(CHAVE_DA_BARRA_RECOLHIDA);
    if (guardada === "0") publicar({ barraRecolhida: false });
    if (guardada === "1") publicar({ barraRecolhida: true });
  }

  function alternarBarra() {
    if (ehCelular()) {
      const abrindo = estado.barraRecolhida && !estado.barraAberta;
      publicar({ barraAberta: abrindo, barraRecolhida: !abrindo });
      janela?.dispatchEvent(new Event("resize"));
      return;
    }
    ajustarBarra();
    const recolhida = !estado.barraRecolhida;
    publicar({ barraRecolhida: recolhida });
    guardar(CHAVE_DA_BARRA_RECOLHIDA, recolhida ? "1" : "0");
  }

  // ── Tema ──────────────────────────────────────────────────────────────

  function aplicarTema(escuro: boolean) {
    publicar({ temaEscuro: escuro });
  }

  function alternarTema() {
    const escuro = !estado.temaEscuro;
    guardar(CHAVE_DO_TEMA, escuro ? "1" : "0");
    aplicarTema(escuro);
  }

  /* Sem preferência guardada, claro: a tela de acesso não abre escura no primeiro acesso. */
  function aplicarTemaGuardado() {
    aplicarTema(ler(CHAVE_DO_TEMA) === "1");
  }

  // ── Tela cheia ────────────────────────────────────────────────────────

  /* Sem a tela cheia do navegador: o app se expande dentro da janela. */
  function telaCheiaDoApp(forcar?: unknown) {
    const ativa = typeof forcar === "boolean" ? forcar : !estado.telaCheiaDoApp;
    publicar({
      telaCheiaDoApp: ativa,
      telaCheiaDoNavegador: Boolean(documento?.fullscreenElement),
    });
    avisar(ativa ? "Modo expandido ativado." : "Modo expandido desativado.");
  }

  function alternarTelaCheia() {
    try {
      if (estado.telaCheiaDoApp) {
        telaCheiaDoApp(false);
        return;
      }
      if (documento.fullscreenElement) {
        documento.exitFullscreen?.()?.catch?.(() => telaCheiaDoApp(false));
        return;
      }
      // O painel externo aberto vai para a tela cheia sozinho; senão, o app.
      const alvo = alvoDaTelaCheia() || documento.documentElement;
      if (!documento.fullscreenEnabled || !alvo?.requestFullscreen) {
        telaCheiaDoApp(true);
        return;
      }
      alvo.requestFullscreen()?.catch?.(() => telaCheiaDoApp(true));
    } catch {
      telaCheiaDoApp(true);
    }
  }

  /* Sai da tela cheia (do navegador ou do app), se houver. */
  function sairDaTelaCheia() {
    try {
      if (documento.fullscreenElement && documento.exitFullscreen)
        documento.exitFullscreen()?.catch?.(() => {});
    } catch {
      // O navegador já saiu da tela cheia.
    }
    if (estado.telaCheiaDoApp) telaCheiaDoApp(false);
  }

  // ── Relatório (o montador da Visão geral) ──────────────────────────────

  /*
    "Montar relatório" no menu da conta (13/11/2026): abre o montador da Visão
    geral (src/modulos/visao-geral/montador-de-relatorio.tsx), indo para ela
    se a pessoa está em outra tela. Antes, imprimia a tela inteira.
  */
  function montarRelatorio() {
    if (!naVisaoGeral()) irParaVisaoGeral();
    abrirMontador();
  }

  // ── A página ──────────────────────────────────────────────────────────

  /**
   * Liga o estado à página (a casca chama ao montar): aplica agora e a cada
   * mudança, e acompanha a largura (no celular, a barra volta a recolher),
   * o tema trocado em outra aba e a tela cheia do navegador. Devolve o
   * desligamento.
   */
  function ligarNaPagina(): () => void {
    let aplicado: EstadoDaMoldura | null = null;
    const aplicar = () => {
      aplicarNaPagina(documento, estado, aplicado);
      aplicado = estado;
    };
    aplicar();
    ouvintes.add(aplicar);

    // A área aberta vai para `html[data-area]`: a cor da área (tokens.css).
    const aplicarArea = () => {
      const area = areaAtual();
      if (area) documento.documentElement.setAttribute("data-area", area);
      else documento.documentElement.removeAttribute("data-area");
    };
    aplicarArea();
    const largarArea = assinarDadosDoMonitoramento(aplicarArea);

    let espera: ReturnType<typeof setTimeout> | null = null;
    const aoMudar = (atraso: number) => () => {
      clearTimeout(espera!);
      espera = setTimeout(ajustarBarra, atraso);
    };
    const aoRedimensionar = aoMudar(220);
    const aoGirar = aoMudar(300);
    const aoGuardar = (evento: StorageEvent) => {
      if (evento.key && evento.key !== CHAVE_DO_TEMA) return;
      if (evento.newValue !== "1" && evento.newValue !== "0") return;
      aplicarTema(evento.newValue === "1");
    };
    const aoMudarTelaCheia = () =>
      publicar({ telaCheiaDoNavegador: Boolean(documento.fullscreenElement) });
    janela.addEventListener("resize", aoRedimensionar);
    janela.addEventListener("orientationchange", aoGirar);
    janela.addEventListener("storage", aoGuardar as EventListener);
    documento.addEventListener("fullscreenchange", aoMudarTelaCheia);
    return () => {
      ouvintes.delete(aplicar);
      largarArea();
      clearTimeout(espera!);
      janela.removeEventListener("resize", aoRedimensionar);
      janela.removeEventListener("orientationchange", aoGirar);
      janela.removeEventListener("storage", aoGuardar as EventListener);
      documento.removeEventListener("fullscreenchange", aoMudarTelaCheia);
    };
  }

  return {
    obter: (): EstadoDaMoldura => estado,
    assinar(ouvinte: () => void): () => void {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    ligarNaPagina,
    ajustarBarra,
    aplicarBarraGuardada,
    alternarBarra,
    aplicarTema,
    alternarTema,
    aplicarTemaGuardado,
    alternarTelaCheia,
    sairDaTelaCheia,
    montarRelatorio,
  };
}

export type Moldura = ReturnType<typeof criarMoldura>;
