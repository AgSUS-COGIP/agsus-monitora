/*
  O MOTOR DA TELA (src/lib/classificacao/motor.ts) RODANDO NO NODE

  Existe para conferir a classificação em Python (python/monitora/classificacao/)
  com a referência desta etapa: o mesmo motor que a tela usa, com a mesma
  entrada. Quem chama:
    - scripts/classificacao/classificacao.py --seco (compara o Python com este);
    - scripts/classificacao/gerar-casos-do-motor.mjs (casos dourados).

  Uso
    node scripts/classificacao/classificar-como-a-tela.mjs <dados.json> <TIPO>[,<TIPO>…]

  <dados.json>: o json de classificacao_ler_edital (o de
  obter_classificacao_do_edital, com `convocacao` = as linhas cruas de
  listar_configuracao_convocacao e listar_modelos_convocacao do edital).
  Escreve no stdout {"PRELIMINAR": resultado, …}. Nada vai para o banco.
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classificarEdital } from "../../src/lib/classificacao/ajustes.ts";
import { convocacaoDoEdital } from "../../src/lib/classificacao/convocacao-do-edital.ts";
import { classificar } from "../../src/lib/classificacao/motor.ts";

/** O resultado como sai num json (sem os campos `undefined`). */
const json = (valor) => JSON.parse(JSON.stringify(valor));

/** A configuração de convocação crua ({configuracoes, modelos}) na forma que a tela passa ao motor. */
export function convocacaoDaTela(bruta, editalId) {
  if (!bruta || !editalId) return null;
  return convocacaoDoEdital(
    { configuracoes: bruta.configuracoes, modelos: bruta.modelos },
    editalId,
  );
}

/** Um caso dourado: a entrada do motor, com a convocação crua (edital_id dentro). */
export function classificarCaso(entrada) {
  const bruta = entrada.convocacao;
  return json(
    classificar({
      ...entrada,
      convocacao: bruta ? convocacaoDaTela(bruta, bruta.edital_id) : null,
    }),
  );
}

/** O json do edital numa lista, como a tela (classificarEdital). */
export function classificarDados(dados, tipo) {
  return json(
    classificarEdital(
      {
        ...dados,
        convocacao: convocacaoDaTela(dados.convocacao, dados.edital?.id),
      },
      tipo,
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [arquivo, tipos = "FINAL"] = process.argv.slice(2);
  if (!arquivo) {
    console.error(
      "Uso: node scripts/classificacao/classificar-como-a-tela.mjs <dados.json> <TIPO>[,<TIPO>…]",
    );
    process.exit(1);
  }
  const dados = JSON.parse(readFileSync(arquivo, "utf8"));
  const saida = {};
  for (const tipo of tipos.split(","))
    saida[tipo] = classificarDados(dados, tipo);
  process.stdout.write(JSON.stringify(saida));
}
