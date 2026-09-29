import { describe, expect, it } from "vitest";
import {
  AVISO_PRAZO_PELA_ABERTURA,
  AVISO_SEM_PRAZO,
  classificarCronograma,
  cronogramasPorEdital,
  normalizarAtividade,
  origemDaAtividade,
  papelDaAtividade,
  prazoDoRecurso,
} from "../src/lib/prazo-do-recurso.js";

/*
  O prazo de resposta do recurso sai do cronograma do edital, cujas atividades
  são texto livre. Os nomes abaixo são reais (TB_CRONOGRAMA_MONIT_INDIG, 29/09/2026).
*/

describe("classificação de cada atividade", () => {
  it.each([
    [
      "Prazo de recurso do resultado preliminar documental",
      "analise-curricular",
      "abertura",
    ],
    ["Prazo para recursos das entrevistas", "entrevista", "abertura"],
    [
      "Resultado preliminar da análise curricular e abertura do prazo de recurso",
      "analise-curricular",
      "abertura",
    ],
    [
      "Resultado preliminar do Avaliação de Conhecimentos e abertura do prazo para recurso",
      "avaliacao-conhecimentos",
      "abertura",
    ],
    [
      "Análise e resposta ao recurso da Avaliação de Conhecimento",
      "avaliacao-conhecimentos",
      "resposta",
    ],
    [
      "Prazo para recursos referentes ao resultado preliminar das entrevistas",
      "entrevista",
      "abertura",
    ],
    [
      "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos",
      "analise-curricular",
      "abertura",
    ],
    [
      "Abertura do Prazo de Recurso Curricular",
      "analise-curricular",
      "abertura",
    ],
    [
      "Resposta aos Recursos e Resultado Final das Entrevistas",
      "entrevista",
      "resposta",
    ],
    ["Abertura do Prazo de Recurso Entrevista", "entrevista", "abertura"],
    [
      "Recurso contra o resultado preliminar das Entrevistas",
      "entrevista",
      "abertura",
    ],
    [
      "Divulgação da resposta aos recursos e Publicação do Resultado Definitivo da Avaliação de Títulos",
      "analise-curricular",
      "resposta",
    ],
    [
      "Recurso contra o Resultado Preliminar da Análise Curricular",
      "analise-curricular",
      "abertura",
    ],
    [
      "Recebimento dos recursos contra o resultado preliminar Entrevista para os candidatos negros, indígenas e quilombolas ",
      "entrevista",
      "abertura",
    ],
    [
      "Submissão de recursos relativos à análise documental",
      "analise-curricular",
      "abertura",
    ],
    [
      "Prazo  para  a  interposição  de  recursos  quanto  às  questões  formuladas  e(ou)  aos  gabaritos  oficiais  preliminares",
      "avaliacao-conhecimentos",
      "abertura",
    ],
  ])("%s → %s / %s", (atividade, origem, papel) => {
    expect(origemDaAtividade(atividade)).toBe(origem);
    expect(papelDaAtividade(atividade)).toBe(papel);
  });

  it("atividade sem etapa citada não tem origem própria", () => {
    for (const atividade of [
      "Análise e resposta ao recurso ",
      "Envio de Resposta aos Recursos",
      "Prazo de recursos",
      "Análise e resposta aos recursos interpostos",
    ]) {
      expect(origemDaAtividade(atividade)).toBeNull();
      expect(papelDaAtividade(atividade)).not.toBeNull();
    }
  });

  it("atividade que não é de recurso não tem papel", () => {
    expect(papelDaAtividade("Resultado final do Processo Seletivo")).toBeNull();
    expect(
      papelDaAtividade("Solicitação pelo candidato do espelho de nota"),
    ).toBeNull();
    expect(origemDaAtividade("Resultado final do Processo Seletivo")).toBe(
      "resultado-final",
    );
  });

  it("o que vem depois de “e convocação” fala da etapa seguinte", () => {
    expect(
      origemDaAtividade(
        "Resultado final da análise curricular e convocação para a Avaliação de Conhecimentos",
      ),
    ).toBe("analise-curricular");
  });

  it("normaliza acento, caixa e espaços", () => {
    expect(normalizarAtividade("  Análise  e RESPOSTA — ao Recurso ")).toBe(
      "analise e resposta ao recurso",
    );
  });
});

/* Cronograma real (edital de Projetos com análise curricular e avaliação de conhecimentos). */
const CRONOGRAMA = [
  {
    ordem: 1,
    atividade: "Publicação do Edital",
    inicio: "2025-09-24",
    fim: "2025-09-24",
  },
  {
    ordem: 4,
    atividade: "Análise curricular ",
    inicio: "2025-10-08",
    fim: "2025-10-14",
  },
  {
    ordem: 5,
    atividade:
      "Resultado preliminar da análise curricular e abertura do prazo de recurso",
    inicio: "2025-10-15",
    fim: "2025-10-15",
  },
  {
    ordem: 6,
    atividade: "Análise e resposta ao recurso ",
    inicio: "2025-10-16",
    fim: "2025-10-17",
  },
  {
    ordem: 7,
    atividade:
      "Resultado final da análise curricular e convocação para a Avaliação de Conhecimentos",
    inicio: "2025-10-20",
    fim: "2025-10-20",
  },
  {
    ordem: 9,
    atividade:
      "Resultado preliminar do Avaliação de Conhecimentos e abertura do prazo para recurso",
    inicio: "2025-10-23",
    fim: "2025-10-23",
  },
  {
    ordem: 10,
    atividade: "Análise e resposta ao recurso da Avaliação de Conhecimento",
    inicio: "2025-10-24",
    fim: "2025-10-27",
  },
  {
    ordem: 11,
    atividade: "Divulgação do resultado final do Processo Seletivo",
    inicio: "2025-10-28",
    fim: "2025-10-28",
  },
];

