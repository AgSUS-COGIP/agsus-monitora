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
import { subirVercelSimulada } from "./apoio/vercel-simulada.js";

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

/*
  Aba aberta durante a publicação: a Vercel publica a versão nova e os pedaços
  da anterior somem (404). A aba que ficou aberta ainda roda o código antigo e
  pede, ao abrir uma tela pela primeira vez, um pedaço que já não existe. Antes
  disto a tela ficava preta até um Ctrl+Shift+R. O servidor imita a Vercel
  (`apoio/vercel-simulada.js`) e a publicação troca o hash de todos os pedaços.
*/
test.describe("aba aberta durante a publicação", () => {
  /** @type {Awaited<ReturnType<typeof subirVercelSimulada>>} */
  let vercel;

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar estes testes.`,
    );
    // Copiar o build e publicar a versão nova leva alguns segundos.
    test.setTimeout(90_000);
    vercel = await subirVercelSimulada();
  });
  test.afterEach(async () => {
    await vercel?.fechar();
  });

  const abrirCronograma = (page) =>
    page.locator(".sidebar").getByText("Cronograma", { exact: true }).click();
  const cronogramaAberto = async (page) => {
    await expect(page).toHaveURL(/\/saude-indigena\/cronograma$/);
    await expect(titulo(page)).toHaveText("Cronograma");
    await expect(page.locator("#calMesTitulo")).toBeVisible();
  };

  test("sem service worker, a aba antiga recarrega uma vez e abre a tela", async ({
    browser,
  }) => {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const erros = await abrirComSessao(page);
    await page.goto(`${vercel.endereco}/saude-indigena/visao-geral`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".sidebar")).toBeVisible();

    await vercel.publicar();
    const recargas = contarRecargas(page);
    await abrirCronograma(page);
    await cronogramaAberto(page);
    // O CSS da tela sumiu primeiro ("Unable to preload CSS"): recarregou uma vez.
    expect(recargas()).toBe(1);
    expect(erros).toEqual([]);
    await context.close();
  });

  test("com o service worker, a tela nunca aberta abre com o pedaço guardado", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page);
    await page.goto(`${vercel.endereco}/saude-indigena/visao-geral`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".sidebar")).toBeVisible();
    await instalado(page);

    await vercel.publicar();
    const recargas = contarRecargas(page);
    await abrirCronograma(page);
    await cronogramaAberto(page);
    // O pedaço da versão anterior veio do cache: nem precisou recarregar.
    expect(recargas()).toBe(0);
    expect(erros).toEqual([]);
  });

  test("com o service worker novo já no comando, a aba antiga ainda acha os seus pedaços", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page);
    await page.goto(`${vercel.endereco}/saude-indigena/visao-geral`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".sidebar")).toBeVisible();
    const guardados = await instalado(page);
    const pedacoAntigo = guardados.find((url) =>
      /\/assets\/calendario-editais-[\w-]+\.js$/.test(url),
    );
    expect(pedacoAntigo).toBeTruthy();

    await vercel.publicar();
    /*
      O navegador acha o sw.js novo, que instala e fica esperando: sozinho não
      assume (src/modules/pwa-lifecycle.ts). Assume quando alguém aceita a
      versão nova — aqui, a mensagem que o "Atualizar" do aviso manda
      (aplicarVersaoNova), como se viesse de outra aba: esta segue aberta.
    */
    const assumiuSozinho = await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.ready;
      const anterior = navigator.serviceWorker.controller;
      await registro.update();
      // Instalado, fica esperando. Conferir o `waiting` não perde evento já
      // disparado (o navegador pode ter achado a versão antes do update()).
      while (!registro.waiting)
        await new Promise((pronto) => setTimeout(pronto, 100));
      await new Promise((pronto) => setTimeout(pronto, 1000));
      return navigator.serviceWorker.controller !== anterior;
    });
    expect(assumiuSozinho).toBe(false);

    await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.ready;
      const trocou = new Promise((pronto) =>
        navigator.serviceWorker.addEventListener("controllerchange", pronto, {
          once: true,
        }),
      );
      registro.waiting.postMessage({ type: "SKIP_WAITING" });
      await trocou;
      const novo = navigator.serviceWorker.controller;
      if (novo.state !== "activated")
        await new Promise((pronto) =>
          novo.addEventListener("statechange", () => {
            if (novo.state === "activated") pronto();
          }),
        );
    });
    // O cache da versão anterior saiu: o pedaço vem da herança no cache novo.
    const nomes = await page.evaluate(() => caches.keys());
    expect(nomes.filter((nome) => nome.endsWith("-static"))).toEqual([
      expect.stringMatching(/-p1-static$/),
    ]);

    // O código antigo pede o pedaço antigo, que a Vercel já não tem.
    const carregou = await page.evaluate(
      (url) =>
        import(url).then(
          () => "ok",
          (erro) => String(erro),
        ),
      pedacoAntigo,
    );
    expect(carregou).toBe("ok");
    expect(erros).toEqual([]);
  });
});

/* O service worker terminou de guardar e controla a página; devolve o que guardou. */
async function instalado(page) {
  return page.evaluate(async () => {
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
}

/* Quantas vezes a página recarregou desde agora. */
function contarRecargas(page) {
  let recargas = 0;
  page.on("load", () => {
    recargas += 1;
  });
  return () => recargas;
}
