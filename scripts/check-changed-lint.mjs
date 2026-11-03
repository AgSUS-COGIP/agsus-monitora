import { execFileSync } from "node:child_process";
import { extname } from "node:path";
import { arquivosAlterados } from "./arquivos-alterados.mjs";

const SUPPORTED_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

/*
  Mudou a regra (configuração do ESLint ou versão dos pacotes), muda o
  resultado de todos os arquivos: aí o lint passa por `src/` inteiro.
*/
const MUDA_A_REGRA = new Set([
  "eslint.config.js",
  "package.json",
  "package-lock.json",
  "tsconfig.frontend.json",
]);

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
  const elegiveis = alteracao.arquivos.filter((caminho) =>
    SUPPORTED_EXTENSIONS.has(extname(caminho)),
  );
  if (alteracao.arquivos.some((caminho) => MUDA_A_REGRA.has(caminho))) {
    console.log(`A configuração do lint mudou em relação a ${alteracao.base}.`);
    const fora = elegiveis.filter((caminho) => !caminho.startsWith("src/"));
    alvos = ["src", ...fora];
    descricao = `em src/ inteiro e em ${fora.length} outro(s) ficheiro(s)`;
  } else if (!elegiveis.length) {
    console.log(
      `Lint validado: nenhum ficheiro JavaScript ou TypeScript elegível foi alterado em relação a ${alteracao.base}.`,
    );
    process.exit(0);
  } else {
    alvos = elegiveis;
    descricao = `em ${alvos.length} ficheiro(s) alterado(s) em relação a ${alteracao.base}`;
  }
}

try {
  execFileSync("npx", ["eslint", ...alvos], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  console.log(`Lint validado ${descricao}.`);
} catch {
  process.exit(1);
}
