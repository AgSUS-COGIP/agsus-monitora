import { describe, expect, it } from "vitest";
import {
  apuradoDoBloco,
  blocoComDecisao,
  comItensLancados,
} from "../../src/lib/avaliacao-documental/apurado-da-ficha.ts";

/*
  O Apurado dos itens que pontuam: começa preenchido (declarado, ou
  calculado com itens), Conforme grava o valor explícito, Não conforme e Não
  enviado zeram, e o primeiro item lançado devolve o Apurado ao calculado.
*/
const CURSOS = { codigo: "CURSOS", tipo: "CURSOS", teto: 5 };
const declarada = { parciais: { CURSOS: 3 } };
const lancamento = (blocos = {}, extra = {}) => ({
  nivel: "superior",
  blocos,
  cursos: [],
  ...extra,
});

describe("apurado da ficha", () => {
  it("começa com o declarado; com itens, com o calculado; com ajuste, o ajuste", () => {
    const entrada = { bloco: CURSOS, declarada, calculado: 0 };
    expect(apuradoDoBloco({ ...entrada, lancamento: lancamento() })).toEqual({
      valor: 3,
      origem: "declarado",
    });
    expect(
      apuradoDoBloco({
        ...entrada,
        calculado: 1,
        lancamento: lancamento({}, { cursos: [{ horas: 40 }] }),
      }),
    ).toEqual({ valor: 1, origem: "calculado" });
    expect(
      apuradoDoBloco({
        ...entrada,
        lancamento: lancamento({ CURSOS: { nota_ajustada: 2 } }),
      }),
    ).toEqual({ valor: 2, origem: "ajustado" });
    // Sem declarada: o calculado.
    expect(
      apuradoDoBloco({
        ...entrada,
        declarada: null,
        lancamento: lancamento(),
      }).origem,
    ).toBe("calculado");
  });

  it("Conforme grava o declarado explícito; Não conforme e Não enviado zeram", () => {
    const decidir = (l, situacao) =>
      blocoComDecisao({
        bloco: CURSOS,
        lancamento: l,
        situacao,
        declarada,
        calculado: 0,
      });
    const conforme = decidir(lancamento(), "CONFORME");
    expect(conforme).toMatchObject({
      situacao: "CONFORME",
      motivos: [],
      nota_ajustada: 3,
    });
    const nao = decidir(
      lancamento({ CURSOS: { ...conforme, motivos: ["X"] } }),
      "NAO_CONFORME",
    );
    expect(nao.nota_ajustada).toBe(0);
    expect(decidir(lancamento(), "NAO_ENVIADO").nota_ajustada).toBe(0);
    // Volta ao Conforme: o declarado de novo; desmarcar tira o zero.
    expect(decidir(lancamento({ CURSOS: nao }), "CONFORME").nota_ajustada).toBe(
      3,
    );
    expect(decidir(lancamento({ CURSOS: nao }), null).nota_ajustada).toBeNull();
    // Um ajuste feito pelo analista fica no Conforme.
    expect(
      decidir(lancamento({ CURSOS: { nota_ajustada: 2 } }), "CONFORME")
        .nota_ajustada,
    ).toBe(2);
    // Com itens lançados, segue o cálculo (nota_ajustada vazia).
    expect(
      decidir(lancamento({}, { cursos: [{ horas: 40 }] }), "CONFORME")
        .nota_ajustada,
    ).toBeNull();
  });

  it("o primeiro item lançado devolve o apurado ao calculado", () => {
    const l = lancamento(
      { CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } },
      { cursos: [{ horas: 40 }] },
    );
    comItensLancados(CURSOS, { tinhaItens: false }, l, declarada);
    expect(l.blocos.CURSOS.nota_ajustada).toBeNull();
    // Um ajuste diferente do declarado fica.
    const outro = lancamento(
      { CURSOS: { situacao: "CONFORME", nota_ajustada: 2 } },
      { cursos: [{ horas: 40 }] },
    );
    comItensLancados(CURSOS, { tinhaItens: false }, outro, declarada);
    expect(outro.blocos.CURSOS.nota_ajustada).toBe(2);
  });
});

describe("Conforme num bloco de itens (avancoDoConforme)", () => {
  it("declarado 0 ou itens lançados avançam; declarado > 0 sem item avisa e avança só com o Apurado definido", async () => {
    const { avancoDoConforme } =
      await import("../../src/lib/avaliacao-documental/apurado-da-ficha.ts");
    const entrada = (decl, blocos = {}, extra = {}) => ({
      bloco: CURSOS,
      lancamento: lancamento(blocos, extra),
      declarada: { parciais: { CURSOS: decl } },
    });
    expect(avancoDoConforme(entrada(0))).toEqual({ avanca: true, aviso: null });
    expect(
      avancoDoConforme(entrada(3, {}, { cursos: [{ horas: 40 }] })),
    ).toEqual({ avanca: true, aviso: null });
    expect(
      avancoDoConforme(entrada(3, { CURSOS: { nota_ajustada: 3 } })),
    ).toEqual({
      avanca: true,
      aviso: "Lance os cursos comprovados ou ajuste o Apurado",
    });
    expect(avancoDoConforme(entrada(3))).toEqual({
      avanca: false,
      aviso: "Lance os cursos comprovados ou ajuste o Apurado",
    });
    expect(
      avancoDoConforme({
        ...entrada(3),
        bloco: { codigo: "X", tipo: "DOCUMENTO" },
      }),
    ).toEqual({ avanca: true, aviso: null });
  });
});
