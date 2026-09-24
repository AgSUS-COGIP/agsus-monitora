import { act } from "react";

/*
  Interações de teste com componentes React, sem biblioteca extra.

  Campo controlado pelo React não aceita `campo.value = "x"` seguido de um
  evento: o React guarda o último valor que viu no próprio elemento, e a
  atribuição direta o atualiza junto — no evento, nada parece ter mudado e o
  `onChange` não corre. Escrever pelo setter do protótipo contorna isso, como
  faria o navegador ao receber uma tecla.
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setterDoValor(campo) {
  const prototipo =
    campo instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : campo instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(prototipo, "value").set;
}

/** Digita `valor` num `<input>`/`<textarea>` (troca o texto inteiro). */
export async function digitar(campo, valor) {
  if (!campo) throw new Error("digitar: campo não encontrado");
  await act(async () => {
    setterDoValor(campo).call(campo, String(valor));
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Escolhe `valor` num `<select>`. */
export async function escolher(campo, valor) {
  if (!campo) throw new Error("escolher: campo não encontrado");
  await act(async () => {
    setterDoValor(campo).call(campo, String(valor));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Clica (botão, caixa, rádio), esperando o que o clique dispara. */
export async function clicar(elemento) {
  if (!elemento) throw new Error("clicar: elemento não encontrado");
  await act(async () => {
    elemento.click();
  });
}

export async function teclar(alvo, key, opcoes = {}) {
  await act(async () => {
    alvo.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...opcoes }),
    );
  });
}

/** Deixa correr as promessas pendentes (RPCs falsas) dentro de `act`. */
export async function esperar(funcao) {
  let resultado;
  await act(async () => {
    resultado = await funcao?.();
  });
  return resultado;
}
