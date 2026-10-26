import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calcularFicha,
  pendenciasDaFicha,
  resumoParaGravar,
} from "../../src/lib/avaliacao-documental/ficha.ts";

/*
  Casos dourados do cálculo dos itens e das pendências da ficha, nos três
  lados: a tela (aqui), o Python (tests/python/test_calculo_no_banco.py) e o
  banco (o ensaio de supabase/ensaios/20261023090000_calculo_conferido_no_banco.sql
  leva o mesmo JSON; tests/calculo-conferido-no-banco-migration.test.js
  confere). Cada caso diz o lançamento, a declarada e, se houver, a data
  limite do bloco de vínculos; o resultado gravado, a conta e as pendências
  saem da tela. `banco` traduz as pendências para os trechos que
  FC_PENDENCIAS_FICHA devolve e diz se FC_VALIDAR_RESULTADO_FICHA recusa.
  Mudou a regra de propósito: ATUALIZAR_DOURADOS=1 npx vitest run <este arquivo>
  regrava o JSON (confira o diff).
*/
const ARQUIVO =
  "tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json";
const DOURADOS = JSON.parse(readFileSync(ARQUIVO, "utf8"));

const NO_BANCO = {
  acima: "acima do que",
  datas: "vínculo com",
  justificativa: "nota diferente da declarada",
};

/** A regra do caso: a do arquivo, com a data limite do caso no bloco de vínculos. */
function regraDoCaso(regra, caso) {
  if (!caso.data_limite) return regra;
  return {
    ...regra,
    blocos: regra.blocos.map((b) =>
      b.tipo === "VINCULOS" ? { ...b, data_limite: caso.data_limite } : b,
    ),
  };
}

function calcular(caso) {
  const regra = regraDoCaso(DOURADOS.regra, caso);
  const av = calcularFicha(regra, caso.lancamento, DOURADOS.documental);
  const pendencias = pendenciasDaFicha(
    regra,
    caso.lancamento,
    av,
    caso.declarada,
    { hoje: DOURADOS.hoje },
  ).map((p) => ({ bloco: p.bloco, tipo: p.tipo }));
  const blocos = caso.lancamento.blocos;
  return {
    resultado: resumoParaGravar(av, caso.declarada),
    esperado: {
      calculados: av.calculados,
      parciais: av.parciais,
      resultado: av.resultado,
      experiencia: {
        dias_total: av.experiencia.dias_total,
        meses: av.experiencia.meses,
        meses_considerados: av.experiencia.meses_considerados,
      },
      pendencias,
      banco: {
        pendencias: pendencias.map((p) =>
          p.tipo === "minimo"
            ? blocos[p.bloco].situacao === "CONFORME"
              ? "experiência mínima"
              : "marcada como"
            : NO_BANCO[p.tipo],
        ),
        recusa:
          pendencias.some((p) => p.tipo === "acima") &&
          av.resultado !== "INAPTO_REQUISITO"
            ? "acima do que os itens registrados dão"
            : null,
      },
    },
  };
}

describe("casos dourados do cálculo conferido no banco", () => {
  if (process.env.ATUALIZAR_DOURADOS === "1") {
    it("regrava o arquivo", () => {
      const casos = DOURADOS.casos.map((c) => ({ ...c, ...calcular(c) }));
      writeFileSync(
        ARQUIVO,
        `${JSON.stringify({ ...DOURADOS, casos }, null, 2)}\n`,
      );
    });
    return;
  }

  it("tem os casos que importam", () => {
    const tipos = DOURADOS.casos.flatMap((c) =>
      c.esperado.pendencias.map((p) => p.tipo),
    );
    for (const tipo of ["acima", "minimo", "datas"])
      expect(tipos).toContain(tipo);
    expect(DOURADOS.casos.some((c) => c.data_limite)).toBe(true);
  });

  for (const caso of DOURADOS.casos)
    it(caso.nome, () => {
      const { resultado, esperado } = calcular(caso);
      expect(esperado).toEqual(caso.esperado);
      expect(resultado).toEqual(caso.resultado);
    });
});
