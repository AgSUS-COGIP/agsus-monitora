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
  legado move para fora dele.
*/

export const PASTAS_DO_LEGADO = ["src/modules/", "src/analises/"];

/** Os arquivos de `agora` que estão numa pasta do legado e não existiam `antes`. */
export function arquivosNovosNoLegado(antes, agora, pastas = PASTAS_DO_LEGADO) {
  const existiam = new Set(antes);
  return agora.filter(
    (caminho) =>
      pastas.some((pasta) => caminho.startsWith(pasta)) &&
      !existiam.has(caminho),
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
    `Legado sem arquivo novo: ${agora.length} arquivo(s) em ${PASTAS_DO_LEGADO.join(" e ")} (${antes.length} onde o ramo saiu de ${base}).`,
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
