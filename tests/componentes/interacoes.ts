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

/** O que se pode procurar no DOM: o elemento ou nada (`querySelector`). */
type Talvez<T> = T | null | undefined;

/*
  Os testes acham o campo por `querySelector` (Element). Fora de `<select>` e
  `<textarea>`, vale o setter do `<input>`: num elemento sem `value` ele
  reclama do `this` e o teste quebra apontando o campo.
*/
function setterDoValor(campo: Element): (valor: string) => void {
  const prototipo =
    campo instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : campo instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototipo, "value")?.set;
  if (!setter) throw new Error("setterDoValor: protótipo sem setter de value");
  return setter;
}

/** Digita `valor` num `<input>`/`<textarea>` (troca o texto inteiro). */
export async function digitar(
  campo: Talvez<Element>,
  valor: unknown,
): Promise<void> {
  if (!campo) throw new Error("digitar: campo não encontrado");
  await act(async () => {
    setterDoValor(campo).call(campo, String(valor));
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Escolhe `valor` num `<select>`. */
export async function escolher(
  campo: Talvez<Element>,
  valor: unknown,
): Promise<void> {
  if (!campo) throw new Error("escolher: campo não encontrado");
  await act(async () => {
    setterDoValor(campo).call(campo, String(valor));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Clica (botão, caixa, rádio), esperando o que o clique dispara. */
export async function clicar(elemento: Talvez<Element>): Promise<void> {
  if (!elemento) throw new Error("clicar: elemento não encontrado");
  await act(async () => {
    if (!(elemento instanceof HTMLElement))
      throw new TypeError("clicar: elemento sem click()");
    elemento.click();
  });
}

export async function teclar(
  alvo: EventTarget,
  key: string,
  opcoes: KeyboardEventInit = {},
): Promise<void> {
  await act(async () => {
    alvo.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...opcoes }),
    );
  });
}

/** Deixa correr as promessas pendentes (RPCs falsas) dentro de `act`. */
export async function esperar<T = undefined>(
  funcao?: () => T | Promise<T>,
): Promise<T | undefined> {
  let resultado: T | undefined;
  await act(async () => {
    resultado = await funcao?.();
  });
  return resultado;
}
