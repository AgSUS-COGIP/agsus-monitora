import { execFileSync } from "node:child_process";
import { extname } from "node:path";
import { arquivosAlterados } from "./arquivos-alterados.mjs";

const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
  ".css",
  ".html",
]);
const EXCLUDED = new Set(["index.html"]);

let alvos;
let descricao;
const alteracao = arquivosAlterados();

if (!alteracao) {
  console.log(
    "Sem base para comparar (corporativo/main, origin/main ou main).",
  );
  alvos = ["src"];
  descricao = "em src/ inteiro";
} else {
  alvos = alteracao.arquivos.filter(
    (caminho) =>
      !EXCLUDED.has(caminho) && SUPPORTED_EXTENSIONS.has(extname(caminho)),
  );
  if (!alvos.length) {
    console.log(
      `Formatação validada: nenhum ficheiro elegível foi alterado em relação a ${alteracao.base}.`,
    );
    process.exit(0);
  }
  descricao = `em ${alvos.length} ficheiro(s) alterado(s) em relação a ${alteracao.base}`;
}

try {
  execFileSync("npx", ["prettier", "--check", ...alvos], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  console.log(`Formatação validada ${descricao}.`);
} catch {
  process.exit(1);
}
