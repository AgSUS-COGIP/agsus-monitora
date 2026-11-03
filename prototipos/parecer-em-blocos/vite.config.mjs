import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/*
  Build da página avulsa do protótipo "Montar parecer" (fora do build do app):
    npx vite build --config prototipos/parecer-em-blocos/vite.config.mjs
  O simulador original (o HTML da equipe, que não fica no repositório) entra
  como texto (__SIMULADOR_HTML__) para a aba de comparação quando
  SIMULADOR_DE_PARECERES aponta para ele; sem a variável, a aba avisa. Depois, `node prototipos/parecer-em-blocos/empacotar.mjs`
  junta tudo num HTML só, para abrir sem servidor.
*/
const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");

export default defineConfig({
  // A raiz é a do repositório: a página fica em /prototipos/parecer-em-blocos/.
  root: raiz,
  base: "./",
  plugins: [react()],
  define: {
    __SIMULADOR_HTML__: JSON.stringify(
      process.env.SIMULADOR_DE_PARECERES
        ? readFileSync(process.env.SIMULADOR_DE_PARECERES, "utf8")
        : "",
    ),
  },
  build: {
    outDir: resolve(aqui, "dist"),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: resolve(aqui, "index.html"),
      output: { inlineDynamicImports: true },
    },
  },
});
