import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  CampoNumero,
  type NumeroDigitado,
} from "../../src/modulos/avaliacao-documental/campos.tsx";
import { digitar } from "../componentes/interacoes.ts";

/*
  O campo de número da regra da avaliação documental. Antes, a cada tecla o
  texto virava número e voltava à tela: "0," virava "0" e a vírgula sumia, de
  modo que digitar "0,25" gravava 25.
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root | undefined;
let caixa: HTMLDivElement | undefined;
afterEach(async () => {
  await act(async () => raiz?.unmount());
  caixa?.remove();
});

async function montar(inicial: NumeroDigitado = null) {
  const gravados: NumeroDigitado[] = [];
  function Teste() {
    const [valor, setValor] = useState<NumeroDigitado>(inicial);
    return createElement(CampoNumero, {
      rotulo: "Pontos por mês",
      valor,
      aoMudar: (v: NumeroDigitado) => {
        gravados.push(v);
        setValor(v);
      },
    });
  }
  caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  await act(async () => raiz!.render(createElement(Teste)));
  const campo = caixa.querySelector("input");
  if (!campo) throw new Error("campo não encontrado");
  return { campo, gravados };
}

/** Digita tecla a tecla, como o navegador: cada tecla vai ao fim do que está na tela. */
async function teclaATecla(campo: HTMLInputElement, texto: string) {
  for (const tecla of texto) await digitar(campo, campo.value + tecla);
}

describe("CampoNumero da avaliação documental", () => {
  it("aceita decimal com vírgula digitado tecla a tecla", async () => {
    const { campo, gravados } = await montar();
    await teclaATecla(campo, "0,25");
    expect(campo.value).toBe("0,25");
    expect(gravados.at(-1)).toBe(0.25);
  });

  it("mantém a vírgula no meio da digitação de 1,5", async () => {
    const { campo, gravados } = await montar();
    await teclaATecla(campo, "1,");
    expect(campo.value).toBe("1,");
    await digitar(campo, "1,5");
    expect(gravados.at(-1)).toBe(1.5);
  });

  it("ao sair do campo mostra o número no formato da tela", async () => {
    const { campo } = await montar();
    await digitar(campo, "2,50");
    await act(async () => {
      campo.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(campo.value).toBe("2,5");
  });

  it("mostra o valor que já vem gravado e devolve null quando apagado", async () => {
    const { campo, gravados } = await montar(0.75);
    expect(campo.value).toBe("0,75");
    await digitar(campo, "");
    expect(gravados.at(-1)).toBeNull();
  });

  it("texto que não é número volta como texto (a validação recusa)", async () => {
    const { campo, gravados } = await montar();
    await digitar(campo, "abc");
    expect(gravados.at(-1)).toBe("abc");
  });
});
