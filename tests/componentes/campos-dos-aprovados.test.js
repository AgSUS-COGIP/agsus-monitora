import { createElement, useState, act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CampoEditavel } from "../../src/modulos/aprovados/partes.tsx";
import { lerInteiro } from "../../src/lib/configuracao-de-convocacao.ts";
import { lerTermos } from "../../src/lib/modelo-de-convocacao.ts";
import { digitar } from "./interacoes.js";
let raiz;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "<div id='campo'></div>";
  raiz = createRoot(document.getElementById("campo"));
});
afterEach(async () => {
  await act(async () => raiz.unmount());
  document.body.innerHTML = "";
});
describe("texto e valor dos campos de Aprovados", () => {
  it("apagar zero não repõe o zero e uma mudança externa atualiza o campo", async () => {
    let mudarPorFora;
    const mudou = vi.fn();
    function Tela() {
      const [valor, setValor] = useState(0);
      mudarPorFora = setValor;
      return createElement(CampoEditavel, {
        valor,
        ler: lerInteiro,
        aoMudar: (v) => {
          mudou(v);
          setValor(v);
        },
      });
    }
    await act(async () => raiz.render(createElement(Tela)));
    const campo = document.querySelector("input");
    await digitar(campo, "");
    expect(campo.value).toBe("");
    expect(mudou).toHaveBeenLastCalledWith(0);
    await digitar(campo, "12");
    expect(campo.value).toBe("12");
    expect(mudou).toHaveBeenLastCalledWith(12);
    await act(async () => mudarPorFora(33));
    expect(campo.value).toBe("33");
  });
  it("preserva o separador enquanto se escreve e recebe uma lista externa", async () => {
    let mudarPorFora;
    const mudou = vi.fn();
    function Tela() {
      const [valor, setValor] = useState([]);
      mudarPorFora = setValor;
      return createElement(CampoEditavel, {
        valor,
        ler: lerTermos,
        escrever: (v) => v.join("; "),
        aoMudar: (v) => {
          mudou(v);
          setValor(v);
        },
      });
    }
    await act(async () => raiz.render(createElement(Tela)));
    const campo = document.querySelector("input");
    await digitar(campo, "ampla; ");
    expect(campo.value).toBe("ampla; ");
    expect(mudou).toHaveBeenLastCalledWith(["ampla"]);
    await digitar(campo, "ampla; indigena");
    expect(mudou).toHaveBeenLastCalledWith(["ampla", "indigena"]);
    await act(async () => mudarPorFora(["pcd", "ampla"]));
    expect(campo.value).toBe("pcd; ampla");
  });
  it("sem conversor continua entregando texto", async () => {
    const mudou = vi.fn();
    await act(async () =>
      raiz.render(
        createElement(CampoEditavel, { valor: "Ana", aoMudar: mudou }),
      ),
    );
    await digitar(document.querySelector("input"), "Ana Maria");
    expect(mudou).toHaveBeenLastCalledWith("Ana Maria");
  });
});
