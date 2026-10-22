import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiSelectBusca } from "../../src/componentes/multi-select-busca.jsx";
import { Modal } from "../../src/ui/modal.jsx";
import { clicar, teclar } from "./interacoes.js";

/*
  Esc com o menu de escolha múltipla aberto dentro de um modal (ex.: "Áreas
  que a pessoa vê" em "Adicionar pessoa"): fechava o modal inteiro e perdia o
  que já estava digitado. Deve fechar só o menu; o próximo Esc fecha o modal.
*/
let raiz = null;

function Tela({ aoFechar }) {
  const [selecionados, setSelecionados] = useState([]);
  return createElement(
    Modal,
    { rotulo: "Adicionar pessoa", aoFechar, fecharAoClicarFora: false },
    createElement(MultiSelectBusca, {
      id: "areas",
      opcoes: ["Sede", "Projetos"],
      selecionados,
      aoMudar: setSelecionados,
    }),
  );
}

afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

describe("Esc no menu dentro do modal", () => {
  it("fecha só o menu; o Esc seguinte fecha o modal", async () => {
    document.body.innerHTML = `<div id="raiz"></div>`;
    const aoFechar = vi.fn();
    await act(async () => {
      raiz = createRoot(document.getElementById("raiz"));
      raiz.render(createElement(Tela, { aoFechar }));
    });
    const gatilho = document.querySelector(".multi-select-trigger");
    const menu = document.querySelector(".multi-select-menu");

    await clicar(gatilho);
    expect(menu.hidden).toBe(false);

    await teclar(document.activeElement, "Escape");
    expect(menu.hidden).toBe(true);
    expect(aoFechar).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(gatilho);

    await teclar(document.activeElement, "Escape");
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
