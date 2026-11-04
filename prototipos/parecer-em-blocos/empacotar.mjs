import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
  Junta o build do protótipo (dist/) num HTML só: o CSS e o JS entram no
  próprio arquivo, que abre com dois cliques, sem servidor.
    node prototipos/parecer-em-blocos/empacotar.mjs [saída.html]
*/
const aqui = dirname(fileURLToPath(import.meta.url));
const dist = resolve(aqui, "dist");
const saida = resolve(
  process.argv[2] || resolve(dist, "montar-parecer-prototipo.html"),
);
let html = readFileSync(
  resolve(dist, "prototipos/parecer-em-blocos/index.html"),
  "utf8",
);
const assets = readdirSync(resolve(dist, "assets"));
const css = assets
  .filter((a) => a.endsWith(".css"))
  .map((a) => readFileSync(resolve(dist, "assets", a), "utf8"));
const js = assets
  .filter((a) => a.endsWith(".js"))
  .map((a) => readFileSync(resolve(dist, "assets", a), "utf8"));
html = html
  .replace(/<link rel="stylesheet"[^>]*>/g, "")
  .replace(/<script type="module"[^>]*><\/script>/g, "")
  .replace("</head>", () => `<style>\n${css.join("\n")}\n</style>\n</head>`)
  .replace(
    "</body>",
    // "</script", "<script" e "<!--" dentro do JS (o simulador embutido) mudariam o
    // fim do <script> no HTML: viram "\x3C…", que nas strings do JS é o mesmo "<".
    () =>
      `<script type="module">\n${js.join("\n").replace(/<(\/?script|!--)/gi, "\\x3C$1")}\n</script>\n</body>`,
  );
writeFileSync(saida, html);
console.log(
  `Protótipo empacotado: ${saida} (${Math.round(html.length / 1024)} KB)`,
);
