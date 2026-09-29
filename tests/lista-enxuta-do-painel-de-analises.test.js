import { describe, expect, it } from "vitest";
import {
  compararNaOrdemDoBanco,
  completarLinhaPeloEnvelope,
  envelopeDeTodos,
  juntarPartesDoPainel,
  linhaSemDetalhe,
  mesclarDetalhe,
  partesDoEscopo,
  temPdf,
} from "../src/lib/lista-do-painel-de-analises.js";

/*
  A lista enxuta do painel de análises (20260929150000): o que sai da linha
  volta pelo envelope, pelo detalhamento ou pela junção dos escopos de "Todos".
*/

const linha = (
  id,
  unidade,
  edital = "1/2026",
  vaga = "10",
  candidato = "Ana",
) => ({
  id,
  unidade,
  edital,
  codigo_vaga: vaga,
  candidato,
});

const parte = (geradoEm, linhas, extra = {}) => ({
  payload: {
    schema_version: 4,
    generated_at: geradoEm,
    rows: [],
    editais: [{ edital: "1/2026" }],
    cache: { hit: true, refreshed_at: geradoEm },
    ...extra,
  },
  linhas,
});

describe("Todos = ativo + inativo + desativadas", () => {
  it("pede os três escopos só para Todos", () => {
    expect(partesDoEscopo("todos")).toEqual([
      "ativo",
      "inativo",
      "desativadas",
    ]);
    expect(partesDoEscopo("inativo")).toEqual(["inativo"]);
  });

  it("junta na ordem do banco: unidade, edital, vaga e candidato, com a colação en-US e o id no desempate", () => {
    const ativo = [
      linha("b", "DSEI Alto Rio Negro"),
      linha("d", "dsei manaus"),
    ];
    const inativo = [
      linha("a", "CASAI Brasília"),
      linha("c", "DSEI Alto Rio Negro", "1/2026", "10", "Ana"),
      linha("e", "Polo Base"),
    ];
    const desativadas = [linha("f", null)];
    const juntas = juntarPartesDoPainel([
      parte("10:00", ativo),
      parte("10:00", inativo),
      parte("10:00", desativadas),
    ]);
    expect(juntas.map((l) => l.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("colação do banco: maiúsculas e acentos não passam na frente", () => {
    expect(
      compararNaOrdemDoBanco(linha("1", "DSEI Ária"), linha("2", "dsei Arib")),
    ).toBeLessThan(0);
    expect(
      compararNaOrdemDoBanco(linha("1", "dsei x"), linha("2", "DSEI X")),
    ).toBeLessThan(0);
  });

  it("análise que mudou de escopo entre a cópia e a nova aparece uma vez, a da parte mais nova", () => {
    const antiga = parte("2026-09-29T10:00:00Z", [
      { ...linha("x", "A"), status_consolidado: "Pendente" },
    ]);
    const nova = parte("2026-09-29T10:30:00Z", [
      { ...linha("x", "A"), status_consolidado: "Aprovado" },
      linha("y", "B"),
    ]);
    const juntas = juntarPartesDoPainel([antiga, nova]);
    expect(juntas.map((l) => [l.id, l.status_consolidado])).toEqual([
      ["x", "Aprovado"],
      ["y", undefined],
    ]);
  });

  it("o envelope de Todos: editais de uma parte, hora da mais velha e o dado mais novo", () => {
    const envelope = envelopeDeTodos(
      [
        parte("2026-09-29T10:00:00Z", [], {
          atualizado_em: "2026-09-28T09:00:00Z",
        }),
        parte("2026-09-29T10:30:00Z", [], {
          atualizado_em: "2026-09-29T08:00:00Z",
          cache: { hit: false, refreshed_at: "2026-09-29T10:30:00Z" },
        }),
      ],
      7,
    );
    expect(envelope).toMatchObject({
      scope: "todos",
      total: 7,
      edital_status: null,
      editais: [{ edital: "1/2026" }],
      generated_at: "2026-09-29T10:00:00Z",
      atualizado_em: "2026-09-29T08:00:00Z",
      cache: { hit: false, refreshed_at: "2026-09-29T10:00:00Z" },
    });
    expect(envelope).not.toHaveProperty("rows");
    expect(envelopeDeTodos([], 0)).toBeNull();
  });
});

describe("o que a linha não traz mais", () => {
  it("grupo e situação do edital vêm do envelope; a linha do payload antigo fica como está", () => {
    const envelope = { grupo: "Projetos", edital_status: "Inativo" };
    expect(completarLinhaPeloEnvelope({ id: "1" }, envelope)).toEqual({
      id: "1",
      grupo: "Projetos",
      edital_status: "Inativo",
    });
    expect(
      completarLinhaPeloEnvelope(
        { id: "1", grupo: "Saúde Indígena", edital_status: "Ativo" },
        envelope,
      ),
    ).toEqual({ id: "1", grupo: "Saúde Indígena", edital_status: "Ativo" });
  });

  it("tem PDF: pelo tem_pdf da lista enxuta ou pelo link do payload antigo", () => {
    expect(temPdf({ tem_pdf: true })).toBe(true);
    expect(temPdf({ tem_pdf: false })).toBe(false);
    expect(temPdf({ link_pdf: " https://pdf " })).toBe(true);
    expect(temPdf({ link_pdf: "  " })).toBe(false);
    expect(temPdf(null)).toBe(false);
  });

  it("o detalhamento completa a linha sem trocar o que ela tem nem a chave da tabela", () => {
    const linhaDaLista = {
      id: "a",
      grupo: "Projetos",
      data_validacao_status: "DATA_FUTURA",
    };
    expect(linhaSemDetalhe(linhaDaLista)).toBe(true);
    const mudou = mesclarDetalhe(linhaDaLista, {
      id: "a",
      area: "projetos",
      chave_natural: "k",
      grupo: "PROJETOS",
      data_validacao_status: "DENTRO_PERIODO",
      pontuacao_escolaridade: 10,
      analise: "Apto",
    });
    expect(mudou).toBe(true);
    expect(linhaDaLista).toEqual({
      id: "a",
      grupo: "Projetos",
      data_validacao_status: "DATA_FUTURA",
      pontuacao_escolaridade: 10,
      analise: "Apto",
    });
    expect(linhaSemDetalhe(linhaDaLista)).toBe(false);
    expect(mesclarDetalhe(linhaDaLista, null)).toBe(false);
    // A linha do payload antigo já vem com as pontuações.
    expect(linhaSemDetalhe({ id: "b", pontuacao_escolaridade: null })).toBe(
      false,
    );
  });
});
