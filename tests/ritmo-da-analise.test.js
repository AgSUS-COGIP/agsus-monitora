import { describe, expect, it } from "vitest";
import {
  agoraEmBrasilia,
  calcularRitmo,
  diasUteisAtePrazo,
  diaUtilDepois,
  ehDiaUtil,
  etapaDaAnalise,
  lerRitmoDaAnalise,
  nomeCurtoDaEtapa,
  ritmosDaArea,
  textoDoPrazo,
  textoDoRitmo,
} from "../src/lib/ritmo-da-analise.ts";

/* O cronograma real do 114/2026 (resumido nas etapas que importam). */
const CRONOGRAMA_114 = [
  {
    ordem: 3,
    atividade: "Período de Inscrições",
    tipo: null,
    inicio: "2026-10-05",
    fim: "2026-10-14",
  },
  {
    ordem: 4,
    atividade:
      "Validação das inscrições, por meio da verificação da documentação obrigatória / Análise do processo de Heteroidentificação",
    tipo: null,
    inicio: "2026-10-15",
    fim: "2026-10-22",
  },
  {
    ordem: 5,
    atividade:
      "Divulgação do resultado preliminar da validação da documentação obrigatória e da heteroidentificação e abertura do prazo para interposição de recurso",
    tipo: null,
    inicio: "2026-10-26",
    fim: "2026-10-26",
  },
  {
    ordem: 7,
    atividade:
      "Envio do espelho da análise de títulos e experiência profissional",
    tipo: null,
    inicio: "2026-10-28",
    fim: "2026-10-30",
  },
  {
    ordem: 8,
    atividade: "Submissão de recursos relativos à análise documental",
    tipo: null,
    inicio: "2026-11-03",
    fim: "2026-11-04",
  },
];

const edital = (mudancas = {}) => ({
  id: "bcecfb08",
  edital: "114/2026",
  situacoes: {
    pendente: 1086,
    em_analise: 12,
    revisar: 0,
    concluida: 414,
    fora_lote: 448,
  },
  porDia: [
    { dia: "2026-10-16", qt: 266 },
    { dia: "2026-10-19", qt: 148 },
  ],
  qtEquipe: 9,
  qtAvaliadoresRecentes: 7,
  cronograma: CRONOGRAMA_114,
  ...mudancas,
});

const SEGUNDA_MEIO_DIA = { hoje: "2026-10-19", hora: 12 };

describe("dias úteis", () => {
  it("segunda a sexta, sem fim de semana nem feriado nacional fixo", () => {
    expect(ehDiaUtil("2026-10-16")).toBe(true); // sexta
    expect(ehDiaUtil("2026-10-17")).toBe(false); // sábado
    expect(ehDiaUtil("2026-10-18")).toBe(false); // domingo
    expect(ehDiaUtil("2026-10-12")).toBe(false); // feriado (segunda)
    expect(ehDiaUtil("2026-11-02")).toBe(false); // Finados
  });

  it("hoje conta até o fim do expediente (18h)", () => {
    expect(diasUteisAtePrazo(SEGUNDA_MEIO_DIA, "2026-10-22")).toBe(4);
    expect(
      diasUteisAtePrazo({ hoje: "2026-10-19", hora: 18 }, "2026-10-22"),
    ).toBe(3);
  });

  it("no fim de semana, começa na segunda", () => {
    expect(
      diasUteisAtePrazo({ hoje: "2026-10-17", hora: 10 }, "2026-10-22"),
    ).toBe(4);
    expect(diaUtilDepois("2026-10-16", 1)).toBe("2026-10-19");
  });

  it("hoje e hora em Brasília", () => {
    expect(agoraEmBrasilia(new Date("2026-10-19T15:00:00Z"))).toEqual(
      SEGUNDA_MEIO_DIA,
    );
    expect(agoraEmBrasilia(new Date("2026-10-20T02:30:00Z"))).toEqual({
      hoje: "2026-10-19",
      hora: 23,
    });
  });
});

