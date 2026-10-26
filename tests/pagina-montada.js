import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Casca } from "../src/app/casca/casca.tsx";

/*
  A página como o navegador a tem depois de src/main.ts desenhar a casca
  (src/app/casca/): o index.html com o `#appScreen` preenchido. Os testes que
  conferem a marcação fixa do app (seções das telas, cabeçalho, aviso global,
  blocos de Configurações) leem daqui — o index.html sozinho só tem a raiz.
*/
const RAIZ = '<section id="appScreen" class="app hidden"></section>';

export function htmlDaPagina() {
  const indice = readFileSync("index.html", "utf8");
  if (!indice.includes(RAIZ))
    throw new Error("index.html sem a raiz vazia do #appScreen");
  return indice.replace(
    RAIZ,
    `<section id="appScreen" class="app hidden">${renderToStaticMarkup(createElement(Casca))}</section>`,
  );
}
