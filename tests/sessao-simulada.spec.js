import { expect, test } from "@playwright/test";

/*
  O app aberto com sessão, sem Supabase de verdade: a sessão é semeada no
  armazenamento e cada chamada ao Supabase é respondida aqui (`page.route`).
  Roda em todo PR, ao contrário dos `*-autenticad*.spec.js`, que precisam de um
  banco de desenvolvimento.

  Sob prova fica o que é do app: com um perfil válido ele abre as telas pelo
  endereço (`/<área>/<tela>`), o F5 e o voltar/avançar do navegador mantêm a
  tela, e quem não tem perfil vai para a solicitação de acesso.

  O build precisa apontar para o endereço simulado: o CI compila com
  VITE_SUPABASE_URL=https://teste.supabase.co (veja build-and-smoke.yml).
  Num build com outro endereço, os testes são pulados — nunca passam por
  vacuidade nem chamam um Supabase real.

  O que não é respondido aqui volta como "função ausente" (PGRST202), e o app
  segue pelos caminhos de reserva (catálogo de abas do código, sem dados).
*/

import {
  abrirComSessao,
  buildSimulado,
  contextoDoAdmin,
  SUPABASE,
} from "./apoio/sessao-simulada.js";

const titulo = (page) => page.locator("#pageTitle");

test.describe("sessão simulada", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar estes testes.`,
    );
  });

  test("com perfil, entra na Visão geral da área e põe a tela no endereço", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/saude-indigena\/visao-geral$/);
    await expect(page.locator("#loginScreen")).toBeHidden();
    await expect(page.getByText("Pessoa Teste").first()).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("o endereço abre a tela direto, e o F5 a mantém", async ({ page }) => {
    const erros = await abrirComSessao(page);
    await page.goto("/sede/cronograma", { waitUntil: "domcontentloaded" });
    await expect(titulo(page)).toHaveText("Cronograma");
    await expect(page).toHaveURL(/\/sede\/cronograma$/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(titulo(page)).toHaveText("Cronograma");
    await expect(page).toHaveURL(/\/sede\/cronograma$/);
    expect(erros).toEqual([]);
  });

  test("o menu troca a tela, e voltar/avançar do navegador acompanham", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page);
    await page.goto("/saude-indigena/visao-geral", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".sidebar")).toBeVisible();

    await page
      .locator(".sidebar")
      .getByText("Cronograma", { exact: true })
      .click();
    await expect(page).toHaveURL(/\/saude-indigena\/cronograma$/);
    await expect(titulo(page)).toHaveText("Cronograma");

    await page.goBack();
    await expect(page).toHaveURL(/\/saude-indigena\/visao-geral$/);
    await expect(titulo(page)).not.toHaveText("Cronograma");
    await expect(page.locator(".sidebar")).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/saude-indigena\/cronograma$/);
    await expect(titulo(page)).toHaveText("Cronograma");
    expect(erros).toEqual([]);
  });

  test("a Aya, a busca global e Pessoas online são da raiz: aparecem depois de entrar", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page);
    await page.goto("/saude-indigena/visao-geral", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".sidebar")).toBeVisible();
    // A arara baixa quando o app abre (React.lazy na casca).
    await expect(page.locator("#ayaApp .aya-arara")).toBeVisible();
    await expect(page.locator("#pessoasOnlineApp #onlinePresence")).toHaveCount(
      1,
    );
    // Ctrl+K abre a busca global com a pessoa conectada; Esc fecha.
    await page.keyboard.press("Control+k");
    const busca = page.locator('[role="dialog"].search-modal');
    await expect(busca).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(busca).toBeHidden();
    expect(erros).toEqual([]);
  });

  test("Configurações é rota: a seção do endereço abre, o F5 a mantém e trocar de seção entra no histórico", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page);
    await page.goto("/administracao/configuracoes/operacao", {
      waitUntil: "domcontentloaded",
    });
    const secao = (id) => page.locator(`.config-secao[data-secao="${id}"]`);
    await expect(secao("operacao")).toBeVisible();
    await expect(secao("marca")).toBeHidden();
    await expect(page.locator(".config-cabecalho h2")).toHaveText("Operação");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/administracao\/configuracoes\/operacao$/);
    await expect(secao("operacao")).toBeVisible();

    // Acessos é tela própria: baixa na primeira abertura, dentro da seção.
    // (O menu recolhido em trilho esconde o rótulo; o contrato é o mesmo do menu.)
    await page.evaluate(() => window.navigate("config", { secao: "acessos" }));
    await expect(page).toHaveURL(/\/administracao\/configuracoes\/acessos$/);
    await expect(secao("acessos")).toBeVisible();
    await expect(secao("operacao")).toBeHidden();
    await expect(secao("acessos").locator("#acessosApp > *")).not.toHaveCount(
      0,
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/administracao\/configuracoes\/operacao$/);
    await expect(secao("operacao")).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("Regras do edital são rota: o endereço abre na etapa, ← Editais volta à tabela e o voltar reabre", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page);
    const edital = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
    await page.goto(`/sede/editais/${edital}/regras/classificacao`, {
      waitUntil: "domcontentloaded",
    });
    const regras = page.locator("[data-tour='regras-do-edital']");
    await expect(regras).toBeVisible();
    await expect(regras).toHaveAttribute("data-etapa", "classificacao");

    await page.locator("[data-acao='voltar-aos-editais']").click();
    await expect(page).toHaveURL(/\/sede\/editais$/);
    await expect(regras).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(
      new RegExp(`/sede/editais/${edital}/regras/classificacao$`),
    );
    await expect(regras).toHaveAttribute("data-etapa", "classificacao");
    expect(erros).toEqual([]);
  });

  test("Página em manutenção: o aviso no lugar da página, em React", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page, {
      contexto: {
        ...contextoDoAdmin(),
        profile: {
          ...contextoDoAdmin().profile,
          admin_global: false,
          role: "edital_gestor",
        },
      },
      situacao: {
        admin_global: false,
        sistema: {
          situacao: "MANUTENCAO",
          mensagem: "Volta já",
          previsao: null,
        },
        areas: [],
      },
    });
    await page.goto("/sede/cronograma", { waitUntil: "domcontentloaded" });
    const aviso = page.locator("#page-manutencao.active");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("Em manutenção");
    await expect(aviso).toContainText("Volta já");
    await expect(titulo(page)).toHaveText("Em manutenção");
    expect(erros).toEqual([]);
  });

  test("rota de uma área que o perfil não tem cai na área dele", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page, {
      contexto: contextoDoAdmin(["saude-indigena"]),
    });
    await page.goto("/sede/cronograma", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/saude-indigena\/cronograma$/);
    await expect(titulo(page)).toHaveText("Cronograma");
    expect(erros).toEqual([]);
  });

  test("sem perfil, vai para a solicitação de acesso e não abre o sistema", async ({
    page,
  }) => {
    const erros = await abrirComSessao(page, { contexto: null });
    await page.goto("/sede/cronograma", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByText("Solicitação de acesso", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.locator(".sidebar")).toBeHidden();
    expect(erros).toEqual([]);
  });
});
