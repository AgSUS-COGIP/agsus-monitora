import { expect, test } from "@playwright/test";

/*
  O workspace cartográfico na aplicação real.

  As medições do PR #9 saíram de `bench/prototipo-workspace.html`, porque os
  mapas só arrancam depois do login Google e o protótipo é a única forma de os
  ver sem sessão. Ele usa o CSS real, o markup real e o caminho real de criação
  dos mapas — mas continua a ser uma reconstituição, com dados sintéticos.

  Este ficheiro repete as mesmas perguntas na aplicação, quando há sessão. É o
  que fecha a distância entre "medido no protótipo" e "medido no produto".

  Como a `analises-authenticated.spec.js` e a `sessao-autenticada.spec.js`,
  semeia a sessão no armazenamento em vez de encenar o login: o provedor externo
  não entra num teste automatizado. Sem `E2E_SUPABASE_SESSION_JSON` os testes
  são pulados — nunca passam por vacuidade.

  A chave é literal porque `src/lib/env.js` lê `import.meta.env`, ausente no
  runtime do Playwright; `tests/chaves-de-sessao.test.js` falha se ela divergir
  da que a aplicação usa.
*/
const sessionJson = process.env.E2E_SUPABASE_SESSION_JSON;
const storageKey =
  process.env.E2E_SUPABASE_STORAGE_KEY || "agsus-monitora-auth";

/*
  As três medidas de desktop que o pedido nomeia. O telemóvel empilha e sai da
  dobra por natureza — lá o que interessa é não haver transbordo, conferido no
  último teste.
*/
const MEDIDAS = [
  { nome: "1920x1000", width: 1920, height: 1000 },
  { nome: "1600x900", width: 1600, height: 900 },
  { nome: "1366x768", width: 1366, height: 768 },
];

/*
  Quantos pixéis do container do mapa estão cobertos por azulejo. Não se deduz
  dos bounds: contam-se os `<img>` que o Leaflet pôs no DOM, unidos e recortados
  ao container. Era esta a medida que denunciava os 67% de cinzento que a faixa
  branca apenas tornava visível.
*/
const cobertura = (id) => {
  const el = document.getElementById(id);
  const r = el?.getBoundingClientRect();
  if (!r?.width || !r?.height) return 0;
  const azulejos = [...el.querySelectorAll("img.leaflet-tile")]
    .filter((t) => t.complete && t.naturalWidth > 0)
    .map((t) => t.getBoundingClientRect());
  let dentro = 0;
  let total = 0;
  for (let y = r.top + 2; y < r.bottom - 2; y += 8) {
    for (let x = r.left + 2; x < r.right - 2; x += 8) {
      total += 1;
      if (
        azulejos.some(
          (a) => x >= a.left && x < a.right && y >= a.top && y < a.bottom,
        )
      ) {
        dentro += 1;
      }
    }
  }
  return total ? Math.round((dentro / total) * 100) : 0;
};

/*
  O vazio de cada lado do mapa, dentro do card. Mede-se lado a lado e não pela
  soma: em produção a faixa tinha cerca de 310px só à esquerda, e é a assimetria
  que a distingue de um padding simétrico. O painel de unidades é conteúdo, e
  por isso fecha o lado direito no estado com DSEI.
*/
const vazio = ([id, seletorCard]) => {
  const el = document.getElementById(id);
  const card = el?.closest(seletorCard);
  if (!el || !card) return null;
  const m = el.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const painel = card.querySelector(".health-map-units");
  const pr = painel?.offsetParent ? painel.getBoundingClientRect() : null;
  const direita = pr && pr.top < m.bottom - 1 ? pr.left : c.right;
  return {
    largura: Math.round(m.width),
    altura: Math.round(m.height),
    esquerda: Math.round(m.left - c.left),
    direita: Math.round(direita - m.right),
  };
};

const visivel = (id) => {
  const el = document.getElementById(id);
  return !!el && !!el.offsetParent;
};

const transbordaNaHorizontal = () =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth;

