import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { teclar } from "../componentes/interacoes.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  As partes da casca que eram ilhas (Pessoas online, aviso de versão,
  encerramento e selos do edital, Aya e busca global) são filhas da raiz do
  app (src/app/raiz.tsx, src/app/casca/pecas.tsx): o estado vem pelas `pecas`
  do contexto, e não há `createRoot` próprio para elas.
*/

const aya = vi.hoisted(() => ({ baixada: 0 }));
vi.mock("../../src/modulos/aya/aya.tsx", () => {
  aya.baixada += 1;
  return { Aya: () => createElement("div", { id: "ayaDeTeste" }, "Aya") };
});

const { Raiz } = await import("../../src/app/raiz.tsx");

function assinavel(inicial) {
  let valor = Object.freeze(inicial);
  const ouvintes = new Set();
  return {
    obter: () => valor,
    assinar: vi.fn((ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    }),
    mudar(novo) {
      valor = novo;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
}

function criarPecas({ aberto = false, conectado = true } = {}) {
  const presenca = {
    ...assinavel({
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
    ...assinavel({
      versaoNova: "v2",
      novidade: null,
      telaAntiga: false,
      fechado: false,
      pendencia: false,
    }),
    fechar: vi.fn(),
    atualizar: vi.fn(),
  };
  const encerramento = {
    ...assinavel({ aberto: null, encerramentos: [], fogosJaSoltos: [] }),
    fechar: vi.fn(),
  };
  return {
    presenca,
    avisoDeVersao,
    encerramento,
    appAberto: assinavel(aberto),
    estaConectado: () => conectado,
  };
}

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

let raiz = null;
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

async function montar(pecas) {
  document.body.innerHTML =
    '<section id="appScreen" class="app hidden"></section><div id="raiz"></div>';
  raiz = createRoot(document.getElementById("raiz"));
  await act(async () =>
    raiz.render(
      createElement(Raiz, {
        navegacao: NAVEGACAO,
        sessao: null,
        marca: null,
        pedido: null,
        pecas,
        lugares: {
          avisos: null,
          entrada: null,
          casca: document.getElementById("appScreen"),
        },
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
    await act(async () => raiz.unmount());

    await montar(criarPecas({ conectado: true }));
    await teclar(document, "k", { ctrlKey: true });
    expect(
      document.querySelector('[role="dialog"].search-modal'),
    ).not.toBeNull();
  });

  it("sem as peças (a casca num teste), nada disso aparece", async () => {
    await montar(null);
    expect(document.getElementById("onlinePresence")).toBeNull();
    expect(document.getElementById("pessoasOnlineApp")).not.toBeNull();
  });
});
