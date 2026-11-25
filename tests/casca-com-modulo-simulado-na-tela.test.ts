// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { type PropsDaRaiz } from "../src/app/raiz.tsx";
import { type PecasDoApp } from "../src/app/contexto-do-app.ts";
import { type EstadoDoAviso } from "../src/app/aviso-de-versao.ts";
import { type EstadoDaPresenca } from "../src/componentes/pessoas-online/pessoas-online.tsx";
import { type EstadoDoEncerramento } from "../src/modulos/encerramento-do-edital/estado.ts";
import {
  ESTADO_INICIAL_DA_NAVEGACAO,
  type LeituraDaNavegacao,
} from "../src/app/navegacao.ts";
import { achar } from "./dom.ts";
import { definido } from "./definido.ts";
import { teclar, clicar, escolher, esperar } from "./componentes/interacoes.ts";
import { existsSync, readFileSync } from "node:fs";
import { montarArvoreDoMenu } from "../src/lib/navegacao/menu-lateral.ts";
import {
  avisar,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../src/lib/navegacao/eventos-da-barra-lateral.ts";
import { SECOES } from "../src/modulos/configuracoes/secoes.ts";
import { sairDoSistema } from "../src/app/casca/saida.ts";
import { BarraLateral } from "../src/componentes/barra-lateral/barra-lateral.tsx";
import { desenharNoTeste } from "./montar-tela.ts";
import {
  aplicarMarcaDaBarraLateral,
  aplicarMarcaDaConfiguracao,
  redefinirMarcaDaBarraLateral,
} from "../src/componentes/barra-lateral/marca.ts";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
} from "../src/componentes/barra-lateral/estado.ts";
import {
  definirAreaAtual,
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../src/componentes/dados-do-monitoramento.ts";
import { htmlDaPagina } from "./pagina-montada.ts";
import { type ArvoreDoMenu } from "../src/componentes/barra-lateral/tipos.ts";
import { registrarTelas } from "../src/app/registro-das-telas.ts";
import { registrarTelasFalsas } from "./app/telas-no-teste.ts";
import {
  CentralDeConvocacoes,
  usarConducaoLigada,
  type TipoDaCentralDeConvocacoes,
} from "../src/modulos/aprovados/central-de-convocacoes.tsx";
import { paginaDesligada } from "../src/lib/navegacao/pagina-desligada.ts";
import { criarConducaoDeEntrevistas } from "../src/modulos/entrevistas/conduzir.tsx";
import { type ClienteDaConducao } from "../src/modulos/entrevistas/tipos-do-estado-da-conducao.ts";
import { createElement as h } from "react";
import { esquecerFiltrosDasTelas } from "../src/app/filtros-no-endereco.ts";
import type { DseiDoMapa } from "../src/lib/mapas/mapa-saude-indigena/tipos.ts";
import type { PropsDoMapaComSigepsi } from "../src/modulos/mapa-saude-indigena/mapa-com-sigepsi.tsx";
import { criarMapa } from "../src/modulos/mapa/mapa.tsx";
import { criarEstadoDaVisaoGeral } from "../src/modulos/visao-geral/estado.ts";
import type { DadosDoMonitoramento } from "../src/modulos/visao-geral/tipos.ts";

const visto = vi.hoisted(() => ({
  props: null as PropsDoMapaComSigepsi | null,
}));

vi.mock("../src/modulos/mapa-saude-indigena/mapa-com-sigepsi.tsx", () => ({
  MapaSaudeIndigenaComSigepsi: (props: PropsDoMapaComSigepsi) => {
    visto.props = props;
    return h("div", { "data-mapa-falso": props.dseiSelecionado ?? "" });
  },
}));

// de tests/casca-com-modulo-simulado-na-tela.test.ts (bloco app/pecas-da-casca)
const aya = vi.hoisted(() => ({ baixada: 0 }));
// de tests/casca-com-modulo-simulado-na-tela.test.ts (bloco app/pecas-da-casca)
vi.mock("../src/modulos/aya/aya.tsx", () => {
  aya.baixada += 1;
  return { Aya: () => createElement("div", { id: "ayaDeTeste" }, "Aya") };
});
// de tests/casca-com-modulo-simulado-na-tela.test.ts (bloco componentes/barra-lateral)
vi.mock("../src/app/casca/saida.ts", async (original) => ({
  ...(await original()),
  sairDoSistema: vi.fn(),
}));
// de tests/casca-com-modulo-simulado-na-tela.test.ts (bloco componentes/central-de-convocacoes-para-entrevistas)
vi.mock("../src/lib/navegacao/pagina-desligada.ts", () => ({
  paginaDesligada: vi.fn(() => false),
}));

bloco("app/pecas-da-casca", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /*
  As partes da casca que eram ilhas (Pessoas online, aviso de versão,
  encerramento e selos do edital, Aya e busca global) são filhas da raiz do
  app (src/app/raiz.tsx, src/app/casca/pecas.tsx): o estado vem pelas `pecas`
  do contexto, e não há `createRoot` próprio para elas.
*/

  const { Raiz } = await import("../src/app/raiz.tsx");

  function assinavel<T>(inicial: T) {
    let valor: T = Object.freeze(inicial);
    const ouvintes = new Set<() => void>();
    return {
      obter: () => valor,
      assinar: vi.fn((ouvinte: () => void) => {
        ouvintes.add(ouvinte);
        return () => ouvintes.delete(ouvinte);
      }),
      mudar(novo: T) {
        valor = novo;
        ouvintes.forEach((ouvinte) => ouvinte());
      },
    };
  }

  function criarPecas({ aberto = false, conectado = true } = {}) {
    const presenca = {
      ...assinavel<EstadoDaPresenca>({
        visivel: true,
        aberto: false,
        sincronizado: true,
        desde: 0,
        pessoas: [],
      }),
      alternar: vi.fn(),
      fechar: vi.fn(),
    };
    const avisoDeVersao = {
      ...assinavel<EstadoDoAviso>({
        versaoNova: "v2",
        novidade: null,
        telaAntiga: false,
        fechado: false,
        pendencia: false,
        atualizando: false,
      }),
      fechar: vi.fn(),
      atualizar: vi.fn(),
      // O resto do aviso, parado: nada confere, liga ou recarrega.
      conferir: async () => false,
      aoSinalDeTelaAntiga: async () => {},
      iniciar() {},
      parar() {},
      atualizarAgora: () => false,
    };
    const encerramento = {
      ...assinavel<EstadoDoEncerramento>({
        aberto: null,
        encerramentos: [],
        fogosJaSoltos: new Set<string>(),
      }),
      fechar: vi.fn(),
      // O resto do encerramento, parado.
      verificar: async () => [],
      editalConcluidoNaTela() {},
      acompanhar: () => () => {},
      esquecer() {},
    };
    return {
      presenca,
      avisoDeVersao,
      encerramento,
      appAberto: assinavel(aberto),
      estaConectado: () => conectado,
    } satisfies PecasDoApp;
  }

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

  let raiz: Root | null = null;
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  async function montar(
    pecas: PecasDoApp | null,
    navegacao: LeituraDaNavegacao = NAVEGACAO,
  ) {
    document.body.innerHTML =
      '<section id="appScreen" class="app hidden"></section><div id="raiz"></div>';
    const novaRaiz = createRoot(achar("#raiz"));
    raiz = novaRaiz;
    const lugares: PropsDaRaiz["lugares"] & { avisos: null } = {
      avisos: null,
      entrada: null,
      casca: document.getElementById("appScreen"),
    };
    await act(async () =>
      novaRaiz.render(
        createElement(Raiz, {
          navegacao,
          ...SEM_ENTRADA,
          pecas,
          lugares,
        }),
      ),
    );
  }

  describe("peças da casca (antes, ilhas)", () => {
    it("Pessoas online e o aviso de versão desenham na casca, com o estado das peças", async () => {
      const pecas = criarPecas();
      await montar(pecas);
      expect(
        document.querySelector("#pessoasOnlineApp > #onlinePresence"),
      ).not.toBeNull();
      expect(
        document.querySelector("#avisoDeVersaoApp .aviso-de-versao"),
      ).not.toBeNull();
      expect(pecas.encerramento.assinar).toHaveBeenCalled();
    });

    it("a Aya só baixa quando o app abre, e fica", async () => {
      const pecas = criarPecas({ aberto: false });
      await montar(pecas);
      expect(document.getElementById("ayaDeTeste")).toBeNull();
      expect(aya.baixada).toBe(0);

      await act(async () => pecas.appAberto.mudar(true));
      expect(
        document.querySelector("#ayaApp > #ayaDeTeste"),
        "a Aya na casca",
      ).not.toBeNull();

      await act(async () => pecas.appAberto.mudar(false));
      expect(document.getElementById("ayaDeTeste")).not.toBeNull();
      expect(aya.baixada).toBe(1);
    });

    it("a busca global (Ctrl+K) é da raiz e só abre com usuário conectado", async () => {
      await montar(criarPecas({ conectado: false }));
      await teclar(document, "k", { ctrlKey: true });
      expect(document.querySelector('[role="dialog"].search-modal')).toBeNull();
      await act(async () => definido(raiz).unmount());

      await montar(criarPecas({ conectado: true }));
      await teclar(document, "k", { ctrlKey: true });
      expect(
        document.querySelector('[role="dialog"].search-modal'),
      ).not.toBeNull();
    });

    describe("sem sessão (link interno aberto na tela de acesso)", () => {
      const TEXTO_SEM_MODULO = "ainda não tem módulos liberados";
      const textoDaCasca = () =>
        document.getElementById("appScreen")?.textContent ?? "";

      beforeEach(() =>
        registrarTelasFalsas({
          dashboard: {
            conteudo: createElement(
              "div",
              { id: "telaDeTeste" },
              "Carregando dados…",
            ),
          },
        }),
      );
      afterEach(() => registrarTelas({}));

      it("a casca escondida não monta a tela da rota; monta ao abrir e desmonta ao sair", async () => {
        const pecas = criarPecas({ aberto: false });
        await montar(pecas);
        expect(document.getElementById("page-dashboard")).not.toBeNull();
        expect(document.getElementById("telaDeTeste")).toBeNull();
        expect(textoDaCasca()).not.toContain("Carregando dados");

        await act(async () => pecas.appAberto.mudar(true));
        expect(
          document.querySelector("#page-dashboard #telaDeTeste"),
        ).not.toBeNull();

        await act(async () => pecas.appAberto.mudar(false));
        expect(document.getElementById("telaDeTeste")).toBeNull();
      });

      it("o aviso de quem não tem módulo liberado só existe com o app aberto e o aviso ativo", async () => {
        await montar(criarPecas({ aberto: false }));
        expect(textoDaCasca()).not.toContain(TEXTO_SEM_MODULO);
        await act(async () => definido(raiz).unmount());

        await montar(criarPecas({ aberto: true }));
        expect(textoDaCasca()).not.toContain(TEXTO_SEM_MODULO);
        await act(async () => definido(raiz).unmount());

        const semAcesso = {
          ...ESTADO_DA_NAVEGACAO,
          aviso: "sem-acesso" as const,
        };
        await montar(criarPecas({ aberto: true }), {
          ...NAVEGACAO,
          obter: () => semAcesso,
        });
        expect(
          document.querySelector("#page-sem-acesso.active")?.textContent,
        ).toContain(TEXTO_SEM_MODULO);
      });
    });

    it("sem as peças (a casca num teste), nada disso aparece", async () => {
      await montar(null);
      expect(document.getElementById("onlinePresence")).toBeNull();
      expect(document.getElementById("pessoasOnlineApp")).not.toBeNull();
    });
  });
});

