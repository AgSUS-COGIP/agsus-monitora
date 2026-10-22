import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  blocoNaoPontuaNoNivel,
  blocoSeAplica,
  calcularFicha,
  composicaoDaNota,
  etapasDaFicha,
  lancamentoInicial,
  pendenciasDaFicha,
  regraDaFicha,
  respostasDoBloco,
} from "../../src/lib/avaliacao-documental/ficha.js";
import { semPerguntaNoQuestionario } from "../../src/lib/avaliacao-documental/respostas-do-candidato.ts";

/*
  A ficha do 114/2026 com a regra vigente (v18) e as respostas reais de um
  candidato por vaga (tests/fixtures/avaliacao-documental/ficha-114-2026.json).
  A regra liga a cada bloco as perguntas de todos os questionários (superior,
  técnico, médio, Motorista): a ficha mostra só as do questionário do
  candidato. A titulação só pontua no superior: no médio e no técnico o item
  não pede conferência ("Não pontua neste nível") e sai da composição da nota
  (FC_BLOCO_NAO_PONTUA_NO_NIVEL, migration 20261014210000).
*/
const DADOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);
const REGRA = DADOS.regra;
const DOCUMENTAL = { nota_minima: 10, nota_minima_por_nivel: {} };

function fichaDaVaga(vaga) {
  const { cargo, respostas } = DADOS.vagas[vaga];
  const lancamento = lancamentoInicial({
    regra: REGRA,
    respostas,
    modalidade: "AC",
    cargo,
    vaga,
    documental: DOCUMENTAL,
  });
  return { lancamento, respostas, regra: regraDaFicha(REGRA, lancamento) };
}
const bloco = (regra, codigo) => regra.blocos.find((b) => b.codigo === codigo);
const perguntas = (regra, codigo, respostas) =>
  respostasDoBloco(bloco(regra, codigo), respostas).map((l) => l.enunciado);

describe("perguntas do questionário do candidato (114/2026)", () => {
  it("Motorista D: só as perguntas do questionário de nível médio do Motorista", () => {
    const { regra, respostas } = fichaDaVaga("182567");
    expect(perguntas(regra, "ESCOLARIDADE", respostas)).toEqual([
      "Você possui Ensino Médio completo",
      "Anexe a comprovação de conclusão do Nível Médio.",
    ]);
    expect(perguntas(regra, "REQUISITO_DO_CARGO", respostas)).toEqual([
      "Você possui CNH Categoria D vigente",
      "Anexe aqui sua CNH Categoria D.",
      "Você possui curso de direção defensiva",
      "Anexe o comprovante de conclusão do curso de direção defensiva",
    ]);
    expect(perguntas(regra, "FORMACAO", respostas)).toEqual([]);
  });

  it("Técnico e superior: a formação e o requisito de cada questionário", () => {
    const tec = fichaDaVaga("182445");
    expect(perguntas(tec.regra, "ESCOLARIDADE", tec.respostas)).toEqual([
      "Você possui Curso Técnico na área da vaga",
      "Anexe a comprovação de Nível Técnico",
    ]);
    expect(perguntas(tec.regra, "REQUISITO_DO_CARGO", tec.respostas)).toEqual(
      [],
    );
    const sup = fichaDaVaga("182418");
    expect(perguntas(sup.regra, "ESCOLARIDADE", sup.respostas)).toEqual([
      "Você possui Graduação na área da vaga",
      "Anexe a comprovação de Nível Superior",
    ]);
    expect(perguntas(sup.regra, "FORMACAO", sup.respostas)).toHaveLength(2);
  });

  it("a pergunta que existe e ficou em branco continua, sem resposta", () => {
    const { regra, respostas } = fichaDaVaga("182567");
    const coluna = Object.keys(respostas).find((c) =>
      c.includes("direção defensiva?"),
    );
    const linhas = respostasDoBloco(bloco(regra, "REQUISITO_DO_CARGO"), {
      ...respostas,
      [coluna]: "--",
    });
    expect(linhas.find((l) => l.coluna === coluna)?.texto).toBe("");
    expect(linhas).toHaveLength(4);
  });

  it("o item sem pergunta no questionário avisa (e só ele)", () => {
    const { regra, respostas } = fichaDaVaga("182444");
    const requisito = bloco(regra, "REQUISITO_DO_CARGO");
    const linhas = respostasDoBloco(requisito, respostas).length;
    expect(semPerguntaNoQuestionario(requisito, respostas, linhas)).toBe(true);
    const cursos = bloco(regra, "CURSOS");
    expect(
      semPerguntaNoQuestionario(
        cursos,
        respostas,
        respostasDoBloco(cursos, respostas).length,
      ),
    ).toBe(false);
    // Sem as respostas carregadas, nada a dizer.
    expect(semPerguntaNoQuestionario(requisito, {}, 0)).toBe(false);
    expect(
      semPerguntaNoQuestionario(
        { tipo: "PONTUACAO", perguntas: ["x"] },
        respostas,
        0,
      ),
    ).toBe(false);
  });
});

