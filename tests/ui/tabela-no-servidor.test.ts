import { act, createElement as h, useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabelaInfinita, usarListaNoServidor } from "../../src/ui/index.ts";
import type { BuscarPagina, PaginaDoServidor } from "../../src/ui/index.ts";
import { definido } from "../definido.ts";
import { clicar } from "../componentes/interacoes.ts";

/*
  TabelaInfinita com o banco (usarListaNoServidor): 50 linhas por vez, "N de
  M" com o total do recorte que o banco manda, a próxima página ao rolar (ou
  "Carregar mais"), recomeço quando a chave (filtro) muda e resposta velha
  descartada.
*/
let raiz: Root | null = null;
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});
const $ = (seletor: string) => document.querySelector<HTMLElement>(seletor);
const linhas = () => document.querySelectorAll(".ui-tabela-rolagem tbody tr");
const esperar = () => act(async () => new Promise((r) => setTimeout(r, 0)));

/* Um "banco" de 120 linhas, filtrável, com cursor = último número. */
type Linha = { n: number };

function criarBanco(total = 120) {
  const todos = Array.from({ length: total }, (_, i) => ({ n: i + 1 }));
  const pedidos: { filtro: string; apos: unknown; limite: number }[] = [];
  const buscar =
    (filtro: string): BuscarPagina<Linha> =>
    async (apos, limite) => {
      pedidos.push({ filtro, apos, limite });
      const recorte = filtro ? todos.filter((x) => x.n % 2 === 0) : todos;
      const inicio =
        apos === null ? 0 : recorte.findIndex((x) => x.n > Number(apos));
      const pagina = recorte.slice(inicio, inicio + limite);
      return {
        linhas: pagina,
        proximo:
          inicio + limite < recorte.length
            ? definido(pagina[pagina.length - 1]).n
            : null,
        total: recorte.length,
      };
    };
  return { buscar, pedidos };
}

function Tela({
  banco,
  filtroInicial = "",
}: {
  banco: ReturnType<typeof criarBanco>;
  filtroInicial?: string;
}) {
  const [filtro, setFiltro] = useState(filtroInicial);
  const lista = usarListaNoServidor(banco.buscar(filtro), `f:${filtro}`);
  return h(
    "div",
    null,
    h("button", { id: "pares", onClick: () => setFiltro("pares") }, "pares"),
    h(TabelaInfinita<Linha>, {
      idDoTitulo: "t",
      titulo: "Eliminados",
      colunas: [{ rotulo: "N" }],
      carregado: lista.carregado,
      itens: lista.itens,
      filtrarPelaBusca: (itens) => itens,
      linha: (x) => h("tr", { key: x.n }, h("td", null, x.n)),
      informacao: (quantos) =>
        quantos === null ? "" : `${quantos} no recorte`,
      total: 120,
      vazio: "Nada.",
      servidor: lista,
    }),
  );
}

async function montar(elemento: ReactElement) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    const novaRaiz = createRoot(definido(document.getElementById("raiz")));
    raiz = novaRaiz;
    novaRaiz.render(elemento);
  });
  await esperar();
}

describe("TabelaInfinita com o banco em páginas", () => {
  it("desenha a primeira página de 50 e diz o total do recorte", async () => {
    const banco = criarBanco();
    await montar(h(Tela, { banco }));
    expect(linhas()).toHaveLength(50);
    expect($("[data-tabela-mostrando]")?.textContent).toBe(
      "Mostrando 50 de 120 registros",
    );
    expect($("[data-tabela-contagem]")?.textContent).toBe("120 no recorte");
    expect(banco.pedidos).toEqual([{ filtro: "", apos: null, limite: 50 }]);
  });

  it("pede a próxima página ao rolar até o fim e para quando acaba", async () => {
    const banco = criarBanco();
    await montar(h(Tela, { banco }));
    const rolagem = definido($(".ui-tabela-rolagem"));
    Object.defineProperty(rolagem, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(rolagem, "clientHeight", {
      value: 400,
      configurable: true,
    });
    rolagem.scrollTop = 600;
    await act(async () =>
      rolagem.dispatchEvent(new Event("scroll", { bubbles: true })),
    );
    await esperar();
    expect(linhas()).toHaveLength(100);
    expect(banco.pedidos[1]).toEqual({ filtro: "", apos: 50, limite: 50 });
    await clicar($('[data-acao="carregar-mais"]'));
    await esperar();
    expect(linhas()).toHaveLength(120);
    expect($('[data-acao="carregar-mais"]')).toBeNull();
    expect($(".ui-tabela-status")?.textContent).toBe(
      "Todos os 120 registros do recorte foram carregados",
    );
    expect(banco.pedidos).toHaveLength(3);
  });

  it("filtro novo recomeça da primeira página", async () => {
    const banco = criarBanco();
    await montar(h(Tela, { banco }));
    await clicar($('[data-acao="carregar-mais"]'));
    await esperar();
    await clicar($("#pares"));
    await esperar();
    expect(linhas()).toHaveLength(50);
    expect($("[data-tabela-mostrando]")?.textContent).toBe(
      "Mostrando 50 de 60 registros",
    );
    expect(banco.pedidos.at(-1)).toEqual({
      filtro: "pares",
      apos: null,
      limite: 50,
    });
  });

  it("descarta a resposta de um filtro que já mudou", async () => {
    let soltarPrimeira: (() => void) | undefined;
    const lenta = vi.fn(
      (_apos: unknown, _limite: number) =>
        new Promise<PaginaDoServidor<Linha>>((r) => {
          soltarPrimeira = () =>
            r({ linhas: [{ n: 999 }], proximo: null, total: 1 });
        }),
    );
    const rapida = criarBanco(3).buscar("");
    function Troca() {
      const [qual, setQual] = useState("lenta");
      const lista = usarListaNoServidor(
        qual === "lenta" ? lenta : rapida,
        qual,
      );
      return h(
        "div",
        null,
        h("button", { id: "trocar", onClick: () => setQual("rapida") }, "t"),
        h("span", { id: "itens" }, lista.itens.map((x) => x.n).join(",")),
      );
    }
    await montar(h(Troca));
    await clicar($("#trocar"));
    await esperar();
    await act(async () => definido(soltarPrimeira)());
    await esperar();
    expect($("#itens")?.textContent).toBe("1,2,3");
  });
});
