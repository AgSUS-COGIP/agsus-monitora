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
import { monitoramento } from "./fixtures/acabamento/dados.js";
import { rpcsDaAuditoria } from "./fixtures/auditoria-visual/dados.js";

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

  /*
    Central de convocações (#581), a 375px, com quatro perfis: só Aprovados;
    Aprovados + Entrevistas; + Classificação; e Conduzir entrevistas desligada
    na área. A aba e o tipo vão no endereço; "Para entrevistas" lê a loja de
    Conduzir (a lista da Classificação e a agenda, só leitura); "Ver em
    Convocações", de Conduzir › Preparar › Convocação, leva até ela.
  */
  const EDITAL_DA_ENTREVISTA = "00000000-0000-4000-8000-000000000581";
  const CENTRAL = "/sede/aprovados?aba=convocacao&tipo=entrevista";
  const contextoCom = (permissoes) => ({
    profile: {
      ...contextoDoAdmin(["sede"]).profile,
      admin_global: false,
      role: "usuario",
      perfil: "usuario",
      permissoes,
    },
    panel_ids: [],
  });
  const SO_APROVADOS = { aprovados: "leitor" };
  const COM_ENTREVISTAS = { aprovados: "leitor", entrevistas: "leitor" };
  const COM_CLASSIFICACAO = {
    aprovados: "leitor",
    entrevistas: "editor",
    classificacao: "leitor",
  };
  const candidatoDoRetrato = (posicao, nota) => ({
    posicao,
    analise_id: `a${posicao}`,
    nome: `Pessoa Teste 00${posicao}`,
    nota,
    modalidades: ["AC"],
  });
  const RETRATO = {
    schema: 1,
    tipo: "CONVOCACAO",
    vagas: [
      {
        chave: "V1",
        codigo: "V1",
        cargo: "Enfermeiro",
        total: 1,
        origem_das_vagas: "QUADRO",
        limite_convocacao: { limite: 2, origem: "2 × 1 vaga(s)" },
        geral: [candidatoDoRetrato(1, 90), candidatoDoRetrato(2, 80)],
        listas: {},
        eliminados: [],
      },
    ],
  };
  const RPCS_DA_CONDUCAO = {
    listar_editais_entrevista: {
      admin_global: false,
      editais: [
        {
          id: EDITAL_DA_ENTREVISTA,
          edital: "58/2026",
          unidade: "Unidade de Teste",
          na_janela: true,
          visivel_por: "janela",
        },
      ],
    },
    obter_entrevistas_do_edital: {
      edital: {
        id: EDITAL_DA_ENTREVISTA,
        edital: "58/2026",
        unidade: "Unidade de Teste",
        area: "sede",
      },
      pode_editar: true,
      configuracao: { roteiro: { id: "r1", nome: "Roteiro", versao: 1 } },
      regra_classificacao: { versao: 1, convocacao: { multiplo_vagas: 2 } },
      lista_convocacao: {
        lista: { id: "l1", versao_regra: 1, gerada_em: "2026-11-20T12:00:00Z" },
        retrato: RETRATO,
      },
      convocados: [
        {
          id: "e1",
          analise_id: "a1",
          vaga: "V1",
          candidato: "Pessoa Teste 001",
          avaliacoes: [],
        },
      ],
    },
    obter_previsao_entrevista_edital: {
      situacao: "PREVISTA",
      motivo: null,
      pode_alterar: false,
    },
    obter_agenda_entrevista: {
      itens: [
        {
          analise_id: "a1",
          data: "2026-12-02",
          inicio: "09:00:00",
          fim: "09:30:00",
          banca: 1,
        },
      ],
    },
  };
  /* O catálogo das abas com Conduzir entrevistas só na Saúde Indígena. */
  const TRES_AREAS = ["saude-indigena", "sede", "projetos"];
  const aba = (co_aba, co_view, co_recurso, areas) => ({
    co_aba,
    no_aba: co_aba,
    co_view,
    co_recurso,
    areas: areas.map((co_area, i) => ({ co_area, nu_ordem: i })),
  });
  const SEM_CONDUZIR_NA_SEDE = [
    aba("aprovados", "approved", "aprovados", TRES_AREAS),
    aba("conduzir-entrevistas", "conduzir-entrevistas", "entrevistas", [
      "saude-indigena",
    ]),
    aba("classificacao", "classificacao", "classificacao", TRES_AREAS),
  ];

  async function abrirNoCelular(browser, permissoes, rpcs = {}) {
    const contexto = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await contexto.newPage();
    // A Lista de aprovados vazia (as respostas da auditoria visual) e Conduzir com um edital.
    const erros = await abrirComSessao(page, {
      contexto: contextoCom(permissoes),
      rpcs: {
        ...rpcsDaAuditoria("vazio", "sede"),
        listar_monitoramento_operacional: monitoramento("vazio", "sede"),
        ...RPCS_DA_CONDUCAO,
        ...rpcs,
      },
    });
    return { contexto, page, erros };
  }
  const central = (page) => page.locator("[data-tour='central-convocacoes']");
  const botaoDaCentral = (page, nome) =>
    central(page).getByRole("button", { name: nome, exact: true });
  const semRolarDeLado = async (page) =>
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(375);
  const BOTOES_DA_CLASSIFICACAO = [
    "Abrir listas da Classificação",
    "Editar na Classificação › Agenda",
  ];

  test("só Aprovados: a Convocação abre na contratação, sem o bloco das entrevistas", async ({
    browser,
  }) => {
    const { contexto, page, erros } = await abrirNoCelular(
      browser,
      SO_APROVADOS,
    );
    await page.goto(CENTRAL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#approvedTabConvocacao")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("#approvedPanelConvocacao")).toBeVisible();
    await expect(central(page)).toHaveCount(0);
    await expect(
      page.locator("[data-bloco='convocacao-para-entrevistas']"),
    ).toHaveCount(0);
    await semRolarDeLado(page);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test("Aprovados + Entrevistas: a lista e a agenda só para ler, sem os botões da Classificação", async ({
    browser,
  }) => {
    const { contexto, page, erros } = await abrirNoCelular(
      browser,
      COM_ENTREVISTAS,
      // Leitor nas Entrevistas: o banco diz que não edita.
      {
        obter_entrevistas_do_edital: {
          ...RPCS_DA_CONDUCAO.obter_entrevistas_do_edital,
          pode_editar: false,
        },
      },
    );
    await page.goto(CENTRAL, { waitUntil: "domcontentloaded" });
    await expect(
      central(page).locator("[role='radio'][data-valor='entrevista']"),
    ).toHaveAttribute("aria-checked", "true");
    // Um edital só na janela: abre sozinho, o mesmo de Conduzir entrevistas.
    await expect(central(page).locator("select")).toHaveValue(
      EDITAL_DA_ENTREVISTA,
    );
    await expect(central(page)).toContainText("Pessoa Teste 002");
    const agenda = central(page).locator("[data-bloco='agenda-da-central']");
    await expect(agenda).toContainText("09:00–09:30");
    await expect(central(page).locator("input[type='checkbox']")).toHaveCount(
      0,
    );
    for (const fora of BOTOES_DA_CLASSIFICACAO)
      await expect(botaoDaCentral(page, fora)).toHaveCount(0);
    await expect(
      botaoDaCentral(page, "Abrir em Conduzir entrevistas"),
    ).toBeVisible();
    await semRolarDeLado(page);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test("+ Classificação: 'Ver em Convocações' do Preparar abre a central no edital, com os atalhos para a Classificação", async ({
    browser,
  }) => {
    const { contexto, page, erros } = await abrirNoCelular(
      browser,
      COM_CLASSIFICACAO,
    );
    // O único edital na janela abre sozinho, já no Preparar › Convocação.
    await page.goto("/sede/entrevistas?visao=preparar&passo=convocacao", {
      waitUntil: "domcontentloaded",
    });
    const atalho = page.locator("[data-acao='ver-em-convocacoes']");
    await expect(atalho).toBeVisible();
    // Convocar continua no Preparar.
    await expect(page.locator(".entrevistas-convocacao")).toBeVisible();
    await semRolarDeLado(page);
    await atalho.click();
    await expect(page).toHaveURL(
      /\/sede\/aprovados\?aba=convocacao&tipo=entrevista$/,
    );
    await expect(central(page).locator("select")).toHaveValue(
      EDITAL_DA_ENTREVISTA,
    );
    await expect(
      botaoDaCentral(page, "Convocar em Conduzir entrevistas"),
    ).toBeVisible();
    for (const dentro of BOTOES_DA_CLASSIFICACAO)
      await expect(botaoDaCentral(page, dentro)).toBeVisible();
    await semRolarDeLado(page);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test("Conduzir entrevistas desligada na área: sem o bloco das entrevistas, mesmo com o endereço pedindo", async ({
    browser,
  }) => {
    const { contexto, page, erros } = await abrirNoCelular(
      browser,
      COM_CLASSIFICACAO,
      { listar_abas_do_menu: SEM_CONDUZIR_NA_SEDE },
    );
    await page.goto(CENTRAL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#approvedTabConvocacao")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("#approvedPanelConvocacao")).toBeVisible();
    await expect(central(page)).toHaveCount(0);
    await semRolarDeLado(page);
    expect(erros).toEqual([]);
    await contexto.close();
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