bloco("componentes/barra-lateral", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /* Os contratos que o app publica em window (src/app/sistema.ts). */
  const janela: Window & {
    toggleSidebar?: () => void;
    toggleDarkMode?: () => void;
  } = window;

  /*
  O elemento com `dataset` (HTML ou SVG); outro quebra aqui, como quebrava
  ao ler o `dataset` que não existe.
*/
  function comDataset(elemento: Element | null): HTMLElement | SVGElement {
    if (elemento instanceof HTMLElement || elemento instanceof SVGElement)
      return elemento;
    throw new TypeError("elemento sem dataset");
  }

  const CHAVE_FECHADAS = "agsus_monitora_menu_areas_fechadas_v1";
  const LARGURA_ORIGINAL = window.innerWidth;
  const PAINEL_X = [{ codigo: "x", titulo: "Painel X" }];

  function arvoreCompleta(paineis: { codigo: string; titulo: string }[] = []) {
    return montarArvoreDoMenu({
      permitidas: {
        dashboard: true,
        nucleo: true,
        calendario: true,
        approved: true,
        analises: true,
        config: true,
      },
      paineis,
      secoesDeConfiguracao: SECOES,
    });
  }

  let raiz: Root | null = null;

  /*
  A barra como o app a desenha: src/main.ts aplica a marca padrão e a raiz
  desenha a casca (src/app/casca/casca.tsx) na hora, com a barra no <aside>.
*/
  function montarBarraLateral(aside: Element) {
    aplicarMarcaDaBarraLateral();
    return desenharNoTeste(aside, createElement(BarraLateral), {
      sincrono: true,
      nome: "a barra lateral",
    }).raiz;
  }

  function prepararPagina() {
    document.body.className = "";
    document.documentElement.setAttribute("data-theme", "");
    document.body.innerHTML = `
    <section id="appScreen" class="app">
      <aside class="sidebar" aria-label="Navegação principal"></aside>
      <main class="main">
        <header class="top">
          <div class="title-row">
            <div class="page-title"><h1 id="pageTitle">Editais</h1></div>
          </div>
        </header>
      </main>
    </section>
    <section id="page-dashboard" class="page active"></section>
    <section id="page-config" class="page"></section>`;
  }

  async function montar(
    arvore: ArvoreDoMenu | null = arvoreCompleta(),
    opcoes: Parameters<typeof atualizarMenuLateral>[1] = {},
  ) {
    prepararPagina();
    await act(async () => {
      raiz = montarBarraLateral(
        definido(document.querySelector<HTMLElement>("#appScreen .sidebar")),
      );
    });
    if (arvore) {
      await act(async () => atualizarMenuLateral(arvore, opcoes));
    }
  }

  async function larguraDaJanela(valor: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: valor,
    });
    await act(async () => window.dispatchEvent(new Event("resize")));
  }

  async function recolher(sim = true) {
    document.body.classList.toggle("sidebar-collapsed", sim);
    await act(async () => avisar(EVENTO_BARRA_ALTERNADA));
  }

  const clicar = (elemento: HTMLElement | null | undefined) =>
    act(async () => definido(elemento).click());
  const area = (id: string) =>
    document.querySelector<HTMLElement>(`.menu-area[data-area="${id}"]`);
  const cabecalho = (id: string) =>
    definido(area(id)).querySelector<HTMLElement>(".menu-area__cabecalho");
  const item = (view: string, secao?: string) =>
    [...document.querySelectorAll<HTMLElement>("#nav .menu-item")].find(
      (botao) =>
        botao.dataset.view === view &&
        (!secao || botao.dataset.secao === secao),
    );
  const aberta = (id: string) =>
    definido(area(id)).classList.contains("menu-area--aberta");
  const flutuando = (id: string) =>
    definido(area(id)).classList.contains("menu-area--flutuante");

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(async () => {
    await act(async () => raiz?.unmount());
    raiz = null;
    await act(async () => redefinirBarraLateral());
    await act(async () => redefinirMarcaDaBarraLateral());
    await act(async () => redefinirDadosDoMonitoramento());
    await larguraDaJanela(LARGURA_ORIGINAL);
    delete window.navigate;
    delete janela.toggleSidebar;
    delete janela.toggleDarkMode;
    vi.clearAllMocks();
  });

  describe("a barra lateral em React", () => {
    it("monta marca, menu e rodapé dentro do <aside>", async () => {
      await montar();
      const aside = definido(
        document.querySelector<HTMLElement>("#appScreen .sidebar"),
      );

      /* Sem logo enviada, a marca é o símbolo do Yeendé, em linha e decorativo. */
      const simbolo = aside.querySelector(".side-brand svg.side-simbolo");
      expect(simbolo?.getAttribute("aria-hidden")).toBe("true");
      expect(aside.querySelector(".side-brand #sideLogo")).toBeNull();
      expect(aside.querySelector(".side-brand-copy strong")?.textContent).toBe(
        "Yeendé",
      );
      expect(
        aside.querySelector<HTMLElement>(
          ".side-navigation > nav#nav.menu-lateral",
        ),
      ).not.toBeNull();
      expect(
        aside.querySelectorAll<HTMLElement>(".side-tema__opcao"),
      ).toHaveLength(2);
      expect(
        aside.querySelector<HTMLElement>("#sidebarLogoutBtn.side-logout"),
      ).not.toBeNull();
      expect(
        aside.querySelector<HTMLElement>(".side-version #sidebarVersion"),
      ).not.toBeNull();
      expect(
        [...aside.querySelectorAll<HTMLElement>(".menu-area__rotulo")].map(
          (r) => r.textContent,
        ),
      ).toEqual(["Saúde Indígena", "Administração"]);
    });

    it("antes do primeiro buildNav não mostra aviso; perfil sem área mostra", async () => {
      await montar(null);
      expect(document.querySelector<HTMLElement>("#nav .alert")).toBeNull();

      await act(async () =>
        atualizarMenuLateral([], {
          textoVazio: "Peça acesso ao administrador.",
        }),
      );
      expect(
        document.querySelector<HTMLElement>("#nav .alert.warn")?.textContent,
      ).toBe("Peça acesso ao administrador.");
    });

    it("título de painel vindo do banco entra como texto, nunca como HTML", async () => {
      await montar(
        arvoreCompleta([
          { codigo: "x", titulo: '<img src=x onerror="alert(1)">' },
        ]),
      );
      expect(item("panel:x")?.textContent).toBe(
        '<img src=x onerror="alert(1)">',
      );
      expect(document.querySelectorAll<HTMLElement>("#nav img")).toHaveLength(
        0,
      );
    });
  });

  /*
  As áreas nascem abertas. Guarda-se só o que a pessoa fechou — então uma
  área nova no catálogo já aparece aberta.
*/
  describe("áreas abertas por padrão", () => {
    it("sem preferência salva, toda área com submenu está aberta", async () => {
      await montar();
      expect(aberta("saude-indigena")).toBe(true);
      expect(aberta("administracao")).toBe(true);
      expect(cabecalho("saude-indigena")?.getAttribute("aria-expanded")).toBe(
        "true",
      );
    });

    it("fechar grava só as fechadas, e a próxima montagem lembra", async () => {
      await montar();
      await clicar(cabecalho("saude-indigena"));

      expect(aberta("saude-indigena")).toBe(false);
      expect(cabecalho("saude-indigena")?.getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(JSON.parse(String(localStorage.getItem(CHAVE_FECHADAS)))).toEqual([
        "saude-indigena",
      ]);

      await act(async () => definido(raiz).unmount());
      await montar();
      expect(aberta("saude-indigena")).toBe(false);
      expect(aberta("administracao")).toBe(true);
    });

    it("área que ninguém fechou nasce aberta, mesmo com outras fechadas", async () => {
      localStorage.setItem(CHAVE_FECHADAS, JSON.stringify(["administracao"]));
      await montar();
      expect(aberta("saude-indigena")).toBe(true);
      expect(aberta("administracao")).toBe(false);
    });

    it("Saúde Indígena é submenu, com os blocos Acompanhar e Processo seletivo", async () => {
      await montar();
      const cabecalhoDaArea = definido(cabecalho("saude-indigena"));
      expect(cabecalhoDaArea.hasAttribute("data-view")).toBe(false);
      expect(cabecalhoDaArea.getAttribute("aria-expanded")).toBe("true");
      expect(
        [
          ...definido(area("saude-indigena")).querySelectorAll<HTMLElement>(
            ".menu-item",
          ),
        ].map((botao) => [botao.dataset.rotulo, botao.dataset.area]),
      ).toEqual([
        ["Visão geral", "saude-indigena"],
        ["Painel das análises", "saude-indigena"],
        ["Cronograma", "saude-indigena"],
        ["Editais", "saude-indigena"],
        ["Lista de aprovados", "saude-indigena"],
      ]);
      // Cada bloco tem o título e uma lista nomeada por ele.
      const blocos = [
        ...definido(area("saude-indigena")).querySelectorAll<HTMLElement>(
          ".menu-bloco",
        ),
      ];
      expect(
        blocos.map((bloco) => [
          bloco.dataset.bloco,
          bloco.querySelector<HTMLElement>(".menu-bloco__titulo")?.textContent,
          [...bloco.querySelectorAll<HTMLElement>(".menu-item")].map(
            (b) => b.dataset.view,
          ),
        ]),
      ).toEqual([
        [
          "acompanhamento",
          "Acompanhar",
          ["dashboard", "analises", "calendario"],
        ],
        ["processo", "Processo seletivo", ["nucleo", "approved"]],
      ]);
      const titulo = definido(blocos[1]).querySelector<HTMLElement>(
        ".menu-bloco__titulo",
      );
      expect(
        blocos[1]
          ?.querySelector<HTMLElement>("ul")
          ?.getAttribute("aria-labelledby"),
      ).toBe(titulo?.id);
      // Administração em três grupos com título: Aparência, Pessoas e
      // acessos, Sistema.
      expect(
        [
          ...definido(area("administracao")).querySelectorAll<HTMLElement>(
            ".menu-bloco",
          ),
        ].map((bloco) => [
          bloco.dataset.bloco,
          bloco.querySelector<HTMLElement>(".menu-bloco__titulo")?.textContent,
          [...bloco.querySelectorAll<HTMLElement>(".menu-item")].map(
            (b) => b.dataset.secao,
          ),
        ]),
      ).toEqual([
        [
          "aparencia",
          "Aparência",
          ["marca", "inicio", "acesso", "aparencia", "comemoracoes"],
        ],
        ["pessoas", "Pessoas e acessos", ["acessos", "recursos"]],
        ["sistema", "Sistema", ["modulos", "operacao", "cargas", "automacao"]],
      ]);
    });

    it("bloco sem página que o perfil vê não aparece", async () => {
      await montar(
        montarArvoreDoMenu({
          permitidas: { nucleo: true, approved: true },
        }),
      );
      expect(
        [
          ...document.querySelectorAll<HTMLElement>("#nav .menu-bloco__titulo"),
        ].map((titulo) => titulo.textContent),
      ).toEqual(["Processo seletivo"]);
    });

    it("painel externo entra no fim de Acompanhar, sem grupo próprio", async () => {
      await montar(arvoreCompleta(PAINEL_X));
      expect(area("paineis")).toBeNull();
      expect(
        item("panel:x")?.closest<HTMLElement>(".menu-bloco")?.dataset.bloco,
      ).toBe("acompanhamento");
      expect(
        [
          ...definido(area("saude-indigena")).querySelectorAll<HTMLElement>(
            '[data-bloco="acompanhamento"] .menu-item',
          ),
        ].map((botao) => botao.dataset.view),
      ).toEqual(["dashboard", "analises", "calendario", "panel:x"]);
    });

    it("painel externo aberto acende o item e a área onde está", async () => {
      await montar(arvoreCompleta(PAINEL_X));
      await act(async () => marcarItemAtivoNoMenu("panel:x"));
      expect(item("panel:x")?.getAttribute("aria-current")).toBe("page");
      expect(
        definido(area("saude-indigena")).classList.contains("menu-area--atual"),
      ).toBe(true);
    });
  });

  describe("página ativa", () => {
    it("marca o item e destaca a área", async () => {
      await montar();

      await act(async () => marcarItemAtivoNoMenu("calendario"));

      expect(item("calendario")?.getAttribute("aria-current")).toBe("page");
      expect(item("calendario")?.classList.contains("active")).toBe(true);
      expect(
        definido(area("saude-indigena")).classList.contains("menu-area--atual"),
      ).toBe(true);
      expect(
        document.querySelectorAll<HTMLElement>('#nav [aria-current="page"]'),
      ).toHaveLength(1);
    });

    it("abrir uma página reabre a área dela, se estava fechada", async () => {
      localStorage.setItem(CHAVE_FECHADAS, JSON.stringify(["saude-indigena"]));
      await montar();
      expect(aberta("saude-indigena")).toBe(false);

      await act(async () => marcarItemAtivoNoMenu("nucleo"));
      expect(aberta("saude-indigena")).toBe(true);
      expect(JSON.parse(String(localStorage.getItem(CHAVE_FECHADAS)))).toEqual(
        [],
      );
    });

    it("em Configurações marca a seção aberta", async () => {
      await montar();
      await act(async () => marcarItemAtivoNoMenu("config", "aparencia"));
      expect(item("config", "aparencia")?.getAttribute("aria-current")).toBe(
        "page",
      );
    });
  });

  /*
  Com mais de uma área, o topo é o seletor de área e, abaixo, só as páginas da
  área atual. Trocar de área abre a mesma página na área nova, ou a primeira
  dela. As páginas esperadas vêm da árvore: o teste não supõe qual view é a
  Visão geral de cada área.
*/
  describe("as áreas do usuário: seletor de área", () => {
    const TODAS = ["saude-indigena", "sede", "projetos"];
    const itemDaArea = (id: string, view: string) =>
      definido(area(id)).querySelector<HTMLElement>(
        `.menu-item[data-view="${view}"]`,
      );
    const seletor = () => document.querySelector<HTMLElement>(".menu-seletor");
    const opcao = (id: string) =>
      document.querySelector<HTMLElement>(`[data-opcao-de-area="${id}"]`);
    const areasDesenhadas = () =>
      [...document.querySelectorAll<HTMLElement>(".menu-area[data-area]")].map(
        (secao) => secao.dataset.area,
      );
    const viewsDoGrupo = (arvore: ArvoreDoMenu, id: string) =>
      definido(arvore.find((grupo) => grupo.id === id)).itens.map(
        (item) => item.view,
      );

    it("com três áreas, mostra o seletor e só as páginas da área atual", async () => {
      const arvore = montarArvoreDoMenu({
        permitidas: {
          dashboard: true,
          nucleo: true,
          calendario: true,
          approved: true,
          analises: true,
          config: true,
        },
        secoesDeConfiguracao: SECOES,
        areas: TODAS,
      });
      await montar(arvore);

      expect(seletor()?.querySelector<HTMLElement>("strong")?.textContent).toBe(
        "Saúde Indígena",
      );
      expect(
        [
          ...definido(seletor()).querySelectorAll<HTMLElement>(
            ".menu-seletor__opcao",
          ),
        ].map((botao) => botao.textContent),
      ).toEqual(["Saúde Indígena", "SEDE", "Projetos"]);
      // As opções não são páginas: o celular e os ganchos do mapa não as veem.
      expect(seletor()?.querySelector<HTMLElement>("[data-view]")).toBeNull();
      // No lugar das três áreas abertas uma sob a outra, só a atual.
      expect(areasDesenhadas()).toEqual(["saude-indigena", "administracao"]);
      // Expandida, o seletor é o cabeçalho: a área não repete o nome.
      expect(
        definido(area("saude-indigena")).querySelector<HTMLElement>(
          ".menu-area__cabecalho",
        ),
      ).toBe(null);
      expect(
        definido(area("administracao")).classList.contains(
          "menu-area--administracao",
        ),
      ).toBe(true);
      // Administração lista todas as seções de Configurações.
      expect(
        [
          ...definido(area("administracao")).querySelectorAll<HTMLElement>(
            ".menu-item",
          ),
        ].map((botao) => botao.dataset.secao),
      ).toEqual(SECOES.map((secao) => secao.id));

      await act(async () => definirAreaAtual("sede"));
      expect(seletor()?.querySelector<HTMLElement>("strong")?.textContent).toBe(
        "SEDE",
      );
      expect(areasDesenhadas()).toEqual(["sede", "administracao"]);
      expect(
        [
          ...definido(area("sede")).querySelectorAll<HTMLElement>(".menu-item"),
        ].map((botao) => botao.dataset.view),
      ).toEqual(["dashboard", "analises", "calendario", "nucleo", "approved"]);
      expect(new Set(viewsDoGrupo(arvore, "sede"))).toEqual(
        new Set(["dashboard", "analises", "approved", "nucleo", "calendario"]),
      );
    });

    it("com uma área só, não há seletor e a área é acordeão como antes", async () => {
      await montar();
      expect(seletor()).toBeNull();
      expect(
        definido(area("saude-indigena")).querySelector<HTMLElement>(
          ".menu-area__cabecalho",
        ),
      ).not.toBeNull();
    });

    it("trocar de área abre a mesma página na área nova; sem ela, a primeira", async () => {
      const chamadas: unknown[] = [];
      /*
      Hoje toda aba existe nas três áreas; para o "sem ela", a Visão geral
      fica só na Saúde Indígena nesta árvore.
    */
      const arvore = montarArvoreDoMenu({
        permitidas: { dashboard: true, nucleo: true, calendario: true },
        areas: TODAS,
      }).map((grupo) =>
        grupo.id === "saude-indigena"
          ? grupo
          : {
              ...grupo,
              itens: grupo.itens.filter((item) => item.view !== "dashboard"),
            },
      );
      await montar(arvore, {
        navegar: (view) => {
          // A área já mudou quando a navegação acontece.
          chamadas.push([view, obterDadosDoMonitoramento().areaAtual]);
          marcarItemAtivoNoMenu(view);
        },
      });

      await clicar(itemDaArea("saude-indigena", "calendario"));
      await clicar(
        seletor()?.querySelector<HTMLElement>(".menu-area__cabecalho"),
      );
      expect(seletor()?.classList.contains("menu-area--aberta")).toBe(true);
      await clicar(opcao("sede"));

      expect(seletor()?.classList.contains("menu-area--aberta")).toBe(false);
      expect(seletor()?.dataset.seletorDeArea).toBe("sede");
      expect(
        itemDaArea("sede", "calendario")?.getAttribute("aria-current"),
      ).toBe("page");
      expect(
        document.querySelectorAll<HTMLElement>('#nav [aria-current="page"]'),
      ).toHaveLength(1);

      // Uma página que só a Saúde Indígena tem: em Projetos, abre a primeira dela.
      const sede = viewsDoGrupo(arvore, "sede");
      const soDaSaude = viewsDoGrupo(arvore, "saude-indigena").find(
        (view) => !sede.includes(view),
      );
      await clicar(opcao("saude-indigena"));
      await clicar(itemDaArea("saude-indigena", definido(soDaSaude)));
      await clicar(opcao("projetos"));

      expect(chamadas).toEqual([
        ["calendario", "saude-indigena"],
        ["calendario", "sede"],
        ["calendario", "saude-indigena"],
        [soDaSaude, "saude-indigena"],
        [viewsDoGrupo(arvore, "projetos")[0], "projetos"],
      ]);
    });

    it("trocar de área com alteração não salva pergunta antes; recusar mantém a área e a página", async () => {
      const chamadas: unknown[] = [];
      let permitir = false;
      const confirmarTrocaDeArea = vi.fn(() => permitir);
      await montar(
        montarArvoreDoMenu({
          permitidas: { dashboard: true, nucleo: true, calendario: true },
          areas: TODAS,
        }),
        {
          navegar: (view) => {
            chamadas.push([view, obterDadosDoMonitoramento().areaAtual]);
            marcarItemAtivoNoMenu(view);
          },
          confirmarTrocaDeArea,
        },
      );
      await clicar(itemDaArea("saude-indigena", "calendario"));
      expect(confirmarTrocaDeArea).not.toHaveBeenCalled();

      await clicar(
        seletor()?.querySelector<HTMLElement>(".menu-area__cabecalho"),
      );
      await clicar(opcao("sede"));
      expect(confirmarTrocaDeArea).toHaveBeenCalledTimes(1);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
      expect(chamadas).toEqual([["calendario", "saude-indigena"]]);

      permitir = true;
      await clicar(
        seletor()?.querySelector<HTMLElement>(".menu-area__cabecalho"),
      );
      await clicar(opcao("sede"));
      expect(obterDadosDoMonitoramento().areaAtual).toBe("sede");
      expect(chamadas.at(-1)).toEqual(["calendario", "sede"]);
    });

    it("navegação recusada: a área volta à de antes", async () => {
      const arvore = montarArvoreDoMenu({
        permitidas: { dashboard: true, nucleo: true, calendario: true },
        areas: TODAS,
      });
      let aceitar = true;
      await montar(arvore, {
        navegar: (view) => {
          if (!aceitar) return false;
          marcarItemAtivoNoMenu(view);
          return true;
        },
      });
      await clicar(itemDaArea("saude-indigena", "calendario"));
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");

      aceitar = false;
      await clicar(
        seletor()?.querySelector<HTMLElement>(".menu-area__cabecalho"),
      );
      await clicar(opcao("sede"));
      expect(obterDadosDoMonitoramento().areaAtual).toBe("saude-indigena");
    });

    it("recolhida, o seletor é um ícone e a lista das áreas flutua no clique", async () => {
      await montar(
        montarArvoreDoMenu({ permitidas: { nucleo: true }, areas: TODAS }),
        { navegar: () => {} },
      );
      await recolher();
      const botao = definido(
        seletor()?.querySelector<HTMLElement>(".menu-area__cabecalho"),
      );
      expect(botao.getAttribute("aria-label")).toBe(
        "Área atual: Saúde Indígena. Trocar de área",
      );
      // No trilho a área atual não tem cabeçalho: as páginas são ícones diretos.
      expect(
        definido(area("saude-indigena")).querySelector<HTMLElement>(
          ".menu-area__cabecalho",
        ),
      ).toBeNull();

      // Apontar e focar só mostram a dica; quem abre a lista é o clique.
      await act(async () => {
        botao.dispatchEvent(
          new PointerEvent("pointerover", {
            bubbles: true,
            pointerType: "mouse",
          }),
        );
        botao.focus();
      });
      expect(seletor()?.classList.contains("menu-area--flutuante")).toBe(false);

      await clicar(botao);
      expect(seletor()?.classList.contains("menu-area--flutuante")).toBe(true);
      await clicar(opcao("projetos"));
      expect(seletor()?.classList.contains("menu-area--flutuante")).toBe(false);
      expect(obterDadosDoMonitoramento().areaAtual).toBe("projetos");
      expect(document.activeElement).toBe(
        seletor()?.querySelector<HTMLElement>(".menu-area__cabecalho"),
      );
    });

    it("o ícone do seletor é o da área atual, com a cor e a dica dela", async () => {
      await montar(
        montarArvoreDoMenu({ permitidas: { nucleo: true }, areas: TODAS }),
        { navegar: () => {} },
      );
      await recolher();
      const botao = () =>
        seletor()?.querySelector<HTMLElement>(".menu-seletor__botao");
      const icone = () =>
        botao()?.querySelector<HTMLElement>(".menu-seletor__icone")?.dataset
          .icone;

      const esperado = {
        "saude-indigena": ["heart-pulse", "Área: Saúde Indígena"],
        sede: ["building-2", "Área: SEDE"],
        projetos: ["folder-kanban", "Área: Projetos"],
      };
      for (const [id, [nome, dica]] of Object.entries(esperado)) {
        await act(async () => definirAreaAtual(id));
        expect(icone()).toBe(nome);
        expect(botao()?.dataset.corDaArea).toBe(id);
        expect(botao()?.dataset.dica).toBe(dica);
        expect(
          botao()?.querySelector<HTMLElement>(".menu-seletor__ponto")?.dataset
            .corDaArea,
        ).toBe(id);
      }

      // Expandida, a marca é a mesma (ícone e bolinha); a dica é só do trilho.
      await recolher(false);
      expect(icone()).toBe("folder-kanban");
      expect(botao()?.hasAttribute("data-dica")).toBe(false);
    });
  });

  /*
  Recolhida, cada página da área atual é um ícone que navega num clique, com a
  dica do nome e a página aberta em destaque; o título do bloco vira um
  separador. Administração continua agrupada, com o painel flutuante.
*/
  describe("barra recolhida: páginas da área como ícones", () => {
    const TODAS = ["saude-indigena", "sede", "projetos"];
    const arvoreDasAreas = () =>
      montarArvoreDoMenu({
        permitidas: {
          dashboard: true,
          nucleo: true,
          calendario: true,
          approved: true,
          analises: true,
          recursos: true,
          config: true,
        },
        paineis: [{ codigo: "x", titulo: "Painel X" }],
        secoesDeConfiguracao: SECOES,
        areas: TODAS,
      });
    const paginasDoTrilho = () => [
      ...document.querySelectorAll<HTMLElement>(
        ".menu-area--direta .menu-item",
      ),
    ];

    it("de cima para baixo: área, páginas (em blocos) e Administração", async () => {
      await montar(arvoreDasAreas(), { navegar: () => {} });
      await recolher();

      const ordem = [
        ...document.querySelectorAll<HTMLElement>("#nav > section"),
      ].map((secao) =>
        secao.dataset.seletorDeArea ? "seletor" : secao.dataset.area,
      );
      expect(ordem).toEqual(["seletor", "saude-indigena", "administracao"]);
      expect(
        paginasDoTrilho().map((botao) => [
          botao.dataset.rotulo,
          botao.querySelector<HTMLElement>(".menu-item__icone")?.dataset.icone,
          botao.dataset.dica,
        ]),
      ).toEqual([
        ["Visão geral", "map", "Visão geral"],
        ["Painel das análises", "file-search", "Painel das análises"],
        ["Painel de recursos", "scale", "Painel de recursos"],
        ["Cronograma", "calendar-days", "Cronograma"],
        ["Painel X", "square-arrow-out-up-right", "Painel X"],
        ["Editais", "file-text", "Editais"],
        ["Lista de aprovados", "user-round-check", "Lista de aprovados"],
      ]);
      // Os dois blocos continuam no trilho (o título só sai de vista no CSS).
      expect(
        [
          ...document.querySelectorAll<HTMLElement>(
            ".menu-area--direta .menu-bloco",
          ),
        ].map((bloco) => bloco.dataset.bloco),
      ).toEqual(["acompanhamento", "processo"]);
      // O nome continua no botão para o leitor de tela.
      expect(
        paginasDoTrilho().map(
          (botao) =>
            botao.querySelector<HTMLElement>(".menu-item__rotulo")?.textContent,
        ),
      ).toContain("Cronograma");
      // Administração continua agrupada, sem dica (a pílula diz o nome).
      expect(area("paineis")).toBeNull();
      expect(cabecalho("administracao")?.getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(cabecalho("administracao")?.hasAttribute("data-dica")).toBe(false);
    });

    it("um clique navega e marca a página aberta, sem painel", async () => {
      const chamadas: unknown[] = [];
      await montar(arvoreDasAreas(), {
        navegar: (view) => {
          chamadas.push(view);
          marcarItemAtivoNoMenu(view);
        },
      });
      await recolher();

      const cronograma = definido(item("calendario"));
      expect(
        cronograma.closest<HTMLElement>(".menu-area--direta"),
      ).not.toBeNull();
      await clicar(cronograma);

      expect(chamadas).toEqual(["calendario"]);
      expect(item("calendario")?.getAttribute("aria-current")).toBe("page");
      expect(item("calendario")?.classList.contains("active")).toBe(true);
      expect(
        document.querySelectorAll<HTMLElement>('#nav [aria-current="page"]'),
      ).toHaveLength(1);
      expect(
        document.querySelector<HTMLElement>(".menu-area--flutuante"),
      ).toBeNull();

      // Apontar uma página não abre painel nenhum.
      await act(async () =>
        definido(area("saude-indigena")).dispatchEvent(
          new PointerEvent("pointerover", {
            bubbles: true,
            pointerType: "mouse",
          }),
        ),
      );
      expect(
        document.querySelector<HTMLElement>(".menu-area--flutuante"),
      ).toBeNull();
    });

    it("trocar de área troca os ícones das páginas", async () => {
      await montar(arvoreDasAreas(), { navegar: () => {} });
      await recolher();
      // O painel externo não tem área: fica de fora da conta.
      const areasDasPaginas = () =>
        new Set(
          paginasDoTrilho()
            .filter(
              (botao) => !definido(botao.dataset.view).startsWith("panel:"),
            )
            .map((botao) => botao.dataset.area),
        );
      expect(areasDasPaginas()).toEqual(new Set(["saude-indigena"]));

      await act(async () => definirAreaAtual("projetos"));
      expect(areasDasPaginas()).toEqual(new Set(["projetos"]));
      expect(
        item("panel:x")?.closest<HTMLElement>(".menu-area")?.dataset.area,
      ).toBe("projetos");
    });

    it("com uma área só, as páginas também são ícones diretos", async () => {
      await montar(arvoreCompleta(), { navegar: () => {} });
      await recolher();
      expect(
        definido(area("saude-indigena")).classList.contains(
          "menu-area--direta",
        ),
      ).toBe(true);
      expect(
        definido(area("saude-indigena")).querySelector<HTMLElement>(
          ".menu-area__cabecalho",
        ),
      ).toBeNull();
      expect(item("nucleo")?.dataset.dica).toBe("Editais");
    });

    it("a dica aparece na altura do ícone apontado ou focado", async () => {
      await montar(arvoreDasAreas(), { navegar: () => {} });
      await recolher();
      const editais = definido(item("nucleo"));
      // A dica só lê top e height; o resto completa o DOMRect.
      editais.getBoundingClientRect = () => ({
        top: 100,
        height: 36,
        x: 0,
        y: 100,
        width: 0,
        left: 0,
        right: 0,
        bottom: 136,
        toJSON: () => ({}),
      });
      await act(async () => editais.focus());
      expect(editais.style.getPropertyValue("--dica-topo")).toBe("118px");
    });
  });

  /*
  O menu aberto mostra o ícone de cada página à esquerda do nome (o mesmo do
  trilho), e a aba beta leva o selo "BETA".
*/
  describe("ícones e selo beta no menu aberto", () => {
    const arvore = () =>
      montarArvoreDoMenu({
        permitidas: {
          dashboard: true,
          nucleo: true,
          recursos: true,
          "analisar-recursos": true,
          config: true,
        },
        paineis: [{ codigo: "x", titulo: "Painel X" }],
        secoesDeConfiguracao: SECOES,
      });

    it("todo item tem o ícone da página antes do nome", async () => {
      await montar(arvore());
      const itens = [
        ...document.querySelectorAll<HTMLElement>("#nav .menu-item"),
      ];
      expect(itens.length).toBeGreaterThan(0);
      for (const botao of itens) {
        const icone = comDataset(botao.firstElementChild);
        expect(icone.classList.contains("menu-item__icone")).toBe(true);
        expect(icone.dataset.icone).toBe(botao.dataset.icone);
        expect(icone.nextElementSibling?.className).toBe("menu-item__rotulo");
      }
      expect(item("dashboard")?.dataset.icone).toBe("map");
      expect(item("panel:x")?.dataset.icone).toBe("square-arrow-out-up-right");
      expect(item("config", "acessos")?.dataset.icone).toBe("users");
      // Expandida não há dica: o nome está à vista.
      expect(
        document.querySelector<HTMLElement>("#nav [data-dica]"),
      ).toBeNull();
    });

    it("só a aba beta leva o selo, ao lado do nome", async () => {
      await montar(arvore());
      const selos = document.querySelectorAll<HTMLElement>(
        "#nav .menu-item__selo",
      );
      expect(selos).toHaveLength(1);
      expect(selos[0]?.textContent).toBe("BETA");
      expect(selos[0]?.closest<HTMLElement>(".menu-item")).toBe(
        item("analisar-recursos"),
      );
      expect(
        item("analisar-recursos")?.classList.contains("menu-item--beta"),
      ).toBe(true);
      expect(selos[0]?.previousElementSibling?.textContent).toBe("Recursos");
      // `data-rotulo` é o nome da página: o selo não entra nele.
      expect(item("analisar-recursos")?.dataset.rotulo).toBe("Recursos");
      expect(
        item("recursos")?.querySelector<HTMLElement>(".menu-item__selo"),
      ).toBeNull();
      expect(
        item("nucleo")?.querySelector<HTMLElement>(".menu-item__selo"),
      ).toBeNull();
    });

    it("aba e área em manutenção levam a chave inglesa, com a mensagem na dica", async () => {
      const base = arvore();
      const [primeira, ...demais] = base;
      const saude = definido(primeira);
      await montar([
        {
          ...saude,
          manutencao: { mensagem: "Área em ajuste", previsao: null },
          itens: saude.itens.map((i) =>
            i.view === "nucleo"
              ? {
                  ...i,
                  manutencao: { mensagem: "Editais", previsao: "2026-10-05" },
                }
              : i,
          ),
        },
        ...demais,
      ]);
      const indicador =
        item("nucleo")?.querySelector<HTMLElement>(".menu-manutencao");
      expect(indicador?.title).toBe(
        "Em manutenção · Editais · Previsão de volta: 05/10/2026",
      );
      expect(item("nucleo")?.classList.contains("menu-item--manutencao")).toBe(
        true,
      );
      expect(
        item("dashboard")?.querySelector<HTMLElement>(".menu-manutencao"),
      ).toBeNull();
      expect(
        cabecalho(saude.id)?.querySelector<HTMLElement>(".menu-manutencao")
          ?.title,
      ).toContain("Área em ajuste");
    });
  });

  describe("escolher uma página", () => {
    it("chama a navegação com a view do item", async () => {
      const chamadas: unknown[] = [];
      await montar(arvoreCompleta(), {
        navegar: (view) => chamadas.push(view),
      });

      await clicar(item("nucleo"));
      await clicar(item("dashboard"));
      await clicar(item("analises"));

      expect(chamadas).toEqual(["nucleo", "dashboard", "analises"]);
    });

    it("sem opção, usa window.navigate na hora do clique (os embrulhos valem)", async () => {
      await montar();
      window.navigate = vi.fn();
      await clicar(item("approved"));
      expect(window.navigate).toHaveBeenCalledWith("approved");
    });

    it("seção de Configurações: navega uma vez e abre a seção", async () => {
      const pagina = () => document.getElementById("page-config");
      const navegacoes: unknown[] = [];
      const secoes: unknown[] = [];
      await montar(arvoreCompleta(), {
        navegar: (view) => {
          navegacoes.push(view);
          pagina()?.classList.add("active");
        },
        aoAbrirSecao: (_view, secao) => secoes.push(secao),
      });

      await clicar(item("config", "acesso"));
      await clicar(item("config", "acessos"));

      expect(navegacoes).toEqual(["config"]);
      expect(secoes).toEqual(["acesso", "acessos"]);
      expect(item("config", "acessos")?.getAttribute("aria-current")).toBe(
        "page",
      );
    });

    it("se a navegação foi barrada, a seção não abre", async () => {
      const secoes: unknown[] = [];
      await montar(arvoreCompleta(), {
        navegar: () => {},
        aoAbrirSecao: (_view, secao) => secoes.push(secao),
      });
      await clicar(item("config", "operacao"));
      expect(secoes).toEqual([]);
    });
  });

  /*
  Recolhida, Administração é um ícone, e o painel dela flutua ao lado do
  trilho (o seletor de área também abre um). O estado é o de `proximoFlutuante` (testado em
  tests/casca-sessao-e-interface.test.js (bloco menu-lateral)).
*/
  describe("barra recolhida: painel flutuante", () => {
    it("o clique no ícone abre e fixa; o segundo fecha", async () => {
      await montar(arvoreCompleta(PAINEL_X), { navegar: () => {} });
      await recolher();

      await clicar(cabecalho("administracao"));
      expect(flutuando("administracao")).toBe(true);
      expect(cabecalho("administracao")?.getAttribute("aria-expanded")).toBe(
        "true",
      );
      expect(
        definido(area("administracao")).style.getPropertyValue(
          "--menu-flutuante-topo",
        ),
      ).toMatch(/px$/);

      await clicar(cabecalho("administracao"));
      expect(flutuando("administracao")).toBe(false);
      expect(cabecalho("administracao")?.getAttribute("aria-expanded")).toBe(
        "false",
      );
    });

    it("só um painel por vez", async () => {
      await montar(
        montarArvoreDoMenu({
          permitidas: { nucleo: true, config: true },
          secoesDeConfiguracao: SECOES,
          areas: ["saude-indigena", "sede"],
        }),
        { navegar: () => {} },
      );
      await recolher();
      const seletorDeArea = () =>
        document.querySelector<HTMLElement>("[data-seletor-de-area]");
      await clicar(
        seletorDeArea()?.querySelector<HTMLElement>(".menu-area__cabecalho"),
      );
      expect(seletorDeArea()?.classList.contains("menu-area--flutuante")).toBe(
        true,
      );
      await clicar(cabecalho("administracao"));
      expect(seletorDeArea()?.classList.contains("menu-area--flutuante")).toBe(
        false,
      );
      expect(flutuando("administracao")).toBe(true);
    });

    it("Esc fecha e devolve o foco ao ícone, sem reabrir", async () => {
      await montar(arvoreCompleta(PAINEL_X), { navegar: () => {} });
      await recolher();
      await clicar(cabecalho("administracao"));

      await act(async () => definido(item("config", "marca")).focus());
      await act(async () =>
        definido(item("config", "marca")).dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );

      expect(flutuando("administracao")).toBe(false);
      expect(document.activeElement).toBe(cabecalho("administracao"));
    });

    it("escolher um item, clicar fora ou expandir a barra fecham o painel", async () => {
      await montar(arvoreCompleta(PAINEL_X), { navegar: () => {} });
      await recolher();

      await clicar(cabecalho("administracao"));
      await clicar(item("config", "marca"));
      expect(flutuando("administracao")).toBe(false);

      await clicar(cabecalho("administracao"));
      await act(async () =>
        document.body.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true }),
        ),
      );
      expect(flutuando("administracao")).toBe(false);

      await clicar(cabecalho("administracao"));
      await recolher(false);
      expect(flutuando("administracao")).toBe(false);
    });

    it("expandida, o clique no cabeçalho volta a ser acordeão", async () => {
      await montar();
      await clicar(cabecalho("saude-indigena"));
      expect(flutuando("saude-indigena")).toBe(false);
      expect(aberta("saude-indigena")).toBe(false);
    });

    it("a navegação ganha .transborda quando os ícones não cabem", async () => {
      class ObservadorFalso implements ResizeObserver {
        avisar: ResizeObserverCallback;
        constructor(avisar: ResizeObserverCallback) {
          this.avisar = avisar;
          observadores.push(this);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      const observadores: ObservadorFalso[] = [];
      const ResizeObserverOriginal = globalThis.ResizeObserver;
      globalThis.ResizeObserver = ObservadorFalso;
      try {
        await montar();
        const navegacao = definido(
          document.querySelector<HTMLElement>(".side-navigation"),
        );
        Object.defineProperty(navegacao, "scrollHeight", {
          configurable: true,
          value: 900,
        });
        Object.defineProperty(navegacao, "clientHeight", {
          configurable: true,
          value: 500,
        });
        // Sem argumentos, como o teste sempre chamou.
        const ultimo = definido(observadores.at(-1));
        await act(async () => Reflect.apply(ultimo.avisar, ultimo, []));
        expect(navegacao.classList.contains("transborda")).toBe(true);
      } finally {
        globalThis.ResizeObserver = ResizeObserverOriginal;
      }
    });
  });

  /*
  Um controle só para recolher, com o id de sempre. Acima de 900px mora no
  rodapé, entre o tema e o Sair, no mesmo lugar expandida ou recolhida; até
  900px a barra é gaveta fora da tela e o botão vai para o cabeçalho (portal),
  senão sairia da tela junto com ela.
*/
  describe("o botão de recolher", () => {
    const botoes = () =>
      document.querySelectorAll<HTMLElement>("#globalSidebarToggle");
    const filhosDoRodape = () =>
      [...definido(document.querySelector(".side-footer")).children].map(
        (filho) => filho.id || filho.className,
      );

    it("no desktop fica no rodapé, entre o tema e o Sair, nos dois modos", async () => {
      await montar();
      const botao = definido(document.getElementById("globalSidebarToggle"));

      expect(botoes()).toHaveLength(1);
      expect(botao.parentElement?.className).toBe("side-footer");
      expect(filhosDoRodape()).toEqual([
        "side-tema",
        "globalSidebarToggle",
        "sidebarLogoutBtn",
        "side-version",
      ]);
      expect(botao.querySelector("svg")?.dataset.icone).toBe("panel-left");
      expect(botao.textContent).toBe("Recolher menu");
      expect(botao.getAttribute("aria-expanded")).toBe("true");
      expect(botao.getAttribute("aria-label")).toBe("Recolher menu");
      // A marca ficou só com a logo e o nome: nenhuma alça na borda.
      expect(
        document.querySelector<HTMLElement>(".side-brand button"),
      ).toBeNull();

      await recolher();
      expect(botoes()).toHaveLength(1);
      expect(filhosDoRodape()).toEqual([
        "side-tema",
        "globalSidebarToggle",
        "sidebarLogoutBtn",
        "side-version",
      ]);
      expect(
        document.getElementById("globalSidebarToggle")?.querySelector("svg")
          ?.dataset.icone,
      ).toBe("panel-left");
    });

    it("acompanha a classe de body, com rótulo e dica, e chama janela.toggleSidebar", async () => {
      await montar();
      janela.toggleSidebar = vi.fn();
      await recolher();

      const botao = definido(document.getElementById("globalSidebarToggle"));
      expect(botao.getAttribute("aria-expanded")).toBe("false");
      expect(botao.getAttribute("aria-label")).toBe("Expandir menu");
      expect(botao.dataset.dica).toBe("Expandir menu");
      expect(botao.textContent).toBe("Expandir menu");
      await clicar(botao);
      expect(janela.toggleSidebar).toHaveBeenCalledTimes(1);

      await recolher(false);
      expect(botao.dataset.dica).toBe("Recolher menu");
    });

    it("até 900px vai para o cabeçalho, como o único ☰", async () => {
      await montar();
      await larguraDaJanela(390);

      const botao = definido(document.getElementById("globalSidebarToggle"));
      expect(botoes()).toHaveLength(1);
      expect(botao.parentElement?.classList.contains("title-row")).toBe(true);
      expect(botao.closest<HTMLElement>(".sidebar")).toBeNull();
      expect(botao.querySelector("svg")?.dataset.icone).toBe("menu");
      // Uma ação do cabeçalho, com a mesma caixa das outras.
      expect(botao.classList).toContain("topo-acao");
      expect(
        document.querySelectorAll<HTMLElement>("header.top .title-row button"),
      ).toHaveLength(1);
      // Na gaveta, `sidebar-collapsed` quer dizer fechada.
      await recolher();
      expect(
        document
          .getElementById("globalSidebarToggle")
          ?.getAttribute("aria-label"),
      ).toBe("Abrir menu");
      await recolher(false);
      expect(
        document
          .getElementById("globalSidebarToggle")
          ?.getAttribute("aria-label"),
      ).toBe("Fechar menu");

      await larguraDaJanela(1440);
      expect(
        document.getElementById("globalSidebarToggle")?.parentElement
          ?.className,
      ).toBe("side-footer");
      expect(botoes()).toHaveLength(1);
    });
  });

  /*
  No trilho, todo controle só com ícone tem nome acessível e dica visível
  (`data-dica`, que o CSS desenha no ponteiro e no foco).
*/
  describe("barra recolhida: nomes e dicas dos ícones", () => {
    it("seletor, páginas, tema, recolher e Sair têm aria-label ou nome e dica", async () => {
      await montar(
        montarArvoreDoMenu({
          permitidas: { dashboard: true, nucleo: true, config: true },
          secoesDeConfiguracao: SECOES,
          areas: ["saude-indigena", "sede"],
        }),
        { navegar: () => {} },
      );
      await recolher();

      const comDica = [
        ...document.querySelectorAll<HTMLElement>(".sidebar [data-dica]"),
      ];
      expect(comDica.map((botao) => botao.dataset.dica)).toEqual([
        "Área: Saúde Indígena",
        "Visão geral",
        "Editais",
        "Alternar para tema escuro",
        "Expandir menu",
        "Sair",
      ]);
      for (const botao of comDica) {
        expect(botao.tagName).toBe("BUTTON");
        const nome =
          botao.getAttribute("aria-label") ||
          botao.querySelector<HTMLElement>(".menu-item__rotulo")?.textContent;
        expect(nome).toBeTruthy();
        // Sem `title`: o nativo repetiria a dica, com atraso.
        expect(botao.hasAttribute("title")).toBe(false);
      }
    });
  });

  describe("rodapé", () => {
    const opcao = (tema: string) =>
      document.querySelector<HTMLElement>(
        `.side-tema__opcao[data-tema="${tema}"]`,
      );

    it("o seletor de tema troca o tema, e o segmento ativo não inverte", async () => {
      await montar();
      janela.toggleDarkMode = vi.fn(() => {
        const escuro =
          document.documentElement.getAttribute("data-theme") === "dark";
        document.documentElement.setAttribute(
          "data-theme",
          escuro ? "" : "dark",
        );
        avisar(EVENTO_TEMA_ALTERADO);
      });

      expect(opcao("claro")?.getAttribute("aria-pressed")).toBe("true");
      await clicar(opcao("escuro"));
      expect(janela.toggleDarkMode).toHaveBeenCalledTimes(1);
      expect(opcao("escuro")?.getAttribute("aria-pressed")).toBe("true");
      expect(
        document
          .querySelector<HTMLElement>(".side-tema__alternar")
          ?.getAttribute("aria-label"),
      ).toBe("Tema escuro ativo. Alternar para tema claro.");

      await clicar(opcao("escuro"));
      expect(janela.toggleDarkMode).toHaveBeenCalledTimes(1);
    });

    it("o Sair abre a confirmação de saída", async () => {
      await montar();
      await clicar(document.getElementById("sidebarLogoutBtn"));
      expect(sairDoSistema).toHaveBeenCalledTimes(1);
    });

    /*
    Uma folha continua do legado: o texto da versão (applyConfigToUi). O React
    cria o nó e não mexe mais nele — uma nova renderização não pode desfazer o
    que o legado escreveu. A logo é do React (marca.ts) e também sobrevive.
  */
    it("logo gravada e versão escrita pelo legado sobrevivem às renderizações", async () => {
      await montar();
      await act(async () =>
        aplicarMarcaDaBarraLateral({ logo: "/assets/outra.webp" }),
      );
      definido(document.getElementById("sidebarVersion")).textContent = "2.0.1";

      await act(async () => atualizarMenuLateral(arvoreCompleta([])));
      await act(async () => marcarItemAtivoNoMenu("nucleo"));
      await recolher();

      expect(document.getElementById("sideLogo")?.getAttribute("src")).toBe(
        "/assets/outra.webp",
      );
      expect(document.getElementById("sidebarVersion")?.textContent).toBe(
        "2.0.1",
      );
    });

    /*
    A marca era o legado sidebar-branding.js (src por setAttribute e onerror
    imperativo). Agora o <img> é do React e lê marca.ts: a logo e a cor da
    configuração chegam sem mexer no DOM da barra, e um endereço que não
    carrega volta para a logo padrão em vez de esconder a imagem.
  */
    it("a logo e a cor da configuração pintam a barra", async () => {
      await montar();
      await act(async () =>
        aplicarMarcaDaConfiguracao({
          ui_sidebar_logo_url: "https://exemplo.test/logo.png",
          ui_sidebar_background_color: "#0B3D2E",
        }),
      );
      const logo = definido(document.getElementById("sideLogo"));
      expect(logo.getAttribute("src")).toBe("https://exemplo.test/logo.png");
      expect(logo.getAttribute("alt")).toBe("AgSUS");
      expect(
        document.documentElement.style.getPropertyValue("--sidebar-custom-bg"),
      ).toBe("#0b3d2e");
      expect(document.body.classList.contains("sidebar-theme-dark")).toBe(true);

      await act(async () =>
        aplicarMarcaDaBarraLateral({ logo: "javascript:alert(1)", cor: "red" }),
      );
      expect(logo.isConnected).toBe(false);
      expect(document.querySelector(".side-brand svg.side-simbolo")).not.toBeNull();
      expect(
        document.documentElement.style.getPropertyValue("--sidebar-custom-bg"),
      ).toBe("#ffffff");
      expect(document.body.classList.contains("sidebar-theme-dark")).toBe(
        false,
      );
    });

    it("logo que não carrega volta para o símbolo, sem deixar a marca vazia", async () => {
      await montar();
      await act(async () =>
        aplicarMarcaDaBarraLateral({ logo: "/assets/quebrada.webp" }),
      );
      const logo = definido(document.getElementById("sideLogo"));
      expect(logo.getAttribute("src")).toBe("/assets/quebrada.webp");
      await act(async () => logo.dispatchEvent(new Event("error")));
      expect(document.getElementById("sideLogo")).toBeNull();
      expect(
        document.querySelector(".side-logo-wrap svg.side-simbolo"),
      ).not.toBeNull();
    });

    it("monta já com a cor padrão da marca (antes de a configuração chegar)", async () => {
      document.documentElement.style.removeProperty("--sidebar-custom-bg");
      await montar();
      expect(
        document.documentElement.style.getPropertyValue("--sidebar-custom-bg"),
      ).toBe("#ffffff");
    });
  });

  // CRLF vira LF: no Windows o checkout pode trazer \r\n, e as buscas por "\n" passariam por vacuidade.
  const semComentarios = (fonte: string) =>
    fonte
      .replace(/\r\n/g, "\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  const bloco = (css: string, seletor: string) => {
    const i = css.indexOf(seletor);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };

  describe("contrato de CSS e ligação no arranque", () => {
    const css = semComentarios(
      readFileSync("src/styles/barra-lateral.css", "utf8"),
    );
    const platformShell = semComentarios(
      readFileSync("src/styles/platform-shell.css", "utf8"),
    );
    const app = semComentarios(readFileSync("src/styles/app.css", "utf8"));
    const main = readFileSync("src/main.ts", "utf8");
    const html = htmlDaPagina();

    it("o botão único, sem outro hambúrguer nem regra de id com !important", () => {
      expect(css).not.toContain("#hambToggle");
      expect(css).not.toContain("#appScreen");
      expect(css).not.toContain("!important");
    });

    it("fica no rodapé (sem alça na marca) e no fluxo do cabeçalho, nunca fixo", () => {
      expect(css).not.toContain(".side-brand > .global-side-toggle");
      expect(bloco(css, ".side-footer > .side-recolher {")).toContain(
        "display: flex",
      );
      const topo = semComentarios(
        readFileSync("src/app/casca/topo.css", "utf8"),
      );
      const noCabecalho = bloco(topo, ".title-row > .global-side-toggle");
      expect(noCabecalho).toContain("order: -1");
      expect(noCabecalho).not.toContain("position: fixed");
      expect(css).not.toContain("position: fixed;\n  top: 50%");
    });

    it("recolhida, as dicas aparecem no ponteiro e no foco, fixas ao lado do trilho", () => {
      const dica = bloco(
        css,
        "body.sidebar-collapsed .sidebar [data-dica]::after",
      );
      expect(dica).toContain("content: attr(data-dica)");
      expect(dica).toContain("position: fixed");
      expect(dica).toContain("top: var(--dica-topo");
      expect(css).toMatch(
        /body\.sidebar-collapsed \.sidebar \[data-dica\]:hover::after,\s*body\.sidebar-collapsed \.sidebar \[data-dica\]:focus-visible::after\s*\{[^}]*visibility:\s*visible/,
      );
    });

    it("recolhida, as páginas da área atual ficam no trilho, sem painel flutuante", () => {
      const painel = bloco(
        css,
        "body.sidebar-collapsed .menu-area--direta > .menu-area__painel",
      );
      expect(painel).toContain("position: static");
      expect(painel).toContain("visibility: visible");
    });

    it("nenhum remendo esconde o botão nem guarda folga para a alça", () => {
      // O system-ui-fixes.css foi dissolvido: o cabeçalho é de src/app/casca/topo.css.
      expect(existsSync("src/styles/system-ui-fixes.css")).toBe(false);
      const cabecalho = semComentarios(
        readFileSync("src/styles/app.css", "utf8") +
          readFileSync("src/styles/platform-shell.css", "utf8") +
          readFileSync("src/app/casca/topo.css", "utf8"),
      );
      expect(cabecalho).not.toMatch(
        /\.top\s*\{[^}]*padding-left:\s*var\(--space-6\)/,
      );
      expect(cabecalho).not.toMatch(/\.app \.global-side-toggle\s*\{/);
    });

    it("recolhida, quem rola é a navegação, e só quando transborda", () => {
      expect(platformShell).not.toContain("max-height: 620px");
      expect(
        bloco(
          platformShell,
          "body.sidebar-collapsed .side-navigation.transborda",
        ),
      ).toContain("overflow-y: auto");
      expect(platformShell).not.toContain(
        "body.external-panel-mode .sidebar .global-side-toggle",
      );
    });

    it("a barra é fixa em todo o desktop", () => {
      expect(app).not.toContain("min-width: 1481px");
      expect(bloco(app, "@media (min-width: 901px)")).toContain(
        "position: fixed",
      );
    });

    it("a barra desenha com a raiz (na casca, com a marca, sem branding do legado) e o main.ts importa o CSS dela", () => {
      expect(readFileSync("src/app/casca/casca.tsx", "utf8")).toContain(
        'import { BarraLateral } from "../../componentes/barra-lateral/barra-lateral.tsx"',
      );
      expect(main).toContain('import "./styles/barra-lateral.css"');
      expect(main.indexOf("aplicarMarcaDaBarraLateral();")).toBeGreaterThan(-1);
      expect(main.indexOf("aplicarMarcaDaBarraLateral();")).toBeLessThan(
        main.indexOf("montarRaiz({"),
      );
      expect(main).not.toContain("initSidebarBranding");
      expect(main).not.toContain("sidebar-branding");
      expect(main).not.toContain("colapsar-a-sidebar");
      expect(main).not.toContain("menu-lateral.css");
    });

    it("o <aside> é da casca e a barra desenha dentro dele, sem marcação no index.html", () => {
      expect(readFileSync("index.html", "utf8")).not.toContain("<aside");
      const aside = html.match(
        /<aside class="sidebar"[^>]*>([\s\S]*?)<\/aside>/,
      );
      expect(aside).not.toBeNull();
      expect(aside?.[1]).toContain('class="marca-yeende side-simbolo"');
      expect(aside?.[1]).toContain('id="globalSidebarToggle"');
    });
  });
});

