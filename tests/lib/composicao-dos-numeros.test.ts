import { describe, expect, it } from "vitest";
import {
  composicaoDaLinha,
  composicaoDoIndicador,
} from "../../src/lib/visao-geral/composicao-dos-numeros.ts";
import { indicadoresDoMonitoramento } from "../../src/lib/visao-geral/indicadores-do-monitoramento.ts";
import type { LinhaDoMonitoramento } from "../../src/modulos/visao-geral/tipos.ts";

/*
  Revisão de 17/11/2026: clicar no número mostra as parcelas que o formam
  (o "Ver a composição" do SIGEPSI). As contas fecham com as da faixa.
*/

const linha = (campos: Record<string, unknown>) =>
  ({ id: "x", status: "Em andamento", ...campos }) as LinhaDoMonitoramento;

const ultimo = (passos: ReturnType<typeof composicaoDaLinha>) =>
  passos?.[passos.length - 1];

describe("composição de um número da linha", () => {
  it("Contratados = dentro + além das vagas imediatas", () => {
    const passos = composicaoDaLinha(
      linha({ vagas_total: 51, contratados: 56 }),
      "contratados",
    );
    expect(passos).toEqual([
      { operacao: "", rotulo: "Dentro das vagas imediatas", valor: 51 },
      { operacao: "+", rotulo: "Além das vagas imediatas", valor: 5 },
      { operacao: "=", rotulo: "Contratados no total", valor: 56 },
    ]);
    // Sem nada além das vagas, um número só: sem composição.
    expect(
      composicaoDaLinha(
        linha({ vagas_total: 10, contratados: 4 }),
        "contratados",
      ),
    ).toBeNull();
  });

  it("Vagas = publicadas − reabertas; Sem contratação desconta as duas", () => {
    const reaberta = linha({
      vagas_total: 10,
      vagas_reabertas: 6,
      contratados: 4,
      status: "Concluído",
    });
    expect(ultimo(composicaoDaLinha(reaberta, "vagas_total"))).toEqual({
      operacao: "=",
      rotulo: "Vagas que contam",
      valor: 4,
    });
    expect(composicaoDaLinha(reaberta, "vagas_ociosas")).toEqual([
      { operacao: "", rotulo: "Vagas publicadas", valor: 10 },
      { operacao: "−", rotulo: "Reabertas em edital mais novo", valor: 6 },
      { operacao: "−", rotulo: "Contratadas dentro das vagas", valor: 4 },
      { operacao: "=", rotulo: "Sem contratação", valor: 0 },
    ]);
    expect(
      composicaoDaLinha(linha({ vagas_total: 3 }), "vagas_total"),
    ).toBeNull();
  });

  it("Aprovados = já chamados + aguardando chamada", () => {
    expect(
      composicaoDaLinha(
        linha({ aprovados: 12, cadastro_reserva: 5 }),
        "aprovados",
      ),
    ).toEqual([
      { operacao: "", rotulo: "Já chamados (com status)", valor: 7 },
      { operacao: "+", rotulo: "Aguardando chamada (sem status)", valor: 5 },
      { operacao: "=", rotulo: "Aprovados na lista vigente", valor: 12 },
    ]);
    // Sem lista vigente ("—"), nada a compor.
    expect(
      composicaoDaLinha(linha({ aprovados: null }), "aprovados"),
    ).toBeNull();
  });
});

describe("composição dos indicadores fecha com a faixa", () => {
  const LINHAS = [
    linha({ id: "a", vagas_total: 130, contratados: 567, status: "Concluído" }),
    linha({ id: "b", vagas_total: 83, contratados: 1, status: "Concluído" }),
    linha({ id: "c", vagas_total: 27, contratados: 0 }),
    linha({
      id: "d",
      vagas_total: 10,
      vagas_reabertas: 6,
      contratados: 4,
      status: "Concluído",
    }),
    linha({ id: "e", vagas_total: 9, contratados: 9, status: "Cancelado" }),
  ];
  const k = indicadoresDoMonitoramento(LINHAS);

  it("Vagas imediatas = Contratadas + Em seleção + Ociosas, e publicadas − reabertas", () => {
    const passos = composicaoDoIndicador(LINHAS, "vagas")!;
    const valor = (rotulo: string) =>
      passos.find((p) => p.rotulo === rotulo)?.valor;
    expect(valor("Contratadas")).toBe(k.contratadas);
    expect(valor("Em seleção")).toBe(k.emSelecao);
    expect(valor("Ociosas")).toBe(k.ociosas);
    expect(
      passos.filter((p) => p.operacao === "=").map((p) => p.valor),
    ).toEqual([k.vagas, k.vagas]);
    expect(valor("Reabertas em edital mais novo")).toBe(k.reabertas);
  });

  it("Contratadas e além das vagas: dentro + além = contratados", () => {
    const passos = composicaoDoIndicador(LINHAS, "alemDasVagas")!;
    expect(passos.map((p) => p.valor)).toEqual([
      k.contratadas,
      k.alemDasVagas,
      k.contratadas + k.alemDasVagas,
    ]);
  });

  it("Ociosas e Em seleção: vagas do grupo − contratadas nele", () => {
    expect(ultimo(composicaoDoIndicador(LINHAS, "ociosas"))?.valor).toBe(
      k.ociosas,
    );
    expect(ultimo(composicaoDoIndicador(LINHAS, "emSelecao"))?.valor).toBe(
      k.emSelecao,
    );
    // Sem edital sem resultado, Em seleção não tem o que compor.
    expect(composicaoDoIndicador([LINHAS[0]!], "emSelecao")).toBeNull();
    expect(composicaoDoIndicador([], "vagas")).toBeNull();
  });
});
