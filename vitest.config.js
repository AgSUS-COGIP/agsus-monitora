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
    /*
      Os testes de tela montam React no jsdom (a Lista de aprovados com 120
      linhas, a publicação das Configurações): sozinhos levam de 2 a 5,4 s numa
      máquina Windows e, com a suíte inteira em paralelo, estouravam os 5 s
      padrão sem defeito nenhum. 15 s ainda pega teste preso de verdade.
    */
    testTimeout: 15_000,
  },
});
