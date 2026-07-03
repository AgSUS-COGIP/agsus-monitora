import { expect, test } from "@playwright/test";

function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

test.describe("AgSUS Monitora smoke", () => {
  test("abre a aplicação principal sem erro crítico de JavaScript", async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/AgSUS Monitora/i);
    await expect(page.locator("#loginScreen")).toBeVisible();
    await expect(page.locator("#googleLoginBtn")).toBeVisible();
    await expect(page.locator("#appScreen")).toBeAttached();

    expect(pageErrors).toEqual([]);
  });

  test("abre o painel de análises sem erro crítico de JavaScript", async ({ page }) => {
    const pageErrors = collectPageErrors(page);

    await page.goto("/analises.html", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/AgSUS Monitora Análises/i);
    await expect(page.locator("h1")).toContainText("AgSUS Monitora Análises");
    await expect(page.locator("#authWarning")).toBeAttached();
    await expect(page.locator("#refreshBtn")).toBeVisible();
    await expect(page.locator("#exportBtn")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("o callback de autenticação está publicado", async ({ request }) => {
    const response = await request.get("/auth/callback.html");
    expect(response.ok()).toBeTruthy();

    const html = await response.text();
    expect(html).toContain("Finalizando login Google");
    expect(html).toContain('type="module"');
    expect(html).toMatch(/src="\/assets\/authCallback-[^"]+\.js"/);
  });
});
