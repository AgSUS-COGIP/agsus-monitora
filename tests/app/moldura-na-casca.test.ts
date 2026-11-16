import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Raiz } from "../../src/app/raiz.tsx";
import type { PropsDaRaiz } from "../../src/app/raiz.tsx";
import { criarMoldura } from "../../src/app/moldura.ts";
import type { Moldura } from "../../src/app/moldura.ts";
import type { PecasDoApp } from "../../src/app/contexto-do-app.ts";
import type { EstadoDoAviso } from "../../src/app/aviso-de-versao.ts";
import type { EstadoDaPresenca } from "../../src/componentes/pessoas-online/pessoas-online.tsx";
import type { EstadoDoEncerramento } from "../../src/modulos/encerramento-do-edital/estado.ts";
import { ESTADO_INICIAL_DA_NAVEGACAO } from "../../src/app/navegacao.ts";
import type { LeituraDaNavegacao } from "../../src/app/navegacao.ts";
import { achar } from "../dom.ts";
import { definido } from "../definido.ts";
import { janelaCom } from "./janela-falsa.ts";
import type { OuvinteDaJanela, OuvintesDaJanela } from "./janela-falsa.ts";

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