describe("etapa da análise no cronograma", () => {
  it("acha a validação da documentação do 114, não a divulgação nem os recursos", () => {
    expect(etapaDaAnalise(CRONOGRAMA_114, "2026-10-19")?.ordem).toBe(4);
    expect(nomeCurtoDaEtapa(CRONOGRAMA_114[1].atividade)).toBe(
      "Validação da documentação",
    );
  });

  it("com o prazo passado, fica a última que casou", () => {
    expect(etapaDaAnalise(CRONOGRAMA_114, "2026-10-27")?.ordem).toBe(4);
  });

  it("análise curricular e o tipo da atividade, quando houver", () => {
    const cronograma = [
      {
        ordem: 1,
        atividade: "Período de Análise Curricular",
        tipo: null,
        inicio: "2026-09-30",
        fim: "2026-10-08",
      },
      {
        ordem: 2,
        atividade: "Resultado preliminar da análise curricular",
        tipo: null,
        inicio: "2026-10-09",
        fim: "2026-10-09",
      },
      {
        ordem: 3,
        atividade: "Etapa X",
        tipo: "analise_documental",
        inicio: "2026-10-10",
        fim: "2026-10-20",
      },
    ];
    expect(etapaDaAnalise(cronograma.slice(0, 2), "2026-10-01")?.ordem).toBe(1);
    expect(etapaDaAnalise(cronograma, "2026-10-01")?.ordem).toBe(3);
  });

  it("sem cronograma ou sem etapa que case: nada", () => {
    expect(etapaDaAnalise([], "2026-10-19")).toBeNull();
    expect(etapaDaAnalise([CRONOGRAMA_114[0]], "2026-10-19")).toBeNull();
  });
});

describe("calcularRitmo", () => {
  it("o 114 em 19/10 ao meio-dia: ≈275 por dia, ≈31 por avaliador, um dia útil depois do prazo", () => {
    const r = calcularRitmo(edital(), SEGUNDA_MEIO_DIA);
    expect(r).toMatchObject({
      faltam: 1098,
      concluidas: 414,
      percentual: 27,
      diasRestantes: 4,
      porDia: 275,
      avaliadores: 9,
      avaliadoresDaEquipe: true,
      porAvaliador: 31,
      ritmo: 266,
      diasDoRitmo: 1,
      concluidasHoje: 148,
      termino: "2026-10-23",
      diasDeAtraso: 1,
      situacao: "abaixo",
    });
    expect(textoDoPrazo(r)).toBe("Prazo: 22/10 · Validação da documentação");
    expect(textoDoRitmo(r)).toBe(
      "No ritmo atual (≈266 por dia), termina por volta de 23/10, um dia útil depois do prazo de 22/10.",
    );
  });

  it("ritmo suficiente: no ritmo, antes do prazo", () => {
    const r = calcularRitmo(
      edital({
        porDia: [
          { dia: "2026-10-15", qt: 380 },
          { dia: "2026-10-16", qt: 400 },
        ],
      }),
      SEGUNDA_MEIO_DIA,
    );
    expect(r.ritmo).toBe(390);
    expect(r.situacao).toBe("no-ritmo");
    expect(textoDoRitmo(r)).toContain("antes do prazo de 22/10");
  });

  it("média dos últimos 3 dias com análise; hoje entra depois do expediente", () => {
    const porDia = [
      { dia: "2026-10-13", qt: 10 },
      { dia: "2026-10-14", qt: 100 },
      { dia: "2026-10-15", qt: 200 },
      { dia: "2026-10-16", qt: 300 },
      { dia: "2026-10-19", qt: 400 },
    ];
    expect(calcularRitmo(edital({ porDia }), SEGUNDA_MEIO_DIA).ritmo).toBe(200);
    expect(
      calcularRitmo(edital({ porDia }), { hoje: "2026-10-19", hora: 19 }).ritmo,
    ).toBe(300);
  });

  it("prazo passado: vencido, sem necessárias por dia", () => {
    const r = calcularRitmo(edital(), { hoje: "2026-10-26", hora: 9 });
    expect(r.situacao).toBe("vencido");
    expect(r.porDia).toBeNull();
    expect(r.porAvaliador).toBeNull();
    expect(textoDoRitmo(r)).toContain("o prazo era 22/10");
  });

  it("concluído", () => {
    const r = calcularRitmo(
      edital({
        situacoes: {
          pendente: 0,
          em_analise: 0,
          revisar: 0,
          concluida: 1500,
          fora_lote: 448,
        },
      }),
      SEGUNDA_MEIO_DIA,
    );
    expect(r).toMatchObject({
      situacao: "concluido",
      percentual: 100,
      faltam: 0,
      porDia: null,
      termino: null,
    });
  });

  it("sem cronograma: sem prazo e sem inventar data", () => {
    const r = calcularRitmo(edital({ cronograma: [] }), SEGUNDA_MEIO_DIA);
    expect(r).toMatchObject({
      situacao: "sem-prazo",
      etapa: null,
      porDia: null,
    });
    expect(textoDoPrazo(r)).toBe("Sem etapa de análise no cronograma");
    expect(textoDoRitmo(r)).toBe(
      "No ritmo atual (≈266 por dia), termina por volta de 23/10.",
    );
  });

  it("sem histórico: sem ritmo e sem projeção", () => {
    const r = calcularRitmo(
      edital({ porDia: [{ dia: "2026-10-19", qt: 20 }] }),
      SEGUNDA_MEIO_DIA,
    );
    expect(r).toMatchObject({
      situacao: "sem-historico",
      ritmo: null,
      termino: null,
      porDia: 275,
    });
    expect(textoDoRitmo(r)).toBe("Sem dias com análise para medir o ritmo.");
  });

  it("por avaliador: a equipe; sem equipe, quem concluiu nos últimos 7 dias; sem ninguém, nada", () => {
    expect(
      calcularRitmo(edital({ qtEquipe: 0 }), SEGUNDA_MEIO_DIA),
    ).toMatchObject({
      avaliadores: 7,
      avaliadoresDaEquipe: false,
      porAvaliador: 40,
    });
    expect(
      calcularRitmo(
        edital({ qtEquipe: 0, qtAvaliadoresRecentes: 0 }),
        SEGUNDA_MEIO_DIA,
      ).porAvaliador,
    ).toBeNull();
  });
});

