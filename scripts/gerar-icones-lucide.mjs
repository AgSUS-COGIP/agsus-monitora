/*
  GERA src/styles/icones-lucide.css A PARTIR DO MAPA FONT AWESOME → LUCIDE

      npm run icones

  Cada classe `fa-…` de `src/lib/mapa-de-icones-lucide.js` vira uma regra que
  desenha o ícone Lucide no `::before` do `<i>` — o mesmo lugar onde o Font
  Awesome desenhava o glifo. O `<i>` continua com o tamanho, o fundo e a cor
  que o CSS de cada tela já lhe dá (vários são o próprio quadradinho colorido
  de um KPI); só o desenho muda.

  O ícone é uma máscara: o SVG entra como `mask-image` e a cor vem de
  `background-color: currentColor`, então segue a cor do texto como a fonte
  seguia. `img-src data:` já é permitido pela CSP (vercel.json).
*/
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as lucide from "lucide";
import { FA_PARA_LUCIDE } from "../src/lib/mapa-de-icones-lucide.js";

function svgDaMascara(no) {
  const filhos = no
    .map(
      ([tag, atributos]) =>
        `<${tag} ${Object.entries(atributos)
          .map(([k, v]) => `${k}='${String(v)}'`)
          .join(" ")}/>`,
    )
    .join("");
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' ` +
    `stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${filhos}</svg>`
  );
}

function urlDeDados(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/%2C/g, ",")}")`;
}

export function gerarCssDosIcones() {
  const regras = Object.entries(FA_PARA_LUCIDE)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([classe, nome]) => {
      const no = lucide[nome];
      if (!Array.isArray(no))
        throw new Error(`Ícone Lucide inexistente: ${nome} (${classe})`);
      return `.${classe} {\n  --icone-lucide: ${urlDeDados(svgDaMascara(no))};\n}`;
    });

  return `/*
  GERADO por scripts/gerar-icones-lucide.mjs a partir de
  src/lib/mapa-de-icones-lucide.js. Não edite à mão: rode \`npm run icones\`.

  Ícones Lucide no lugar do Font Awesome, com as mesmas classes \`fa-…\`.
*/
.fa-solid,
.fa-regular,
.fa-brands {
  display: inline-block;
  font-style: normal;
  line-height: 1;
}
.fa-solid::before,
.fa-regular::before,
.fa-brands::before {
  content: "";
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  background-color: currentColor;
  -webkit-mask: var(--icone-lucide) center / contain no-repeat;
  mask: var(--icone-lucide) center / contain no-repeat;
}
.fa-fw {
  width: 1.25em;
  text-align: center;
}
.fa-spin {
  animation: icone-lucide-girar 1s linear infinite;
}
@keyframes icone-lucide-girar {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .fa-spin {
    animation: none;
  }
}

${regras.join("\n")}
`;
}

// Só na linha de comando: no Vitest `import.meta.url` não é um caminho de arquivo.
if (
  import.meta.url.startsWith("file:") &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  const destino = fileURLToPath(
    new URL("../src/styles/icones-lucide.css", import.meta.url),
  );
  writeFileSync(destino, gerarCssDosIcones());
  console.log(
    `icones-lucide.css: ${Object.keys(FA_PARA_LUCIDE).length} ícones gerados.`,
  );
}
