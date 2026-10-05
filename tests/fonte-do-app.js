import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*
  O código do app (src/app/, recursivo) num texto só, para os testes que
  conferem que algo NÃO voltou (função antiga, chave abandonada, escrita
  direta numa tabela). Inclui o que restar de src/modules/legacy-app.js.
*/
function arquivos(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return arquivos(caminho);
    return /\.(js|jsx)$/.test(item.name) ? [caminho] : [];
  });
}

export function fonteDoApp() {
  const lista = arquivos("src/app");
  if (existsSync("src/modules/legacy-app.js"))
    lista.push("src/modules/legacy-app.js");
  return lista.map((arquivo) => readFileSync(arquivo, "utf8")).join("\n");
}
