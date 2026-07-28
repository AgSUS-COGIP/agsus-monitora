import { defineConfig } from "vite";
import { resolve } from "node:path";
import { createHtmlSecurityPlugin } from "./src/lib/html-security.js";

export default defineConfig({
  plugins: [createHtmlSecurityPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        analises: resolve(__dirname, "analises.html"),
        authCallback: resolve(__dirname, "auth/callback.html"),
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
