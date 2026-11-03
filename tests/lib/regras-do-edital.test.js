import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ETAPAS_DAS_REGRAS,
  etapaDasRegras,
} from "../../src/lib/regras-do-edital.ts";
import {
  desempateDaAvaliacao,
  resumoDaRegraDaAvaliacao,
  resumoDaRegraDaClassificacao,
} from "../../src/lib/regras-do-edital-resumos.ts";
import { normalizarRegraAnalise } from "../../src/lib/avaliacao-documental/regra.ts";

/*
  Regras do edital (Editais › Regras do edital): a ordem das etapas e os
  resumos só-leitura que as telas da Avaliação documental e da Classificação
  mostram no topo.
*/

const { regras } = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);

describe("etapas das Regras do edital", () => {
  it("na ordem do processo, da Triagem à Chamada para contratação", () => {
    expect(ETAPAS_DAS_REGRAS.map((e) => e.valor)).toEqual([
      "triagem",
      "avaliacao",
      "entrevista",
      "classificacao",
      "chamada",
    ]);
  });

  it("etapa desconhecida abre na Triagem", () => {
    expect(etapaDasRegras("classificacao")).toBe("classificacao");
    expect(etapaDasRegras("lote")).toBe("triagem");
    expect(etapaDasRegras(undefined)).toBe("triagem");
  });
});

describe("resumo da regra da Classificação", () => {
  const REGRA = {
    composicao: {
      componentes: [
        { codigo: "DOCUMENTAL", peso: 2 },
        { codigo: "ENTREVISTA", peso: 1 },
      ],
      casas: 2,
    },
    documental: { nota_minima: 15 },
    desempate: [{ criterio: "IDOSO_60" }, { criterio: "EXP_SAUDE_INDIGENA" }],
    empate_final: { metodo: "SORTEIO" },
    modalidades: [{ codigo: "AC" }, { codigo: "PP", percentual: 25 }],
  };

  it("composição, mínimos, desempate (com o que vem da Avaliação) e cotas", () => {
    const linhas = Object.fromEntries(
      resumoDaRegraDaClassificacao(REGRA).map((l) => [l.rotulo, l.valor]),
    );
    expect(linhas["Composição da nota"]).toBe(
      "Nota documental (curricular) (peso 2) + Nota da entrevista (peso 1); 2 casas decimais",
    );
    expect(linhas["Notas mínimas"]).toBe("documental 15");
    expect(linhas.Desempate).toBe(
      "1º 60+; 2º exp. saúde indígena (comprovado na Avaliação documental)",
    );
    expect(linhas["Empate depois dos critérios"]).toBe("Sorteio registrado");
    expect(linhas.Cotas).toMatch(/^PP 25%; /);
  });

  it("sem regra, nada", () => {
    expect(resumoDaRegraDaClassificacao(null)).toEqual([]);
  });

  it("critérios que usam o comprovado na Avaliação documental", () => {
    expect(desempateDaAvaliacao("INDIGENA_COMPROVADO")).toBe(true);
    expect(desempateDaAvaliacao("IDOSO_60")).toBe(false);
  });
});

describe("resumo da regra da Avaliação documental", () => {
  it("documentos, o que pontua, como a experiência conta e a nota mínima", () => {
    const regra = normalizarRegraAnalise(regras["PROJ26-CURRICULAR"]);
    const linhas = resumoDaRegraDaAvaliacao(regra, 15);
    const rotulos = linhas.map((l) => l.rotulo);
    expect(rotulos[0]).toBe("Documentos exigidos");
    expect(rotulos).toContain("O que pontua");
    expect(rotulos.at(-1)).toBe("Nota mínima");
    const experiencia = linhas.find((l) =>
      /Comprovada nas categorias/.test(l.valor),
    );
    expect(experiencia).toBeDefined();
    expect(experiencia.valor).toMatch(/pontos/);
    expect(linhas.at(-1).valor).toBe("15 pontos (regra da Classificação)");
    // Requisitos da inscrição e lote são da Triagem: não aparecem aqui.
    expect(linhas.map((l) => l.valor).join(" ")).not.toMatch(
      /Na inscrição|Lote:/,
    );
  });

  it("sem regra, nada", () => {
    expect(resumoDaRegraDaAvaliacao(null)).toEqual([]);
  });
});
