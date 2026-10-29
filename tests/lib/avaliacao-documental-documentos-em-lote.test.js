import { describe, expect, it } from "vitest";
import {
  chaveDaPessoa,
  comunicadosDosEliminados,
  concluidosDaFila,
  eliminadosDaPre,
  filtrarPessoas,
  marcadas,
} from "../../src/lib/avaliacao-documental/documentos-em-lote.ts";
import { nomeDoZipDosEspelhos } from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";

/*
  Documentos em lote (Avaliação documental › Documentos e Triagem ›
  Comunicados): listas pesquisáveis por código OU nome, marcação por vaga +
  código e a montagem dos comunicados. Dados fictícios.
*/

const concluida = (resultado) => ({ situacao: "CONCLUIDA", resultado });
const FILA = [
  {
    vaga: "2",
    codigo: "9002",
    nome: "Beatriz Simões",
    ficha: concluida("APTO"),
  },
  {
    vaga: "1",
    codigo: "9001",
    nome: "Ana Conceição",
    ficha: concluida("INAPTO_NOTA"),
  },
  {
    vaga: "1",
    codigo: "9003",
    nome: "Caio Lima",
    ficha: { situacao: "PENDENTE" },
  },
  {
    vaga: "2",
    codigo: "9001",
    nome: "Ana Conceição",
    ficha: concluida("INAPTO_REQUISITO"),
  },
];

const PRE = [
  {
    vaga: "1",
    codigo: "8001",
    nome: "Davi Áureo",
    situacao: "ELIMINADO",
    motivo: "Cancelou a inscrição",
  },
  {
    vaga: "1",
    codigo: "8002",
    nome: "Eva Nunes",
    situacao: "ELIMINADO",
    motivo: null,
  },
  {
    vaga: "1",
    codigo: "8003",
    nome: "Fabio Reis",
    situacao: "RANQUEADO",
    motivo: null,
  },
];

const pessoa = (vaga, codigo) => ({
  chave: chaveDaPessoa(vaga, codigo),
  codigo,
  nome: "",
  vaga,
  detalhe: "",
});

describe("listas dos documentos", () => {
  it("concluídos da fila: só CONCLUIDA, por vaga e nome, chave vaga|código", () => {
    const lista = concluidosDaFila(FILA);
    expect(lista.map((p) => p.chave)).toEqual(["1|9001", "2|9001", "2|9002"]);
    expect(lista[0].detalhe).toBe("Inapto pela nota");
  });

  it("eliminados da pré: só ELIMINADO; sem motivo aparece como tal", () => {
    const lista = eliminadosDaPre(PRE);
    expect(lista.map((p) => p.codigo)).toEqual(["8001", "8002"]);
    expect(lista[1].detalhe).toBe("Sem justificativa registrada");
  });

  it("busca pelo começo do código ou por parte do nome, sem acento; filtra a vaga", () => {
    const lista = concluidosDaFila(FILA);
    expect(filtrarPessoas(lista, "conceicao").map((p) => p.chave)).toEqual([
      "1|9001",
      "2|9001",
    ]);
    expect(filtrarPessoas(lista, "900")).toHaveLength(3);
    expect(filtrarPessoas(lista, "002")).toHaveLength(0);
    expect(filtrarPessoas(lista, "ana", "2").map((p) => p.chave)).toEqual([
      "2|9001",
    ]);
    expect(filtrarPessoas(lista, "  ")).toHaveLength(3);
  });

  it("marcadas segue a ordem da lista", () => {
    const lista = concluidosDaFila(FILA);
    expect(
      marcadas(lista, new Set(["2|9002", "1|9001"])).map((p) => p.chave),
    ).toEqual(["1|9001", "2|9002"]);
  });
});

describe("comunicados dos eliminados", () => {
  it("monta só os ainda eliminados com motivo e relata os demais", () => {
    const r = comunicadosDosEliminados(
      PRE,
      [{ codigo: "1", cargo: "Técnico" }],
      [pessoa("1", "8001"), pessoa("1", "8002"), pessoa("1", "8003")],
      { edital: "93/2026", unidade: "Boa Vista" },
    );
    expect(r.documentos).toHaveLength(1);
    expect(r.semMotivo).toEqual(["8002"]);
    expect(r.foraDaSituacao).toEqual(["8003"]);
    const texto = JSON.stringify(r.documentos[0]);
    expect(texto).toContain("Cancelou a inscrição");
    expect(texto).toContain("1 - Técnico");
  });

  it("o ZIP dos comunicados tem prefixo próprio", () => {
    const quando = new Date(2026, 9, 29);
    expect(nomeDoZipDosEspelhos("Edital 93/2026", quando)).toBe(
      "espelhos-93-2026-2026-10-29.zip",
    );
    expect(
      nomeDoZipDosEspelhos("Edital 93/2026", quando, null, "comunicados"),
    ).toBe("comunicados-93-2026-2026-10-29.zip");
  });
});
