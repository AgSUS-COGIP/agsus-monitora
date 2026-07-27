import { execFileSync } from "node:child_process";
import { extname } from "node:path";

const BASE_REF = process.env.QUALITY_BASE_REF || "origin/main";
const SUPPORTED_EXTENSIONS = new Set([".js", ".mjs"]);
const EXCLUDED = new Set([
  "src/modules/legacy-app.js",
  "src/analises/analises-app.js",
]);

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

let changedFiles = [];
try {
  changedFiles = git(
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    BASE_REF,
    "HEAD",
  )
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
} catch (error) {
  console.error(`Não foi possível comparar o lint com ${BASE_REF}.`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const candidates = changedFiles.filter((path) => {
  if (EXCLUDED.has(path)) return false;
  if (
    path.startsWith("dist/") ||
    path.startsWith("coverage/") ||
    path.startsWith("node_modules/")
  ) {
    return false;
  }
  return SUPPORTED_EXTENSIONS.has(extname(path));
});

if (!candidates.length) {
  console.log(
    "Lint validado: nenhum ficheiro JavaScript elegível foi alterado.",
  );
  process.exit(0);
}

try {
  execFileSync("npx", ["eslint", ...candidates], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  console.log(`Lint validado em ${candidates.length} ficheiro(s) alterado(s).`);
} catch {
  process.exit(1);
}
