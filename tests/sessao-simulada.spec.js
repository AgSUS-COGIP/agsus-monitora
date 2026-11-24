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
    // O nome fica no menu da conta (o cabeçalho mostra só a foto).
    await page.locator("#topUserMenu > summary").click();
    await expect(page.locator("#topUserPopoverName")).toHaveText(
      "Pessoa Teste",
    );
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

  /*
    O cabeçalho (src/app/casca/topo.tsx): no celular, só o ☰, a marca, o
    sininho e a foto; no desktop, a área, a busca e, à direita, sininho, Aya e
    foto. As ações têm todas a mesma caixa (44px no toque, 40px no mouse).
  */
  const RESUMO_DE_RESPONSAVEL = {
    obter_meu_resumo_do_dia: {
      data: "2026-11-23",
      responsavel: true,
      mostrar_ao_entrar: false,
      hoje: [],
      proximos: [],
      atrasadas: [],
    },
  };
  const caixa = async (local) => {
    const r = await local.boundingBox();
    return r && `${Math.round(r.width)}×${Math.round(r.height)}`;
  };

  test("no celular, o cabeçalho mostra o ☰, o nome da tela, o sininho e a foto, na mesma caixa", async ({
    browser,
  }) => {
    const contexto = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await contexto.newPage();
    const erros = await abrirComSessao(page, { rpcs: RESUMO_DE_RESPONSAVEL });
    await page.goto("/sede/visao-geral", { waitUntil: "domcontentloaded" });
    const topo = page.locator("header.top");
    const menu = topo.locator("#globalSidebarToggle");
    const sininho = topo.locator("#resumoDoDiaSininho");
    const foto = topo.locator("#topUserMenu > summary");
    for (const visivel of [menu, topo.locator(".topo-tela"), sininho, foto])
      await expect(visivel).toBeVisible();
    await expect(topo.locator(".topo-tela__titulo")).toHaveText("Visão geral");
    await expect(topo.locator(".topo-marca")).toBeHidden();
    await expect(topo.locator(".topo-busca")).toHaveCount(0);
    for (const acao of [menu, sininho, foto])
      expect(await caixa(acao)).toBe("44×44");
    // Nada passa da borda: exportar e Relatórios ficam em "Mais ações".
    await expect(
      page.locator("#page-dashboard .ui-mais-acoes-botao"),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('no desktop, o cabeçalho diz "● Área › Tela", sem busca, área ou Aya repetidas, e o conteúdo não repete o nome', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const erros = await abrirComSessao(page, { rpcs: RESUMO_DE_RESPONSAVEL });
    await page.goto("/sede/visao-geral", { waitUntil: "domcontentloaded" });
    const topo = page.locator("header.top");
    await expect(topo.locator(".topo-tela__trilha")).toHaveText("SEDE");
    await expect(topo.locator(".topo-tela__titulo")).toHaveText("Visão geral");
    await expect(topo.locator(".topo-marca")).toBeHidden();
    for (const fora of [
      ".topo-busca",
      ".topo-area",
      '[aria-label="Abrir a Aya"]',
    ])
      await expect(topo.locator(fora)).toHaveCount(0);
    await expect(
      page.locator("#page-dashboard .ui-cabecalho-titulo"),
    ).toHaveCount(0);
    const acoes = [
      topo.locator("#resumoDoDiaSininho"),
      topo.locator("#topUserMenu > summary"),
    ];
    for (const acao of acoes) expect(await caixa(acao)).toBe("40×40");
    // A busca global segue no Ctrl+K.
    await page.keyboard.press("Control+k");
    await expect(page.locator('[role="dialog"].search-modal')).toBeVisible();
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
    await expect(page.locator("#page-config .ui-cabecalho-titulo")).toHaveText(
      "Operação",
    );

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

  /* "Meus acessos" (src/app/casca/meus-acessos.tsx): do perfil do contexto, sem RPC nova. */
  const contextoDaGestora = () => ({
    profile: {
      ...contextoDoAdmin(["sede", "saude-indigena"]).profile,
      admin_global: false,
      role: "edital_gestor",
      perfil: "edital_gestor",
      grupo: { codigo: "edital_gestor", nome: "Gestor" },
      coordenacao: { codigo: "C1", nome: "Coordenação Norte", area: "sede" },
      permissoes: {
        dashboard: "leitor",
        nucleo: "editor",
        calendario: "leitor",
      },
    },
    panel_ids: [],
  });

  test('"Meus acessos" no menu da conta abre a gaveta com o grupo, as áreas e o nível por módulo', async ({
    page,
  }) => {
    const erros = await abrirComSessao(page, { contexto: contextoDaGestora() });
    await page.goto("/sede/cronograma", { waitUntil: "domcontentloaded" });
    await expect(titulo(page)).toHaveText("Cronograma");

    await page.locator("#topUserMenu > summary").click();
    await page.getByRole("button", { name: "Meus acessos" }).click();
    await expect(page.locator("#topUserMenu")).not.toHaveAttribute("open", "");
    const gaveta = page.getByRole("dialog", { name: "Meus acessos" });
    await expect(gaveta).toBeVisible();
    const valor = (rotulo) =>
      gaveta
        .locator(".ui-kv")
        .filter({
          has: page.locator(".ui-kv-rotulo", {
            hasText: new RegExp(`^${rotulo}$`),
          }),
        })
        .locator(".ui-kv-valor");
    await expect(valor("Grupo")).toHaveText("Gestor");
    await expect(valor("Áreas")).toHaveText("Saúde Indígena, SEDE");
    await expect(valor("Coordenação")).toHaveText("Coordenação Norte (SEDE)");
    await expect(valor("Editais")).toHaveText("Editor");
    await expect(valor("Cronograma")).toHaveText("Leitor");
    await expect(valor("Gestão de acessos")).toHaveText("Sem acesso");

    await page.keyboard.press("Escape");
    await expect(gaveta).toBeHidden();
    expect(erros).toEqual([]);
  });

  /* "Pedir mais acesso" (src/app/casca/meus-acessos.tsx), com as RPCs do pedido simuladas. */
  test('"Pedir mais acesso" no menu da conta abre o formulário, envia o módulo com o nível e mostra o pedido aguardando', async ({
    page,
  }) => {
    let pedido = null;
    let argumentos = null;
    const erros = await abrirComSessao(page, {
      contexto: contextoDaGestora(),
      rpcs: {
        obter_minha_solicitacao_acesso: () => ({ json: pedido }),
        listar_opcoes_da_solicitacao_acesso: {
          areas: [],
          unidades: [],
          coordenacoes: [],
          grupos: [{ codigo: "coordenador", nome: "Coordenador" }],
        },
        registrar_solicitacao_acesso: (rota) => {
          argumentos = rota.request().postDataJSON();
          pedido = {
            id: "p1",
            tipo: "MODULO",
            recurso: argumentos.p_recurso,
            nivel: argumentos.p_nivel,
            status: "pendente",
            created_at: "2026-11-24T13:00:00Z",
          };
          return { json: { ok: true, status: "pendente" } };
        },
      },
    });
    await page.goto("/sede/cronograma", { waitUntil: "domcontentloaded" });
    await expect(titulo(page)).toHaveText("Cronograma");

    await page.locator("#topUserMenu > summary").click();
    await page.getByRole("button", { name: "Pedir mais acesso" }).click();
    const gaveta = page.getByRole("dialog", { name: "Meus acessos" });
    const formulario = gaveta.getByRole("form", { name: "Pedir mais acesso" });
    await expect(formulario).toBeVisible();
    await formulario.getByLabel("Módulo").selectOption("aprovados");
    await formulario.getByLabel("Nível").selectOption("editor");
    await formulario
      .getByLabel("Justificativa")
      .fill("Preciso conferir e editar a lista de aprovados da SEDE.");
    await formulario.getByRole("button", { name: "Enviar pedido" }).click();

    await expect(gaveta.getByText("Aguardando aprovação")).toBeVisible();
    await expect(gaveta.getByText("Lista de aprovados: Editor")).toBeVisible();
    expect(argumentos).toMatchObject({
      p_tipo: "MODULO",
      p_recurso: "aprovados",
      p_nivel: "editor",
    });
    await expect(
      gaveta.getByRole("button", { name: "Cancelar pedido" }),
    ).toBeVisible();
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
