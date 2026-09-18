/*
  Compila `docs/aya/*.md` no módulo que o código lê.

  POR QUE COMPILAR, E NÃO LER EM TEMPO DE EXECUÇÃO

  A `/api/aya` roda como função serverless na Vercel, onde nem todo arquivo do
  repositório acompanha o bundle. Ler `.md` do disco ali funciona hoje e quebra
  na próxima mudança de empacotamento, sem aviso. Gerar um módulo JavaScript
  torna o conhecimento parte do código, com o mesmo destino do resto.

  A verificação de sincronia vive nos testes: se alguém editar um `.md` e
  esquecer de regenerar, o CI reprova em vez de a Aya responder com a base
  velha.
*/

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/*
  Sob o vitest este módulo pode chegar por uma URL que não é `file:`, e aí
  `fileURLToPath` lança. Como os testes e os scripts npm rodam a partir da raiz
  do repositório, o diretório de trabalho é a alternativa correta.
*/
function raizDoRepositorio() {
  try {
    return fileURLToPath(new URL("../", import.meta.url));
  } catch {
    return process.cwd();
  }
}

const ORIGEM = join(raizDoRepositorio(), "docs/aya");
const DESTINO = join(
  raizDoRepositorio(),
  "src/modules/aya-conhecimento-gerado.js",
);

function lerCampo(bloco, nome) {
  const achado = bloco.match(
    new RegExp(String.raw`^\*\*${nome}:\*\*\s*(.+)$`, "im"),
  );
  return achado ? achado[1].trim() : "";
}

export function compilarVerbetes() {
  const arquivos = readdirSync(ORIGEM)
    .filter((nome) => nome.endsWith(".md") && nome !== "README.md")
    .sort();

  const verbetes = [];
  const problemas = [];

  for (const arquivo of arquivos) {
    const texto = readFileSync(join(ORIGEM, arquivo), "utf8");
    // Cada `##` abre um verbete; o que vem antes do primeiro é introdução.
    const blocos = texto.split(/^## /m).slice(1);

    for (const bloco of blocos) {
      const titulo = bloco.split("\n")[0].trim();
      const perguntas = lerCampo(bloco, "perguntas")
        .split("|")
        .map((termo) => termo.trim().toLowerCase())
        .filter(Boolean);
      const resposta = lerCampo(bloco, "resposta");
      const fato = lerCampo(bloco, "fato");
      const fonte = lerCampo(bloco, "fonte");

      if (!titulo) continue;
      if (!perguntas.length && resposta) {
        problemas.push(
          `${arquivo} › ${titulo}: tem resposta mas não tem perguntas que a disparem`,
        );
      }
      if (resposta && !fonte) {
        problemas.push(`${arquivo} › ${titulo}: resposta sem fonte`);
      }
      if (!resposta && !fato) {
        problemas.push(`${arquivo} › ${titulo}: não define resposta nem fato`);
      }

      verbetes.push({ arquivo, titulo, perguntas, resposta, fato, fonte });
    }
  }

  // Dois verbetes com o mesmo termo fariam o primeiro vencer em silêncio.
  const vistos = new Map();
  for (const verbete of verbetes) {
    for (const termo of verbete.perguntas) {
      if (vistos.has(termo)) {
        problemas.push(
          `termo "${termo}" repetido em "${vistos.get(termo)}" e "${verbete.titulo}"`,
        );
      }
      vistos.set(termo, verbete.titulo);
    }
  }

  return { verbetes, problemas };
}

export function gerarModulo({ verbetes }) {
  const corpo = verbetes.map((verbete) => ({
    titulo: verbete.titulo,
    perguntas: verbete.perguntas,
    resposta: verbete.resposta,
    fato: verbete.fato,
    fonte: verbete.fonte,
  }));

  return `/*
  ARQUIVO GERADO. Não edite à mão.

  Origem: docs/aya/*.md
  Gere de novo com: npm run aya:conhecimento
*/

export const VERBETES_AYA = Object.freeze(
${JSON.stringify(corpo, null, 2)
  .split("\n")
  .map((linha) => `  ${linha}`)
  .join("\n")},
);
`;
}

// Comparar strings montadas à mão erra no Windows, onde o caminho vem com
// barras invertidas e a URL do módulo tem três barras depois de `file:`.
function executadoDiretamente() {
  try {
    return (
      Boolean(process.argv[1]) &&
      import.meta.url === pathToFileURL(process.argv[1]).href
    );
  } catch {
    return false;
  }
}

if (executadoDiretamente()) {
  const { verbetes, problemas } = compilarVerbetes();
  if (problemas.length) {
    console.error("Base de conhecimento da Aya com problemas:");
    for (const problema of problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  writeFileSync(DESTINO, gerarModulo({ verbetes }));
  const comResposta = verbetes.filter((v) => v.resposta).length;
  const comFato = verbetes.filter((v) => v.fato).length;
  console.log(
    `${verbetes.length} verbetes compilados: ${comResposta} com resposta direta, ${comFato} com fato no prompt.`,
  );
}
