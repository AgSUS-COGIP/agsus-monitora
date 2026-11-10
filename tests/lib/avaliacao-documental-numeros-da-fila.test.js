import { describe, expect, it } from "vitest";
import {
  aptasDaFila,
  concluidasHoje,
  ritmoDaFila,
} from "../../src/lib/avaliacao-documental/numeros-da-fila.ts";
import { porcentagemDe } from "../../src/ui/faixa-de-situacao.tsx";
import {
  acoesDaFicha,
  acoesDaSelecao,
  filtrosDaFilaEmUso,
  FILTRO_INICIAL,
} from "../../src/lib/avaliacao-documental/fila.ts";

/*
  Os números da faixa de situação da Fila (numeros-da-fila.ts) e as ações
  do "⋯" de cada linha (a mesma regra das ações em lote, em fila.ts).
*/

const ficha = (situacao, extra = {}) => ({
  ficha: { id: `f-${situacao}`, situacao, ...extra },
});

describe("números dos cards da Fila", () => {
  it("concluídas hoje contam pelo dia de Brasília", () => {
    // 05/11 às 01:30 UTC ainda é 04/11 em Brasília.
    const agora = new Date("2026-11-05T15:00:00Z");
    const lista = [
      ficha("CONCLUIDA", { concluida_em: "2026-11-05T12:00:00Z" }),
      ficha("CONCLUIDA", { concluida_em: "2026-11-05T01:30:00Z" }),
      ficha("CONCLUIDA", { concluida_em: null }),
      ficha("EM_ANALISE", { concluida_em: "2026-11-05T12:00:00Z" }),
      { ficha: null },
    ];
    expect(concluidasHoje(lista, agora)).toBe(1);
    expect(concluidasHoje(null, agora)).toBe(0);
  });

  it("as aptas: só as concluídas com resultado Apto", () => {
    const lista = [
      ficha("CONCLUIDA", { resultado: "APTO" }),
      ficha("CONCLUIDA", { resultado: "INAPTO_NOTA" }),
      ficha("EM_ANALISE", { resultado: "APTO" }),
      { ficha: null },
    ];
    expect(aptasDaFila(lista)).toBe(1);
    expect(aptasDaFila(null)).toBe(0);
  });

  it("percentual com uma casa, para baixo; 100% só com tudo feito; sem total, vazio", () => {
    expect(porcentagemDe(1, 3)).toBe("33,3%");
    expect(porcentagemDe(1999, 2000)).toBe("99,9%");
    expect(porcentagemDe(1, 4)).toBe("25%");
    expect(porcentagemDe(200, 200)).toBe("100%");
    expect(porcentagemDe(0, 0)).toBe("");
  });

  const retrato = (cronograma) => ({
    editais: [
      {
        id: "e93",
        edital: "93/2026",
        situacoes: { pendente: 20, em_analise: 0, revisar: 0, concluida: 10 },
        por_dia: [{ dia: "2026-11-04", qt: 4 }],
        qt_equipe: 2,
        cronograma,
      },
    ],
  });
  const ANALISE = [
    {
      ordem: 1,
      atividade: "Análise documental",
      inicio: "2026-11-01",
      fim: "2026-11-06",
    },
  ];

  it("a meta do dia é a do Painel das análises: o que falta pelos dias úteis até o prazo", () => {
    // Quarta, 04/11: quarta, quinta e sexta até o prazo → (20 + 4) / 3.
    expect(
      ritmoDaFila(retrato(ANALISE), "e93", {
        hoje: "2026-11-04",
        hora: 10,
        minuto: 0,
      }),
    ).toEqual({
      meta: 8,
      feito: 4,
      selo: { rotulo: "No ritmo hoje", tom: "aprovado" },
    });
  });

  it("sem o edital: nada; sem prazo no cronograma ou fora de dia útil: sem meta", () => {
    const quarta = { hoje: "2026-11-04", hora: 10, minuto: 0 };
    expect(ritmoDaFila(retrato(ANALISE), "outro", quarta)).toBeNull();
    expect(ritmoDaFila(null, "e93", quarta)).toBeNull();
    expect(ritmoDaFila(retrato([]), "e93", quarta)?.meta).toBeNull();
    const sabado = ritmoDaFila(retrato(ANALISE), "e93", {
      hoje: "2026-11-07",
      hora: 10,
      minuto: 0,
    });
    expect(sabado?.meta).toBeNull();
    expect(sabado?.selo.rotulo).toBe("Hoje não é dia útil");
  });
});

describe("ações do ⋯ de uma linha da Fila", () => {
  const agora = new Date("2026-11-05T12:00:00Z");
  const reserva = {
    usuario: "u-beto",
    desde: "2026-11-05T11:55:00Z",
    expira: "2026-11-05T12:10:00Z",
  };

  it("a mesma regra das ações em lote, na ordem do menu", () => {
    const linhas = [
      { id: "1", ...ficha("PENDENTE") },
      { id: "2", ...ficha("EM_ANALISE", { reserva }) },
      { id: "3", ...ficha("CONCLUIDA") },
      { id: "4", ...ficha("FORA_LOTE") },
      { id: "5", ficha: null },
    ];
    expect(linhas.map((c) => acoesDaFicha(c, agora))).toEqual([
      ["distribuir", "revisao"],
      ["distribuir", "liberar", "revisao"],
      // Concluída: só reabrir (AM-6.3: reaberta, aí aceita Atribuir a…).
      ["reabrir"],
      [],
      [],
    ]);
    // Uma linha é a seleção de uma: o mesmo resultado das ações em lote.
    for (const c of linhas) {
      const lote = acoesDaSelecao([c], agora);
      expect(
        ["distribuir", "liberar", "revisao", "reabrir"].filter((a) =>
          lote[a].includes(c),
        ),
      ).toEqual(acoesDaFicha(c, agora));
    }
  });

  it("filtros em uso: vaga, responsável, modalidade e busca (a etapa não conta)", () => {
    expect(filtrosDaFilaEmUso(FILTRO_INICIAL)).toBe(0);
    expect(
      filtrosDaFilaEmUso({
        ...FILTRO_INICIAL,
        etapa: "concluidas",
        busca: "  ",
      }),
    ).toBe(0);
    expect(
      filtrosDaFilaEmUso({
        etapa: "lote",
        vaga: "1",
        responsavel: "eu",
        modalidade: "AC",
        busca: "ana",
      }),
    ).toBe(4);
  });
});