describe("bloco que não pontua no nível da vaga (114/2026)", () => {
  it("a titulação só pontua no superior", () => {
    for (const [vaga, nivel, pontua] of [
      ["182567", "medio", false],
      ["182444", "medio", false],
      ["182445", "tecnico", false],
      ["182418", "superior", true],
    ]) {
      const { regra, lancamento } = fichaDaVaga(vaga);
      expect(lancamento.nivel).toBe(nivel);
      expect(blocoNaoPontuaNoNivel(bloco(regra, "FORMACAO"), nivel)).toBe(
        !pontua,
      );
      expect(blocoSeAplica(bloco(regra, "FORMACAO"), lancamento)).toBe(pontua);
      // Cursos e experiência pontuam em todos os níveis.
      expect(blocoSeAplica(bloco(regra, "CURSOS"), lancamento)).toBe(true);
      expect(blocoSeAplica(bloco(regra, "EXPERIENCIA"), lancamento)).toBe(true);
    }
  });

  it("Motorista D: sem a etapa nem a pendência da titulação, e fora da lateral", () => {
    const { lancamento } = fichaDaVaga("182567");
    const av = calcularFicha(REGRA, lancamento, DOCUMENTAL);
    expect(etapasDaFicha(REGRA, lancamento).map((e) => e.codigo)).not.toContain(
      "FORMACAO",
    );
    expect(
      pendenciasDaFicha(REGRA, lancamento, av, null).some(
        (p) => p.bloco === "FORMACAO",
      ),
    ).toBe(false);
    expect(
      composicaoDaNota(REGRA, lancamento, av, null).map((p) => p.parcial),
    ).toEqual(["CURSOS", "EXPERIENCIA"]);
    // A conta não muda: a titulação vale 0 no médio.
    expect(av.parciais.FORMACAO ?? 0).toBe(0);
  });

  it("superior: a titulação continua pedindo a conferência", () => {
    const { lancamento } = fichaDaVaga("182418");
    const av = calcularFicha(REGRA, lancamento, DOCUMENTAL);
    expect(etapasDaFicha(REGRA, lancamento).map((e) => e.codigo)).toContain(
      "FORMACAO",
    );
    expect(
      composicaoDaNota(REGRA, lancamento, av, null).map((p) => p.parcial),
    ).toContain("FORMACAO");
  });

  it("não vale quando o bloco pode mudar o resultado, nem sem nível", () => {
    const titulos = {
      tipo: "TITULOS",
      teto: 10,
      pontos_por_nivel: { superior: [{ titulo: "MESTRADO", pontos: 8 }] },
    };
    expect(blocoNaoPontuaNoNivel(titulos, "medio")).toBe(true);
    expect(blocoNaoPontuaNoNivel(titulos, "superior")).toBe(false);
    expect(blocoNaoPontuaNoNivel(titulos, null)).toBe(false);
    expect(
      blocoNaoPontuaNoNivel(
        { ...titulos, efeitos: { NAO_ENVIADO: "ELIMINA" } },
        "medio",
      ),
    ).toBe(false);
    expect(
      blocoNaoPontuaNoNivel(
        { ...titulos, efeitos: { NAO_CONFORME: "SO_REGISTRO" } },
        "medio",
      ),
    ).toBe(true);
    expect(
      blocoNaoPontuaNoNivel(
        { ...titulos, motivos: [{ codigo: "X", efeito: "ZERA_PONTOS" }] },
        "medio",
      ),
    ).toBe(false);
    expect(
      blocoNaoPontuaNoNivel(
        { ...titulos, extras: [{ codigo: "E", pontos: 2 }] },
        "medio",
      ),
    ).toBe(false);
    // Cursos com teto 0 no nível; experiência com mínimo continua valendo.
    const cursos = {
      tipo: "CURSOS",
      teto: 5,
      por_nivel: { medio: { teto: 0 } },
    };
    expect(blocoNaoPontuaNoNivel(cursos, "medio")).toBe(true);
    expect(blocoNaoPontuaNoNivel(cursos, "superior")).toBe(false);
    expect(
      blocoNaoPontuaNoNivel(
        { tipo: "VINCULOS", teto: 0, minimo_meses: 6 },
        "medio",
      ),
    ).toBe(false);
    expect(blocoNaoPontuaNoNivel({ tipo: "DOCUMENTO", teto: 0 }, "medio")).toBe(
      false,
    );
  });
});
