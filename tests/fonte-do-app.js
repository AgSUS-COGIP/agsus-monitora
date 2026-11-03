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
    return /\.(js|jsx|ts|tsx)$/.test(item.name) ? [caminho] : [];
  });
}

export function fonteDoApp() {
  return arquivos("src/app")
    .map((arquivo) => readFileSync(arquivo, "utf8"))
    .join("\n");
}

/**
 * O texto sem os trechos entre `abre` e `fecha` (comentários HTML ou de
 * bloco), por indexOf: um trecho não remonta outro depois de tirado, como
 * aconteceria com um replace de expressão regular (CodeQL
 * js/incomplete-multi-character-sanitization).
 */
export function semTrechos(texto, abre, fecha) {
  let saida = "";
  let posicao = 0;
  for (;;) {
    const inicio = texto.indexOf(abre, posicao);
    if (inicio < 0) return saida + texto.slice(posicao);
    saida += texto.slice(posicao, inicio);
    const fim = texto.indexOf(fecha, inicio + abre.length);
    if (fim < 0) return saida;
    posicao = fim + fecha.length;
  }
}