test.describe("workspace cartográfico com sessão", () => {
  test.skip(
    !sessionJson,
    "Defina E2E_SUPABASE_SESSION_JSON (Supabase de desenvolvimento) para conferir os mapas na aplicação.",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      { key: storageKey, value: sessionJson || "" },
    );
  });

  const abrirPainel = async (page) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#appScreen")).toBeVisible({ timeout: 30_000 });
    /* O mapa nacional só existe depois de o Leaflet montar os azulejos. */
    await expect(page.locator("#map img.leaflet-tile").first()).toBeAttached({
      timeout: 30_000,
    });
    await page.waitForTimeout(1200);
  };

  /*
    Entra num território pelo caminho da pessoa: clicando numa bolha do mapa.
    As camadas de base — divisas e contorno — nascem com `interactive: false`,
    por isso os `path.leaflet-interactive` de `#map` são as bolhas dos DSEIs.
  */
  const escolherUmDsei = async (page) => {
    const bolha = page.locator("#map path.leaflet-interactive").first();
    await expect(bolha).toBeVisible({ timeout: 15_000 });
    await bolha.click({ force: true });
    await expect(page.locator(".health-map-workspace")).toHaveClass(
      /com-dsei/,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(1200);
  };

  for (const medida of MEDIDAS) {
    test(`estado Brasil a ${medida.nome}: um mapa, a toda a largura, sem vazio`, async ({
      page,
    }) => {
      await page.setViewportSize(medida);
      await abrirPainel(page);

      expect(await page.evaluate(visivel, "map")).toBe(true);
      expect(await page.evaluate(visivel, "detailMap")).toBe(false);

      const medido = await page.evaluate(vazio, [
        "map",
        ".health-map-pane--master",
      ]);
      expect(medido).not.toBeNull();
      /* Só as duas bordas de 1px do card, e iguais dos dois lados. */
      expect(medido.esquerda).toBeLessThanOrEqual(2);
      expect(Math.abs(medido.esquerda - medido.direita)).toBeLessThanOrEqual(2);

      expect(await page.evaluate(cobertura, "map")).toBeGreaterThanOrEqual(99);
      expect(await page.evaluate(transbordaNaHorizontal)).toBe(false);
    });
  }

  test("escolher um DSEI troca o mapa em vez de acrescentar outro", async ({
    page,
  }) => {
    await page.setViewportSize(MEDIDAS[0]);
    await abrirPainel(page);
    await escolherUmDsei(page);

    expect(await page.evaluate(visivel, "map")).toBe(false);
    expect(await page.evaluate(visivel, "detailMap")).toBe(true);

    /* O trilho tem de dizer o território, não um rótulo fixo. */
    const trilho = await page.locator("#detailBreadcrumbDsei").textContent();
    expect(trilho?.trim()).toMatch(/^DSEI /);

    await expect(page.locator("#detailMapReset")).toBeVisible();
    await expect(page.locator("#detailMapReset")).toContainText(
      "Voltar à visão nacional",
    );

    const medido = await page.evaluate(vazio, [
      "detailMap",
      ".health-map-detail-layout",
    ]);
    expect(medido.esquerda).toBeLessThanOrEqual(2);
    expect(medido.direita).toBeLessThanOrEqual(2);
    expect(await page.evaluate(cobertura, "detailMap")).toBeGreaterThanOrEqual(
      99,
    );
    expect(await page.evaluate(transbordaNaHorizontal)).toBe(false);
  });

  /*
    Um filtro que esconde um tipo tem de esconder no mapa E na lista. Enquanto
    foram dois números diferentes, a contagem do painel mentia sobre o mapa.
  */
  test("os filtros por tipo agem no mapa e na lista ao mesmo tempo", async ({
    page,
  }) => {
    await page.setViewportSize(MEDIDAS[0]);
    await abrirPainel(page);
    await escolherUmDsei(page);

    const filtros = page.locator("#detailFiltros button");
    const quantos = await filtros.count();
    test.skip(
      quantos < 2,
      "O território sorteado tem um tipo só — os chips não nascem.",
    );

    const antes = Number(await page.locator("#detailUnitCount").textContent());
    const marcadoresAntes = await page
      .locator("#detailMap .mapa-marcador-wrap, #detailMap .mapa-cluster")
      .count();

    await filtros.first().click();
    await expect(filtros.first()).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(600);

    const depois = Number(await page.locator("#detailUnitCount").textContent());
    const marcadoresDepois = await page
      .locator("#detailMap .mapa-marcador-wrap, #detailMap .mapa-cluster")
      .count();

    expect(depois).toBeLessThan(antes);
    expect(marcadoresDepois).toBeLessThan(marcadoresAntes);

    /* E voltar a ligar devolve o que estava. */
    await filtros.first().click();
    await expect(filtros.first()).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(600);
    expect(Number(await page.locator("#detailUnitCount").textContent())).toBe(
      antes,
    );
  });

  test("voltar à visão nacional desfaz o estado", async ({ page }) => {
    await page.setViewportSize(MEDIDAS[0]);
    await abrirPainel(page);
    await escolherUmDsei(page);

    await page.locator("#detailMapReset").click();
    await expect(page.locator(".health-map-workspace")).not.toHaveClass(
      /com-dsei/,
    );
    await page.waitForTimeout(900);

    expect(await page.evaluate(visivel, "map")).toBe(true);
    expect(await page.evaluate(visivel, "detailMap")).toBe(false);
    /* O mapa nacional esteve escondido: o Leaflet tem de o ter remedido. */
    expect(await page.evaluate(cobertura, "map")).toBeGreaterThanOrEqual(99);
  });

  /*
    O cartão que a regressão empurrava para fora da dobra. É o sintoma que a
    pessoa vê primeiro, e por isso vale um teste próprio.
  */
  test("o Resumo por etapa continua na dobra no notebook de 1366x768", async ({
    page,
  }) => {
    await page.setViewportSize(MEDIDAS[2]);
    await abrirPainel(page);

    const topo = await page.evaluate(
      () =>
        document
          .querySelector(".health-status-summary-card")
          ?.getBoundingClientRect().top ?? Infinity,
    );
    expect(topo).toBeLessThan(768);
  });

  test("no telemóvel nada transborda na horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await abrirPainel(page);

    expect(await page.evaluate(transbordaNaHorizontal)).toBe(false);
    expect(await page.evaluate(cobertura, "map")).toBeGreaterThanOrEqual(99);
  });
});
