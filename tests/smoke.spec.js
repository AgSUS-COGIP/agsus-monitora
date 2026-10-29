import { readFileSync } from "node:fs";
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
  test("abre a aplicação principal sem erro crítico de JavaScript", async ({
    page,
    request,
  }) => {
    const pageErrors = collectPageErrors(page);

    await expectNoSupabaseCdn(request, "/");
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle("MONITORA");
    await expect(page.locator("#loginScreen")).toBeVisible();
    await expect(page.locator("#googleLoginBtn")).toBeVisible();
    await expect(page.locator("#appScreen")).toBeAttached();
    await expect(page.locator("#profileAvatarButton")).toHaveCount(0);
    await expect(page.locator("#profileAvatarDialog")).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test("o callback de autenticação é visualmente neutro", async ({
    request,
  }) => {
    const response = await request.get("/auth/callback.html");
    expect(response.ok()).toBeTruthy();

    const html = await response.text();
    expect(html).not.toContain("Finalizando login Google");
    expect(html).not.toContain('class="card"');
    expect(html).not.toContain('class="spin"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('type="module"');
    expect(html).toMatch(/src="\/assets\/authCallback-[^"]+\.js"/);
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("cdn.jsdelivr.net/npm/@supabase/supabase-js");
  });
  test("o seletor da Triagem respeita a largura de celulares", async ({
    page,
  }) => {
    const css = readFileSync(
      new URL(
        "../src/modulos/avaliacao-documental/avaliacao-documental.css",
        import.meta.url,
      ),
      "utf8",
    );
    // Sem login nem dados reais: renderiza a estrutura do seletor com as
    // classes e o CSS de produção para validar responsividade.
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 740 });
      await page.setContent(`
        <style>${css}</style>
        <main style="box-sizing:border-box;width:100%;padding:12px">
          <section class="avd-edital" aria-label="Edital da triagem">
            <div>
              <label for="edital">Edital</label>
              <select id="edital">
                <option>114/2026 - Rio Doce - Modalidade por pergunta - Versão conferida</option>
              </select>
            </div>
            <label><input type="checkbox"> Mostrar todos os editais da área</label>
          </section>
        </main>
      `);
      const dimensoes = await page.locator("#edital").evaluate((select) => ({
        direita: select.getBoundingClientRect().right,
        largura: select.getBoundingClientRect().width,
        documento: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(dimensoes.largura).toBeGreaterThan(100);
      expect(dimensoes.direita).toBeLessThanOrEqual(dimensoes.viewport + 1);
      expect(dimensoes.documento).toBeLessThanOrEqual(dimensoes.viewport + 1);
    }
  });
});
