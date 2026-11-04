import { getSupabaseClient } from "../lib/supabaseClient";
import { permissaoLegada } from "../lib/access-roles.ts";
import { enderecoDoPainel } from "../lib/endereco-do-painel";
import { semOPainelAntigoDeAnalises } from "../lib/pagina-do-painel";
import {
  origensParaPreconectar,
  precisaDeCrossorigin,
} from "../lib/carregamento-do-painel.ts";
import { codigoDoPainel, ehPainelExterno } from "../lib/navegacao";
import { acompanharCarregamentoDoPainel } from "../modulos/paineis-externos/carregamento-do-painel.tsx";
import { estadoDasConfiguracoes } from "../modulos/configuracoes/estado.ts";
import { avisar as avisarPadrao } from "./avisos.ts";
import type { PerfilDeAcesso } from "../lib/tipos-dos-acessos.ts";

/*
  Os painéis externos (TB_PAINEL_EXTERNO): a lista, os liberados para o perfil
  e o quadro (`#page-external`, um iframe por painel). Quem troca de tela é a
  navegação (src/app/navegacao.ts), que chama `mostrar(codigo)` e põe o título.

  O iframe nasce na primeira abertura e fica até a página fechar (ou até o
  "Atualizar dados", que descarta os abertos para recarregarem). Antes, a
  entrada criava de uma vez o iframe de cada painel ativo, escondido, e todos
  carregavam a cada login. Na primeira abertura, uma cobertura diz o que está
  carregando até o `load` do iframe (src/modulos/paineis-externos/).

  Pré-conexão: o iframe não é carregado antes da hora, mas o DNS e o TLS das
  origens do painel (e, no Looker Studio, das estáticas do Google) podem ser
  abertos antes — ao apontar ou focar o item do menu (`preconectarAoApontar`)
  e, depois da entrada, quando o navegador fica ocioso (`preconectarNoOcioso`),
  só para os painéis em iframe que a pessoa vê.
*/

/*
  O quadro do painel é de outro site (endereco-do-painel.js recusa a mesma
  origem), por isso pode ter `allow-scripts` junto de `allow-same-origin`:
  a página de fora continua na origem dela, sem acesso a esta.

  O que os painéis de hoje precisam (Apps Script HtmlService, Looker Studio,
  Power BI):
    - allow-scripts, allow-same-origin: os scripts e o login Google/Microsoft
      do próprio site (o Apps Script abre num quadro interno de
      script.googleusercontent.com que lê os cookies de lá);
    - allow-forms: formulários do Apps Script (google.script.run, filtros);
    - allow-popups, allow-popups-to-escape-sandbox: "abrir em nova aba", login
      e links para planilhas e documentos, que abrem sem a sandbox;
    - allow-downloads: exportar CSV/PDF;
    - allow-modals: alert/confirm do HtmlService;
    - allow-top-navigation-by-user-activation: link com target="_top" só
      quando a pessoa clica (o quadro não tira ninguém do sistema sozinho);
    - allow-storage-access-by-user-activation: o Looker Studio pede acesso aos
      cookies dele no clique.
  Fora: allow-top-navigation (sem clique), allow-pointer-lock,
  allow-presentation, allow-orientation-lock.

  `allow` (Permissions Policy) só o que um painel usa: tela cheia e copiar
  para a área de transferência, restritos à origem do próprio quadro (sem
  `*`). Saíram geolocalização, captura de tela, leitura da área de
  transferência e mídia protegida.
*/
export const SANDBOX_DO_QUADRO = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-downloads",
  "allow-modals",
  "allow-top-navigation-by-user-activation",
  "allow-storage-access-by-user-activation",
].join(" ");

const ATRIBUTOS_DO_QUADRO = Object.freeze({
  class: "external-frame",
  loading: "eager",
  referrerpolicy: "no-referrer-when-downgrade",
  sandbox: SANDBOX_DO_QUADRO,
  allow: "fullscreen; clipboard-write",
  allowfullscreen: "true",
});

/** Uma linha de TB_PAINEL_EXTERNO (as colunas da consulta). */
export interface PainelExternoDoApp {
  id: string;
  codigo: string;
  titulo: string;
  icone?: string | null;
  url?: string | null;
  ordem?: number | null;
  ativo?: boolean | null;
  em_manutencao?: boolean | null;
  tipo_abertura?: string | null;
}

/** A resposta da consulta da lista (a do Supabase, ou uma já disparada). */
export interface RespostaDosPaineis {
  data: unknown;
  error: unknown;
}

export interface OpcoesDosPaineisExternos {
  cliente?: typeof getSupabaseClient;
  documento?: Document;
  origem?: () => string | undefined;
  obterPerfil?: () => PerfilDeAcesso | null | undefined;
  configuracao?: (chave: string) => string;
  avisar?: (texto: string, tom?: string) => void;
  aoTentarDeNovo?: () => void;
  estado?: { definirPaineisCarregados(lista: unknown): void };
}

