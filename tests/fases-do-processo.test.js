import { describe, expect, it } from "vitest";
import {
  faseDaAtividade,
  faseDoEdital,
  FASES,
  ORDEM_DAS_FASES,
  tomDaFase,
} from "../src/lib/fases-do-processo.js";

/*
  As fases fixas da Visão geral, lidas do texto livre do cronograma. Os textos
  são variantes reais (analise.md e prazo-do-recurso.ts): SI com 15 valores,
  Projetos com 12 para 12 editais, SEDE com duplicados por espaço final e um
  "zzzzz".
*/

describe("o texto da atividade vira uma fase fixa", () => {
  it.each([
    ["Elaboração do Edital", "Edital"],
    ["Impugnação do Edital", "Edital"],
    ["Publicação do edital", "Edital"],
    ["Período de inscrição", "Inscrições"],
    ["Inscrições", "Inscrições"],
    ["Homologação das inscrições", "Inscrições"],
    ["Análise Curricular", "Análise curricular"],
    ["Análise documental e de títulos", "Análise curricular"],
    ["Resultado Preliminar", "Análise curricular"],
    ["Avaliação de Conhecimentos", "Análise curricular"],
    [
      "Resultado preliminar da análise curricular e abertura do prazo de recurso",
      "Recursos",
    ],
    ["Abertura do Prazo de Recurso", "Recursos"],
    ["Prazo para recursos das entrevistas", "Recursos"],
    ["Análise e resposta ao recurso", "Recursos"],
    ["Prazo de recurso do resultado final", "Recursos"],
    ["Entrevistas", "Entrevistas"],
    ["Convocação para entrevista", "Entrevistas"],
    ["Resultado preliminar das entrevistas", "Entrevistas"],
    ["Resposta aos Recursos e Resultado Final das Entrevistas", "Resultado"],
    ["Resultado final do Processo Seletivo", "Resultado"],
    ["Resultado final do processo seletivo ", "Resultado"],
    ["RESULTADO FINAL DO PROCESSO SELETIVO", "Resultado"],
    ["Homologação do resultado", "Resultado"],
    ["Convocação para admissão", "Contratação"],
    ["Contratação", "Contratação"],
    ["Exames admissionais e posse", "Contratação"],
    ["Aguardando: Entrevistas", "Entrevistas"],
    ["Aguardando: Período de inscrição", "Inscrições"],
    ["Cronograma pendente", "Sem cronograma"],
    ["zzzzz", "Outra"],
    ["Cronograma em andamento", "Outra"],
  ])("%s → %s", (texto, fase) => {
    expect(faseDaAtividade(texto)).toBe(fase);
  });

  it("vazio não tem fase", () => {
    expect(faseDaAtividade("  ")).toBeNull();
    expect(faseDaAtividade(null)).toBeNull();
  });
});

describe("a fase do edital", () => {
  it("o status manda: cancelado, concluído e planejado", () => {
    expect(
      faseDoEdital({
        status: "Cancelado",
        etapa: "Resultado final do Processo Seletivo",
      }),
    ).toBe("Cancelado");
    expect(faseDoEdital({ status: "Concluído", etapa: "Entrevistas" })).toBe(
      "Concluído",
    );
    expect(
      faseDoEdital({
        status: "Planejado",
        etapa: "Aguardando: Período de inscrição",
      }),
    ).toBe("Edital");
  });

  it("em andamento: a atividade de hoje, senão a etapa", () => {
    expect(
      faseDoEdital({
        status: "Em andamento",
        cronograma_atividade_atual: "Entrevistas",
        etapa: "Entrevistas",
      }),
    ).toBe("Entrevistas");
    expect(
      faseDoEdital({
        status: "Em andamento",
        etapa: "Aguardando: Entrevistas",
      }),
    ).toBe("Entrevistas");
    expect(faseDoEdital({ status: "Em andamento", etapa: "zzzzz" })).toBe(
      "Outra",
    );
    expect(faseDoEdital({ status: "Cronograma pendente", etapa: "" })).toBe(
      "Sem cronograma",
    );
  });

  it("ordem e tons fixos", () => {
    expect(FASES).toEqual([
      "Edital",
      "Inscrições",
      "Análise curricular",
      "Recursos",
      "Entrevistas",
      "Resultado",
      "Contratação",
      "Concluído",
    ]);
    expect(ORDEM_DAS_FASES.slice(-3)).toEqual([
      "Cancelado",
      "Sem cronograma",
      "Outra",
    ]);
    expect(tomDaFase("Concluído")).toBe("sucesso");
    expect(tomDaFase("Cancelado")).toBe("perigo");
    expect(tomDaFase("Outra")).toBe("neutro");
  });
});
