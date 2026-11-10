import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";

/*
  CONFERE OS LINKS DA BIBLIOTECA DE DOCUMENTAÇÃO

      npm run check:docs        (também roda no npm run check:architecture)

  POR QUE EXISTE

  A documentação do MONITORA é um vault do Obsidian com a raiz do repositório
  como vault: o CLAUDE.md da raiz é o índice e cada assunto é uma nota curta em
  docs/biblioteca/, ligada às outras por [[wikilinks]] (docs/biblioteca/documentacao.md).
  Um link quebrado ou uma nota que ninguém liga não dão erro em lugar nenhum:
  a nota simplesmente some do caminho de quem lê. Este script falha quando:

  - um [[link]] do CLAUDE.md da raiz, dos CLAUDE.md das pastas ou de uma nota
    da biblioteca não tem nota em docs/biblioteca/<nome>.md;
  - uma nota da biblioteca não é ligada por nenhum outro arquivo (órfã; o link
    da nota para ela mesma não conta);
  - uma nota tem o nome de outro .md visível no vault (o [[link]] ficaria
    ambíguo no Obsidian; as pastas escondidas vêm de .obsidian/app.json);
  - uma nota não tem o cabeçalho YAML com tipo, area e atualizado válidos.

  Links dentro de bloco de código ou de `crase` não contam (são exemplos).
  Arquivo fora da biblioteca se cita com link markdown, não com [[ ]].
*/

export const PASTA_DA_BIBLIOTECA = "docs/biblioteca";
export const TIPOS = Object.freeze([
  "regra",
  "guia",
  "modulo",
  "decisao",
  "referencia",
]);
export const AREAS = Object.freeze([
  "front",
  "banco",
  "seguranca",
  "testes",
  "operacao",
  "modulo",
]);

/* Pastas que nunca entram na busca de CLAUDE.md nem de nomes repetidos. */
const PASTAS_FORA = new Set([
  ".git",
  "node_modules",
  "dist",
  ".claude",
  "coverage",
  "test-results",
  "playwright-report",
]);

/**
 * Os destinos dos [[links]] de um texto markdown, sem os de código.
 * `[[nome]]`, `[[nome|texto]]` e `[[nome#seção]]` dão `nome`.
 * @param {string} texto
 * @returns {string[]}
 */
export function extrairLinks(texto) {
  const semCodigo = texto
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
  const links = [];
  for (const achado of semCodigo.matchAll(
    /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g,
  )) {
    links.push(achado[1].trim().replace(/\.md$/, ""));
  }
  return links;
}

/**
 * O cabeçalho YAML simples (chave: valor) do começo da nota, ou null.
 * @param {string} texto
 * @returns {Record<string, string> | null}
 */
export function lerCabecalho(texto) {
  const achado = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(texto);
  if (!achado) return null;
  /** @type {Record<string, string>} */
  const campos = {};
  for (const linha of achado[1].split(/\r?\n/)) {
    const par = /^([a-z_]+):\s*(.*)$/.exec(linha);
    if (par) campos[par[1]] = par[2].trim();
  }
  return campos;
}

/**
 * Confere a biblioteca. Puro: recebe os textos e devolve a lista de problemas.
 * @param {{
 *   notas: Map<string, string>,
 *   fontes: Map<string, string>,
 *   outrosNomes?: Map<string, string>,
 * }} entrada `notas`: nome → texto das notas da biblioteca; `fontes`: caminho → texto
 *   dos CLAUDE.md (que ligam, mas não são notas); `outrosNomes`: nome → caminho dos
 *   outros .md visíveis no vault.
 * @returns {string[]}
 */