export function criarPaineisExternos({
  cliente = getSupabaseClient,
  documento = globalThis.document,
  origem = () => globalThis.location?.origin,
  obterPerfil = () => null,
  configuracao = () => "",
  avisar = avisarPadrao,
  aoTentarDeNovo = () => {},
  estado = estadoDasConfiguracoes,
}: OpcoesDosPaineisExternos = {}) {
  let lista: PainelExternoDoApp[] = [];
  let liberados = new Set<string>();
  let atual: PainelExternoDoApp | null = null;
  /* O desmonte da cobertura de cada quadro ainda carregando. */
  const coberturas = new Map<Element, () => void>();
  const preconectadas = new Set<string>();

  const $ = (id: string) => documento.getElementById(id);
  const perfil = () => obterPerfil();
  const podeVerPaineis = () => permissaoLegada(perfil(), "paineis");

  // ── Lista e permissões ────────────────────────────────────────────────

  const consulta = () =>
    // Sem cliente (sem ambiente do Supabase) a consulta falha, como antes.
    cliente()!
      .from("TB_PAINEL_EXTERNO")
      .select(
        "id,codigo,titulo,icone,url,ordem,ativo,em_manutencao,tipo_abertura",
      )
      .order("ordem", { ascending: true });

  async function carregar({
    consulta: disparada,
  }: { consulta?: PromiseLike<RespostaDosPaineis> } = {}): Promise<void> {
    const { data, error } = await (disparada || consulta());
    // Análises curriculares virou página (view `analises`): o painel antigo sai.
    lista =
      !error && Array.isArray(data) && data.length
        ? semOPainelAntigoDeAnalises<PainelExternoDoApp>(data)
        : [];
    // Configurações › Painéis externos (React) lê daqui.
    estado.definirPaineisCarregados(lista);
  }

  /** Os ids liberados que vieram da sessão (`obter_contexto_monitora`). */
  function definirLiberados(ids: Iterable<string> | null | undefined) {
    liberados = new Set(ids || []);
  }

  /* Perfil sem matriz de permissões: todos os painéis ativos ficam liberados. */
  function completarLiberados() {
    const atualPerfil = perfil();
    if (atualPerfil?.permissoes) return;
    if (!atualPerfil?.id || !podeVerPaineis()) return;
    liberados = new Set(
      lista
        .filter((painel) => painel.ativo !== false && painel.id)
        .map((painel) => painel.id),
    );
  }

  function permitido(painel: PainelExternoDoApp | null | undefined) {
    return (
      !!painel &&
      painel.ativo !== false &&
      podeVerPaineis() &&
      (!perfil()?.permissoes || liberados.has(String(painel.id)))
    );
  }

  const podeAbrir = (codigo: string) =>
    lista.some((painel) => painel.codigo === codigo && permitido(painel));
  const primeiro = () => lista.find(permitido) || null;
  const doMenu = () =>
    podeVerPaineis()
      ? lista
          .filter(permitido)
          .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      : [];

  // ── Quadro ────────────────────────────────────────────────────────────

  function aviso(titulo: string, texto: string, icone = "") {
    const caixa = documento.createElement("div");
    caixa.className = "external-placeholder";
    const corpo = documento.createElement("div");
    if (icone) {
      const tile = documento.createElement("div");
      tile.style.fontSize = "58px";
      const i = documento.createElement("i");
      i.className = `fa-solid ${icone}`;
      tile.append(i);
      corpo.append(tile);
    }
    const h2 = documento.createElement("h2");
    h2.textContent = titulo;
    const p = documento.createElement("p");
    p.textContent = texto;
    corpo.append(h2, p);
    caixa.append(corpo);
    return caixa;
  }

  function montarQuadro(holder: HTMLElement, painel: PainelExternoDoApp) {
    if (painel.em_manutencao) {
      holder.replaceChildren(
        aviso(
          configuracao("maintenance_title"),
          configuracao("maintenance_message"),
          "fa-screwdriver-wrench",
        ),
      );
      return;
    }
    const endereco = enderecoDoPainel(painel.url, origem());
    if (!endereco) {
      holder.replaceChildren(
        aviso(
          painel.titulo,
          "Cadastre uma URL http(s) válida deste painel em paineis_externos.",
        ),
      );
      return;
    }
    const quadro = documento.createElement("iframe");
    for (const [nome, valor] of Object.entries(ATRIBUTOS_DO_QUADRO))
      quadro.setAttribute(nome, valor);
    quadro.setAttribute("src", endereco);
    holder.replaceChildren(quadro);
    // Até o site de fora responder, o quadro ficaria em branco.
    const desmontar = acompanharCarregamentoDoPainel(holder, {
      endereco,
      aoTentarDeNovo,
    });
    coberturas.set(holder, desmontar);
  }

  /* Tira o quadro da página, com a cobertura dele (se ainda estava carregando). */
  function removerQuadro(holder: Element | null) {
    if (!holder) return;
    coberturas.get(holder)?.();
    coberturas.delete(holder);
    holder.remove();
  }

  // ── Pré-conexão ───────────────────────────────────────────────────────

  /* O endereço do painel em iframe que a pessoa pode abrir e que ainda não está aberto. */
  function enderecoParaPreconectar(painel: PainelExternoDoApp | undefined) {
    if (!painel || !permitido(painel) || painel.em_manutencao) return "";
    if (painel.tipo_abertura && painel.tipo_abertura !== "iframe") return "";
    if ($("external-panel-" + painel.codigo)) return "";
    return enderecoDoPainel(painel.url, origem());
  }

  /** Abre o DNS e o TLS das origens do painel, sem carregar o iframe. */
  function preconectar(codigo: string) {
    const endereco = enderecoParaPreconectar(
      lista.find((p) => p.codigo === codigo),
    );
    for (const destino of origensParaPreconectar(endereco)) {
      if (preconectadas.has(destino)) continue;
      preconectadas.add(destino);
      for (const rel of ["preconnect", "dns-prefetch"]) {
        const link = documento.createElement("link");
        link.rel = rel;
        link.href = destino;
        if (rel === "preconnect" && precisaDeCrossorigin(destino))
          link.crossOrigin = "anonymous";
        link.dataset.preconexaoDoPainel = "";
        documento.head.append(link);
      }
    }
  }

  /**
   * Apontar ou focar o item de um painel no menu (`[data-view="panel:…"]`)
   * pré-conecta. Devolve o cancelamento.
   */
  function preconectarAoApontar() {
    const aoChegar = (evento: Event) => {
      const alvo = evento.target as Element | null;
      const view = alvo?.closest?.("[data-view]")?.getAttribute("data-view");
      if (ehPainelExterno(view)) preconectar(codigoDoPainel(view));
    };
    documento.addEventListener("pointerover", aoChegar, { passive: true });
    documento.addEventListener("focusin", aoChegar);
    return () => {
      documento.removeEventListener("pointerover", aoChegar);
      documento.removeEventListener("focusin", aoChegar);
    };
  }

  /** Depois da entrada, com o navegador ocioso: os painéis em iframe que a pessoa vê. */
  function preconectarNoOcioso() {
    const janela = documento.defaultView;
    const fazer = () => doMenu().forEach((p) => preconectar(p.codigo));
    if (janela?.requestIdleCallback)
      janela.requestIdleCallback(fazer, { timeout: 5_000 });
    else janela?.setTimeout(fazer, 2_000);
  }

  /**
   * Mostra o quadro do painel (a navegação já trocou a tela). Devolve o painel,
   * ou `null` se ele não estiver liberado.
   */
  function mostrar(codigo: string): PainelExternoDoApp | null {
    const painel = lista.find((p) => p.codigo === codigo && permitido(p));
    if (!painel) {
      avisar("Painel indisponível ou inativo.", "warn");
      return null;
    }
    /*
      O painel externo traz o seu próprio cabeçalho: `external-panel-mode`
      esconde **apenas** o cabeçalho superior do app. A barra lateral fica,
      porque é por ela que se volta (o antigo `external-clean` a escondia).
    */
    documento.body.classList.remove("external-clean");
    documento.body.classList.add("external-panel-mode");
    atual = painel;
    // A seção do quadro fica ativa pela navegação (src/app/telas.tsx).
    const titulo = $("externalTitle");
    if (titulo) titulo.textContent = painel.titulo;
    const abrir = $("externalOpen") as HTMLAnchorElement | null;
    if (abrir) abrir.href = enderecoDoPainel(painel.url, origem()) || "#";
    const montagem = $("externalMount");
    if (!montagem) return painel;
    if (montagem.classList.contains("external-placeholder")) {
      montagem.className = "";
      montagem.replaceChildren();
    }
    montagem
      .querySelectorAll<HTMLElement>(".external-panel")
      .forEach((holder) => (holder.hidden = true));
    let holder = $("external-panel-" + codigo);
    if (!holder) {
      holder = documento.createElement("div");
      holder.id = "external-panel-" + codigo;
      holder.className = "external-panel";
      montagem.appendChild(holder);
      montarQuadro(holder, painel);
    }
    holder.hidden = false;
    return painel;
  }

  /** Tira o quadro do painel (o próximo `mostrar` cria de novo). */
  function descartar(codigo: string) {
    removerQuadro($("external-panel-" + codigo));
  }

  /** Os quadros abertos recarregam na próxima abertura ("Atualizar dados"). */
  function descartarAbertos() {
    documento
      .querySelectorAll(".external-panel")
      .forEach((holder) => removerQuadro(holder));
  }

  /* A pessoa saiu: nenhum quadro dela fica na página. */
  function limpar() {
    descartarAbertos();
    const montagem = $("externalMount");
    if (montagem) {
      montagem.className = "external-placeholder";
      montagem.textContent = configuracao("external_placeholder");
    }
    atual = null;
    liberados = new Set();
  }

  return {
    consulta,
    carregar,
    definirLiberados,
    completarLiberados,
    liberados: () => liberados,
    permitido,
    podeAbrir,
    primeiro,
    doMenu,
    mostrar,
    preconectar,
    preconectarAoApontar,
    preconectarNoOcioso,
    descartar,
    descartarAbertos,
    limpar,
    atual: () => atual,
    esquecerAtual: () => {
      atual = null;
    },
  };
}

export type PaineisExternos = ReturnType<typeof criarPaineisExternos>;
