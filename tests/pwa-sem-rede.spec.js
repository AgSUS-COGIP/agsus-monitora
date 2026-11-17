import { expect, test } from "@playwright/test";

/*
  O app instalado abre qualquer tela sem rede, também a que nunca foi aberta: o
  service worker guarda na instalação os arquivos de todas as telas (a lista
  vem do build, `PRECACHE` no sw.js publicado). Antes, o pedaço de uma tela só
  entrava no cache quando ela era aberta com rede.

  Os dados continuam vindo do Supabase simulado (`page.route`): aqui se prova
  só que o código da tela chega sem rede. Mesmo build simulado de
  `sessao-simulada.spec.js`.
*/

import {
  abrirComSessao,
  buildSimulado,
  SUPABASE,
} from "./apoio/sessao-simulada.js";

const titulo = (page) => page.locator("#pageTitle");

test.describe("PWA sem rede", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar estes testes.`,
    );
  });

  test("com o app instalado, a rede cai e uma tela nunca aberta ainda abre", async ({
    page,
    context,
  }) => {
    const erros = await abrirComSessao(page);
    const pedidosComRede = new Set();
    page.on("request", (pedido) => pedidosComRede.add(pedido.url()));

    await page.goto("/saude-indigena/visao-geral", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".sidebar")).toBeVisible();

    // Instalado: o service worker terminou de guardar e controla a página.
    const guardados = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((pronto) =>
          navigator.serviceWorker.addEventListener("controllerchange", pronto, {
            once: true,
          }),
        );
      }
      const nomes = await caches.keys();
      const cache = await caches.open(nomes.find((n) => n.endsWith("-static")));
      return (await cache.keys()).map((pedido) => pedido.url);
    });
    const telaDoCronograma = guardados.filter((url) =>
      /\/assets\/calendario-editais-[\w-]+\.js$/.test(url),
    );
    expect(telaDoCronograma).not.toHaveLength(0);
    // Nunca aberta: o pedaço da tela não passou pela rede.
    expect(telaDoCronograma.filter((url) => pedidosComRede.has(url))).toEqual(
      [],
    );

    await context.setOffline(true);
    await expect(
      page.getByText("Sem conexão com a internet", { exact: true }),
    ).toBeVisible();

    const doServiceWorker = [];
    page.on("response", (resposta) => {
      if (resposta.fromServiceWorker()) doServiceWorker.push(resposta.url());
    });

    await page
      .locator(".sidebar")
      .getByText("Cronograma", { exact: true })
      .click();
    await expect(page).toHaveURL(/\/saude-indigena\/cronograma$/);
    await expect(titulo(page)).toHaveText("Cronograma");
    // O título vem da casca; o mês do calendário só aparece com o código da tela.
    await expect(page.locator("#calMesTitulo")).toBeVisible();
    expect(doServiceWorker).toEqual(expect.arrayContaining(telaDoCronograma));

    // F5 sem rede: a página vem do cache e a tela do endereço abre de novo.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(titulo(page)).toHaveText("Cronograma");
    await expect(page.locator("#calMesTitulo")).toBeVisible();
    expect(erros).toEqual([]);
  });
});
