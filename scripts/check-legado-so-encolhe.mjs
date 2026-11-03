import { execFileSync } from "node:child_process";

/*
  O legado só encolhe.

  O front está migrando para um app React só (docs/arquitetura-react.md):
  tela nova nasce em src/modulos/ (ou, enquanto a pasta não recebe os
  primeiros módulos, em src/componentes/), montada com src/app/ e src/ui/.
  src/modules/ (o legado do index.html) e src/analises/ (o painel legado de
  Análises) só podem perder arquivos: editar o que existe pode; arquivo novo
  nessas pastas, não.

  Compara a lista de arquivos de HEAD com a do ponto onde o ramo saiu da base
  (o ramo de destino). Renomear dentro da pasta também conta como arquivo novo
  — o nome antigo some e o novo aparece; quem precisa mover um arquivo do
  legado move para fora dele. A exceção é a migração para TypeScript: `x.ts`
  (ou `x.tsx`) no lugar de `x.js` (ou `x.jsx`), que sumiu, é o mesmo arquivo.

  E o legado já não tem JavaScript escrito à mão (a última leva saiu em
  03/11/2026: a marca e o Sair foram para a barra lateral e a casca em React,
  o Mapa/Satélite e as Terras Indígenas viraram TypeScript). Nenhum `.js`
  (nem `.jsx`, `.mjs`, `.cjs`) pode voltar a estas pastas, nem editado de um
  que já existia na base: só o gerado da Aya, que `npm run aya:conhecimento`
  reescreve a partir de docs/aya/.
*/

export const PASTAS_DO_LEGADO = ["src/modules/", "src/analises/"];

/* O único JavaScript que fica no legado: gerado, não escrito à mão. */
export const JAVASCRIPT_PERMITIDO_NO_LEGADO = Object.freeze([
  "src/modules/aya-conhecimento-gerado.js",
]);

const JAVASCRIPT = /\.(?:c|m)?jsx?$/i;

/** Os arquivos JavaScript nas pastas do legado, fora os permitidos (o gerado). */
export function javascriptNoLegado(
  arquivos,
  pastas = PASTAS_DO_LEGADO,
  permitidos = JAVASCRIPT_PERMITIDO_NO_LEGADO,
) {
  return arquivos.filter(
    (caminho) =>
      pastas.some((pasta) => caminho.startsWith(pasta)) &&
      JAVASCRIPT.test(caminho) &&
      !permitidos.includes(caminho),
  );
}

/* Os nomes em JavaScript de que um arquivo TypeScript pode ser a migração. */
function origensEmJavaScript(caminho) {
  const base = caminho.replace(/.tsx?$/, "");
  return base === caminho ? [] : [`${base}.js`, `${base}.jsx`];
}

/**
 * Os arquivos de `agora` que estão numa pasta do legado e não existiam `antes`.
 * O `.ts`/`.tsx` que substitui um `.js`/`.jsx` de `antes` (que já não está em
 * `agora`) é migração, não arquivo novo.
 */
export function arquivosNovosNoLegado(antes, agora, pastas = PASTAS_DO_LEGADO) {
  const existiam = new Set(antes);
  const continuam = new Set(agora);
  const migrado = (caminho) =>
    origensEmJavaScript(caminho).some(
      (origem) => existiam.has(origem) && !continuam.has(origem),
    );
  return agora.filter(
    (caminho) =>
      pastas.some((pasta) => caminho.startsWith(pasta)) &&
      !existiam.has(caminho) &&
      !migrado(caminho),
  );
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function existe(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch {
    return false;
  }
}

/*
  A base é o ramo para onde a mudança vai: no CI, o do pull request; aqui, o
  upstream do ramo atual (um ramo criado de corporativo/main compara com ele,
  mesmo que o origin/main local esteja velho); depois, origin/main e main.
*/
function resolverBase() {
  const candidatos = [
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "@{upstream}",
    "origin/main",
    "main",
  ].filter(Boolean);
  const base = candidatos.find(existe);
  if (!base)
    throw new Error(
      "Não foi possível determinar a base para a verificação do legado.",
    );
  return base;
}

/*
  Compara com o ponto onde o ramo saiu da base, não com a ponta dela: se a
  base andou e apagou um arquivo do legado, o ramo ainda o tem, e isso não é
  arquivo novo. Sem histórico para achar o ponto (clone raso do CI), usa a
  ponta da base.
*/
function pontoDePartida(base) {
  try {
    return git(["merge-base", "HEAD", base]).trim() || base;
  } catch {
    return base;
  }
}

function arquivosEm(ref) {
  return git([
    "ls-tree",
    "-r",
    "--name-only",
    ref,
    "--",
    ...PASTAS_DO_LEGADO.map((pasta) => pasta.replace(/\/$/, "")),
  ])
    .split(/\r?\n/)
    .filter(Boolean);
}

function principal() {
  const base = resolverBase();
  const antes = arquivosEm(pontoDePartida(base));
  const agora = arquivosEm("HEAD");
  const novos = arquivosNovosNoLegado(antes, agora);
  const javascript = javascriptNoLegado(agora);

  if (javascript.length) {
    console.error(`JavaScript no legado (${PASTAS_DO_LEGADO.join(", ")}):`);
    javascript.forEach((caminho) => console.error(`  ${caminho}`));
    console.error(
      "O legado não tem mais JavaScript escrito à mão: código novo é TypeScript/React em src/modulos/, src/componentes/, src/app/ ou src/ui/; um módulo do legado que precise mudar vira .ts. Ver docs/arquitetura-react.md.",
    );
    process.exit(1);
  }

  if (novos.length) {
    console.error(
      `Arquivo novo no legado (${PASTAS_DO_LEGADO.join(", ")}) desde que o ramo saiu de ${base}:`,
    );
    novos.forEach((caminho) => console.error(`  ${caminho}`));
    console.error(
      "O legado só encolhe: tela nova vai para src/modulos/ (ou src/componentes/), montada com src/app/ e src/ui/. Ver docs/arquitetura-react.md.",
    );
    process.exit(1);
  }

  console.log(
    `Legado sem arquivo novo nem JavaScript escrito à mão: ${agora.length} arquivo(s) em ${PASTAS_DO_LEGADO.join(" e ")} (${antes.length} onde o ramo saiu de ${base}).`,
  );
}

// Roda só quando chamado direto (o teste importa `arquivosNovosNoLegado`).
if (
  String(process.argv[1] || "")
    .split("\\")
    .join("/")
    .endsWith("scripts/check-legado-so-encolhe.mjs")
) {
  principal();
}
