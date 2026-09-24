import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiSelectBusca } from "../../src/componentes/multi-select-busca.jsx";
import { clicar, digitar, teclar } from "./interacoes.js";

/*
  O select com busca e escolha múltipla, em React. Controlado: o teste faz de
  tela, guardando a seleção e passando-a de volta, como fazem as abas da Lista
  de Aprovados.
*/

let raiz = null;

function Tela({ opcoes, inicial = [], aoMudar = () => {}, id = "f" }) {
  const [selecionados, setSelecionados] = useState(inicial);
  return createElement(MultiSelectBusca, {
    id,
    opcoes,
    selecionados,
    placeholder: "Todos os editais",
    aoMudar: (valores) => {
      setSelecionados(valores);
      aoMudar(valores);
    },
  });
}

async function montar(elemento) {
  document.body.innerHTML = `<div class="form-row"><label for="f">Edital</label><div id="raiz"></div></div>`;
  await act(async () => {
    raiz = createRoot(document.getElementById("raiz"));
    raiz.render(elemento);
  });
}

afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

const rotulo = () => document.querySelector(".multi-select-label").textContent;
const opcoesVisiveis = () =>
  [...document.querySelectorAll(".multi-select-option span")].map(
    (item) => item.textContent,
  );
const caixaDe = (texto) =>
  [...document.querySelectorAll(".multi-select-option")]
    .find((item) => item.querySelector("span").textContent === texto)
    .querySelector("input");
const marcar = (texto) => clicar(caixaDe(texto));
const menu = () => document.querySelector(".multi-select-menu");
const gatilho = () => document.querySelector(".multi-select-trigger");

