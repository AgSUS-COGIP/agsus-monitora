import { execFileSync } from "node:child_process";

const ALVO = "new MutationObserver";
const AREA = "src";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function existe(ref) {
  try {
    git(["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
}

function resolveBase() {
  const candidatos = [
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "main",
    "HEAD~1",
  ].filter(Boolean);

  const base = candidatos.find(existe);
  if (!base) {
    throw new Error(
      "Não foi possível determinar a base para a verificação arquitetural.",
    );
  }
  return base;
}

/*
  Conta ocorrências, não linhas adicionadas.

  A versão anterior lia as linhas `+` do diff. Isso confunde *usar* com
  *reescrever*: quando o prettier reformatou `analises-dark-mode-fix.js`, a
  linha do observador existente reapareceu como adição e o check reprovou um PR
  que não introduziu observador nenhum. O que a regra quer proibir é o número
  crescer — então é o número que se compara.
*/
function ficheirosComAlvo(ref) {
  try {
    return git(["grep", "-l", "-F", ALVO, ref, "--", AREA])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((linha) => linha.slice(linha.indexOf(":") + 1));
  } catch {
    // `git grep` sai com 1 quando não há nenhuma ocorrência.
    return [];
  }
}

function quantidadeNoFicheiro(ref, ficheiro) {
  let conteudo;
  try {
    conteudo = git(["show", `${ref}:${ficheiro}`]);
  } catch {
    // O ficheiro não existe nessa revisão.
    return 0;
  }
  return conteudo.split(ALVO).length - 1;
}

const base = resolveBase();
const ficheiros = new Set([
  ...ficheirosComAlvo(base),
  ...ficheirosComAlvo("HEAD"),
]);

const violacoes = [];
let total = 0;

for (const ficheiro of [...ficheiros].sort()) {
  const antes = quantidadeNoFicheiro(base, ficheiro);
  const agora = quantidadeNoFicheiro("HEAD", ficheiro);
  total += agora;
  if (agora > antes) {
    violacoes.push(`  ${ficheiro}: ${antes} -> ${agora}`);
  }
}

if (violacoes.length) {
  console.error(
    `Novos usos de MutationObserver não são permitidos em ${AREA}/.`,
  );
  console.error(
    "Use eventos explícitos, callbacks de renderização ou estado controlado.",
  );
  violacoes.forEach((linha) => console.error(linha));
  process.exit(1);
}

console.log(
  `Arquitetura DOM validada: ${total} uso(s) de MutationObserver em ${AREA}/, nenhum novo em relação a ${base}.`,
);
