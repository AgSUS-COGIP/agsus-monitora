import { expect, test } from "@playwright/test";

/*
  O app instalado abre qualquer tela sem rede, também a que nunca foi aberta: o
  service worker guarda na instalação os arquivos de todas as telas (a lista
  vem do build, `PRECACHE` no sw.js publicado). Antes, o pedaço de uma tela só
  entrava no cache quando ela era aberta com rede.

  Os dados continuam vindo do Supabase simulado (`page.route`): o primeiro
  teste prova só que o código da tela chega sem rede. O segundo derruba a
  leitura dos dados (o pedido ao Supabase falha como sem rede) e confere que a
  tela mostra a cópia guardada no aparelho, com a data dela. Mesmo build
  simulado de `sessao-simulada.spec.js`.
*/

/* O painel de Entrevistas da área (dados fictícios). */
const ENTREVISTAS = {
  schema_version: 1,
  area: "saude-indigena",
  versao: "v1",
  gerado_em: "2026-11-17T12:00:00Z",
  criterios: ["POSTURA"],
  entrevistas: [
    {
      id: "e1",
      edital_id: null,
      edital: "Edital 01/2026",
      edital_planilha: "01/2026",
      unidade: "DSEI Xingu",
      vaga: "V1",
      cargo: "Enfermeiro",
      candidato: "Pessoa Fictícia",
      codigo: "C1",
      modalidade: "Ampla",
      nota: 9,
      parecer: "APTO",
      compareceu: "S",
      link: null,
      notas: [[0, 9]],
      analise: null,
    },
  ],
  aprovados_sem_entrevista: [],
};

import {
  abrirComSessao,
  buildSimulado,
  SUPABASE,
} from "./apoio/sessao-simulada.js";

const titulo = (page) => page.locator("#pageTitle");

/* Há cópia com esta chave no IndexedDB das cópias de payload? */
const guardado = (page, chave) =>
  page.evaluate(
    (chave) =>
      new Promise((pronto) => {
        const pedido = indexedDB.open("agsus-monitora-analises");
        pedido.onsuccess = () => {
          const leitura = pedido.result
            .transaction("payload")
            .objectStore("payload")
            .get(chave);
          leitura.onsuccess = () => {
            pedido.result.close();
            pronto(Boolean(leitura.result));
          };
        };
        pedido.onerror = () => pronto(false);
      }),
    chave,
  );

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

  test("sem rede para os dados, a tela mostra a cópia guardada com a data dela", async ({
    page,
    context,
  }) => {
    const erros = await abrirComSessao(page, {
      rpcs: { get_entrevistas_da_area_se_mudou: ENTREVISTAS },
    });
    await page.goto("/saude-indigena/painel-de-entrevistas", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Pessoa Fictícia").first()).toBeVisible();
    // A cópia no aparelho (IndexedDB das cópias de payload).
    await expect
      .poll(() => guardado(page, "entrevistas:saude-indigena"))
      .toBe(true);
    await page.close();

    // Outra abertura, com a leitura do painel falhando como sem rede.
    const semRede = await context.newPage();
    const errosSemRede = await abrirComSessao(semRede);
    await semRede.route(
      `${SUPABASE}/rest/v1/rpc/get_entrevistas_da_area_se_mudou`,
      (rota) => rota.abort("internetdisconnected"),
    );
    await semRede.goto("/saude-indigena/painel-de-entrevistas", {
      waitUntil: "domcontentloaded",
    });
    await expect(semRede.getByText("Pessoa Fictícia").first()).toBeVisible();
    await expect(semRede.locator("[data-status-da-carga]:visible")).toHaveText(
      /^Dados de \d{2}\/\d{2}, \d{2}:\d{2}$/,
    );
    await expect(semRede.getByText(/Não foi possível/)).toHaveCount(0);
    expect([...erros, ...errosSemRede]).toEqual([]);
  });

  test("abrir o app sem rede entra com o perfil guardado e mostra a cópia", async ({
    page,
    context,
  }) => {
    const erros = await abrirComSessao(page, {
      rpcs: { get_entrevistas_da_area_se_mudou: ENTREVISTAS },
    });
    await page.goto("/saude-indigena/painel-de-entrevistas", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Pessoa Fictícia").first()).toBeVisible();
    // As cópias do perfil e do painel são gravadas por trás.
    for (const chave of ["perfil", "entrevistas:saude-indigena"])
      await expect.poll(() => guardado(page, chave)).toBe(true);
    await page.close();

    // Outra abertura com o Supabase inteiro fora do alcance, como sem rede.
    const semRede = await context.newPage();
    const errosSemRede = await abrirComSessao(semRede);
    await semRede.route(`${SUPABASE}/**`, (rota) =>
      rota.abort("internetdisconnected"),
    );
    await semRede.goto("/saude-indigena/painel-de-entrevistas", {
      waitUntil: "domcontentloaded",
    });
    await expect(semRede.locator("#loginScreen")).toBeHidden();
    await expect(
      semRede.getByText("Não foi possível verificar suas permissões"),
    ).toHaveCount(0);
    await expect(semRede.getByText("Pessoa Fictícia").first()).toBeVisible();
    await expect(semRede.locator("[data-status-da-carga]:visible")).toHaveText(
      /^Dados de \d{2}\/\d{2}, \d{2}:\d{2}$/,
    );
    expect([...erros, ...errosSemRede]).toEqual([]);
  });
});