export function conferirBiblioteca({ notas, fontes, outrosNomes = new Map() }) {
  const problemas = [];
  /** @type {Map<string, Set<string>>} */
  const ligadaPor = new Map([...notas.keys()].map((nome) => [nome, new Set()]));
  const origens = [
    ...[...fontes].map(([caminho, texto]) => ({
      origem: caminho,
      nome: null,
      texto,
    })),
    ...[...notas].map(([nome, texto]) => ({
      origem: `${PASTA_DA_BIBLIOTECA}/${nome}.md`,
      nome,
      texto,
    })),
  ];

  for (const { origem, nome, texto } of origens) {
    for (const destino of new Set(extrairLinks(texto))) {
      if (!notas.has(destino)) {
        problemas.push(
          `${origem}: [[${destino}]] não tem nota em ${PASTA_DA_BIBLIOTECA}/${destino}.md`,
        );
      } else if (destino !== nome) {
        ligadaPor.get(destino)?.add(origem);
      }
    }
  }

  for (const [nome, quem] of ligadaPor) {
    if (quem.size === 0) {
      problemas.push(
        `${PASTA_DA_BIBLIOTECA}/${nome}.md: nota órfã (nenhum CLAUDE.md nem outra nota liga para ela)`,
      );
    }
    const repetida = outrosNomes.get(nome);
    if (repetida) {
      problemas.push(
        `${PASTA_DA_BIBLIOTECA}/${nome}.md: mesmo nome de ${repetida} (o [[link]] fica ambíguo no Obsidian)`,
      );
    }
  }

  for (const [nome, texto] of notas) {
    const cabecalho = lerCabecalho(texto);
    const caminho = `${PASTA_DA_BIBLIOTECA}/${nome}.md`;
    if (!cabecalho) {
      problemas.push(`${caminho}: sem cabeçalho YAML (tipo, area, atualizado)`);
      continue;
    }
    if (!TIPOS.includes(cabecalho.tipo)) {
      problemas.push(
        `${caminho}: tipo "${cabecalho.tipo ?? ""}" fora de ${TIPOS.join(", ")}`,
      );
    }
    if (!AREAS.includes(cabecalho.area)) {
      problemas.push(
        `${caminho}: area "${cabecalho.area ?? ""}" fora de ${AREAS.join(", ")}`,
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cabecalho.atualizado ?? "")) {
      problemas.push(
        `${caminho}: atualizado "${cabecalho.atualizado ?? ""}" não é AAAA-MM-DD`,
      );
    }
  }
  return problemas;
}

/**
 * As pastas que o vault esconde (userIgnoreFilters de .obsidian/app.json).
 * @param {string} raiz
 * @returns {string[]}
 */
function pastasEscondidasDoVault(raiz) {
  const arquivo = join(raiz, ".obsidian", "app.json");
  if (!existsSync(arquivo)) return [];
  const config = JSON.parse(readFileSync(arquivo, "utf8"));
  return (config.userIgnoreFilters ?? []).map((/** @type {string} */ pasta) =>
    pasta.replace(/\/$/, ""),
  );
}

/**
 * Todos os .md do repositório (fora das pastas que nunca contam), caminho relativo com "/".
 * @param {string} raiz
 * @returns {string[]}
 */
function arquivosMarkdown(raiz) {
  /** @type {string[]} */
  const achados = [];
  /** @param {string} pasta */
  const andar = (pasta) => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      if (entrada.isDirectory()) {
        if (!PASTAS_FORA.has(entrada.name)) andar(join(pasta, entrada.name));
      } else if (entrada.name.endsWith(".md")) {
        achados.push(
          relative(raiz, join(pasta, entrada.name)).split("\\").join("/"),
        );
      }
    }
  };
  andar(raiz);
  return achados.sort();
}

/**
 * Lê o repositório e devolve a entrada de `conferirBiblioteca`.
 * @param {string} raiz
 */
export function lerRepositorio(raiz) {
  const todos = arquivosMarkdown(raiz);
  const escondidas = pastasEscondidasDoVault(raiz);
  const visivel = (/** @type {string} */ caminho) =>
    !escondidas.some(
      (pasta) => caminho === pasta || caminho.startsWith(`${pasta}/`),
    ) && !caminho.split("/").some((parte) => parte.startsWith("."));

  /** @type {Map<string, string>} */
  const notas = new Map();
  /** @type {Map<string, string>} */
  const fontes = new Map();
  /** @type {Map<string, string>} */
  const outrosNomes = new Map();
  for (const caminho of todos) {
    const ler = () => readFileSync(join(raiz, caminho), "utf8");
    if (
      caminho.startsWith(`${PASTA_DA_BIBLIOTECA}/`) &&
      !caminho.slice(PASTA_DA_BIBLIOTECA.length + 1).includes("/")
    ) {
      notas.set(basename(caminho, ".md"), ler());
    } else {
      if (basename(caminho) === "CLAUDE.md") fontes.set(caminho, ler());
      if (visivel(caminho) && !outrosNomes.has(basename(caminho, ".md"))) {
        outrosNomes.set(basename(caminho, ".md"), caminho);
      }
    }
  }
  return { notas, fontes, outrosNomes };
}

function principal() {
  const entrada = lerRepositorio(process.cwd());
  const problemas = conferirBiblioteca(entrada);
  if (problemas.length) {
    console.error(
      `Biblioteca de documentação com ${problemas.length} problema(s):`,
    );
    for (const problema of problemas) console.error(`  - ${problema}`);
    console.error("Como corrigir: docs/biblioteca/documentacao.md.");
    process.exit(1);
  }
  console.log(
    `Biblioteca de documentação em ordem: ${entrada.notas.size} nota(s), ${entrada.fontes.size} CLAUDE.md, nenhum link quebrado nem nota órfã.`,
  );
}

// Roda só quando chamado direto (o teste importa as funções puras).
if (
  String(process.argv[1] || "")
    .split("\\")
    .join("/")
    .endsWith("scripts/checar-links-da-biblioteca.mjs")
) {
  principal();
}
