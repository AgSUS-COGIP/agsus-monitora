import { act, createElement as h } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabelaInfinita } from "../../src/ui/index.ts";
import type { PropriedadesDaTabelaInfinita } from "../../src/ui/index.ts";
import { definido } from "../definido.ts";
import { clicar } from "../componentes/interacoes.ts";

/*
  TabelaInfinita com a leitura falha (norma 12.3): o erro toma o lugar do
  esqueleto, com "Tentar novamente"; sem erro e sem carga, o esqueleto continua.
*/
interface Linha {
  nome: string;
}

let raiz: Root | null = null;
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});
const $ = (seletor: string) => document.querySelector<HTMLElement>(seletor);

const props = (
  extra: Partial<PropriedadesDaTabelaInfinita<Linha>> = {},
): PropriedadesDaTabelaInfinita<Linha> => ({
  idDoTitulo: "tabelaTitulo",
  titulo: "Fila",
  carregado: false,
  itens: [],
  filtrarPelaBusca: (itens) => itens,
  colunas: [{ rotulo: "Nome" }],
  linha: (item) => h("tr", { key: item.nome }, h("td", null, item.nome)),
  informacao: (quantos) => (quantos === null ? "Carregando…" : `${quantos}`),
  total: 0,
  vazio: "Nada carregado.",
  ...extra,
});

async function montar(elemento: ReactElement) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    const novaRaiz = createRoot(definido(document.getElementById("raiz")));
    raiz = novaRaiz;
    novaRaiz.render(elemento);
  });
}

describe("TabelaInfinita com erro de leitura", () => {
  it("com erro, mostra a mensagem no lugar do esqueleto e o botão tenta de novo", async () => {
    const tentarDeNovo = vi.fn();
    await montar(
      h(
        TabelaInfinita<Linha>,
        props({
          erro: {
            mensagem: "Falha simulada",
            oQue: "os editais",
            tentarDeNovo,
          },
        }),
      ),
    );
    const aviso = definido($('[role="alert"]'));
    expect(aviso.textContent).toContain("Não foi possível carregar os editais");
    expect(aviso.textContent).toContain("Falha simulada");
    expect(document.querySelector(".ui-esqueleto")).toBeNull();
    expect($("[data-tabela-contagem]")?.textContent).toBe("");
    expect($("[data-tabela-mostrando]")?.textContent).toBe("");

    await clicar($('[data-acao="tentar-novamente"]'));
    expect(tentarDeNovo).toHaveBeenCalledTimes(1);
  });

  it("sem tentarDeNovo, a mensagem aparece sem botão", async () => {
    await montar(
      h(TabelaInfinita<Linha>, props({ erro: { mensagem: "Falha" } })),
    );
    expect($('[role="alert"]')?.textContent).toContain("esta lista");
    expect($('[data-acao="tentar-novamente"]')).toBeNull();
  });

  it("sem erro e sem carga, continua o esqueleto", async () => {
    await montar(h(TabelaInfinita<Linha>, props({ erro: null })));
    expect($('[role="alert"]')).toBeNull();
    expect(document.querySelector(".ui-esqueleto")).not.toBeNull();
    expect($("[data-tabela-mostrando]")?.textContent).toBe(
      "Mostrando 0 de 0 registros",
    );
    expect($("[data-tabela-contagem]")?.textContent).toBe("Carregando…");
  });
});