/* Cronograma típico da Saúde Indígena: só o prazo de recurso, sem a resposta. */
const CRONOGRAMA_SI = [
  {
    ordem: 3,
    atividade: "Resultado Preliminar da Avaliação Documental e de Títulos",
    inicio: "2026-05-04",
    fim: "2026-05-04",
  },
  {
    ordem: 4,
    atividade: "Prazo de recurso do resultado preliminar documental",
    inicio: "2026-05-05",
    fim: "2026-05-06",
  },
  {
    ordem: 5,
    atividade: "Resultado Final da Avaliação Documental e de Títulos",
    inicio: "2026-05-08",
    fim: "2026-05-08",
  },
  {
    ordem: 7,
    atividade: "Resultado Preliminar das Entrevistas",
    inicio: "2026-05-15",
    fim: "2026-05-15",
  },
  {
    ordem: 8,
    atividade: "Prazo para recursos das entrevistas",
    inicio: "2026-05-18",
    fim: "2026-05-19",
  },
  {
    ordem: 9,
    atividade: "Resultado final do Processo Seletivo",
    inicio: "2026-05-22",
    fim: null,
  },
];

describe("contexto: recurso sem etapa herda a da atividade anterior", () => {
  it("“Análise e resposta ao recurso” depois do resultado da análise curricular é dela", () => {
    const classificadas = classificarCronograma(CRONOGRAMA);
    expect(classificadas.find((e) => e.ordem === 6)).toMatchObject({
      origem: "analise-curricular",
      papel: "resposta",
    });
  });

  it("a ordem do cronograma vale, mesmo que a lista chegue embaralhada", () => {
    const embaralhado = [...CRONOGRAMA].reverse();
    expect(prazoDoRecurso(embaralhado, "analise-curricular").data).toBe(
      "2025-10-17",
    );
  });
});

describe("prazo por origem", () => {
  it("usa o fim da atividade de resposta daquela origem", () => {
    expect(prazoDoRecurso(CRONOGRAMA, "analise-curricular")).toEqual({
      data: "2025-10-17",
      fonte: "resposta",
      atividade: "Análise e resposta ao recurso",
      aviso: "",
    });
    expect(prazoDoRecurso(CRONOGRAMA, "avaliacao-conhecimentos").data).toBe(
      "2025-10-27",
    );
  });

  it("sem resposta no cronograma, usa o fim do prazo de recurso, com aviso", () => {
    expect(prazoDoRecurso(CRONOGRAMA_SI, "analise-curricular")).toEqual({
      data: "2026-05-06",
      fonte: "abertura",
      atividade: "Prazo de recurso do resultado preliminar documental",
      aviso: AVISO_PRAZO_PELA_ABERTURA,
    });
    expect(prazoDoRecurso(CRONOGRAMA_SI, "entrevista").data).toBe("2026-05-19");
  });

  it("origem sem atividade de recurso: prazo não encontrado", () => {
    expect(prazoDoRecurso(CRONOGRAMA_SI, "resultado-final")).toEqual({
      data: null,
      fonte: null,
      atividade: "",
      aviso: AVISO_SEM_PRAZO,
    });
    expect(prazoDoRecurso([], "entrevista").data).toBeNull();
    expect(prazoDoRecurso(null, "entrevista").data).toBeNull();
  });

  it("duas respostas (errata): vale a de fim mais tardio; sem fim, o início", () => {
    const etapas = [
      {
        ordem: 1,
        atividade: "Prazo para recursos das entrevistas",
        inicio: "2026-01-02",
        fim: "2026-01-03",
      },
      {
        ordem: 2,
        atividade: "Resposta aos Recursos e Resultado Final das Entrevistas",
        inicio: "2026-01-06",
        fim: "2026-01-07",
      },
      {
        ordem: 3,
        atividade: "Resposta aos Recursos e Resultado Final das Entrevistas",
        inicio: "2026-01-10",
        fim: null,
      },
    ];
    expect(prazoDoRecurso(etapas, "entrevista").data).toBe("2026-01-10");
  });
});

describe("agrupamento do payload", () => {
  it("agrupa as etapas por edital e ignora linha sem edital", () => {
    const mapa = cronogramasPorEdital([
      { edital_id: "a", ordem: 1 },
      { edital_id: "b", ordem: 1 },
      { edital_id: "a", ordem: 2 },
      { ordem: 3 },
    ]);
    expect([...mapa.keys()]).toEqual(["a", "b"]);
    expect(mapa.get("a")).toHaveLength(2);
  });
});
