// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MolduraDaPrevia } from "../src/modulos/configuracoes/moldura-da-previa.tsx";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root | null = null;
let caixa: HTMLElement | null = null;

afterEach(async () => {
  /*
    No jsdom, tirar o quadro apaga o documento dele, e o React não acha mais
    o que desenhou ali pelo portal: esvazia a prévia antes de desmontar.
  */
  await act(async () =>
    raiz?.render(
      <MolduraDaPrevia titulo="Prévia" escuro={false}>
        {null}
      </MolduraDaPrevia>,
    ),
  );
  await act(async () => raiz?.unmount());
  caixa?.remove();
  document.head.querySelector("link[data-teste]")?.remove();
  raiz = null;
  caixa = null;
});

describe("moldura da prévia (Configurações)", () => {
  it("o load do mesmo documento não troca as folhas copiadas (não cancela o download)", async () => {
    const folha = document.createElement("link");
    folha.rel = "stylesheet";
    folha.href = "/assets/main-teste.css";
    folha.dataset.teste = "";
    document.head.append(folha);
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () =>
      raiz!.render(
        <MolduraDaPrevia titulo="Prévia" escuro={false}>
          <p>barra lateral</p>
        </MolduraDaPrevia>,
      ),
    );
    const quadro = caixa.querySelector("iframe")!;
    const documento = quadro.contentDocument!;
    const copiada = documento.head.querySelector("link[data-teste]");
    expect(copiada).not.toBeNull();
    expect(documento.body.textContent).toContain("barra lateral");

    await act(async () => quadro.dispatchEvent(new Event("load")));

    // A mesma folha (o mesmo nó): nada foi recopiado.
    expect(documento.head.querySelector("link[data-teste]")).toBe(copiada);
    expect(documento.body.textContent).toContain("barra lateral");
  });
});
