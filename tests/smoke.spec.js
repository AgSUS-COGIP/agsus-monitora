import { expect, test } from "@playwright/test";

function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

async function expectNoSupabaseCdn(request, path) {
  const response = await request.get(path);
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).not.toContain("cdn.jsdelivr.net/npm/@supabase/supabase-js");
}

test.describe("AgSUS Monitora smoke", () => {
  test("abre a aplicação principal sem erro crítico de JavaScript", async ({ page, request }) => {
    const pageErrors = collectPageErrors(page);

    await expectNoSupabaseCdn(request, "/");
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/AgSUS Monitora/i);
    await expect(page.locator("#loginScreen")).toBeVisible();
    await expect(page.locator("#googleLoginBtn")).toBeVisible();
    await expect(page.locator("#appScreen")).toBeAttached();

    expect(pageErrors).toEqual([]);
  });

  test("abre o painel de análises sem erro crítico de JavaScript", async ({ page, request }) => {
    const pageErrors = collectPageErrors(page);

    await expectNoSupabaseCdn(request, "/analises.html");
    await page.goto("/analises.html", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/AgSUS Monitora Análises/i);
    await expect(page.locator("h1")).toContainText("AgSUS Monitora Análises");
    await expect(page.locator("#authWarning")).toBeAttached();
    await expect(page.locator("#refreshBtn")).toBeVisible();
    await expect(page.locator("#exportBtn")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("o callback de autenticação é visualmente neutro", async ({ request }) => {
    const response = await request.get("/auth/callback.html");
    expect(response.ok()).toBeTruthy();

    const html = await response.text();
    expect(html).not.toContain("Finalizando login Google");
    expect(html).not.toContain("class=\"card\"");
    expect(html).not.toContain("class=\"spin\"");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('type="module"');
    expect(html).toMatch(/src="\/assets\/authCallback-[^"]+\.js"/);
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("cdn.jsdelivr.net/npm/@supabase/supabase-js");
  });
});
