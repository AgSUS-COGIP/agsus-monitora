import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHtmlSecurityPlugin } from "./src/lib/html-security.js";

const projectDirectory = dirname(fileURLToPath(import.meta.url));

function copyProgressiveWebAppAssets() {
  return {
    name: "agsus-copy-pwa-assets",
    apply: "build",
    async writeBundle(options) {
      const outputDirectory = resolve(
        projectDirectory,
        typeof options.dir === "string" ? options.dir : "dist",
      );
      await mkdir(outputDirectory, { recursive: true });

      for (const filename of [
        "manifest.webmanifest",
        "offline.html",
        "sw-policy.js",
        "sw.js",
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

export default defineConfig({
  // React em src/componentes/ (barra lateral, Calendário, Lista de Aprovados); o resto migra aos poucos.
  plugins: [react(), createHtmlSecurityPlugin(), copyProgressiveWebAppAssets()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectDirectory, "index.html"),
        analises: resolve(projectDirectory, "analises.html"),
        authCallback: resolve(projectDirectory, "auth/callback.html"),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "vendor-supabase";
          // Só a página principal usa React; Análises não baixa.
          // O Vite normaliza o id com "/", também no Windows.
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return "vendor-react";
          }
          if (id.includes("chart.js")) return "vendor-charts";
          return "vendor";
        },
      },
    },
  },
});
