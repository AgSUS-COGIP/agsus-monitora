import { describe, expect, it, vi } from "vitest";
import {
  acompanharCasamento,
  casamentoLido,
  numerosDoCasamento,
  pedidoLido,
  textoDoCasamentoParado,
} from "../../src/lib/casamento-da-lista.ts";

/*
  A prévia do casamento da lista de aprovados (migration 20261030090000): a
  conta é do job Python; a tela lê o plano, espera o job e mostra os números.
*/

const P = "11111111-1111-4111-8111-111111111111";
const C1 = "22222222-2222-4222-8222-222222222222";
const C2 = "33333333-3333-4333-8333-333333333333";

const calculado = (extra = {}) => ({
  pedido_id: P,
  origem: "XLSX",
  situacao: "CALCULADO",
  erro: null,
  disparo: "ACEITO",
  exige_motivo: true,
  pode_substituir: true,
  anteriores: 3,
  novos_total: 3,
  manuais: {},
  plano: {
    versao: 1,
    vinculos: [{ candidato_id: C1, chave: "1", forma: "NOME" }],
    resumo: {
      casados: 1,
      entram: 2,
      sem_par: 2,
      sem_dono: 1,
      preservados: 1,
      mudam: 0,
      sub_judice_mantidos: 1,
      ambiguos: 0,
    },
    pendencias: [
      {
        candidato_id: C2,
        nome: "Paulo",
        status: "Desistente",
        matricula: null,
      },
    ],
    mudam: [],
    revisar: [C2],
  },
  novos: null,
  revisar: [],
  ...extra,
});

describe("respostas do banco", () => {
  it("o pedido e o casamento calculado", () => {
    expect(pedidoLido({ pedido_id: P, situacao: "PENDENTE" })).toEqual({
      pedido_id: P,
      situacao: "PENDENTE",
    });
    const c = casamentoLido(calculado());
    expect(c.plano.vinculos).toEqual([
      { candidato_id: C1, chave: "1", forma: "NOME" },
    ]);
    expect(c.plano.pendencias[0]).toMatchObject({
      nome: "Paulo",
      status: "Desistente",
      matricula: "",
    });
    expect(numerosDoCasamento(c)).toEqual({
      casados: 1,
      entram: 2,
      semPar: 2,
      semDono: 1,
      preservados: 1,
      mudam: 0,
      subJudiceMantidos: 1,
    });
  });

  it("recusa o que vem fora do formato", () => {
    expect(() =>
      pedidoLido({ pedido_id: "x", situacao: "PENDENTE" }),
    ).toThrow();
    expect(() => casamentoLido(calculado({ plano: null }))).toThrow();
    expect(() =>
      casamentoLido(
        calculado({
          plano: {
            ...calculado().plano,
            vinculos: [{ candidato_id: C1, chave: "1", forma: "AUTOMATICO" }],
          },
        }),
      ),
    ).toThrow();
    expect(() => casamentoLido(calculado({ situacao: "OUTRA" }))).toThrow();
  });

  it("por que a prévia parou", () => {
    expect(
      textoDoCasamentoParado({
        situacao: "ERRO",
        erro: "A lista mudou.",
        disparo: "",
      }),
    ).toBe("A lista mudou.");
    expect(
      textoDoCasamentoParado({ situacao: "DESCARTADO", erro: "", disparo: "" }),
    ).toBe("Outra prévia começou depois desta.");
    expect(
      textoDoCasamentoParado({
        situacao: "PENDENTE",
        erro: "",
        disparo: "SEM_TOKEN",
      }),
    ).toContain("não chegou ao GitHub");
  });
});

describe("acompanharCasamento", () => {
  const pendente = () => ({
    ...calculado(),
    situacao: "PENDENTE",
    plano: null,
  });

  it("espera o job e devolve o plano", async () => {
    const obter = vi
      .fn()
      .mockResolvedValueOnce(pendente())
      .mockResolvedValueOnce(pendente())
      .mockResolvedValueOnce(calculado());
    const esperar = vi.fn(async () => {});
    const r = await acompanharCasamento({
      pedidoId: P,
      obter,
      esperar,
      intervaloMs: 10,
    });
    expect(r.casamento.situacao).toBe("CALCULADO");
    expect(obter).toHaveBeenCalledTimes(3);
    expect(esperar).toHaveBeenCalledWith(10);
  });

  it("o pedido não chegou ao GitHub: para na hora", async () => {
    const obter = vi
      .fn()
      .mockResolvedValue({ ...pendente(), disparo: "SEM_TOKEN" });
    const r = await acompanharCasamento({
      pedidoId: P,
      obter,
      esperar: async () => {},
    });
    expect(r.erro).toContain("não chegou ao GitHub");
    expect(obter).toHaveBeenCalledTimes(1);
  });

  it("o prazo passou", async () => {
    let t = 0;
    const r = await acompanharCasamento({
      pedidoId: P,
      obter: async () => pendente(),
      esperar: async (ms) => {
        t += ms;
      },
      agora: () => t,
      intervaloMs: 60000,
      prazoMs: 180000,
    });
    expect(r.erro).toBe(
      "O cálculo do casamento não chegou em 3 min. Tente de novo.",
    );
  });

  it("o job deu erro", async () => {
    const r = await acompanharCasamento({
      pedidoId: P,
      obter: async () => ({
        ...pendente(),
        situacao: "ERRO",
        erro: "A lista vigente mudou desde o pedido; peça a prévia de novo.",
      }),
      esperar: async () => {},
    });
    expect(r.erro).toContain("A lista vigente mudou");
  });

  it("a tela mudou: para sem aviso", async () => {
    const r = await acompanharCasamento({
      pedidoId: P,
      obter: async () => pendente(),
      esperar: async () => {},
      vigente: () => false,
    });
    expect(r).toEqual({ erro: "" });
  });
});
