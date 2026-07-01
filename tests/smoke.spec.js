import { expect, test } from "@playwright/test";

test("abre a tela principal", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AgSUS Monitora/);
  await expect(page.locator("#loginScreen")).toBeVisible();
});

test("abre o painel de analises", async ({ page }) => {
  await page.goto("/analises.html");
  await expect(page).toHaveTitle(/AgSUS Monitora Analises|AgSUS Monitora Análises/);
  await expect(page.locator("body")).toBeVisible();
});
