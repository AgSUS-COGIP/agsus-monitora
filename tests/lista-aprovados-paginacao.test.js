import { describe, expect, it } from "vitest";
import { paginateApprovedCandidates } from "../src/lib/lista-aprovados-rules.js";

/** Candidatos falsos, só com o que a paginação precisa: a ordem. */
const candidatos = (quantidade) =>
  Array.from({ length: quantidade }, (_, indice) => ({
    candidato_id: String(indice + 1),
    nome: `Candidato ${indice + 1}`,
  }));

describe("paginateApprovedCandidates", () => {
  it("devolve só as linhas da página pedida", () => {
    const resultado = paginateApprovedCandidates(candidatos(120), 2, 50);
    expect(resultado.rows).toHaveLength(50);
    expect(resultado.rows[0].nome).toBe("Candidato 51");
    expect(resultado.rows.at(-1).nome).toBe("Candidato 100");
  });

  it("conta as páginas incluindo a última incompleta", () => {
    expect(paginateApprovedCandidates(candidatos(120), 1, 50).totalPages).toBe(
      3,
    );
    expect(paginateApprovedCandidates(candidatos(100), 1, 50).totalPages).toBe(
      2,
    );
    expect(paginateApprovedCandidates(candidatos(1), 1, 50).totalPages).toBe(1);
  });

  it("descreve o intervalo como uma pessoa o leria", () => {
    const primeira = paginateApprovedCandidates(candidatos(120), 1, 50);
    expect([primeira.from, primeira.to]).toEqual([1, 50]);
    const ultima = paginateApprovedCandidates(candidatos(120), 3, 50);
    expect([ultima.from, ultima.to]).toEqual([101, 120]);
  });

  /*
    O caso que motiva a função corrigir a página em vez de confiar em quem chama:
    estando na página 7, filtrar por um cargo que só tem 3 candidatos deixaria a
    fatia vazia — e a tabela pareceria não ter encontrado nada.
  */
  it("traz a página para dentro do total quando o filtro encurta a lista", () => {
    const resultado = paginateApprovedCandidates(candidatos(3), 7, 50);
    expect(resultado.page).toBe(1);
    expect(resultado.rows).toHaveLength(3);
  });

  it("nunca devolve página menor que 1", () => {
    for (const pedida of [0, -5, NaN, undefined, null]) {
      expect(paginateApprovedCandidates(candidatos(10), pedida, 50).page).toBe(
        1,
      );
    }
  });

  it("aguenta lista vazia sem inventar intervalo", () => {
    const resultado = paginateApprovedCandidates([], 1, 50);
    expect(resultado.rows).toEqual([]);
    expect(resultado.total).toBe(0);
    expect(resultado.totalPages).toBe(1);
    // `from` a 0 diz "nada a mostrar"; 1 sugeriria uma primeira linha.
    expect([resultado.from, resultado.to]).toEqual([0, 0]);
  });

  it("aguenta entrada inválida no lugar das linhas", () => {
    for (const entrada of [null, undefined, "texto", 42]) {
      const resultado = paginateApprovedCandidates(entrada, 1, 50);
      expect(resultado.rows).toEqual([]);
      expect(resultado.total).toBe(0);
    }
  });

  it("cai no tamanho padrão quando o pedido não faz sentido", () => {
    for (const tamanho of [0, -10, NaN, undefined]) {
      expect(
        paginateApprovedCandidates(candidatos(60), 1, tamanho).rows,
      ).toHaveLength(50);
    }
  });

  it("respeita o tamanho de página escolhido", () => {
    expect(
      paginateApprovedCandidates(candidatos(300), 1, 25).rows,
    ).toHaveLength(25);
    expect(
      paginateApprovedCandidates(candidatos(300), 1, 200).rows,
    ).toHaveLength(200);
    expect(
      paginateApprovedCandidates(candidatos(300), 2, 200).rows,
    ).toHaveLength(100);
  });

  it("não perde nem repete candidatos ao percorrer todas as páginas", () => {
    const todos = candidatos(137);
    const vistos = [];
    let pagina = 1;
    let total = Infinity;
    while (vistos.length < 137 && pagina <= total) {
      const resultado = paginateApprovedCandidates(todos, pagina, 25);
      total = resultado.totalPages;
      vistos.push(...resultado.rows.map((row) => row.candidato_id));
      pagina += 1;
    }
    expect(vistos).toHaveLength(137);
    expect(new Set(vistos).size).toBe(137);
  });
});
