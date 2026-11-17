import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHtmlSecurityPlugin } from "./src/lib/html-security";
import {
  arquivosParaGuardar,
  swComVersao,
} from "./src/lib/cache-do-service-worker";
import { novidadesVisiveis } from "./src/lib/novidades.ts";
import { apiLocalNoVite } from "./scripts/servir-api-no-vite.mjs";

const projectDirectory = dirname(fileURLToPath(import.meta.url));

/*
  Versão do build: na Vercel é o commit; fora dela, a hora do build. Vai para
  o aviso de versão nova e para o nome do cache do service worker.
*/
const VERSAO_DO_BUILD =
  (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12) ||
  `local-${Date.now().toString(36)}`;

/* Os arquivos de uma pasta, com o caminho a partir dela ("fonts/x.woff2"). */
async function arquivosDaPasta(pasta, prefixo) {
  const entradas = await readdir(pasta, {
    recursive: true,
    withFileTypes: true,
  });
  return entradas
    .filter((entrada) => entrada.isFile())
    .map((entrada) =>
      join(prefixo, relative(pasta, join(entrada.parentPath, entrada.name))),
    );
}

function copyProgressiveWebAppAssets() {
  return {
    name: "agsus-copy-pwa-assets",
    apply: "build",
    async writeBundle(options, bundle) {
      const outputDirectory = resolve(
        projectDirectory,
        typeof options.dir === "string" ? options.dir : "dist",
      );
      await mkdir(outputDirectory, { recursive: true });

      /*
        O que o service worker guarda na instalação: o que o Vite gerou (os
        pedaços de todas as telas), o que vem de public/ e os ícones.
        Fica de fora o que arquivosParaGuardar exclui (src/lib/cache-do-service-worker.ts).
      */
      const publicados = arquivosParaGuardar([
        ...Object.keys(bundle),
        ...(await arquivosDaPasta(resolve(projectDirectory, "public"), "")),
        ...(await arquivosDaPasta(resolve(projectDirectory, "icons"), "icons")),
      ]);
      await writeFile(
        resolve(outputDirectory, "sw.js"),
        swComVersao(
          await readFile(resolve(projectDirectory, "sw.js"), "utf8"),
          VERSAO_DO_BUILD,
          publicados,
        ),
      );
      for (const filename of [
        "manifest.webmanifest",
        "offline.html",
        "sw-policy.js",
      ]) {
        await cp(
          resolve(projectDirectory, filename),
          resolve(outputDirectory, filename),
        );
      }

      await cp(
        resolve(projectDirectory, "icons"),
        resolve(outputDirectory, "icons"),
        { recursive: true },
      );
    },
  };
}

/*
  Versão do build para o aviso de versão nova (src/app/aviso-de-versao.ts):
  grava a versão no JS (`__VERSAO_DO_BUILD__`) e publica `/versao.json` com a
  mesma versão e as novidades visíveis (src/lib/novidades.ts). Na Vercel é o
  commit; fora dela, a hora do build. A página aberta compara as duas.
*/
function publicarVersaoDoBuild() {
  const versao = VERSAO_DO_BUILD;
  return {
    name: "agsus-versao-do-build",
    apply: "build",
    config: () => ({
      define: { __VERSAO_DO_BUILD__: JSON.stringify(versao) },
    }),
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "versao.json",
        source: JSON.stringify({ versao, novidades: novidadesVisiveis() }),
      });
    },
  };
}

export default defineConfig({
  // React em src/componentes/ (barra lateral, Calendário, Lista de Aprovados); o resto migra aos poucos.
  plugins: [
    react(),
    createHtmlSecurityPlugin(),
    copyProgressiveWebAppAssets(),
    publicarVersaoDoBuild(),
    apiLocalNoVite(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectDirectory, "index.html"),
        authCallback: resolve(projectDirectory, "auth/callback.html"),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "vendor-supabase";
          // A página principal usa React; Análises não baixa.
          // O Vite normaliza o id com "/", também no Windows.
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return "vendor-react";
          }
          if (id.includes("chart.js")) return "vendor-charts";
          // O PDF dos espelhos de nota (jsPDF, autotable, fflate e o que o jsPDF
          // carrega sozinho para html() e SVG): fora do vendor da entrada; o
          // Rollup os põe nos chunks do import dinâmico (espelho-em-pdf.ts), que
          // só baixam quando alguém pede um PDF.
          if (
            /\/node_modules\/(jspdf|jspdf-autotable|fflate|fast-png|iobuffer|pako|@babel\/runtime|html2canvas|canvg|core-js|raf|performance-now|regenerator-runtime|rgbcolor|stackblur-canvas|svg-pathdata|css-line-break|text-segmentation|utrie|base64-arraybuffer)\//.test(
              id,
            )
          ) {
            return undefined;
          }
          return "vendor";
        },
      },
    },
  },
});
