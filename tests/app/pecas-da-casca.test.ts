import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsDaRaiz } from "../../src/app/raiz.tsx";
import type { PecasDoApp } from "../../src/app/contexto-do-app.ts";
import type { EstadoDoAviso } from "../../src/app/aviso-de-versao.ts";
import type { EstadoDaPresenca } from "../../src/componentes/pessoas-online/pessoas-online.tsx";
import type { EstadoDoEncerramento } from "../../src/modulos/encerramento-do-edital/estado.ts";
import { ESTADO_INICIAL_DA_NAVEGACAO } from "../../src/app/navegacao.ts";
import type { LeituraDaNavegacao } from "../../src/app/navegacao.ts";
import { achar } from "../dom.ts";
import { definido } from "../definido.ts";
import { teclar } from "../componentes/interacoes.ts";

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

async function montar(pecas: PecasDoApp | null) {
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
        navegacao: NAVEGACAO,
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

  it("sem as peças (a casca num teste), nada disso aparece", async () => {
    await montar(null);
    expect(document.getElementById("onlinePresence")).toBeNull();
    expect(document.getElementById("pessoasOnlineApp")).not.toBeNull();
  });
});
