import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding:"utf8", stdio:["ignore", "pipe", "pipe"] }).trim();
}

function resolveBase() {
  const candidates = [
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "main",
    "HEAD~1"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      git(["rev-parse", "--verify", candidate]);
      return candidate;
    } catch {
      // Tenta o próximo candidato.
    }
  }
  throw new Error("Não foi possível determinar a base para a verificação arquitetural.");
}

const base = resolveBase();
const diff = git(["diff", "--unified=0", `${base}...HEAD`, "--", "src"]);
const violations = diff
  .split(/\r?\n/)
  .filter(line => line.startsWith("+") && !line.startsWith("+++"))
  .filter(line => /\bMutationObserver\b/.test(line));

if (violations.length) {
  console.error("Novos usos de MutationObserver não são permitidos em src/.");
  console.error("Use eventos explícitos, callbacks de renderização ou estado controlado.");
  violations.forEach(line => console.error(line));
  process.exit(1);
}

console.log(`Verificação concluída: nenhum novo MutationObserver em src/ desde ${base}.`);