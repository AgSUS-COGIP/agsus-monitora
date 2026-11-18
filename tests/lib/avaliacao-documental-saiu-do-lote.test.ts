import { describe, expect, it } from "vitest";
import {
  andamentoDaFila,
  colunasDaEtapa,
  contadoresDaFila,
  filtrarFila,
  naEtapa,
  parteDoLote,
  type InscritoNaFila,
} from "../../src/lib/avaliacao-documental/fila.ts";
import { resumoPorVaga } from "../../src/lib/avaliacao-documental/andamento-por-vaga.ts";

/*
  O lote que não fechava (93/2026, revisão de 17/11/2026): 94 concluídas e 2
  fichas FORA_LOTE com a pré-classificação ainda NO_LOTE (a importação da
  planilha as tirou). O bloco por vaga as contava como pendentes e a faixa do
  alto não as contava em lugar nenhum. Agora as duas contas têm "Saiu do
  lote" e somam o lote. Dados fictícios.
*/
const inscrito = (
  n: number,
  vaga: string,
  situacao: string | null,
  pre = "NO_LOTE",
): InscritoNaFila => ({
  id: `c${n}`,
  codigo: String(9000 + n),
  vaga,
  situacao_pre: pre,
  ficha: situacao ? { id: `f${n}`, situacao } : null,
});

const VAGA = "100001";
const LOTE_96: InscritoNaFila[] = [
  ...Array.from({ length: 94 }, (_, i) =>
    inscrito(i, VAGA, "CONCLUIDA", "ANALISADO"),
  ),
  inscrito(94, VAGA, "FORA_LOTE"),
  inscrito(95, VAGA, "FORA_LOTE"),
];

describe("Saiu do lote: a faixa e o bloco por vaga somam o lote", () => {
  it("o lote de 96 fecha: 94 concluídas + 2 saíram, nenhuma pendente", () => {
    const faixa = contadoresDaFila(LOTE_96);
    const { total, vagas } = andamentoDaFila(LOTE_96, [{ codigo: VAGA }]);
    expect(faixa).toMatchObject({
      lote: 96,
      concluidas: 94,
      saiu: 2,
      pendentes: 0,
    });
    expect(total).toEqual({
      lote: 96,
      concluidas: 94,
      em_analise: 0,
      revisao: 0,
      pendentes: 0,
      saiu: 2,
    });
    expect(vagas[0]).toMatchObject({ codigo: VAGA, pendentes: 0, saiu: 2 });
    expect(resumoPorVaga(vagas)).toBe(
      "1 vaga · nenhuma com pendências · 1 concluída",
    );
  });

  it("faixa e bloco dão os mesmos números em qualquer mistura", () => {
    const mistura = [
      ...LOTE_96.slice(90),
      inscrito(200, "100002", "PENDENTE"),
      inscrito(201, "100002", null),
      inscrito(202, "100002", "EM_ANALISE"),
      inscrito(203, "100002", "REVISAR"),
      inscrito(204, "100002", "FORA_LOTE", "ELIMINADO"),
      inscrito(205, "100002", null, "RANQUEADO"),
    ];
    const faixa = contadoresDaFila(mistura);
    const { total } = andamentoDaFila(mistura, []);
    for (const parte of [
      "lote",
      "concluidas",
      "em_analise",
      "revisao",
      "pendentes",
      "saiu",
    ] as const)
      expect(faixa[parte]).toBe(total[parte]);
    expect(
      total.concluidas +
        total.em_analise +
        total.revisao +
        total.pendentes +
        total.saiu,
    ).toBe(total.lote);
    // No lote sem ficha é pendente; quem saiu eliminado é "fora", não "saiu".
    expect(total).toMatchObject({ lote: 10, pendentes: 2, saiu: 2 });
    expect(naEtapa(mistura[10], "fora")).toBe(true);
    expect(naEtapa(mistura[10], "saiu")).toBe(false);
  });

  it("cada inscrito do lote cai numa parte só; fora do lote, em nenhuma", () => {
    expect(parteDoLote(inscrito(1, VAGA, "FORA_LOTE"))).toBe("saiu");
    expect(parteDoLote(inscrito(2, VAGA, null))).toBe("pendentes");
    expect(parteDoLote(inscrito(3, VAGA, "FORA_LOTE", "ELIMINADO"))).toBeNull();
    expect(parteDoLote(null)).toBeNull();
  });

  it("a aba Saiu do lote filtra as duas e mostra o motivo da saída", () => {
    const linhas = filtrarFila(LOTE_96, { etapa: "saiu" });
    expect(linhas.map((c) => c.codigo)).toEqual(["9094", "9095"]);
    expect(colunasDaEtapa("saiu")).toContain("motivo_saida");
  });
});
