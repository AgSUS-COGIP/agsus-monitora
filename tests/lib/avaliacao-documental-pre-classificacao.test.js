import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  artDasColunas,
  eliminacaoDoCandidato,
  idadeEm,
  modalidadeDoCandidato,
  numeroNoTexto,
  preClassificarVaga,
  tamanhoDoLote,
  vagasPorModalidade,
} from "../../src/lib/avaliacao-documental/pre-classificacao.js";
import {
  normalizarRegraAnalise,
  validarRegraAnalise,
} from "../../src/lib/avaliacao-documental/regra.js";

/*
  Os mesmos casos rodam no pytest (tests/python/test_pre_classificacao.py),
  contra a conta oficial do job (python/monitora/avaliacao_documental/).
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json",
    "utf8",
  ),
);
const CAMPOS = [
  "situacao",
  "motivo_codigo",
  "posicao",
  "posicao_modalidade",
  "lote",
  "lista_lote",
  "entrada",
  "motivo_entrada",
  "nota",
  "origem_nota",
  "divergente",
  "modalidade",
];

const rodar = (c) =>
  preClassificarVaga({
    regra: normalizarRegraAnalise(c.regra),
    vaga: c.vaga,
    candidatos: c.candidatos,
    anterior: c.anterior,
    ultimo_lote: c.ultimo_lote,
    refazer: c.refazer,
    hoje: c.hoje,
  });

describe("casos dourados da pré-classificação", () => {
  it.each(CASOS.casos.map((c) => [`${c.historia} — ${c.nome}`, c]))(
    "%s",
    (_nome, c) => {
      const r = rodar(c);
      const linhas = Object.fromEntries(
        r.linhas.map((l) => [
          l.id,
          Object.fromEntries(CAMPOS.map((k) => [k, l[k]])),
        ]),
      );
      expect(linhas).toEqual(c.esperado.linhas);
      expect(r.resumo).toEqual(c.esperado.resumo);
    },
  );

  it("a regra de cada caso é uma regra válida", () => {
    for (const c of CASOS.casos)
      expect(validarRegraAnalise(normalizarRegraAnalise(c.regra))).toEqual([]);
  });

  it("rodar de novo com o resultado como anterior não muda nada (AM-4.2)", () => {
    for (const c of CASOS.casos) {
      const primeira = rodar(c);
      const anterior = Object.fromEntries(
        primeira.linhas.map((l) => [l.id, l]),
      );
      const segunda = rodar({
        ...c,
        candidatos: c.candidatos.filter(
          (x) => x.ativo !== false || anterior[x.id],
        ),
        anterior,
        refazer: false,
        ultimo_lote: Math.max(0, ...primeira.linhas.map((l) => l.lote ?? 0)),
      });
      expect(segunda.linhas.map((l) => [l.id, l.situacao, l.lote])).toEqual(
        primeira.linhas.map((l) => [l.id, l.situacao, l.lote]),
      );
      expect(segunda.resumo.entraram).toBe(0);
    }
  });
});

describe("peças da conta", () => {
  it("ART da coluna NOTA - …", () => {
    expect(artDasColunas({ "NOTA - Questionário": "24,5/30,0" })).toBe(24.5);
    expect(artDasColunas({ "nota - x": "x/30", "NOTA - y": "3/30" })).toBe(3);
    expect(artDasColunas({ NOTAS: "10" })).toBeNull();
  });

  it("eliminação: a primeira regra que vale, e as colunas ausentes", () => {
    const regra = normalizarRegraAnalise(CASOS.casos[0].regra);
    expect(
      eliminacaoDoCandidato(regra, {
        SITUAÇÃO: "cancelado",
        "SITUAÇÃO - Q": "EM ANDAMENTO",
      }).eliminacao.codigo,
    ).toBe("CANCELADO");
    const semColunas = eliminacaoDoCandidato(regra, {});
    expect(semColunas.eliminacao).toBeNull();
    expect(semColunas.ausentes).toEqual([
      "CANCELADO",
      "QUESTIONARIO",
      "REPROVADO_EMPREGARE",
      "TERMO",
    ]);
  });

  it("modalidade pelo bloco MODALIDADE; sem ele, ampla", () => {
    const regra = normalizarRegraAnalise(CASOS.casos[0].regra);
    expect(
      modalidadeDoCandidato(regra, {
        "Pergunta 5 - Sistema": "Pessoa com deficiência (PcD)",
      }),
    ).toBe("PCD");
    expect(modalidadeDoCandidato({ blocos: [] }, {})).toBe("AC");
  });

  it("tamanho do lote: múltiplo, CR, fixo, por vaga e sem quadro", () => {
    const lote = normalizarRegraAnalise({}).lote;
    expect(
      tamanhoDoLote(lote, { vagas_imediatas: 11, cadastro_reserva: true })
        .descricao,
    ).toBe("3 × (11 + CR) = 36");
    expect(
      tamanhoDoLote(
        { ...lote, multiplo: 2.5, inclui_cr: false },
        { vagas_imediatas: 3, cadastro_reserva: true },
      ),
    ).toMatchObject({ tamanho: 8, descricao: "2,5 × 3 = 8" });
    expect(
      tamanhoDoLote(lote, { vagas_imediatas: 0, cadastro_reserva: false })
        .aviso,
    ).toBe("SEM_VAGAS");
    expect(
      tamanhoDoLote(
        { ...lote, por_modalidade: true },
        {
          vagas_imediatas: 2,
          cadastro_reserva: false,
          modalidades: { AC: null },
        },
      ).aviso,
    ).toBe("QUADRO_SEM_MODALIDADES");
  });

  it("vagas por modalidade do quadro", () => {
    expect(
      vagasPorModalidade({
        "Ampla Concorrência": "2",
        PcD: null,
        Indígenas: 1,
      }),
    ).toEqual({ AC: 2, PCD: 0, PI: 1 });
    expect(vagasPorModalidade({ "Ampla Concorrência": null })).toBeNull();
  });

  it("idade e número no texto", () => {
    expect(idadeEm("1966-10-07", "2026-10-06")).toBe(59);
    expect(idadeEm("1966-10-06", "2026-10-06")).toBe(60);
    expect(idadeEm(null, "2026-10-06")).toBeNull();
    expect(numeroNoTexto(24)).toBe("24");
    expect(numeroNoTexto(18.5)).toBe("18,5");
  });
});

describe("regra: desempate e lote por vaga", () => {
  it("o padrão do desempate é idoso e candidatura", () => {
    expect(normalizarRegraAnalise({}).provisoria.desempate).toEqual([
      "IDOSO",
      "CANDIDATURA",
    ]);
  });

  it("recusa desempate desconhecido ou repetido e lote por vaga inválido", () => {
    const base = normalizarRegraAnalise(CASOS.casos[0].regra);
    const com = (mudar) => {
      const r = structuredClone(base);
      mudar(r);
      return validarRegraAnalise(r).join(" ");
    };
    expect(com((r) => (r.provisoria.desempate = ["SORTEIO"]))).toMatch(
      /Desempate da Provisória/,
    );
    expect(com((r) => (r.provisoria.desempate = ["IDOSO", "IDOSO"]))).toMatch(
      /Desempate da Provisória/,
    );
    expect(com((r) => (r.lote.por_vaga = { "17A": 3 }))).toMatch(
      /Lote por vaga/,
    );
    expect(com((r) => (r.lote.por_vaga = { 179698: 0 }))).toMatch(
      /Lote por vaga/,
    );
    expect(com((r) => (r.lote.por_vaga = { 179698: 40 }))).toBe("");
  });
});
