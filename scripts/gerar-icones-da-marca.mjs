/*
  Gera os ícones em PNG do PWA a partir do símbolo do Yeendé (icons/yeende.svg),
  a fonte única do desenho. Rode depois de mexer no símbolo:

    npm run icones:marca

  Os PNG levam fundo sólido no verde-escuro da marca (o da arte de referência,
  25/11/2026): o iOS não aceita transparência no apple-touch-icon (pinta o
  vazio de preto) e o ícone "maskable" é recortado pelo sistema, então precisa
  ser cheio até a borda. O favicon e o ícone "any" em SVG continuam sem fundo.
  Sobre o verde-escuro, o corpo do pássaro é o creme da referência.

  Desenha com o Chromium do Playwright (já é dependência dos testes e2e).
*/
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERDE_ESCURO = "#022d20";
const CREME = "#fdf8ec";

/*
  Cada ícone: tamanho final, o quanto da largura o símbolo ocupa e o canto do
  fundo. O "maskable" guarda o símbolo dentro do círculo seguro (80% do lado):
  o símbolo é mais largo que alto, então 62% da largura cabe no círculo.
*/
const ICONES = [
  { arquivo: "yeende-192.png", lado: 192, largura: 0.78, canto: 0.22 },
  { arquivo: "yeende-512.png", lado: 512, largura: 0.78, canto: 0.22 },
  { arquivo: "yeende-maskable-512.png", lado: 512, largura: 0.62, canto: 0 },
  { arquivo: "yeende-apple-180.png", lado: 180, largura: 0.74, canto: 0 },
];

const fonte = await readFile(resolve(raiz, "icons/yeende.svg"), "utf8");
/* Só as formas: tira título, descrição e o estilo do corpo (aqui ele é creme). */
const formas = fonte
  .replace(/^[\s\S]*?<\/style>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace('class="corpo"', `fill="${CREME}"`)
  .trim();

function svgDoIcone({ largura, canto }) {
  const escala = largura;
  const deslocamento = 50 - 50 * escala;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="${canto * 100}" fill="${VERDE_ESCURO}"/>
<g transform="translate(${deslocamento} ${deslocamento}) scale(${escala})">${formas}</g>
</svg>`;
}

const navegador = await chromium.launch();
try {
  for (const icone of ICONES) {
    const pagina = await navegador.newPage({
      viewport: { width: icone.lado, height: icone.lado },
    });
    await pagina.setContent(
      `<html><body style="margin:0;background:transparent">${svgDoIcone(
        icone,
      ).replace(
        "<svg ",
        `<svg width="${icone.lado}" height="${icone.lado}" style="display:block" `,
      )}</body></html>`,
    );
    const png = await pagina.screenshot({ omitBackground: true });
    await writeFile(resolve(raiz, "icons", icone.arquivo), png);
    await pagina.close();
    console.log(`icons/${icone.arquivo} (${icone.lado}px)`);
  }
} finally {
  await navegador.close();
}
