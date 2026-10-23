/*
  HASH DOS RETRATOS DOS CASOS DOURADOS (tela × Python × banco)

  Gera tests/fixtures/classificacao/hash-dos-retratos.json: o hash
  (hashDoRetrato, src/lib/classificacao/hash-do-retrato.ts — a conta de
  private."FC_HASH_RETRATO_CLASSIFICACAO", 20261024130000) do retrato de cada
  caso dourado (tests/fixtures/classificacao/casos-do-motor.json, o retrato que
  o motor.ts grava) e de exemplos pequenos com 35 × 35.0. O vitest
  (tests/lib/classificacao-hash-do-retrato.test.js) confere o lado da tela; o
  pytest (tests/python/test_classificacao_hash_do_retrato.py) gera os mesmos
  retratos com o motor Python (que escreve 35.0) e confere o mesmo hash; o
  ensaio da migration confere os exemplos no banco. Dados fictícios.

  Uso: node scripts/classificacao/gerar-hash-dos-retratos.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";
import { hashDoRetrato } from "../../src/lib/classificacao/hash-do-retrato.ts";

const ORIGEM = new URL(
  "../../tests/fixtures/classificacao/casos-do-motor.json",
  import.meta.url,
);
const DESTINO = new URL(
  "../../tests/fixtures/classificacao/hash-dos-retratos.json",
  import.meta.url,
);

const casos = JSON.parse(readFileSync(ORIGEM, "utf8")).casos;

/* Exemplos: o texto json como o Python manda (35.0) e o hash do conteúdo. */
const EXEMPLOS = [
  '{"tipo": "PRELIMINAR", "casas": 2, "vagas": [{"geral": [{"nome": "Ana Exemplo", "nota": 35.0, "posicao": 1, "parciais": {"FORMACAO": 10.0, "EXPERIENCIA": 25.0}}, {"nome": "Bruno Teste", "nota": 7.50, "posicao": 2, "parciais": {"FORMACAO": 0.0, "EXPERIENCIA": 7.5}}]}], "rodape": "Nota 35.0 no texto fica como está."}',
  '{"a": [1.0, 2.50, -0.0, 0.000001, 1e-7, 1E+21], "b": "Tab\\t, aspas \\" e barra \\\\; ação", "chave mais longa": null, "x": true}',
];

const saida = {
  gerado_por: "scripts/classificacao/gerar-hash-dos-retratos.mjs",
  aviso:
    "Dados fictícios. Não edite à mão: rode o gerador de novo (o hash é o de hash-do-retrato.ts).",
  casos: Object.fromEntries(
    casos.map((c) => [c.nome, hashDoRetrato(c.retrato)]),
  ),
  exemplos: EXEMPLOS.map((texto) => ({
    texto,
    hash: hashDoRetrato(JSON.parse(texto)),
  })),
};

writeFileSync(DESTINO, `${JSON.stringify(saida, null, 2)}\n`);
console.log(
  `${Object.keys(saida.casos).length} casos e ${saida.exemplos.length} exemplos em ${DESTINO.pathname}`,
);
