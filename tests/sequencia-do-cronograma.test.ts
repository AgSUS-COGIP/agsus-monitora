import { describe, expect, it } from "vitest";
import {
  analisarCronograma,
  type EtapaDoCronograma,
} from "../src/lib/cronograma/cronograma-do-edital.ts";
import {
  avisosDeSequencia,
  comSequencia,
  marcarEtapas,
} from "../src/lib/cronograma/sequencia-do-cronograma.ts";

/*
  A sequência entre etapas dependentes (src/lib/cronograma/sequencia-do-cronograma.ts).
  Caso da conferência de 17/11/2026: no 120/2026 o recurso das entrevistas
  (etapa 11) vai de 14/01 a 25/02/2027, depois do resultado final (21/01).
*/

const e = (atividade: string, data_inicio: string, data_fim = data_inicio) => ({
  atividade,
  data_inicio,
  data_fim,
});

const DO_120 = [
  e("Publicação do Edital", "2026-10-21"),
  e("Impugnação do Edital", "2026-11-14", "2026-11-16"),
  e(
    "Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos",
    "2026-11-19",
    "2026-11-23",
  ),
  e("Publicação da Lista Geral de Classificação Provisória", "2026-11-25"),
  e("Resultado Preliminar da Avaliação Documental e de Títulos", "2026-12-08"),
  e(
    "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos",
    "2026-12-09",
    "2026-12-10",
  ),
  e("Resultado Final da Avaliação Documental e de Títulos", "2026-12-17"),
  e("Convocação para a Entrevista", "2026-12-18"),
  e("Período de Entrevistas", "2027-01-05", "2027-01-11"),
  e("Resultado Preliminar das Entrevistas", "2027-01-13"),
  e(
    "Prazo para recursos referentes ao resultado preliminar das entrevistas",
    "2027-01-14",
    "2027-02-25",
  ),
  e("Resultado final da Entrevista", "2027-01-21"),
  e("Resultado final do Processo Seletivo", "2027-01-21"),
];

describe("sequência do cronograma", () => {
  it("120/2026: o recurso das entrevistas termina depois do resultado final", () => {
    expect(avisosDeSequencia(DO_120)).toEqual([
      "A etapa 11 (recurso) termina em 25/02/2027, depois da etapa 12 (resultado final, 21/01/2027).",
    ]);
  });

  it("corrigido, nenhum aviso", () => {
    const corrigido = DO_120.map((etapa, i) =>
      i === 10 ? { ...etapa, data_fim: "2027-01-15" } : etapa,
    );
    expect(avisosDeSequencia(corrigido)).toEqual([]);
  });

  it("recurso antes do preliminar e final antes do preliminar", () => {
    expect(
      avisosDeSequencia([
        e("Resultado Preliminar da Análise Curricular", "2026-08-10"),
        e(
          "Recurso contra o Resultado Preliminar da Análise Curricular",
          "2026-08-08",
          "2026-08-09",
        ),
        e("Resultado final da análise curricular", "2026-08-05"),
      ]),
    ).toEqual([
      "A etapa 3 (resultado final) vem em 05/08/2026, antes da etapa 1 (resultado preliminar, 10/08/2026).",
      "A etapa 2 (recurso) começa em 08/08/2026, antes da etapa 1 (resultado preliminar, 10/08/2026).",
      "A etapa 2 (recurso) termina em 09/08/2026, depois da etapa 3 (resultado final, 05/08/2026).",
    ]);
  });

  it("sem resultado final da fase, vale o do processo seletivo", () => {
    expect(
      avisosDeSequencia([
        e("Resultado Preliminar da Entrevista", "2026-09-01"),
        e(
          "Análise e resposta aos recursos — entrevistas",
          "2026-09-02",
          "2026-09-20",
        ),
        e("Divulgação do resultado final do Processo Seletivo", "2026-09-15"),
      ]),
    ).toEqual([
      "A etapa 2 (análise dos recursos) termina em 20/09/2026, depois da etapa 3 (resultado final, 15/09/2026).",
    ]);
  });

  it("preliminar com abertura do prazo de recurso conta como preliminar", () => {
    const [etapa] = marcarEtapas([
      e(
        "Resultado preliminar da análise curricular e abertura do prazo de recurso",
        "2026-07-01",
      ),
    ]);
    expect(etapa).toMatchObject({ papel: "preliminar", fase: "documental" });
  });

  it("a fase é a da primeira palavra-chave; títulos sozinho é fase própria", () => {
    expect(
      marcarEtapas([
        e(
          "Resultado Final da Avaliação Curricular e convocação para a Entrevista",
          "2025-07-25",
        ),
        e(
          "Resultado Preliminar da Avaliação Documental e de Títulos",
          "2026-12-08",
        ),
        e(
          "Divulgação do edital de resultado provisório na avaliação de títulos",
          "2027-01-12",
        ),
      ]).map(({ fase, papel }) => [fase, papel]),
    ).toEqual([
      ["documental", "final"],
      ["documental", "preliminar"],
      ["titulos", "preliminar"],
    ]);
    // O recurso dos títulos se mede pelo resultado final dos títulos, não pelo da documental.
    expect(
      avisosDeSequencia([
        e(
          "Divulgação do edital de resultado final na análise documental",
          "2026-12-29",
        ),
        e(
          "Divulgação do edital de resultado provisório na avaliação de títulos",
          "2027-01-12",
        ),
        e(
          "Prazo para a interposição de recursos contra o resultado provisório na avaliação de títulos",
          "2027-01-13",
          "2027-01-14",
        ),
        e(
          "Divulgação do edital de resultado final na avaliação de títulos e de resultado final no processo seletivo",
          "2027-01-26",
        ),
      ]),
    ).toEqual([]);
  });

  it("etapa sem data ou fora do padrão não entra", () => {
    expect(
      marcarEtapas([
        e("Análise Curricular", "2026-07-01"),
        { atividade: "Resultado final da Entrevista", data_inicio: "" },
      ]),
    ).toEqual([]);
  });

  it("comSequencia soma os avisos à análise do formulário, sem repetir", () => {
    const edital = { edital: "120/2026", unidade: "DSEI Fictício" };
    const etapas: EtapaDoCronograma[] = DO_120.map((etapa, i) => ({
      ...etapa,
      ordem: i + 1,
      origem: "MANUAL",
      observacao: "",
      concluida: null,
      confianca_extracao: null,
    }));
    const base = analisarCronograma(edital, etapas, "Errata");
    expect(base.avisos.join(" ")).not.toContain("etapa 11 (recurso)");
    const analise = comSequencia(base, etapas);
    expect(analise.erros).toEqual(base.erros);
    expect(analise.avisos).toContain(
      "A etapa 11 (recurso) termina em 25/02/2027, depois da etapa 12 (resultado final, 21/01/2027).",
    );
    expect(comSequencia(analise, etapas).avisos).toEqual(analise.avisos);
  });
});
