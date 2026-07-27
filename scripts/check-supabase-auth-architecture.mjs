import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = "src";
const EXTENSIONS = new Set([".js", ".mjs", ".ts", ".html"]);
const PATTERNS = [
  ["window-client", "cliente via window.supabase", /window\.supabase\.createClient\s*\(/g],
  ["implicit-flow", "fluxo OAuth implícito", /flowType\s*:\s*["']implicit["']/g],
  ["url-session", "detecção automática da sessão", /detectSessionInUrl\s*:\s*true/g]
];

// Tetos temporários do débito legado conhecido. As chamadas createClient abaixo
// passam pela fachada de compatibilidade e devolvem o singleton compartilhado.
// Reduções são aceites; aumentos ou ocorrências em novos ficheiros bloqueiam o build.
const BASELINE = new Map([
  ["src/modules/legacy-app.js", new Map([
    ["window-client", 1],
    ["implicit-flow", 1],
    ["url-session", 1]
  ])],
  ["src/analises/analises-app.js", new Map([
    ["window-client", 1],
    ["implicit-flow", 1],
    ["url-session", 1]
  ])],
  ["src/modules/config-governance.js", new Map([["window-client", 1]])],
  ["src/modules/health-status-details.js", new Map([["window-client", 1]])],
  ["src/modules/nucleo-cronograma-tools.js", new Map([["window-client", 1]])],
  ["src/modules/nucleo-cronograma.js", new Map([["window-client", 1]])],
  ["src/modules/nucleo-operational-enhancements.js", new Map([["window-client", 1]])],
  ["src/modules/nucleo-operational-safe.js", new Map([["window-client", 1]])]
]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const violations = [];

for (const file of walk(ROOT).filter((path) => EXTENSIONS.has(extname(path)))) {
  const path = relative(".", file).replaceAll("\\", "/");
  const content = readFileSync(file, "utf8");

  for (const [id, label, pattern] of PATTERNS) {
    const count = [...content.matchAll(pattern)].length;
    if (!count) continue;

    const allowed = BASELINE.get(path)?.get(id) || 0;
    if (count > allowed) {
      violations.push(`${path}: ${label} tem ${count} ocorrência(s); máximo permitido: ${allowed}`);
    }
  }
}

if (violations.length) {
  console.error("Regressões na arquitetura Supabase Auth:");
  violations.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("Arquitetura Supabase Auth validada: nenhuma ocorrência excede os tetos legados.");
