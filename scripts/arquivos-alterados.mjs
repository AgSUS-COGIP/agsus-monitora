import { execFileSync } from "node:child_process";

/*
  Base comum do `npm run lint` e do `npm run format:check`.

  Os dois comparavam só com `origin/main`. Nesta máquina o remoto do repositório
  da organização se chama `corporativo` e o `origin/main` é o do fork pessoal,
  que fica velho: o lint comparava com a base errada (ou com nenhuma). A base
  agora é procurada nesta ordem:

  1. `QUALITY_BASE_REF`, quando alguém quiser forçar;
  2. `origin/<GITHUB_BASE_REF>`, a base do pull request no CI;
  3. `corporativo/main`, o repositório da organização nesta máquina;
  4. `origin/main` e `main`.

  Sem nenhuma delas, devolve `null` e quem chamou verifica `src/` inteiro, em
  vez de passar sem olhar nada.
*/

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function existe(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export function resolverBase() {
  const candidatos = [
    process.env.QUALITY_BASE_REF,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "corporativo/main",
    "origin/main",
    "main",
  ].filter(Boolean);
  return candidatos.find(existe) ?? null;
}

/*
  Compara com o ponto onde o ramo saiu da base, para não pegar o que a base
  mudou depois. No clone raso do CI não há histórico para achar esse ponto;
  aí compara com a ponta da base, que lá é o próprio alvo do pull request.
*/
function pontoDePartida(base) {
  try {
    return git(["merge-base", "HEAD", base]) || base;
  } catch {
    return base;
  }
}

const FORA = ["dist/", "coverage/", "node_modules/"];

/**
 * Arquivos alterados em relação à base, ou `null` quando não há base.
 * @returns {{ base: string, arquivos: string[] } | null}
 */
export function arquivosAlterados() {
  const base = resolverBase();
  if (!base) return null;
  const arquivos = git([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    pontoDePartida(base),
    "HEAD",
  ])
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((caminho) => !FORA.some((pasta) => caminho.startsWith(pasta)));
  return { base, arquivos };
}