describe("leitura e editais do card", () => {
  it("lê o retrato da RPC e descarta o malformado", () => {
    const [e] = lerRitmoDaAnalise([
      {
        editais: [
          {
            id: "x",
            edital: "114/2026",
            situacoes: { pendente: "3", concluida: 2 },
            por_dia: [
              { dia: "2026-10-16", qt: 2 },
              { dia: "lixo", qt: 1 },
            ],
            qt_equipe: 2,
            cronograma: [
              { ordem: 1, atividade: "Análise curricular", fim: "2026-10-22" },
            ],
          },
          { edital: "sem id" },
        ],
      },
    ]);
    expect(e).toMatchObject({
      id: "x",
      situacoes: { pendente: 3, em_analise: 0, concluida: 2 },
      qtEquipe: 2,
    });
    expect(e.porDia).toEqual([{ dia: "2026-10-16", qt: 2 }]);
    expect(lerRitmoDaAnalise(null)).toEqual([]);
    expect(lerRitmoDaAnalise({ editais: "x" })).toEqual([]);
  });

  it("edital sem nenhuma concluída e com o prazo vencido sai (análise feita fora do sistema)", () => {
    const fora = edital({
      id: "93",
      situacoes: {
        pendente: 93,
        em_analise: 3,
        revisar: 0,
        concluida: 0,
        fora_lote: 1,
      },
      porDia: [],
      cronograma: [
        {
          ordem: 4,
          atividade: "Período de Análise Curricular",
          tipo: null,
          inicio: "2026-09-30",
          fim: "2026-10-08",
        },
      ],
    });
    expect(
      ritmosDaArea([edital(), fora], SEGUNDA_MEIO_DIA).map((r) => r.id),
    ).toEqual(["bcecfb08"]);
  });
});
