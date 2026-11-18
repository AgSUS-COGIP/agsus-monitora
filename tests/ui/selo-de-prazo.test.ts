// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SeloDePrazo } from "../../src/ui/index.ts";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root | null = null;
afterEach(() => {
  act(() => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

function selo(data: string | null) {
  const caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  act(() =>
    raiz!.render(
      h(SeloDePrazo, { data, hoje: "2026-11-18", diaFormatado: "dia" }),
    ),
  );
  return caixa.querySelector(".ui-selo-de-prazo");
}

describe("SeloDePrazo", () => {
  it.each([
    ["2026-11-15", "Venceu há 3 dias", "perigo", "vencido"],
    ["2026-11-18", "Vence hoje", "alerta", "ate-30"],
    ["2026-12-30", "Vence em 42 dias", "info", "ate-90"],
    ["2027-03-01", "Vence em 103 dias", "neutro", "ate-180"],
    ["2028-01-01", "Vence em 409 dias", "neutro", "depois"],
  ])("%s: %s", (data, texto, tom, faixa) => {
    const el = selo(data)!;
    expect(el.textContent).toBe(texto);
    expect(el.getAttribute("data-tom")).toBe(tom);
    expect(el.getAttribute("data-faixa")).toBe(faixa);
    expect(el.getAttribute("title")).toMatch(/dia$/);
  });

  it("sem data, nada", () => {
    expect(selo(null)).toBeNull();
  });
});
