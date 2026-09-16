import { defineConfig, devices } from "@playwright/test";

const laravel = process.env.PLAYWRIGHT_TARGET === "laravel";
const baseURL = laravel ? "http://127.0.0.1:8000" : "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests",
  /*
    Sem isto, o padrão do Playwright também casa `*.test.js` — os ficheiros do
    Vitest, que vivem na mesma pasta — e `npm run test:e2e` quebrava ao tentar
    executá-los. As duas suítes convivem: `.test.js` é unitário, `.spec.js` é
    navegador.
  */
  testMatch: "**/*.spec.js",
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: laravel
      ? "npm run build:laravel && php laravel/artisan serve --host=127.0.0.1 --port=8000 --no-reload"
      : "npm run build && npm run preview -- --host 127.0.0.1",
    url: baseURL,
    /*
      Reutilizar servidor já em execução foi o que produziu um verde falso em
      08/09/2026: um preview antigo continuava na porta 4173 servindo build
      anterior, e a suíte passou contra HTML que não existia mais no código.

      O padrão passa a ser subir servidor próprio sempre. Quem quiser a
      reutilização — para iterar rápido, sabendo o que faz — pede explicitamente
      com PLAYWRIGHT_REUSE_SERVER=1.
    */
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
  },
});
