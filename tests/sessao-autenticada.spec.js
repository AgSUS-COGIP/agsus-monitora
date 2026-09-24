import { expect, test } from "@playwright/test";

/*
  Fluxos autenticados: sessão, logout, persistência de configuração e presença.

  Como o `analises-authenticated.spec.js`, esta suíte semeia a sessão no
  armazenamento em vez de encenar o login com o Google — o provedor externo não
  entra num teste automatizado. O que fica sob prova é o que o Monitora faz com
  uma sessão válida: mantém-na ao recarregar, encerra-a por inteiro no logout,
  reaplica a configuração vinda do banco e marca presença.

  Só corre com `E2E_SUPABASE_SESSION_JSON` definida, apontando para um Supabase de
  **desenvolvimento**. Sem ela, os testes são pulados — nunca passam por vacuidade.

  A chave é literal porque `src/lib/env.js` lê `import.meta.env`, ausente no
  runtime do Playwright. `tests/chaves-de-sessao.test.js` falha se ela divergir da
  que a aplicação usa.
*/

const sessionJson = process.env.E2E_SUPABASE_SESSION_JSON;
const storageKey =
  process.env.E2E_SUPABASE_STORAGE_KEY || "agsus-monitora-auth";

const semearSessao = async (page) => {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: storageKey, value: sessionJson || "" },
  );
};

const abrirApp = async (page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#appScreen")).toBeVisible({ timeout: 30_000 });
};

test.describe("sessão autenticada", () => {
  test.skip(
    !sessionJson,
    "Defina E2E_SUPABASE_SESSION_JSON (Supabase de desenvolvimento) para executar os fluxos autenticados.",
  );

  test.beforeEach(async ({ page }) => {
    await semearSessao(page);
  });

  test("entra com a sessão e mostra o shell, não a tela de acesso", async ({
    page,
  }) => {
    await abrirApp(page);
    await expect(page.locator("#loginScreen")).toBeHidden();
  });

  /*
    Esta é a regressão que motivou `src/lib/sessao.js`: recarregar não pode
    produzir "Sessão expirada".
  */
  test("recarregar a página mantém a sessão", async ({ page }) => {
    await abrirApp(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#appScreen")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#loginScreen")).toBeHidden();
    await expect(page.locator("body")).not.toContainText("Sessão expirada");
  });

  test("o logout da barra lateral encerra a sessão e limpa o armazenamento", async ({
    page,
  }) => {
    await abrirApp(page);
    await page.locator(".sidebar .side-logout").click();
    // O Sair pede confirmação (nielsen-shell-ux.js) antes de encerrar.
    await page.locator("[data-shell-logout-confirm]").click();
    await expect(page.locator("#loginScreen")).toBeVisible({ timeout: 30_000 });
    const guardado = await page.evaluate(
      (chave) => localStorage.getItem(chave),
      storageKey,
    );
    expect(guardado).toBeNull();
  });

  test("a configuração do banco sobrevive ao recarregamento", async ({
    page,
  }) => {
    await abrirApp(page);
    const antes = await page.evaluate(() => ({
      titulo: document.getElementById("pageTitle")?.textContent?.trim() || "",
      rodape: document.getElementById("footerText")?.textContent?.trim() || "",
    }));
    expect(antes.titulo.length + antes.rodape.length).toBeGreaterThan(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#appScreen")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            titulo:
              document.getElementById("pageTitle")?.textContent?.trim() || "",
            rodape:
              document.getElementById("footerText")?.textContent?.trim() || "",
          })),
        { timeout: 30_000 },
      )
      .toEqual(antes);
  });

  test("presença online é registada sem erro", async ({ page }) => {
    const falhas = [];
    page.on("response", (r) => {
      if (r.url().includes("/rpc/registrar_presenca_monitora") && !r.ok()) {
        falhas.push(`${r.status()} ${r.url()}`);
      }
    });
    await abrirApp(page);
    await page.waitForTimeout(3_000);
    expect(falhas, "a RPC de presença respondeu com erro").toEqual([]);
  });

  /*
    A regressão original, encenada no navegador: a rede falha por um momento e o
    sistema anuncia "Sessão expirada" a quem está perfeitamente autenticado.

    `lib/sessao.js` tem testes unitários para a classificação do erro. Este aqui
    prova o outro lado — que a decisão chega até a tela. Derrubamos as chamadas ao
    Supabase **depois** de a aplicação já estar carregada e autenticada, forçamos
    uma ação que fala com o banco, e exigimos que a sessão sobreviva.
  */
  test("falha transitória de rede não produz “Sessão expirada”", async ({
    page,
  }) => {
    await abrirApp(page);

    await page.route("**/rest/v1/**", (rota) => rota.abort("failed"));
    await page.route("**/auth/v1/token**", (rota) => rota.abort("failed"));

    // Uma navegação interna basta para disparar leituras contra o banco. Só um
    // item visível: as páginas de uma área fechada do menu ficam ocultas.
    await page
      .locator("#nav [data-view]:visible")
      .first()
      .click({ timeout: 5_000 })
      .catch(() => {});
    await page.waitForTimeout(5_000);

    await expect(page.locator("#appScreen")).toBeVisible();
    await expect(page.locator("#loginScreen")).toBeHidden();
    await expect(page.locator("body")).not.toContainText("Sessão expirada");

    /*
      E o inverso: com a rede de volta, nada de sequelas — a sessão continua a
      mesma, sem exigir novo login.
    */
    await page.unroute("**/rest/v1/**");
    await page.unroute("**/auth/v1/token**");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#appScreen")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#loginScreen")).toBeHidden();
  });

  test("Análises carrega com dados", async ({ page }) => {
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await page.goto("/analises.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#kpiGrid, #scopeGuard").first()).toBeVisible({
      timeout: 30_000,
    });
    expect(erros).toEqual([]);
  });
});
