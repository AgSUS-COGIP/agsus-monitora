import { expect, test } from "@playwright/test";

const sessionJson = process.env.E2E_SUPABASE_SESSION_JSON;

/*
  A chave vinha escrita à mão como "sb-gnudtaxhjfgtvwkwpsel-auth-token" — nome
  antigo, de antes da unificação do cliente. A aplicação lê
  "agsus-monitora-auth". Quem definisse apenas E2E_SUPABASE_SESSION_JSON semeava
  a sessão numa chave que ninguém consulta, e a corrida passava por um caminho
  não autenticado sem dizer nada.

  Fica como literal porque `src/lib/env.js` lê `import.meta.env`, que não existe
  no runtime do Playwright — importá-lo aqui derruba o ficheiro inteiro. A
  sincronia com a aplicação é garantida por teste no Vitest, onde o import
  funciona.
*/
const storageKey =
  process.env.E2E_SUPABASE_STORAGE_KEY || "agsus-monitora-auth";

test.describe("Análises autenticadas", () => {
  test.skip(
    !sessionJson,
    "Defina E2E_SUPABASE_SESSION_JSON para executar o fluxo autenticado.",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      { key: storageKey, value: sessionJson || "" },
    );
  });

  test("Inativo e Todos carregam direto, como o Ativo, sem pedir recorte", async ({
    page,
  }) => {
    // Análises é uma tela do app (src/modulos/analises/), aberta pelo menu.
    await page.goto("/");
    await expect(page.locator("#appScreen")).toBeVisible({ timeout: 30_000 });
    await page.locator('#nav [data-view="analises"]').first().click();
    const tela = page.locator("#page-analises");

    for (const escopo of ["inativo", "todos"]) {
      await tela.locator("#analises-filtro-escopo").selectOption(escopo);
      await expect(tela.locator(".ui-kpis")).toBeVisible();
      await expect(tela.locator('[data-acao="detalhes"]').first()).toBeVisible({
        timeout: 30_000,
      });
    }
  });
});
