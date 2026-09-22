import { readFileSync, writeFileSync } from "node:fs";
import { ficheiroDosVereditos } from "./veredito-para-o-mapa.mjs";

/*
  RECOMPILA O FICHEIRO DO PACOTE A PARTIR DA AUDITORIA JÁ FEITA

  `validar-localizacoes.mjs` fala com o CNES e com o IBGE, demora, e depende de
  os dois estarem de pé. Quando o que muda é só a FORMA do que viaja no pacote
  — e não os vereditos —, refazer a auditoria inteira é pedir a três serviços
  que confirmem outra vez aquilo que já está escrito em
  `public/data/localizacoes-validadas.json`.

  Os dois escrevem pelo mesmo `ficheiroDosVereditos`, para não poderem divergir.

      node scripts/recompilar-vereditos.mjs
*/
const auditoria = JSON.parse(
  readFileSync("public/data/localizacoes-validadas.json", "utf8"),
);
const registros = auditoria?.registros;
if (!Array.isArray(registros) || !registros.length) {
  console.error("public/data/localizacoes-validadas.json não tem registros.");
  process.exit(1);
}

const destino = "src/lib/localizacoes-validadas-gerado.js";
const texto = await ficheiroDosVereditos(registros);
writeFileSync(destino, texto);

const porEstado = new Map();
for (const r of registros)
  porEstado.set(r.estado, (porEstado.get(r.estado) || 0) + 1);

console.log(
  `${registros.length} vereditos, auditados em ${auditoria.gerado_em}`,
);
for (const [estado, n] of [...porEstado].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${estado}`);
}
console.log("");
console.log(
  `escrito: ${destino}  (${(Buffer.byteLength(texto) / 1024).toFixed(0)} KB)`,
);
