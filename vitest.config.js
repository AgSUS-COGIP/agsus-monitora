import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["tests/**/*.test.js"],
    // A rede é bloqueada por omissão. Ver tests/setup/rede-bloqueada.js.
    setupFiles: ["tests/setup/rede-bloqueada.js"],
  },
});
