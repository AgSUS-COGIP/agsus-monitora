import { describe, expect, it } from "vitest";
import {
  descricaoDoCronograma,
  prazoDoEdital,
  seloDoCronograma,
  temCronogramaCadastrado,
  urgenciaDoCronograma,
} from "../src/lib/visao-geral/visao-geral.ts";

/*
  Conferência de 17/11/2026: a Visão geral tratava "cálculo manual" como "sem
  etapas". O caso é o do 120/2026 (13 etapas, cálculo automático desligado,
  status "Suspenso" digitado), que aparecia como "Sem cronograma" e "Cronograma
  ainda não cadastrado". Com a migration 20261117190000, o banco devolve
  percentual e próxima etapa também no manual. E "Concluído" (status calculado
  pelas datas) não prova que o resultado saiu: o rótulo é "Cronograma
  encerrado".
*/

const HOJE = "2026-11-17";

// A linha do 120/2026 como listar_monitoramento_operacional a devolve depois da migration.
const MANUAL_SUSPENSO = {
  edital: "120/2026",
  status: "Suspenso",
  cronograma_automatico: false,
  cronograma_percentual: 15.4,
  cronograma_proxima_atividade: "Período de inscrição",
  cronograma_proxima_data: "2026-11-19",
  cronograma_dias_para_proxima: 2,
  cronograma_atividade_atual: undefined,
  data_inicio: "2026-10-21",
  data_fim: "2027-02-25",
};

describe("cálculo manual não é falta de etapas", () => {
  it("120/2026: cronograma cadastrado, cálculo manual, suspenso", () => {
    expect(temCronogramaCadastrado(MANUAL_SUSPENSO)).toBe(true);
    expect(descricaoDoCronograma(MANUAL_SUSPENSO)).toBe(
      "Cronograma cadastrado · cálculo manual · suspenso",
    );
    expect(urgenciaDoCronograma(MANUAL_SUSPENSO, HOJE)).toEqual({
      tom: "warning",
      rotulo: "Processo suspenso",
    });
    expect(seloDoCronograma(MANUAL_SUSPENSO, HOJE)?.rotulo).toBe(
      "Processo suspenso",
    );
  });

  it("suspenso não vira etapa atrasada quando o fim passa", () => {
    expect(
      urgenciaDoCronograma({ ...MANUAL_SUSPENSO, data_fim: "2026-11-01" }, HOJE)
        .rotulo,
    ).toBe("Processo suspenso");
  });

  it("manual em andamento com etapas segue a próxima etapa", () => {
    const linha = { ...MANUAL_SUSPENSO, status: "Em andamento" };
    expect(descricaoDoCronograma(linha)).toBe(
      "Cronograma cadastrado · cálculo manual",
    );
    expect(urgenciaDoCronograma(linha, HOJE)).toEqual({
      tom: "danger",
      rotulo: "Próxima etapa em 2 dia(s)",
    });
  });

  it("manual com etapas: qualquer um dos sinais basta", () => {
    const vazio = {
      cronograma_automatico: false,
      cronograma_percentual: 0,
      cronograma_proxima_data: undefined,
      cronograma_atividade_atual: undefined,
    };
    expect(temCronogramaCadastrado(vazio)).toBe(false);
    expect(
      temCronogramaCadastrado({ ...vazio, cronograma_percentual: 100 }),
    ).toBe(true);
    expect(
      temCronogramaCadastrado({
        ...vazio,
        cronograma_atividade_atual: "Entrevistas",
      }),
    ).toBe(true);
    expect(
      temCronogramaCadastrado({
        ...vazio,
        cronograma_proxima_data: "2026-12-01",
      }),
    ).toBe(true);
  });

  it("manual sem etapas continua sem cronograma", () => {
    const linha = {
      status: "Em andamento",
      cronograma_automatico: false,
      cronograma_percentual: 0,
      data_fim: "2026-12-31",
    };
    expect(descricaoDoCronograma(linha)).toBeNull();
    expect(seloDoCronograma(linha, HOJE)?.rotulo).toBe("Sem cronograma");
  });

  it("automático: cálculo automático na descrição", () => {
    expect(
      descricaoDoCronograma({
        status: "Em andamento",
        cronograma_automatico: true,
      }),
    ).toBe("Cronograma cadastrado · cálculo automático");
  });
});

describe("a data passar não prova o resultado", () => {
  it("concluído pelo cronograma diz 'Cronograma encerrado'", () => {
    expect(prazoDoEdital({ status: "Concluído" }, HOJE)?.rotulo).toBe(
      "Cronograma encerrado",
    );
    expect(urgenciaDoCronograma({ status: "Concluído" }, HOJE)).toEqual({
      tom: "done",
      rotulo: "Cronograma encerrado",
    });
  });
});
