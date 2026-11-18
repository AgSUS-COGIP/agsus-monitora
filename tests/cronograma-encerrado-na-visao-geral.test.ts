import { describe, expect, it } from "vitest";
import { faseDoEdital } from "../src/lib/visao-geral/fases-do-processo.ts";
import {
  ehConcluido,
  temResultado,
} from "../src/lib/visao-geral/indicadores-do-monitoramento.ts";
import {
  andamentoPorFase,
  csvDaVisaoGeral,
  enriquecerLinhas,
  filtrosVazios,
  opcoesDosFiltros,
  prazoDoEdital,
  statusDaVisaoGeral,
  urgenciaDoCronograma,
} from "../src/lib/visao-geral/visao-geral.ts";

/*
  Item 3 da conferência de 17/11/2026: o status "Concluído" que a Visão geral
  recebe é o calculado pelas datas. Com o cálculo automático, ele só diz que a
  última data do cronograma passou, não que o resultado saiu nem que o
  processo foi homologado (em 17/11, 52 editais gravados "Em andamento"
  calculavam "Concluído"). A Visão geral mostra "Cronograma encerrado" no
  status, na fase, nos filtros, no CSV e nos contadores; o "Concluído" digitado
  à mão (cálculo manual) continua "Concluído". As regras que dependem do fim
  (pós-resultado, ociosas) seguem valendo.
*/

const HOJE = "2026-11-18";

const AUTOMATICO = {
  id: "a",
  edital: "42/2026",
  unidade: "DSEI Fictício A",
  status: "Concluído",
  etapa: "Resultado final do Processo Seletivo",
  cronograma_automatico: true,
  vagas_total: 10,
  contratados: 2,
  data_fim: "2026-07-31",
};
const MANUAL = {
  ...AUTOMATICO,
  id: "m",
  edital: "13/2025",
  cronograma_automatico: false,
};
const ABERTO = {
  id: "b",
  edital: "120/2026",
  unidade: "DSEI Fictício B",
  status: "Em andamento",
  etapa: "Entrevistas",
  cronograma_automatico: true,
  data_fim: "2027-01-21",
};

describe("cronograma encerrado não é processo concluído", () => {
  it("status: automático vira 'Cronograma encerrado'; o digitado à mão fica", () => {
    expect(statusDaVisaoGeral(AUTOMATICO)).toBe("Cronograma encerrado");
    expect(statusDaVisaoGeral(MANUAL)).toBe("Concluído");
    expect(statusDaVisaoGeral(ABERTO)).toBe("Em andamento");
    expect(statusDaVisaoGeral({ status: "Cancelado" })).toBe("Cancelado");
  });

  it("linhas enriquecidas: status e fase dizem 'Cronograma encerrado'", () => {
    const [auto, manual, aberto] = enriquecerLinhas(
      [AUTOMATICO, MANUAL, ABERTO],
      { hoje: HOJE },
    );
    expect([auto?.status, auto?.fase]).toEqual([
      "Cronograma encerrado",
      "Cronograma encerrado",
    ]);
    expect([manual?.status, manual?.fase]).toEqual(["Concluído", "Concluído"]);
    expect(aberto?.status).toBe("Em andamento");
    // O fim do cronograma continua contando (pós-resultado e ociosas).
    expect(ehConcluido(auto)).toBe(true);
    expect(temResultado(auto ?? {})).toBe(true);
  });

  it("filtros, CSV e o bloco de fases usam o mesmo texto", () => {
    const linhas = enriquecerLinhas([AUTOMATICO, MANUAL, ABERTO], {
      hoje: HOJE,
    });
    const opcoes = opcoesDosFiltros(linhas, filtrosVazios());
    expect(opcoes.status).toEqual([
      "Em andamento",
      "Cronograma encerrado",
      "Concluído",
    ]);
    expect(opcoes.fase).toContain("Cronograma encerrado");
    expect(csvDaVisaoGeral(linhas)).toContain('"Cronograma encerrado"');
    expect(andamentoPorFase(linhas)).toMatchObject({
      encerrados: 1,
      concluidos: 1,
      cancelados: 0,
    });
  });

  it("prazo e selo: 'Cronograma encerrado', ou 'Processo concluído' só no manual", () => {
    expect(prazoDoEdital(AUTOMATICO, HOJE)?.rotulo).toBe(
      "Cronograma encerrado",
    );
    expect(prazoDoEdital(MANUAL, HOJE)?.rotulo).toBe("Processo concluído");
    expect(urgenciaDoCronograma(AUTOMATICO, HOJE)).toEqual({
      tom: "done",
      rotulo: "Cronograma encerrado",
    });
  });

  it("a fase reconhece o status já trocado", () => {
    expect(faseDoEdital({ status: "Cronograma encerrado" })).toBe(
      "Cronograma encerrado",
    );
  });
});
