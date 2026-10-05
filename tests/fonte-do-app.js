import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
  O código do app (src/app/, recursivo) num texto só, para os testes que
  conferem que algo NÃO voltou (função antiga, chave abandonada, escrita
  direta numa tabela). O antigo src/modules/legacy-app.js virou src/app/.
*/
function arquivos(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return arquivos(caminho);
    return /\.(js|jsx)$/.test(item.name) ? [caminho] : [];
  });
}

export function fonteDoApp() {
  return arquivos("src/app")
    .map((arquivo) => readFileSync(arquivo, "utf8"))
    .join("\n");
}
