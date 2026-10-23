import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  hashDoRetrato,
  numeroCanonico,
  textoCanonicoDoRetrato,
} from "../../src/lib/classificacao/hash-do-retrato.ts";
import { sha256Hex } from "../../src/lib/classificacao/sorteio.ts";
import { convocacaoDoEdital } from "../../src/lib/classificacao/convocacao-do-edital.ts";
import { classificar } from "../../src/lib/classificacao/motor.ts";
import { retratoDaClassificacao } from "../../src/lib/classificacao/dados-do-estado.ts";
import { instantaneoDaLista } from "../../src/lib/classificacao/exportacao.ts";

/*
  O hash do retrato pelo CONTEÚDO (20261024130000): a tela, o Python e o banco
  fazem a mesma conta. Aqui, o lado da tela: o motor.ts gera de novo cada lista
  dos casos dourados e o hash bate com tests/fixtures/classificacao/
  hash-dos-retratos.json — o pytest (tests/python/
  test_classificacao_hash_do_retrato.py) gera as mesmas listas com o motor
  Python (que escreve 35.0) e confere o MESMO hash; o ensaio da migration
  confere os exemplos no banco. Dados fictícios.
*/
const DOURADO = JSON.parse(
  readFileSync("tests/fixtures/classificacao/casos-do-motor.json", "utf8"),
);
const HASHES = JSON.parse(
  readFileSync("tests/fixtures/classificacao/hash-dos-retratos.json", "utf8"),
);

function retratoDaTela(caso, i) {
  const entrada = DOURADO.editais[caso.edital];
  const bruta = entrada.convocacao;
  const resultado = JSON.parse(
    JSON.stringify(
      classificar({
        tipo: caso.tipo,
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
  return JSON.parse(
    JSON.stringify(
      retratoDaClassificacao(
        instantaneoDaLista(resultado, {
          edital: caso.editalDoRetrato,
          regra: entrada.regra,
          versao: Math.floor(i / 4) + 1,
        }),
      ),
    ),
  );
}

describe("hash do retrato pelo conteúdo", () => {
  it("35 e 35.0 dão o mesmo hash (o texto do jsonb sem zeros à direita)", () => {
    const python = JSON.parse('{"nota": 35.0, "parciais": [7.50, 0.0]}');
    const tela = { nota: 35, parciais: [7.5, 0] };
    expect(hashDoRetrato(python)).toBe(hashDoRetrato(tela));
    expect(textoCanonicoDoRetrato(tela)).toBe(
      '{"nota": 35, "parciais": [7.5, 0]}',
    );
    expect(hashDoRetrato({ nota: 35 })).toBe(sha256Hex('{"nota": 35}'));
    // Outro valor, outro hash; o texto "35.0" não é número e fica como está.
    expect(hashDoRetrato({ nota: 35.01 })).not.toBe(hashDoRetrato(tela));
    expect(textoCanonicoDoRetrato({ s: "35.0" })).toBe('{"s": "35.0"}');
  });

  it("o texto é o do jsonb do PostgreSQL: chaves por tamanho e bytes, escapes e números sem expoente", () => {
    expect(textoCanonicoDoRetrato({ bb: 1, a: 2, ab: [], c: {} })).toBe(
      '{"a": 2, "c": {}, "ab": [], "bb": 1}',
    );
    expect(textoCanonicoDoRetrato({ é: 1, z: 2 })).toBe('{"z": 2, "é": 1}');
    expect(textoCanonicoDoRetrato('a"b\\c\n\t\u0001/ç')).toBe(
      '"a\\"b\\\\c\\n\\t\\u0001/ç"',
    );
    expect(textoCanonicoDoRetrato([null, true, false, undefined])).toBe(
      "[null, true, false, null]",
    );
    expect(textoCanonicoDoRetrato({ x: undefined, y: 1 })).toBe('{"y": 1}');
    expect(numeroCanonico(1e-7)).toBe("0.0000001");
    expect(numeroCanonico(1e21)).toBe("1000000000000000000000");
    expect(numeroCanonico(-0)).toBe("0");
    expect(numeroCanonico(-2.5)).toBe("-2.5");
    expect(numeroCanonico(123.456)).toBe("123.456");
    expect(() => numeroCanonico(Number.NaN)).toThrow();
  });

  it("os exemplos da fixture (os mesmos que o ensaio confere no banco)", () => {
    for (const e of HASHES.exemplos)
      expect(hashDoRetrato(JSON.parse(e.texto))).toBe(e.hash);
  });

  it.each(DOURADO.casos.map((c, i) => [c.nome, c, i]))(
    "teste cruzado: a lista que a tela gera tem o hash da fixture (o mesmo do Python): %s",
    (nome, caso, i) => {
      expect(hashDoRetrato(retratoDaTela(caso, i))).toBe(HASHES.casos[nome]);
    },
  );

  it("a fixture cobre todos os casos dourados", () => {
    expect(Object.keys(HASHES.casos).sort()).toEqual(
      DOURADO.casos.map((c) => c.nome).sort(),
    );
  });
});
