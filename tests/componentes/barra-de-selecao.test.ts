// @vitest-environment jsdom
import { act, createElement, useCallback, useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  alcanceDaSelecao,
  marcarPagina,
} from "../../src/lib/base/alcance-da-selecao.ts";
import { BarraDeSelecao } from "../../src/ui/barra-de-selecao.tsx";
import { TabelaInfinita } from "../../src/ui/tabela-infinita.tsx";
import { desenharNoTeste } from "../montar-tela.ts";
import { clicar } from "./interacoes.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  A barra da seleção com a TabelaInfinita de verdade: a "página" são as 50
  linhas desenhadas (aoMostrar), e "todos os N resultados" é outro botão.
*/
type Item = { id: string };
const ITENS: Item[] = Array.from({ length: 120 }, (_, i) => ({ id: `i${i}` }));
const semBusca = (itens: readonly Item[]) => itens;

function Tela() {
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [pagina, setPagina] = useState<readonly string[]>([]);
  const aoMostrar = useCallback(
    (visiveis: readonly Item[]) => setPagina(visiveis.map((i) => i.id)),
    [],
  );
  const recorte = useMemo(() => ITENS.map((i) => i.id), []);
  const alcance = alcanceDaSelecao(marcados, pagina, recorte);
  return createElement(
    "div",
    null,
    createElement(BarraDeSelecao, {
      alcance,
      nome: { singular: "item", plural: "itens" },
      rotulo: "Seleção de itens",
      aoMarcarPagina: (sim: boolean) =>
        setMarcados((m) => marcarPagina(m, pagina, sim)),
      aoMarcarTodos: () => setMarcados(new Set(recorte)),
      aoLimpar: () => setMarcados(new Set()),
      children: createElement(
        "button",
        { type: "button", "data-acao": "agir" },
        "Agir",
      ),
    }),
    createElement(TabelaInfinita<Item>, {
      idDoTitulo: "t",
      titulo: "Itens",
      colunas: [{ rotulo: "Id" }],
      informacao: () => "",
      vazio: "Nada",
      carregado: true,
      itens: ITENS,
      filtrarPelaBusca: semBusca,
      total: ITENS.length,
      aoMostrar,
      linha: (item: Item) =>
        createElement(
          "tr",
          { key: item.id },
          createElement("td", null, item.id),
        ),
    }),
  );
}

let desmontar = () => {};
afterEach(() => {
  act(() => desmontar());
  document.body.innerHTML = "";
});

const achar = (seletor: string) => document.querySelector(seletor);
const alcance = () => achar("[data-alcance-da-selecao]")?.textContent;

describe("BarraDeSelecao com a TabelaInfinita", () => {
  it("separa esta página (50 desenhadas) de todos os 120 resultados", async () => {
    const raiz = document.createElement("div");
    document.body.append(raiz);
    act(() => {
      desmontar = desenharNoTeste(raiz, createElement(Tela)).desmontar;
    });
    const pagina = achar('[data-acao="selecionar-pagina"]') as HTMLInputElement;
    expect(pagina.parentElement?.textContent).toBe(
      "Selecionar esta página (50)",
    );
    // Sem nada marcado, nenhuma ação.
    expect(achar('[data-acao="agir"]')).toBeNull();

    await clicar(pagina);
    expect(alcance()).toBe(
      "50 itens desta página selecionados (de 120 no resultado)",
    );
    const todos = achar(
      '[data-acao="selecionar-todos-os-resultados"]',
    ) as HTMLButtonElement;
    expect(todos.textContent).toBe("Selecionar todos os 120 resultados");
    expect(achar('[data-acao="agir"]')).not.toBeNull();

    await clicar(todos);
    expect(alcance()).toBe("Todos os 120 itens do resultado selecionados");
    expect(achar('[data-acao="selecionar-todos-os-resultados"]')).toBeNull();
    expect(achar("[data-alcance]")?.getAttribute("data-alcance")).toBe("todos");

    await clicar(achar('[data-acao="limpar-selecao"]') as HTMLButtonElement);
    expect(alcance()).toBe("");
    expect(pagina.checked).toBe(false);
  });
});