bloco("componentes/central-de-convocacoes-para-entrevistas", () => {
  /* A página desligada pela coordenação (Módulos e abas): por padrão, ligada. */

  /*
  Central de convocações (aba Convocação da Lista de aprovados), "Para
  entrevistas": a lista de convocação da Classificação, só leitura, lida da
  MESMA loja de Conduzir entrevistas (o controlador da tela a entrega pelo
  registro). Nada de estado próprio: o edital escolhido aqui é o de
  Conduzir entrevistas, e convocar continua lá.
*/

  const RETRATO = {
    schema: 1,
    tipo: "CONVOCACAO",
    vagas: [
      {
        chave: "V1",
        codigo: "V1",
        cargo: "Enfermeiro",
        total: 1,
        origem_das_vagas: "QUADRO",
        limite_convocacao: { limite: 5, origem: "5 × 1 vaga(s)" },
        geral: [
          {
            posicao: 1,
            analise_id: "a1",
            nome: "Ana",
            nota: 90,
            modalidades: ["AC"],
          },
          {
            posicao: 2,
            analise_id: "a2",
            nome: "Bia",
            nota: 80,
            modalidades: ["AC"],
          },
        ],
        listas: {},
        eliminados: [],
      },
    ],
  };

  const edital = (id: string) => ({
    edital: { id, edital: `${id}/2026` },
    pode_editar: true,
    configuracao: { roteiro: { id: "r1", nome: "Roteiro", versao: 1 } },
    regra_classificacao: { versao: 3, convocacao: { multiplo_vagas: 5 } },
    lista_convocacao: {
      lista: {
        id: `lista-${id}`,
        versao_regra: 3,
        gerada_em: "2026-11-05T12:00:00Z",
      },
      retrato: RETRATO,
    },
    convocados: [
      {
        id: "e1",
        analise_id: "a1",
        vaga: "V1",
        candidato: "Ana",
        avaliacoes: [],
      },
    ],
  });

  /* Edital com id de verdade (uuid): o "Ir para…" só navega com ele. */
  const EDITAL_UUID = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
  const AGENDA = {
    itens: [
      {
        analise_id: "a1",
        data: "2026-12-02",
        inicio: "09:00:00",
        fim: "09:30:00",
        banca: 1,
      },
    ],
  };

  function bancoFalso({
    agenda = null as unknown,
    primeiro = "E1",
  }: { agenda?: unknown; primeiro?: string } = {}) {
    const chamadas: { nome: string; argumentos?: Record<string, unknown> }[] =
      [];
    const respostas: Record<string, (a?: Record<string, unknown>) => unknown> =
      {
        listar_editais_entrevista: () => ({
          admin_global: false,
          editais: [
            { id: primeiro, edital: "E1/2026", unidade: "CASAI Brasília" },
            { id: "E2", edital: "E2/2026", unidade: "CASAI Manaus" },
          ],
        }),
        obter_entrevistas_do_edital: (a) => edital(String(a?.["p_edital"])),
        obter_previsao_entrevista_edital: () => ({
          situacao: "PREVISTA",
          motivo: null,
          pode_alterar: false,
        }),
        obter_agenda_entrevista: () => agenda,
      };
    const cliente: ClienteDaConducao = {
      rpc: (nome, argumentos) => {
        chamadas.push({ nome, ...(argumentos ? { argumentos } : {}) });
        const responder = respostas[nome];
        return Promise.resolve(
          responder
            ? { data: responder(argumentos), error: null }
            : { data: null, error: { message: `sem ${nome}` } },
        );
      },
    };
    return { cliente, chamadas };
  }

  let desmontar: (() => void) | null = null;
  afterEach(() => {
    desmontar?.();
    desmontar = null;
    registrarTelas({});
    document.body.replaceChildren();
    Reflect.deleteProperty(window, "navigate");
    vi.mocked(paginaDesligada).mockReturnValue(false);
  });

  async function montar({
    tipo = "entrevista" as TipoDaCentralDeConvocacoes,
    podeEntrevistas = true,
    podeClassificacao = true,
    agenda = null as unknown,
    primeiro = "E1",
  } = {}) {
    const { cliente, chamadas } = bancoFalso({ agenda, primeiro });
    const criar = vi.fn(() =>
      criarConducaoDeEntrevistas({
        supabase: cliente,
        toast: () => {},
        areaAtual: () => "saude-indigena",
        armazenamento: () => undefined,
      }),
    );
    registrarTelas({ "conduzir-entrevistas": { criar } });
    const elemento = document.createElement("div");
    document.body.append(elemento);
    // A tela de Conduzir entrevistas chega numa promessa: dentro do `act`.
    const desenho = await act(async () =>
      desenharNoTeste(
        elemento,
        createElement(CentralDeConvocacoes, {
          tipo,
          aoMudar: () => {},
          podeEntrevistas,
          podeClassificacao,
        }),
      ),
    );
    desmontar = desenho.desmontar;
    return { elemento, criar, chamadas };
  }

  const botoes = (raiz: Element) =>
    [...raiz.querySelectorAll("button.btn")].map((b) => b.textContent?.trim());

  describe("Central de convocações: Para entrevistas", () => {
    it("mostra a lista da Classificação do edital aberto, sem marcar nem convocar", async () => {
      const { elemento, criar } = await montar();
      await esperar();
      await esperar();

      expect(criar).toHaveBeenCalledTimes(1);
      const bloco = elemento.querySelector(
        "[data-tour='central-convocacoes-entrevistas']",
      );
      expect(bloco).not.toBeNull();
      // Dois editais e nenhum lembrado: escolhe-se o edital.
      const select = elemento.querySelector("select");
      expect(select?.value).toBe("");
      expect(
        [...(select?.options ?? [])].map((o) => o.textContent).sort(),
      ).toEqual([
        "E1/2026 · CASAI Brasília",
        "E2/2026 · CASAI Manaus",
        "Escolha o edital…",
      ]);

      await escolher(select, "E1");
      await esperar();

      const linhas = [...elemento.querySelectorAll("tbody tr")].map((tr) =>
        tr.textContent?.replace(/\s+/g, " ").trim(),
      );
      expect(linhas).toHaveLength(2);
      expect(linhas[0]).toContain("Ana");
      expect(linhas[0]).toContain("Convocado");
      expect(linhas[1]).toContain("Bia");
      expect(linhas[1]).toContain("A convocar");
      expect(elemento.textContent).toContain(
        "Lista de convocação da Classificação",
      );
      // Só leitura: sem caixas, sem "Convocar selecionados" nem "Desconvocar".
      expect(elemento.querySelectorAll("input[type=checkbox]")).toHaveLength(0);
      expect(botoes(elemento)).not.toContain("Desconvocar");
      expect(
        botoes(elemento).some((b) => b?.startsWith("Convocar selecionados")),
      ).toBe(false);
      expect(botoes(elemento)).toEqual([
        "Convocar em Conduzir entrevistas",
        "Abrir listas da Classificação",
        "Editar na Classificação › Agenda",
      ]);
    });

    it("abaixo da lista, a agenda dos convocados do edital, só leitura", async () => {
      const { elemento } = await montar({ agenda: AGENDA });
      await esperar();
      await escolher(elemento.querySelector("select"), "E1");
      await esperar();
      const agenda = elemento.querySelector("[data-bloco='agenda-da-central']");
      expect(agenda?.querySelector("h4")?.textContent).toBe(
        "Agenda das entrevistas",
      );
      // Depois da lista de convocação, no mesmo bloco.
      const lista = elemento.querySelector(".entrevistas-convocacao");
      expect(
        lista &&
          agenda &&
          lista.compareDocumentPosition(agenda) &
            Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      const linhas = [...(agenda?.querySelectorAll("tbody tr") ?? [])].map(
        (tr) => tr.textContent?.replace(/\s+/g, " ").trim(),
      );
      expect(linhas).toEqual(["09:00–09:30AnaV11"]);
      expect(agenda?.querySelectorAll("input, select")).toHaveLength(0);
    });

    it("edital sem agenda salva: estado vazio, não erro", async () => {
      const { elemento } = await montar();
      await esperar();
      await escolher(elemento.querySelector("select"), "E1");
      await esperar();
      const agenda = elemento.querySelector("[data-bloco='agenda-da-central']");
      expect(agenda?.textContent).toContain(
        "Nenhum horário salvo para este edital.",
      );
      expect(agenda?.querySelector(".ui-aviso")).toBeNull();
    });

    it("'Editar na Classificação › Agenda' abre a Classificação na aba Agenda, no edital", async () => {
      const navigate = vi.fn();
      Object.assign(window, { navigate });
      const { elemento } = await montar({
        agenda: AGENDA,
        primeiro: EDITAL_UUID,
      });
      await esperar();
      await escolher(elemento.querySelector("select"), EDITAL_UUID);
      await esperar();
      await clicar(
        [...elemento.querySelectorAll("button")].find(
          (b) => b.textContent?.trim() === "Editar na Classificação › Agenda",
        ),
      );
      expect(navigate).toHaveBeenCalledWith("classificacao", {
        edital: EDITAL_UUID,
        visao: "agenda",
      });
    });

    it("o edital escolhido é o de Conduzir entrevistas (a mesma loja)", async () => {
      const { elemento, criar } = await montar();
      await esperar();
      await escolher(elemento.querySelector("select"), "E2");
      await esperar();
      const controlador = criar.mock.results[0]?.value as ReturnType<
        typeof criarConducaoDeEntrevistas
      >;
      expect(controlador.conducao.obter().editalId).toBe("E2");
      expect(controlador.conducao.obter().edital?.edital?.id).toBe("E2");
    });

    it("'Convocar em Conduzir entrevistas' abre Preparar sem trocar de edital", async () => {
      const navigate = vi.fn();
      Object.assign(window, { navigate });
      const { elemento } = await montar();
      await esperar();
      await escolher(elemento.querySelector("select"), "E1");
      await esperar();
      await clicar(
        [...elemento.querySelectorAll("button")].find(
          (b) => b.textContent?.trim() === "Convocar em Conduzir entrevistas",
        ),
      );
      expect(navigate).toHaveBeenCalledWith("conduzir-entrevistas", {
        visao: "preparar",
      });
    });

    it("sem acesso à Classificação, não oferece as listas dela nem editar a agenda", async () => {
      const { elemento } = await montar({
        podeClassificacao: false,
        agenda: AGENDA,
      });
      await esperar();
      await escolher(elemento.querySelector("select"), "E1");
      await esperar();
      expect(botoes(elemento)).not.toContain("Abrir listas da Classificação");
      expect(botoes(elemento)).not.toContain(
        "Editar na Classificação › Agenda",
      );
      // A agenda continua à vista, só leitura.
      expect(
        elemento.querySelector("[data-bloco='agenda-da-central'] tbody tr"),
      ).not.toBeNull();
    });

    it("não baixa Conduzir entrevistas na contratação nem sem acesso às entrevistas", async () => {
      const naContratacao = await montar({ tipo: "contratacao" });
      await esperar();
      expect(naContratacao.criar).not.toHaveBeenCalled();
      expect(naContratacao.chamadas).toHaveLength(0);
      expect(
        naContratacao.elemento.querySelector(
          "[data-tour='central-convocacoes-entrevistas']",
        ),
      ).toBeNull();
      desmontar?.();

      const semAcesso = await montar({ podeEntrevistas: false });
      await esperar();
      expect(semAcesso.criar).not.toHaveBeenCalled();
      expect(semAcesso.elemento.textContent).toBe("");
    });

    it("se Conduzir entrevistas não abre, avisa e mantém o link antigo", async () => {
      const navigate = vi.fn();
      Object.assign(window, { navigate });
      const { elemento } = await montar();
      registrarTelas({});
      desmontar?.();
      const outro = document.createElement("div");
      document.body.append(outro);
      const desenho = await act(async () =>
        desenharNoTeste(
          outro,
          createElement(CentralDeConvocacoes, {
            tipo: "entrevista",
            aoMudar: () => {},
            podeEntrevistas: true,
            podeClassificacao: true,
          }),
        ),
      );
      desmontar = desenho.desmontar;
      await esperar();
      expect(elemento.textContent).toBe("");
      expect(outro.querySelector(".ui-aviso")?.textContent).toContain(
        "Não foi possível abrir a convocação para entrevistas",
      );
      await clicar(
        [...outro.querySelectorAll("button")].find(
          (b) => b.textContent?.trim() === "Abrir Convocação para entrevistas",
        ),
      );
      expect(navigate).toHaveBeenCalledWith("conduzir-entrevistas");
    });

    it("Conduzir entrevistas desligada na área: a central não oferece as entrevistas", async () => {
      // StrictMode desenha duas vezes: vale para as duas (o afterEach volta a ligar).
      vi.mocked(paginaDesligada).mockReturnValue(true);
      let ligada: boolean | null = null;
      function Sonda() {
        ligada = usarConducaoLigada();
        return null;
      }
      const elemento = document.createElement("div");
      document.body.append(elemento);
      const desenho = await act(async () =>
        desenharNoTeste(elemento, createElement(Sonda)),
      );
      desmontar = desenho.desmontar;
      expect(ligada).toBe(false);
      expect(vi.mocked(paginaDesligada)).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: "conduzir-entrevistas" }),
      );
    });
  });
});

