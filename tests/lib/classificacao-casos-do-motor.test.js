import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convocacaoDoEdital } from "../../src/lib/classificacao/convocacao-do-edital.ts";
import { classificar } from "../../src/lib/classificacao/motor.ts";
import { retratoDaClassificacao } from "../../src/lib/classificacao/dados-do-estado.ts";
import { instantaneoDaLista } from "../../src/lib/classificacao/exportacao.ts";

/*
  Casos dourados da classificação, compartilhados com o pytest
  (tests/python/test_classificacao_motor.py): a classificação em Python
  (python/monitora/classificacao/) tem de dar a MESMA saída do motor da tela.
  Aqui o motor.ts confere que continua dando a saída gravada. Mudou o motor de
  propósito: rode `node scripts/classificacao/gerar-casos-do-motor.mjs` e acerte
  o Python até o pytest passar. Dados fictícios.
*/
const DOURADO = JSON.parse(
  readFileSync("tests/fixtures/classificacao/casos-do-motor.json", "utf8"),
);

function classificarCaso({ edital, tipo }) {
  const entrada = DOURADO.editais[edital];
  const bruta = entrada.convocacao;
  return JSON.parse(
    JSON.stringify(
      classificar({
        tipo,
        ...entrada,
        convocacao: bruta
          ? convocacaoDoEdital(
              { configuracoes: bruta.configuracoes, modelos: bruta.modelos },
              bruta.edital_id,
            )
          : null,
      }),
    ),
  );
}

describe("casos dourados da classificação (motor.ts × Python)", () => {
  it("cobrem as quatro listas em cinco editais fictícios", () => {
    expect(DOURADO.casos).toHaveLength(20);
    expect(new Set(DOURADO.casos.map((c) => c.tipo))).toEqual(
      new Set(["PRELIMINAR", "CONVOCACAO", "ENTREVISTA", "FINAL"]),
    );
  });

  it.each(DOURADO.casos.map((c) => [c.nome, c]))(
    "o motor da tela dá a saída gravada: %s",
    (_nome, caso) => {
      expect(classificarCaso(caso)).toEqual(caso.saida);
    },
  );

  it.each(DOURADO.casos.map((c, i) => [c.nome, c, i]))(
    "o retrato que a tela grava ao gerar é o gravado: %s",
    (_nome, caso, i) => {
      const retrato = retratoDaClassificacao(
        instantaneoDaLista(classificarCaso(caso), {
          edital: caso.editalDoRetrato,
          regra: DOURADO.editais[caso.edital].regra,
          versao: Math.floor(i / 4) + 1,
        }),
      );
      expect(JSON.parse(JSON.stringify(retrato))).toEqual(caso.retrato);
    },
  );

  it("cobrem os empates que o relatório de desempate explica", () => {
    const final = DOURADO.casos.find(
      (c) => c.nome === "criterios-sorteio-maior-percentual · FINAL",
    ).saida;
    const codigos = new Set(final.avisos.map((a) => a.codigo));
    for (const codigo of [
      "HORA_DE_NASCIMENTO",
      "DADO_FALTANDO",
      "EMPATE_PENDENTE",
      "EMPATE_NO_LIMITE",
    ])
      expect(codigos).toContain(codigo);
    const explicacoes = Object.values(final.explicacoes).flatMap(
      (e) => e.explicacao,
    );
    expect(explicacoes.join(" ")).toContain("pela certidão");
    expect(explicacoes.join(" ")).toContain("resolvido por sorteio");
  });
});
