import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Os componentes React (src/componentes/) são .jsx; os testes seguem .js.
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["tests/**/*.test.js"],
    // A rede é bloqueada por omissão. Ver tests/setup/rede-bloqueada.js.
    setupFiles: ["tests/setup/rede-bloqueada.js"],
  },
});