bloco("modulos/mapa", () => {
  /*
    A aba Mapa (src/modulos/mapa/mapa.tsx): o mapa dos DSEIs numa página
    própria, com o DSEI aberto no endereço (`/saude-indigena/mapa/<dsei>`). O
    mapa de verdade (Leaflet + SIGEPSI) tem os próprios testes; aqui ele é
    trocado por um falso que mostra o que recebeu.
  */

  const LINHAS = [
    { id: 1, unidade: "DSEI Yanomami", CO_AREA: "saude-indigena" },
    { id: 2, unidade: "DSEI Xingu", CO_AREA: "saude-indigena" },
    { id: 3, unidade: "SEDE", CO_AREA: "sede" },
  ];

  function dadosFalsos(areaAtual = "saude-indigena"): DadosDoMonitoramento {
    return {
      obter: () => ({ linhas: LINHAS, areaAtual, carregado: true }),
      assinar: () => () => {},
    };
  }

  const props = () => {
    if (!visto.props) throw new Error("o mapa não foi desenhado");
    return visto.props;
  };
  const url = () => location.pathname + location.search;
  const dsei = (k: string): DseiDoMapa => ({ k, n: k }) as DseiDoMapa;

  let raiz: Root | null = null;
  async function abrir({
    area = "saude-indigena",
    leaflet = async () => {},
  }: { area?: string; leaflet?: () => Promise<void> } = {}) {
    const estado = criarEstadoDaVisaoGeral({
      dados: dadosFalsos(area),
      armazenamento: null,
      aberta: false,
    });
    estado.definirLidaPeloMapa(true);
    const irPara = vi.fn();
    const mapa = criarMapa({
      estado,
      supabase: null,
      leaflet,
      irPara,
      comAcompanhamento: true,
    });
    const caixa = document.createElement("div");
    document.body.append(caixa);
    const nova = createRoot(caixa);
    raiz = nova;
    await act(async () => nova.render(mapa.conteudo));
    return { estado, mapa, irPara, caixa };
  }

  beforeEach(() => {
    visto.props = null;
    esquecerFiltrosDasTelas();
    history.replaceState(null, "", "/saude-indigena/mapa");
  });
  afterEach(async () => {
    const montada = raiz;
    if (montada) await act(async () => montada.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  describe("a aba Mapa", () => {
    it("desenha o mapa com as linhas da área inteira, sem DSEI aberto", async () => {
      await abrir();
      expect(props().dseiSelecionado).toBeNull();
      expect(props().filtroAtivo).toBe(false);
      expect((props().linhas || []).map((l) => l.unidade)).toEqual([
        "DSEI Yanomami",
        "DSEI Xingu",
      ]);
    });

    it("espera o desconto das vagas reabertas antes de desenhar", async () => {
      let responder: (valor: unknown) => void = () => {};
      const { estado } = await abrir();
      await act(async () =>
        estado.definirBuscaDoAcompanhamento(
          () =>
            new Promise((resolve) => {
              responder = resolve;
            }),
        ),
      );
      visto.props = null;
      await act(async () => {});
      expect(estado.obter().aguardandoVagas).toBe(true);
      expect(visto.props).toBeNull();

      await act(async () => responder({ etapas: [], listas: [] }));
      await vi.waitFor(() => expect(visto.props).not.toBeNull());
      expect(estado.obter().aguardandoVagas).toBe(false);
    });

    it("o link com o DSEI abre o mapa já nele", async () => {
      history.replaceState(null, "", "/saude-indigena/mapa/yanomami");
      await abrir();
      expect(props().dseiSelecionado).toBe("YANOMAMI");
    });

    it("abrir um DSEI muda o endereço; voltar ao Brasil e o voltar do navegador saem dele", async () => {
      await abrir();
      const comprimento = history.length;
      await act(async () => props().aoEscolherDsei?.(dsei("ALTO RIO NEGRO")));
      expect(url()).toBe("/saude-indigena/mapa/alto-rio-negro");
      expect(history.length).toBe(comprimento + 1);
      expect(props().dseiSelecionado).toBe("ALTO RIO NEGRO");

      await act(async () => props().aoSairDoDsei?.());
      expect(url()).toBe("/saude-indigena/mapa");
      expect(props().dseiSelecionado).toBeNull();

      // O voltar do navegador para o endereço com o DSEI reabre o DSEI.
      await act(async () => {
        history.replaceState(null, "", "/saude-indigena/mapa/xingu");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(props().dseiSelecionado).toBe("XINGU");
    });

    it("cada abertura relê o DSEI do endereço (o link do cartão da Visão geral)", async () => {
      const { mapa } = await abrir();
      history.replaceState(null, "", "/saude-indigena/mapa/xingu");
      await act(async () => mapa.render());
      expect(props().dseiSelecionado).toBe("XINGU");
      // Endereço de outra tela não mexe no DSEI.
      history.replaceState(null, "", "/saude-indigena/editais");
      await act(async () => mapa.render());
      expect(props().dseiSelecionado).toBe("XINGU");
    });

    it("a CASAI nacional leva à Visão geral com a busca por ela", async () => {
      const { estado, irPara } = await abrir();
      await act(async () => props().aoFiltrarPorBusca?.("CASAI Brasília"));
      expect(estado.obter().busca).toBe("CASAI Brasília");
      expect(irPara).toHaveBeenCalledWith("dashboard");
    });

    it("o cartão de processos do DSEI abre a Visão geral filtrada pelas unidades", async () => {
      const { estado, irPara } = await abrir();
      await act(async () => props().aoAbrirNaVisaoGeral?.(["DSEI Yanomami"]));
      expect(estado.obter().filtros.unidade).toEqual(["DSEI Yanomami"]);
      expect(irPara).toHaveBeenCalledWith("dashboard");
    });

    it("a CASAI nacional mora no endereço, sem abrir DSEI", async () => {
      await abrir();
      await act(async () =>
        props().aoEscolherCasai?.({
          chave: "CASAI DF|-15.8|-47.9",
          nome: "CASAI DF",
          cnes: "131",
          lat: -15.8,
          lon: -47.9,
          cidade: "BRASILIA",
          uf: "DF",
          editais: 0,
          vagas: 0,
          contratadas: 0,
          ociosas: 0,
          termoDeBusca: "CASAI BRASILIA",
        }),
      );
      expect(url()).toBe("/saude-indigena/mapa/casai-df");
      expect(props().casaiSelecionada).toBe("DF");
      expect(props().dseiSelecionado).toBeNull();
      await act(async () => props().aoSairDoDsei?.());
      expect(url()).toBe("/saude-indigena/mapa");
      expect(props().casaiSelecionada).toBeNull();
    });

    it("fora da Saúde Indígena não há mapa", async () => {
      const { caixa } = await abrir({ area: "sede" });
      expect(visto.props).toBeNull();
      expect(caixa.textContent).toContain("Saúde Indígena");
    });

    it("sem o Leaflet, o aviso com Tentar novamente", async () => {
      const leaflet = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error("sem rede"))
        .mockResolvedValue(undefined);
      const { caixa } = await abrir({ leaflet });
      expect(visto.props).toBeNull();
      const botao = [...caixa.querySelectorAll("button")].find((b) =>
        /tentar/i.test(b.textContent || ""),
      );
      expect(botao).toBeDefined();
      await act(async () => botao?.click());
      expect(leaflet).toHaveBeenCalledTimes(2);
      expect(visto.props).not.toBeNull();
    });
  });
});
