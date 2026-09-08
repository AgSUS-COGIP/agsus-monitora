import { expect, test } from "@playwright/test";

/*
  Protege no navegador real o que os testes unitários não alcançam: a aparência
  do aviso global depois do bundle, com a cascata toda aplicada.

  A decisão (`avisoGlobal()`) é coberta em `tests/aviso-global.test.js`. Aqui
  verificamos o outro lado: que as três severidades chegam visualmente
  distintas, legíveis, e que a faixa não transborda no telemóvel.

  A tela de acesso é dispensada por manipulação do DOM porque este ambiente não
  tem credenciais do Supabase. Isso é suficiente: o que está sob teste é a folha
  de estilos, não a autenticação.
*/

const CONTRASTE_MINIMO = 4.5;

/*
  `domcontentloaded`, como no smoke: nesta página o evento `load` espera recursos
  que nem sempre chegam, e a navegação estoura o tempo. O que estes testes medem
  — folha de estilos aplicada ao elemento — já está pronto no DOM.
*/

async function revelarShell(page) {
  await page.evaluate(() => {
    document.getElementById("loginScreen")?.classList.add("hidden");
    const app = document.getElementById("appScreen");
    app?.classList.remove("hidden");
    document.body.classList.remove("config-loading");
  });
}

async function pintarAviso(page, mensagem, variante) {
  await page.evaluate(
    ({ mensagem, variante }) => {
      const barra = document.getElementById("broadcastBar");
      barra.textContent = mensagem;
      barra.className = variante
        ? `alert broadcast-bar ${variante}`
        : "alert broadcast-bar";
      barra.hidden = false;
    },
    { mensagem, variante },
  );
}

async function medir(page) {
  return page.evaluate(() => {
    const barra = document.getElementById("broadcastBar");
    const estilo = getComputedStyle(barra);
    const caixa = barra.getBoundingClientRect();
    const luminancia = (cor) => {
      const [r, g, b] = cor
        .match(/\d+/g)
        .map(Number)
        .map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = luminancia(estilo.backgroundColor);
    const z = luminancia(estilo.color);
    return {
      fundo: estilo.backgroundColor,
      contraste: (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05),
      altura: caixa.height,
      direita: caixa.right,
      transborda:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
}

test.describe("aviso global", () => {
  test("as três severidades ficam distintas e legíveis no tema claro", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await revelarShell(page);

    const vistas = [];
    for (const variante of ["", "warn", "error"]) {
      await pintarAviso(
        page,
        "Manutenção programada para sexta às 18h.",
        variante,
      );
      const m = await medir(page);
      expect(m.altura, `variante "${variante}" não apareceu`).toBeGreaterThan(
        0,
      );
      expect(
        m.contraste,
        `contraste insuficiente em "${variante}"`,
      ).toBeGreaterThan(CONTRASTE_MINIMO);
      vistas.push(m.fundo);
    }
    expect(
      new Set(vistas).size,
      "as severidades devem ter fundos diferentes",
    ).toBe(3);
  });

  /*
    A regra `[data-theme="dark"] .app .alert` pinta todo `.alert` com o mesmo azul
    e usa `!important`. Sem a exceção da faixa, um aviso crítico sairia no escuro
    com a mesma cara de um recado corriqueiro.
  */
  test("as três severidades continuam distintas no tema escuro", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await revelarShell(page);
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "dark"),
    );

    const vistas = [];
    for (const variante of ["", "warn", "error"]) {
      await pintarAviso(page, "Instabilidade no envio de dados.", variante);
      const m = await medir(page);
      expect(
        m.contraste,
        `contraste insuficiente no escuro em "${variante}"`,
      ).toBeGreaterThan(CONTRASTE_MINIMO);
      vistas.push(m.fundo);
    }
    expect(
      new Set(vistas).size,
      "no escuro as severidades também devem diferir",
    ).toBe(3);
  });

  test("some por completo quando não há mensagem", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await revelarShell(page);
    await page.evaluate(() => {
      const barra = document.getElementById("broadcastBar");
      barra.textContent = "";
      barra.hidden = true;
    });
    expect((await medir(page)).altura).toBe(0);
  });

  test("cabe no telemóvel de 375 px sem transbordar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await revelarShell(page);
    await pintarAviso(
      page,
      "Manutenção programada para sexta, 18h — o sistema ficará indisponível por 30 minutos.",
      "error",
    );
    const m = await medir(page);
    expect(m.altura).toBeGreaterThan(0);
    expect(m.direita).toBeLessThanOrEqual(375);
    expect(m.transborda).toBe(false);
  });
});
