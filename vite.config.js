import { defineConfig } from "vite";
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
  plugins: [createHtmlSecurityPlugin(), copyProgressiveWebAppAssets()],
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
          if (id.includes("chart.js")) return "vendor-charts";
          if (id.includes("echarts")) return "vendor-echarts";
          if (id.includes("pdfjs-dist") || id.includes("tesseract.js")) {
            return "vendor-documents";
          }
          return "vendor";
        },
      },
    },
  },
});