describe("MultiSelectBusca", () => {
  it("mostra o placeholder quando não há escolha, e lista as opções", async () => {
    await montar(
      createElement(Tela, { opcoes: [{ value: "10", label: "03/2025" }] }),
    );
    expect(rotulo()).toBe("Todos os editais");
    expect(opcoesVisiveis()).toEqual(["03/2025"]);
  });

  it("devolve os valores marcados, em ordem de rótulo", async () => {
    const aoMudar = vi.fn();
    await montar(
      createElement(Tela, {
        opcoes: [
          { value: "20", label: "04/2025" },
          { value: "10", label: "03/2025" },
        ],
        aoMudar,
      }),
    );
    await marcar("04/2025");
    await marcar("03/2025");
    expect(aoMudar).toHaveBeenLastCalledWith(["10", "20"]);
    expect(caixaDe("03/2025").checked).toBe(true);
  });

  it("busca ignorando acento e caixa", async () => {
    await montar(createElement(Tela, { opcoes: ["Migração", "Contratado"] }));
    await digitar(document.querySelector(".multi-select-search"), "MIGRACAO");
    expect(opcoesVisiveis()).toEqual(["Migração"]);
  });

  it("'Selecionar visíveis' pega só o que a busca deixou na lista", async () => {
    const aoMudar = vi.fn();
    await montar(
      createElement(Tela, {
        opcoes: [
          { value: "a", label: "Enfermeiro" },
          { value: "b", label: "Enfermeiro Indígena" },
          { value: "c", label: "Médico" },
        ],
        aoMudar,
      }),
    );
    await digitar(document.querySelector(".multi-select-search"), "enfermeiro");
    await clicar(document.querySelector('[data-acao="visiveis"]'));
    expect(aoMudar).toHaveBeenLastCalledWith(["a", "b"]);
  });

  it("avisa a tela a cada mudança, e 'Limpar' devolve a lista vazia", async () => {
    const aoMudar = vi.fn();
    await montar(createElement(Tela, { opcoes: ["03/2025"], aoMudar }));
    await marcar("03/2025");
    expect(aoMudar).toHaveBeenLastCalledWith(["03/2025"]);
    await clicar(document.querySelector('[data-acao="limpar"]'));
    expect(aoMudar).toHaveBeenLastCalledWith([]);
    expect(rotulo()).toBe("Todos os editais");
  });

  /*
    O caso que mais dói na Lista de Aprovados: escolher um edital encolhe a
    lista de cargos. Um cargo que deixou de existir não aparece marcado nem
    conta no gatilho — estaria a filtrar sem estar na tela.
  */
  it("não mostra como escolhido o que deixou de ser opção", async () => {
    await montar(
      createElement(MultiSelectBusca, {
        id: "f",
        opcoes: ["Enfermeiro"],
        selecionados: ["Enfermeiro", "Médico"],
      }),
    );
    expect(rotulo()).toBe("Enfermeiro");
    expect(document.querySelector(".multi-select-count").textContent).toBe("1");
  });

  it("resume a contagem quando há muitas escolhas", async () => {
    await montar(createElement(Tela, { opcoes: ["A", "B", "C"] }));
    await marcar("A");
    await marcar("B");
    expect(rotulo()).toBe("A, B");
    await marcar("C");
    expect(rotulo()).toBe("3 selecionados");
    expect(document.querySelector(".multi-select-count").textContent).toBe("3");
  });

  it("escreve o rótulo como texto, sem interpretar HTML", async () => {
    await montar(
      createElement(Tela, {
        opcoes: [{ value: "x", label: "<img src=x onerror=1>" }],
      }),
    );
    expect(document.querySelector(".multi-select-options img")).toBeNull();
    expect(opcoesVisiveis()).toEqual(["<img src=x onerror=1>"]);
  });

  it("o id vai no gatilho, para o rótulo da linha apontar para ele", async () => {
    await montar(createElement(Tela, { opcoes: ["A"] }));
    expect(document.querySelector('label[for="f"]')).not.toBeNull();
    expect(document.getElementById("f")).toBe(gatilho());
  });

  describe("abrir e fechar", () => {
    it("abre com clique e fecha com Esc, devolvendo o foco ao gatilho", async () => {
      await montar(createElement(Tela, { opcoes: ["A"] }));
      await clicar(gatilho());
      expect(menu().hidden).toBe(false);
      expect(gatilho().getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(
        document.querySelector(".multi-select-search"),
      );

      await teclar(document, "Escape");
      expect(menu().hidden).toBe(true);
      expect(document.activeElement).toBe(gatilho());
    });

    it("fecha com clique fora, e não com clique numa opção", async () => {
      await montar(createElement(Tela, { opcoes: ["A", "B"] }));
      await clicar(gatilho());
      await marcar("A");
      expect(menu().hidden).toBe(false);

      await clicar(document.body);
      expect(menu().hidden).toBe(true);
    });

    it("abrir um fecha o outro", async () => {
      document.body.innerHTML = `<div id="raiz"></div>`;
      await act(async () => {
        raiz = createRoot(document.getElementById("raiz"));
        raiz.render(
          createElement(
            "div",
            null,
            createElement(Tela, { id: "um", opcoes: ["A"] }),
            createElement(Tela, { id: "dois", opcoes: ["B"] }),
          ),
        );
      });
      const [primeiro, segundo] = document.querySelectorAll(".multi-select");
      await clicar(primeiro.querySelector(".multi-select-trigger"));
      await clicar(segundo.querySelector(".multi-select-trigger"));
      expect(primeiro.querySelector(".multi-select-menu").hidden).toBe(true);
      expect(segundo.querySelector(".multi-select-menu").hidden).toBe(false);
    });

    it("seta para baixo no gatilho abre e vai direto à primeira opção", async () => {
      await montar(createElement(Tela, { opcoes: ["A", "B"] }));
      await teclar(gatilho(), "ArrowDown");
      expect(menu().hidden).toBe(false);
      expect(document.activeElement).toBe(caixaDe("A"));

      await teclar(document.activeElement, "ArrowDown");
      expect(document.activeElement).toBe(caixaDe("B"));
      await teclar(document.activeElement, "ArrowUp");
      await teclar(document.activeElement, "ArrowUp");
      expect(document.activeElement).toBe(
        document.querySelector(".multi-select-search"),
      );
    });
  });
});
