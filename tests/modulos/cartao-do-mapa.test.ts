// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  esquecerFiltrosDasTelas,
  filtrosGuardadosDaTela,
} from "../../src/app/filtros-no-endereco.ts";
import type { LinhaDoMonitoramento } from "../../src/componentes/tipos-do-monitoramento.ts";
import { caminhoDoDestino } from "../../src/lib/navegacao/rotas.ts";
import { CartaoDoMapa } from "../../src/modulos/visao-geral/cartao-do-mapa.tsx";

/*
  O cartão do mapa na Visão geral da Saúde Indígena
  (src/modulos/visao-geral/cartao-do-mapa.tsx): três números do mapa e o
  caminho até a aba Mapa, no Brasil ou já num DSEI. Dados fictícios.
*/

const edital = (
  unidade: string,
  vagas_total: number,
  contratados: number,
): LinhaDoMonitoramento => ({
  unidade,
  vagas_total,
  contratados,
  status: "Concluído",
});
const LINHAS = [
  edital("DSEI Yanomami", 30, 15),
  edital("DSEI Vale do Javari", 10, 2),
  edital("DSEI Ceará", 10, 10),
];

let raiz: Root | null = null;
async function montar(carregado = true) {
  const irPara = vi.fn();
  const caixa = document.createElement("div");
  document.body.append(caixa);
  const nova = createRoot(caixa);
  raiz = nova;
  await act(async () =>
    nova.render(h(CartaoDoMapa, { linhas: LINHAS, carregado, irPara })),
  );
  return { caixa, irPara };
}
const botao = (caixa: HTMLElement, texto: string) => {
  const achado = [...caixa.querySelectorAll("button")].find(
    (b) => b.textContent === texto,
  );
  if (!achado) throw new Error(`sem o botão ${texto}`);
  return achado;
};

beforeEach(() => esquecerFiltrosDasTelas());
afterEach(async () => {
  const montada = raiz;
  if (montada) await act(async () => montada.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

describe("o cartão do mapa", () => {
  it("mostra os DSEIs com edital, o de mais ociosas e o menos preenchido", async () => {
    const { caixa } = await montar();
    const texto = caixa.textContent || "";
    expect(texto).toContain("3 de 34");
    expect(texto).toContain("Mais ociosas");
    expect(texto).toContain("Yanomami · 15");
    expect(texto).toContain("Vale do Javari · 20%");
  });

  it("o nome do DSEI abre o Mapa nele; Abrir no mapa, no Brasil", async () => {
    const { caixa, irPara } = await montar();
    await act(async () => botao(caixa, "Yanomami").click());
    expect(irPara).toHaveBeenLastCalledWith("mapa");
    expect(
      caminhoDoDestino({
        view: "mapa",
        area: "saude-indigena",
        filtros: filtrosGuardadosDaTela("mapa"),
      }),
    ).toBe("/saude-indigena/mapa/yanomami");

    await act(async () => botao(caixa, "Abrir no mapa").click());
    expect(filtrosGuardadosDaTela("mapa")).toBe("");
    expect(irPara).toHaveBeenCalledTimes(2);
  });

  it("antes da carga, sem números", async () => {
    const { caixa } = await montar(false);
    expect(caixa.textContent).not.toContain("de 34");
    expect(caixa.textContent).not.toContain("Mais ociosas");
  });
});
