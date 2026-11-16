import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // JSX dos componentes React; os testes estão passando de .js para .ts.
  plugins: [react()],
  test: {
    /*
      node por padrão: montar o jsdom custava 2495 s somados numa suíte de 557
      arquivos (o dobro do tempo dos testes), e metade deles não usa DOM.
      Arquivo que usa DOM começa com `// @vitest-environment jsdom`.
    */
    environment: "node",
    globals: false,
    // Durante a passagem para TypeScript valem os dois; no fim, só .ts/.tsx.
    include: ["tests/**/*.test.{js,ts,tsx}"],
    // A rede é bloqueada por omissão. Ver tests/setup/rede-bloqueada.ts.
    setupFiles: ["tests/setup/rede-bloqueada.ts", "tests/setup/endereco.ts"],
    /*
      Os testes de tela montam React no jsdom (a Lista de aprovados com 120
      linhas, a publicação das Configurações): sozinhos levam de 2 a 5,4 s numa
      máquina Windows e, com a suíte inteira em paralelo, estouravam os 5 s
      padrão sem defeito nenhum. 15 s ainda pega teste preso de verdade.
    */
    testTimeout: 15_000,
  },
});
