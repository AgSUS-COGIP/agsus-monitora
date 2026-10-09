import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  composicaoComPrevias,
  notaComPrevias,
} from "../../src/lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  comprovadoDaExperiencia,
  comprovadoDosCursos,
  comprovadoDosTitulos,
  textoDoTempo,
} from "../../src/lib/avaliacao-documental/comprovado-da-ficha.ts";
import {
  calcularFicha,
  composicaoDaNota,
  conferenciaDaFicha,
  pendenciasDaFicha,
} from "../../src/lib/avaliacao-documental/ficha.js";
import {
  assuntoDaObservacao,
  justificativasDoBloco,
} from "../../src/lib/avaliacao-documental/justificativas-do-bloco.ts";
import { motivosDoResultado } from "../../src/lib/avaliacao-documental/motivos-do-resultado.ts";
import { apurarExperiencia } from "../../src/lib/avaliacao-documental/pontuacao.js";

/*
  A ficha no item Experiência (retorno do teste de 09/10): o tempo COMPROVADO
  pelos vínculos aceitos (a mesma conta da pontuação), a prévia na lateral, as
  justificativas do bloco primeiro e o POR QUÊ do Inapto. O caso "TREINO-P02"
  reproduz a ficha concluída do treinamento 992/2099: seis itens Conforme,
  nenhum vínculo lançado e o Inapto (requisito) sem motivo na tela. Dados
  fictícios.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const REGRA = CASOS.regras["PROJ26-CURRICULAR"];
const DOCUMENTAL = { nota_minima: 15, nota_minima_por_nivel: {} };
const EXPERIENCIA = REGRA.blocos.find((b) => b.codigo === "EXPERIENCIA");
const vinculo = (inicio, fim, extra = {}) => ({
  empregador: "Empresa fictícia",
  categoria: "AREA_OU_SUS",
  inicio,
  fim,
  aceito: true,
  ...extra,
});
const candidato = (vinculos) => ({ nivel: "superior", vinculos });

describe("tempo comprovado pelos vínculos", () => {
  it("um vínculo: anos, meses e dias, meses inteiros e os pontos da regra", () => {
    const exp = apurarExperiencia(
      EXPERIENCIA,
      candidato([vinculo("2024-02-08", "2026-10-01")]),
    );
    expect(exp.dias_total).toBe(967);
    const c = comprovadoDaExperiencia(EXPERIENCIA, exp, "superior");
    expect(c.texto).toBe("Comprovado: 2 anos, 7 meses e 27 dias (32 meses)");
    expect(c.detalhe).toBe(
      "Além do mínimo de 6 meses: 26 meses → 4 períodos de 6 meses → 20 pontos",
    );
    expect(c.abaixoDoMinimo).toBe(false);
    expect(exp.pontos).toBe(20);
  });

  it("sobreposição conta uma vez e o dia seguinte emenda (igual à pontuação)", () => {
    const vinculos = [
      vinculo("2020-01-01", "2020-12-31"),
      vinculo("2020-06-01", "2021-03-31"), // sobrepõe
      vinculo("2021-04-01", "2021-06-29"), // emenda no dia seguinte
      vinculo("2023-01-01", "2023-01-30", { aceito: false, motivo: "X" }),
    ];
    const exp = apurarExperiencia(EXPERIENCIA, candidato(vinculos));
    expect(exp.dias_total).toBe(546);
    expect(exp.meses).toBe(18);
    const c = comprovadoDaExperiencia(EXPERIENCIA, exp, "superior");
    expect(c.texto).toBe("Comprovado: 1 ano, 6 meses e 1 dia (18 meses)");
    expect(c.detalhe).toContain("12 meses → 2 períodos de 6 meses → 10 pontos");
    // o mesmo número que a ficha grava
    const avaliacao = calcularFicha(
      REGRA,
      { ...candidato(vinculos), modalidade: "AC", blocos: {} },
      DOCUMENTAL,
    );
    expect(avaliacao.parciais.EXPERIENCIA).toBe(exp.pontos);
  });

  it("sem vínculo e abaixo do mínimo; teto no nível da vaga", () => {
    const zero = comprovadoDaExperiencia(
      EXPERIENCIA,
      apurarExperiencia(EXPERIENCIA, candidato([])),
      "superior",
    );
    expect(zero.texto).toBe("Comprovado: 0 meses");
    expect(zero.detalhe).toBe("Abaixo do mínimo de 6 meses (item 1.1.1 c)");
    expect(zero.abaixoDoMinimo).toBe(true);
    const longo = apurarExperiencia(
      EXPERIENCIA,
      candidato([vinculo("2000-01-01", "2020-12-31")]),
    );
    expect(
      comprovadoDaExperiencia(EXPERIENCIA, longo, "superior").detalhe,
    ).toMatch(/35 pontos \(teto\)$/);
    expect(textoDoTempo(0)).toBe("0 dias");
  });

  it("cursos e títulos: só os aceitos", () => {
    expect(
      comprovadoDosCursos([
        { horas: 40, aceito: true },
        { horas: 60 },
        { horas: 40, aceito: true },
        { horas: 100, aceito: false },
      ]).texto,
    ).toBe("Comprovado: 3 cursos, 140 h");
    expect(comprovadoDosCursos([]).texto).toBe(
      "Comprovado: nenhum curso aceito",
    );
    expect(
      comprovadoDosTitulos([{ titulo: "MESTRADO", aceito: true }], {
        MESTRADO: "Mestrado",
      }).texto,
    ).toBe("Comprovado: 1 título (Mestrado)");
  });
});

describe("prévia na lateral", () => {
  it("item sem decisão entra com a prévia; a nota parcial soma as prévias", () => {
    const lancamento = {
      nivel: "superior",
      modalidade: "AC",
      blocos: { CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } },
      titulos: [],
      cursos: [],
      vinculos: [vinculo("2024-02-08", "2026-10-01")],
    };
    const declarada = { parciais: { FORMACAO: 5, CURSOS: 3, EXPERIENCIA: 15 } };
    const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
    const partes = composicaoComPrevias(
      composicaoDaNota(REGRA, lancamento, avaliacao, declarada),
      REGRA.blocos,
      lancamento,
      avaliacao.calculados,
    );
    const por = Object.fromEntries(partes.map((p) => [p.bloco, p]));
    expect(por.CURSOS).toMatchObject({ apurado: 3, previa: null });
    // com vínculo lançado, a prévia é o Calculado (20), não o declarado (15)
    expect(por.EXPERIENCIA).toMatchObject({ apurado: null, previa: 20 });
    // sem itens, a prévia é o calculado (0): o declarado não preenche o Apurado
    expect(por.FORMACAO).toMatchObject({ apurado: null, previa: 0 });
    expect(notaComPrevias(partes)).toEqual({ nota: 23, comPrevia: true });
    expect(notaComPrevias([{ apurado: 2, previa: null }])).toEqual({
      nota: 2,
      comPrevia: false,
    });
  });
});

describe("justificativas por bloco", () => {
  it("Experiência: os motivos do bloco e a observação de experiência; o resto em outras", () => {
    const { doBloco, outras } = justificativasDoBloco(REGRA, EXPERIENCIA);
    expect(doBloco.map((o) => o.codigo)).toEqual([
      "ANTES_DO_DIPLOMA",
      "ESTAGIO_OU_SIMILAR",
      "EXPERIENCIA_DIMINUIDA",
    ]);
    expect(outras.map((o) => o.codigo)).toEqual([
      "ALTERACAO_DE_NOME",
      "CURSOS_DIMINUIDA",
    ]);
  });

  it("Cursos e Titulação ficam com as do seu assunto", () => {
    const cursos = REGRA.blocos.find((b) => b.codigo === "CURSOS");
    expect(
      justificativasDoBloco(REGRA, cursos).doBloco.map((o) => o.codigo),
    ).toContain("CURSOS_DIMINUIDA");
    expect(
      justificativasDoBloco(REGRA, cursos).doBloco.map((o) => o.codigo),
    ).not.toContain("EXPERIENCIA_DIMINUIDA");
  });

  it("o rótulo vale antes do texto (alteração de nome é de Identidade)", () => {
    expect(
      assuntoDaObservacao({
        codigo: "ALTERACAO_DE_NOME",
        rotulo: "Alteração de nome sem documento",
        texto: "títulos e experiências em outro nome foram desconsiderados",
      }),
    ).toBe("IDENTIDADE");
    expect(assuntoDaObservacao({ codigo: "GERAL", rotulo: "Outro" })).toBe(
      null,
    );
  });
});

describe("caso TREINO-P02: Inapto com o motivo", () => {
  // A ficha gravada: seis itens Conforme, Apurado = declarado, nenhum vínculo.
  const LANCAMENTO = {
    nivel: "superior",
    modalidade: "AC",
    indigena: false,
    mora_aldeia: false,
    aldeia_na_lista: false,
    estagio_horas: 0,
    blocos: {
      IDENTIDADE: { motivos: [], situacao: "CONFORME" },
      ESCOLARIDADE: { motivos: [], situacao: "CONFORME" },
      REGISTRO_CONSELHO: { motivos: [], situacao: "CONFORME" },
      FORMACAO: { motivos: [], situacao: "CONFORME", nota_ajustada: 5 },
      CURSOS: { motivos: [], situacao: "CONFORME", nota_ajustada: 3 },
      EXPERIENCIA: { motivos: [], situacao: "CONFORME", nota_ajustada: 15 },
    },
    titulos: [],
    cursos: [],
    vinculos: [],
    observacoes_prontas: [],
  };
  const declarada = { parciais: { FORMACAO: 5, CURSOS: 3, EXPERIENCIA: 15 } };

  it("a causa: a experiência mínima conta só os vínculos lançados (0 meses)", () => {
    const avaliacao = calcularFicha(REGRA, LANCAMENTO, DOCUMENTAL);
    expect(avaliacao.resultado).toBe("INAPTO_REQUISITO");
    expect(avaliacao.nota_apurada).toBe(23);
    expect(avaliacao.nota_final).toBe(0);
    expect(avaliacao.eliminatorios).toEqual([
      "Item 1.1.1 c: não comprovou a experiência profissional mínima de 6 meses.",
    ]);
  });

  it("não conclui em silêncio: Conforme sem registro pede o título, o curso e o vínculo", () => {
    const avaliacao = calcularFicha(REGRA, LANCAMENTO, DOCUMENTAL);
    const pendencias = pendenciasDaFicha(
      REGRA,
      LANCAMENTO,
      avaliacao,
      declarada,
    );
    expect(pendencias.map((p) => [p.bloco, p.tipo])).toEqual([
      ["FORMACAO", "comprovado"],
      ["CURSOS", "comprovado"],
      ["EXPERIENCIA", "comprovado"],
    ]);
    expect(pendencias[2].texto).toBe(
      "Registre ao menos um vínculo com início e fim.",
    );
  });

  it("vínculo registrado abaixo do mínimo: pede o mínimo (! no stepper)", () => {
    const lancamento = {
      ...LANCAMENTO,
      vinculos: [vinculo("2026-01-01", "2026-03-31")],
    };
    const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
    const pendencias = pendenciasDaFicha(
      REGRA,
      lancamento,
      avaliacao,
      declarada,
    ).filter((p) => p.bloco === "EXPERIENCIA");
    expect(pendencias).toEqual([
      {
        bloco: "EXPERIENCIA",
        tipo: "minimo",
        texto:
          "Experiência mínima de 6 meses não comprovada (comprovado 3 meses): registre os vínculos que comprovam ou escolha Não confere.",
      },
    ]);
    expect(
      conferenciaDaFicha(REGRA, lancamento, avaliacao, pendencias)
        .texto_da_falta,
    ).toBe("Falta: Experiência Profissional (experiência mínima)");
  });

  it("a tela diz por quê, com o item", () => {
    const avaliacao = calcularFicha(REGRA, LANCAMENTO, DOCUMENTAL);
    expect(
      motivosDoResultado(
        REGRA.blocos,
        LANCAMENTO,
        avaliacao,
        avaliacao.resultado,
      ),
    ).toEqual([
      {
        bloco: "EXPERIENCIA",
        texto:
          "Experiência mínima de 6 meses não comprovada (comprovado 0 meses) — item 1.1.1 c",
      },
    ]);
  });

  it("com o vínculo lançado, comprova o mínimo e fica Apto", () => {
    const lancamento = {
      ...LANCAMENTO,
      vinculos: [vinculo("2024-02-08", "2026-10-01")],
    };
    const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
    expect(avaliacao.resultado).toBe("APTO");
    expect(
      pendenciasDaFicha(REGRA, lancamento, avaliacao, declarada).filter(
        (p) => p.tipo === "minimo",
      ),
    ).toEqual([]);
  });

  it("motivo de bloco eliminatório e nota mínima", () => {
    const lancamento = {
      ...LANCAMENTO,
      vinculos: [vinculo("2024-02-08", "2026-10-01")],
      blocos: {
        ...LANCAMENTO.blocos,
        ESCOLARIDADE: { situacao: "NAO_CONFORME", motivos: ["NAO_COMPROVADA"] },
      },
    };
    const avaliacao = calcularFicha(REGRA, lancamento, DOCUMENTAL);
    const [motivo] = motivosDoResultado(
      REGRA.blocos,
      lancamento,
      avaliacao,
      avaliacao.resultado,
    );
    expect(motivo.bloco).toBe("ESCOLARIDADE");
    expect(motivo.texto).toMatch(/ — item 8\.2\.1$/);
    expect(
      motivosDoResultado(
        REGRA.blocos,
        lancamento,
        { nota_apurada: 10, nota_minima: 15 },
        "INAPTO_NOTA",
      ),
    ).toEqual([{ bloco: null, texto: "Nota 10 abaixo da mínima 15" }]);
  });
});

describe("tirar e desfazer um vínculo (a P02 perdeu o vínculo pelo ×)", () => {
  it("tira com um clique e o Desfazer devolve na mesma posição", async () => {
    const { tirarItem, devolverItem } =
      await import("../../src/lib/avaliacao-documental/itens-da-ficha.ts");
    const a = vinculo("2020-01-01", "2020-12-31");
    const b = vinculo("2024-02-08", "2026-10-01");
    const r = tirarItem([a, b], 1);
    expect(r.itens).toEqual([a]);
    expect(r.tirado).toEqual({ indice: 1, item: b });
    expect(devolverItem(r.itens, r.tirado)).toEqual([a, b]);
    expect(devolverItem([], { indice: 3, item: b })).toEqual([b]);
    expect(tirarItem([a], 5).tirado).toBeNull();
  });
});
