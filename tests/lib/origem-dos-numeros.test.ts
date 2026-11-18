import { describe, expect, it } from "vitest";
import { origemDoNumero } from "../../src/lib/visao-geral/origem-dos-numeros.ts";

/*
  Revisão de 17/11/2026: cada número da linha leva aos dados que o compõem.
  A linha é do edital (o destino nunca é um código de vaga); só o total, sem
  os registros, é "agregada" (a tela diz "Origem agregada; detalhe
  individual não disponível", nunca abre uma lista vazia).
*/

const COM_LISTA = {
  id: "uuid-1",
  edital: "80/2025",
  aprovados: 12,
  contratados: 9,
  cadastro_reserva: 3,
  inscritos: 300,
  TP_FONTE_FUNIL: "SELECAO",
};

describe("de onde vem cada número da linha", () => {
  it("Aprovados, Contratados e Aguardando chamada → Lista de aprovados no edital", () => {
    expect(
      origemDoNumero(COM_LISTA, "contratados", { comListas: true }),
    ).toEqual({
      tipo: "tela",
      view: "approved",
      rotulo: "Abrir na Lista de aprovados",
      pedido: { edital: "80/2025", editalId: "uuid-1", metrica: "contratados" },
    });
    const aguardando = origemDoNumero(COM_LISTA, "cadastro_reserva");
    expect(aguardando.tipo === "tela" && aguardando.pedido.metrica).toBe(
      "aguardandoChamada",
    );
    const aprovados = origemDoNumero(COM_LISTA, "aprovados");
    expect(aprovados.tipo === "tela" && aprovados.pedido.metrica).toBe(
      "aprovados",
    );
  });

  it("Inscritos → a tela da fonte do funil", () => {
    expect(origemDoNumero(COM_LISTA, "inscritos")).toMatchObject({
      tipo: "tela",
      view: "selecao",
      pedido: { edital: "80/2025" },
    });
    expect(
      origemDoNumero({ ...COM_LISTA, TP_FONTE_FUNIL: "ANALISES" }, "inscritos"),
    ).toMatchObject({ view: "analises" });
  });

  it("só o total, sem os registros: origem agregada", () => {
    // Contratados sem lista vigente (o acompanhamento já disse que não há).
    expect(
      origemDoNumero(
        { ...COM_LISTA, aprovados: null, cadastro_reserva: null },
        "contratados",
        { comListas: true },
      ),
    ).toEqual({ tipo: "agregada" });
    // Inscritos de outra fonte (ou sem fonte gravada).
    expect(
      origemDoNumero(
        { ...COM_LISTA, TP_FONTE_FUNIL: "AVALIACAO_DOCUMENTAL" },
        "inscritos",
      ),
    ).toEqual({ tipo: "agregada" });
    expect(
      origemDoNumero({ ...COM_LISTA, TP_FONTE_FUNIL: null }, "inscritos"),
    ).toEqual({ tipo: "agregada" });
  });

  it("sem número, zero ou antes do acompanhamento: nenhuma", () => {
    expect(
      origemDoNumero({ ...COM_LISTA, contratados: 0 }, "contratados"),
    ).toEqual({ tipo: "nenhuma" });
    expect(
      origemDoNumero({ ...COM_LISTA, aprovados: null }, "aprovados"),
    ).toEqual({ tipo: "nenhuma" });
    expect(
      origemDoNumero({ ...COM_LISTA, inscritos: "" }, "inscritos"),
    ).toEqual({ tipo: "nenhuma" });
    // Sem os resumos das listas, não se sabe se há lista: não promete nada.
    expect(
      origemDoNumero({ ...COM_LISTA, aprovados: null }, "contratados", {
        comListas: false,
      }),
    ).toEqual({ tipo: "nenhuma" });
    expect(origemDoNumero(null, "contratados")).toEqual({ tipo: "nenhuma" });
  });
});
