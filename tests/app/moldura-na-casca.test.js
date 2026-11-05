import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Raiz } from "../../src/app/raiz.tsx";
import { criarMoldura } from "../../src/app/moldura.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  A moldura (src/app/moldura.ts) é um store; a casca a leva para a página
  (MolduraNaPagina em src/app/casca/pecas.tsx): classes de body/html, o
  ícone da tela cheia e o cabeçalho do relatório em PDF. Desmontada, solta a
  página. No StrictMode, liga uma vez só no fim.
*/

const ESTADO_DA_NAVEGACAO = Object.freeze({
  view: "dashboard",
  area: "",
  visao: "",
  edital: "",
  secao: "",
  aviso: "",
  titulo: "",
  subtitulo: "",
  abertura: 0,
});
const NAVEGACAO = {
  obter: () => ESTADO_DA_NAVEGACAO,
  assinar: () => () => {},
  esquecerEditalEVisao: () => {},
};

function janelaFalsa() {
  const ouvintes = {};
  return {
    matchMedia: () => ({ matches: false }),
    addEventListener: (nome, funcao) =>
      (ouvintes[nome] ||= new Set()).add(funcao),
    removeEventListener: (nome, funcao) => ouvintes[nome]?.delete(funcao),
    dispatchEvent: vi.fn(),
    print: vi.fn(),
    contar: (nome) => ouvintes[nome]?.size ?? 0,
  };
}

/* As outras peças do sistema, paradas (só a moldura importa aqui). */
function pecasParadas() {
  const parado = (valor) => ({
    obter: () => valor,
    assinar: () => () => {},
  });
  return {
    presenca: {
      ...parado(
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
    avisoDeVersao: parado(
      Object.freeze({
        versaoNova: null,
        novidade: null,
        telaAntiga: false,
        fechado: false,
        pendencia: false,
      }),
    ),
    encerramento: {
      ...parado(
        Object.freeze({ aberto: null, encerramentos: [], fogosJaSoltos: [] }),
      ),
      fechar() {},
    },
    appAberto: parado(false),
    estaConectado: () => false,
  };
}

let raiz = null;
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

function montar(moldura) {
  document.body.className = "sidebar-collapsed";
  document.body.innerHTML =
    '<section id="appScreen" class="app hidden"></section><div id="raiz"></div>';
  raiz = createRoot(document.getElementById("raiz"));
  act(() =>
    raiz.render(
      createElement(
        StrictMode,
        null,
        createElement(Raiz, {
          navegacao: NAVEGACAO,
          sessao: null,
          marca: null,
          pedido: null,
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

    act(() => raiz.unmount());
    raiz = null;
    expect(janela.contar("resize")).toBe(0);
    moldura.alternarTema();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("o ícone da tela cheia e o cabeçalho do relatório leem o estado", () => {
    vi.useFakeTimers();
    try {
      const avisar = vi.fn();
      const moldura = criarMoldura({
        janela: janelaFalsa(),
        armazenamento: () => null,
        avisar,
        relatorio: () => ({
          filtros: {},
          busca: "",
          filtradas: [{ vagas_total: 10, contratados: 4, vagas_ociosas: 2 }],
        }),
        areaAtual: () => "sede",
      });
      montar(moldura);
      const icone = () => document.getElementById("fullscreenActionIcon");
      expect(icone().className).toBe("fa-solid fa-expand");
      act(() => moldura.alternarTelaCheia());
      expect(icone().className).toBe("fa-solid fa-compress");

      act(() => moldura.exportarPdf());
      const cabecalho = document.getElementById("printReportHeader");
      expect(cabecalho.className).toBe("print-only");
      expect(cabecalho.textContent).toContain("AgSUS Monitora — SEDE");
      expect(cabecalho.textContent).toContain(
        "Relatório de processos seletivos",
      );
      expect(cabecalho.textContent).toContain("10 vagas previstas");
      expect(document.querySelector(".content").firstChild).toBe(cabecalho);
      act(() => vi.advanceTimersByTime(1620));
      expect(document.getElementById("printReportHeader")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
