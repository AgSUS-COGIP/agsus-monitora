import { describe, expect, it } from "vitest";
import {
  COLUNAS_DA_TABELA,
  COLUNAS_INICIAIS,
  csvDaVisaoGeral,
  duracaoEmDias,
  enriquecerLinhas,
  valorParaOrdenar,
} from "../src/lib/visao-geral.ts";
import type {
  Acompanhamento,
  ListaDoAcompanhamento,
} from "../src/modulos/visao-geral/tipos.ts";

/*
  O RESULTADO DE CADA EDITAL NA VISÃO GERAL (pedido de 13/11/2026)

  A diretoria pediu, por processo seletivo: quanto tempo levou, quantas pessoas
  se inscreveram, quantas passaram, quantas foram contratadas e quantas ficaram
  em cadastro reserva. Inscritos, contratados e as datas já estavam na linha;
  aprovados e cadastro reserva vêm da lista de aprovados vigente (aprovados =
  pessoas da lista; cadastro reserva = as que ainda não têm status). Dados
  fictícios.
*/

function acompanhamento(listas: ListaDoAcompanhamento[]): Acompanhamento {
  return {
    etapasPorEdital: new Map(),
    listasPorEdital: new Map(
      listas.map((l) => [String(l.monitoramento_id), l]),
    ),
  };
}

const concluido = {
  id: "e1",
  edital: "80/2025",
  unidade: "DSEI Exemplo",
  status: "Concluído",
  data_inicio: "2025-10-27",
  data_fim: "2025-12-08",
  inscritos: 5179,
  contratados: 42,
};

describe("duração do edital", () => {
  it("dias corridos do início ao encerramento", () => {
    expect(duracaoEmDias(concluido)).toBe(42);
    expect(
      duracaoEmDias({ data_inicio: "2025-02-28", data_fim: "2025-03-01" }),
    ).toBe(1);
  });

  it("sem uma das datas, ou com o fim antes do início, não há duração", () => {
    expect(duracaoEmDias({ data_inicio: "2025-10-27" })).toBeNull();
    expect(duracaoEmDias({ data_fim: "2025-10-27" })).toBeNull();
    expect(
      duracaoEmDias({ data_inicio: "2025-10-27", data_fim: "2025-10-01" }),
    ).toBeNull();
  });
});

describe("aprovados e cadastro reserva pela lista vigente", () => {
  it("aprovados são a lista; cadastro reserva, quem ainda não tem status", () => {
    const [linha] = enriquecerLinhas([concluido], {
      hoje: "2026-11-13",
      acompanhamento: acompanhamento([
        {
          monitoramento_id: "e1",
          aprovados: 361,
          com_status: 70,
          desistentes: 9,
        },
      ]),
    });
    expect(linha?.aprovados).toBe(361);
    expect(linha?.cadastro_reserva).toBe(291);
  });

  it("sem lista vigente, os dois ficam sem número (não zero)", () => {
    const [linha] = enriquecerLinhas([concluido], {
      hoje: "2026-11-13",
      acompanhamento: acompanhamento([]),
    });
    expect(linha?.aprovados).toBeNull();
    expect(linha?.cadastro_reserva).toBeNull();
  });

  it("cadastro reserva nunca fica negativo", () => {
    const [linha] = enriquecerLinhas([concluido], {
      hoje: "2026-11-13",
      acompanhamento: acompanhamento([
        { monitoramento_id: "e1", aprovados: 3, com_status: 5 },
      ]),
    });
    expect(linha?.cadastro_reserva).toBe(0);
  });
});

describe("tabela e arquivo", () => {
  it("as colunas do resultado estão no padrão, para todos; só Observações fica fora", () => {
    const campos = COLUNAS_DA_TABELA.map((c) => c.campo);
    for (const campo of [
      "duracao",
      "inscritos",
      "aprovados",
      "cadastro_reserva",
    ] as const) {
      expect(campos).toContain(campo);
      expect(COLUNAS_INICIAIS).toContain(campo);
    }
    expect(COLUNAS_INICIAIS).toEqual(
      campos.filter((campo) => campo !== "observacoes"),
    );
  });

  it("sem número fica abaixo do zero ao ordenar", () => {
    expect(valorParaOrdenar({ aprovados: null }, "aprovados")).toBe(-1);
    expect(valorParaOrdenar({ aprovados: 0 }, "aprovados")).toBe(0);
    expect(valorParaOrdenar(concluido, "duracao")).toBe(42);
    expect(valorParaOrdenar({}, "duracao")).toBe(-1);
  });

  it("o CSV leva duração, inscritos, aprovados e cadastro reserva", () => {
    const [linha] = enriquecerLinhas([concluido], {
      hoje: "2026-11-13",
      acompanhamento: acompanhamento([
        { monitoramento_id: "e1", aprovados: 361, com_status: 70 },
      ]),
    });
    const [cabecalho = "", corpo = ""] = csvDaVisaoGeral(linha ? [linha] : [])
      .replace(String.fromCharCode(0xfeff), "")
      .split("\n");
    const colunas = cabecalho.split(";").map((c) => c.replaceAll('"', ""));
    const valores = corpo.split(";").map((c) => c.replaceAll('"', ""));
    const valor = (rotulo: string) => valores[colunas.indexOf(rotulo)];
    expect(valor("Duração (dias)")).toBe("42");
    expect(valor("Inscritos")).toBe("5179");
    expect(valor("Aprovados (lista vigente)")).toBe("361");
    expect(valor("Aguardando Chamada (aprovados sem status)")).toBe("291");
    expect(valor("Contratados")).toBe("42");
  });
});
