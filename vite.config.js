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
        authCallback: resolve(__dirname, "auth/callback.html")
      }
    }
  }
});
