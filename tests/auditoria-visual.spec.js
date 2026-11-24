import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { medirTela } from "./apoio/medir-tela.js";
import {
  abrirComSessao,
  buildSimulado,
  contextoDoAdmin,
  SUPABASE,
} from "./apoio/sessao-simulada.js";
import {
  modulosEAbas,
  monitoramento,
  resumoDoNucleo,
} from "./fixtures/acabamento/dados.js";
import { rpcsDaAuditoria } from "./fixtures/auditoria-visual/dados.js";

/*
  Auditoria visual: responsividade e harmonia (diagnóstico, não trava). Passa
  por todas as telas das áreas e as seções de Configurações, com sessão
  simulada e dados fictícios (tests/fixtures/acabamento/), em três estados
  (cheia, vazia, erro) mais as camadas (modal, gaveta, menu), a 375, 768 e
  1280 px, claro e escuro. Em cada uma, mede com `medirTela`
  (tests/apoio/medir-tela.js) e grava:

    test-results/auditoria-visual/<tela>-<estado>-<largura>-<tema>.png
    test-results/auditoria-visual/medicoes/<mesmo nome>.json

  `npm run auditoria:visual` roda tudo e monta o resumo
  (scripts/resumir-auditoria-visual.mjs). Só roda com AUDITORIA=1: são ~450
  aberturas de página e o resultado é para ler, não para passar ou falhar.

  Os blocos do fim são travas, ligadas no CI pelos lotes 3 (tabelas) e 4
  (alvos de toque) do plano de correção: nenhuma tela passa de 375 nem de
  320px, nenhum alvo de toque tem menos de 44 × 44px, e nenhuma palavra curta
  da tabela quebra no meio a 1280px.
  Relatório e plano: docs/_arquivo/auditoria-responsividade-e-harmonia-2026-11-23.md.
*/

const PASTA = "test-results/auditoria-visual";
const ALTURA = { 320: 640, 375: 812, 768: 1024, 1280: 900 };
const LARGURAS = [375, 768, 1280];
const TEMAS = ["claro", "escuro"];
const ESTADOS = ["cheia", "vazia", "erro"];
const CHAVE_DO_TEMA = "agsus_dark_mode_v1";
const EDITAL = "00000000-0000-4000-8000-000000000001";

mkdirSync(`${PASTA}/medicoes`, { recursive: true });

/*
  As telas: o caminho e, quando há, a camada que se abre por cima. A área é
  SEDE (a área é dado, não estrutura), menos os mapas, que são de cada área.
*/
const TELAS = [
  { tela: "visao-geral", caminho: "/sede/visao-geral" },
  { tela: "editais", caminho: "/sede/editais" },
  { tela: "pagina-do-edital", caminho: `/sede/edital/${EDITAL}` },
  { tela: "cronograma", caminho: "/sede/cronograma" },
  { tela: "aprovados", caminho: "/sede/aprovados" },
  { tela: "painel-de-recursos", caminho: "/sede/painel-de-recursos" },
  { tela: "recursos", caminho: "/sede/recursos" },
  { tela: "painel-de-entrevistas", caminho: "/sede/painel-de-entrevistas" },
  { tela: "entrevistas", caminho: "/sede/entrevistas" },
  { tela: "classificacao", caminho: "/sede/classificacao" },
  { tela: "analises", caminho: "/sede/analises" },
  { tela: "avaliacao-documental", caminho: "/sede/avaliacao-documental" },
  { tela: "triagem", caminho: "/sede/triagem" },
  { tela: "selecao", caminho: "/sede/selecao" },
  { tela: "paineis-de-dados", caminho: "/sede/paineis-de-dados" },
  { tela: "mapa-saude-indigena", caminho: "/saude-indigena/mapa" },
  { tela: "mapa-de-projetos", caminho: "/projetos/mapa" },
  ...[
    "marca",
    "inicio",
    "acesso",
    "aparencia",
    "comemoracoes",
    "acessos",
    "recursos",
    "modulos",
  ].map((secao) => ({
    tela: `configuracoes-${secao}`,
    caminho: `/administracao/configuracoes/${secao}`,
  })),
];

/* As camadas: abrem por cima da tela cheia. */
const CAMADAS = [
  {
    tela: "editais",
    estado: "modal",
    caminho: "/sede/editais",
    abrir: async (page) => {
      await page.locator("#newEditalBtn").click();
      await expect(page.locator(".modal.show .modal-card")).toBeVisible();
    },
  },
  {
    tela: "visao-geral",
    estado: "gaveta",
    caminho: "/sede/visao-geral",
    abrir: async (page) => {
      await page.locator("tr[data-linha]").first().click();
      await expect(page.locator(".ui-gaveta-topo")).toBeVisible();
    },
  },
  {
    tela: "aprovados",
    estado: "mais-acoes",
    caminho: "/sede/aprovados",
    larguras: [375],
    abrir: async (page) => {
      await page.locator("[data-acao='mais-acoes']:visible").click();
      await expect(page.locator(".ui-mais-acoes-lista:visible")).toBeVisible();
    },
  },
  {
    tela: "visao-geral",
    estado: "menu",
    caminho: "/sede/visao-geral",
    larguras: [375, 768],
    abrir: async (page) => {
      await page.locator("#globalSidebarToggle").click();
      await expect(page.locator("#globalSidebarToggle")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    },
  },
];

/*
  Administrador com a matriz de acessos inteira: sem ela, as telas que só a
  matriz libera (Avaliação documental, Triagem, Painéis) voltam para a Visão
  geral.
*/
const RECURSOS = [
  "dashboard",
  "analises",
  "avaliacao_documental",
  "nucleo",
  "calendario",
  "aprovados",
  "aprovados_pendencias",
  "entrevistas",
  "classificacao",
  "recursos",
  "recursos_parecer",
  "selecao",
  "paineis_dados",
  "importacao",
  "paineis",
  "configuracoes",
  "acessos",
];
const AREAS = ["saude-indigena", "sede", "projetos"];
function contextoCompleto() {
  const contexto = contextoDoAdmin(AREAS);
  contexto.profile.permissoes = Object.fromEntries([
    ...RECURSOS.map((recurso) => [recurso, "admin"]),
    ...AREAS.map((area) => [`area:${area}`, "leitor"]),
  ]);
  return contexto;
}

const ERRO_500 = () => ({
  status: 500,
  json: { code: "XX000", message: "Falha simulada do banco." },
});

/*
  As respostas do estado. As RPCs com resposta fictícia (as da base) seguem o
  estado; as outras: vazia devolve lista vazia, erro devolve 500, e cheia
  devolve 404 (anotada em `semDados`: a tela aparece no estado de erro e o
  relatório diz que faltou resposta fictícia para ela).
*/
function respostas(estado, area, semDados) {
  const cenario = { cheia: "cheia", vazia: "vazio", erro: "erro" }[estado];
  const conhecidas = {
    ...rpcsDaAuditoria(cenario, area),
    listar_monitoramento_operacional: monitoramento(cenario, area),
    get_nucleo_cronograma_resumo: resumoDoNucleo(cenario, area),
    obter_modulos_e_abas: modulosEAbas(cenario),
    listar_acompanhamento_da_visao_geral_se_mudou: { versao: "v1" },
    listar_editais_criticos_manuais: [],
    listar_mapa_da_saude_indigena: {
      linhas: [
        { chave: "lmap", payload: { dsei: [] } },
        { chave: "rede_cnes", payload: { rede: [] } },
      ],
      versao: "v1",
    },
  };
  const rpcs = new Proxy(conhecidas, {
    has(alvo, nome) {
      if (nome in alvo) return true;
      if (estado === "cheia") {
        semDados.add(String(nome));
        return false;
      }
      return true;
    },
    get(alvo, nome) {
      if (nome in alvo) return alvo[nome];
      return estado === "erro" ? ERRO_500 : [];
    },
  });
  // Leituras de tabela: vazias, para não virar aviso de erro da moldura.
  const tabelas = new Proxy({}, { has: () => true, get: () => [] });
  return { contexto: contextoCompleto(), rpcs, tabelas };
}

async function abrir(browser, { caminho, estado, largura, tema }) {
  const toque = largura < 1280;
  const contexto = await browser.newContext({
    viewport: { width: largura, height: ALTURA[largura] },
    isMobile: toque,
    hasTouch: toque,
    deviceScaleFactor: 1,
  });
  const page = await contexto.newPage();
  const semDados = new Set();
  const area = caminho.split("/")[1];
  const erros = await abrirComSessao(page, respostas(estado, area, semDados));
  // Sem rede de fora (fontes, mosaicos do mapa), menos o Leaflet do cdnjs.
  await page.route(
    (url) =>
      !["127.0.0.1", "teste.supabase.co"].includes(url.hostname) &&
      !url.href.startsWith("https://cdnjs.cloudflare.com/ajax/libs/leaflet/"),
    (rota) => rota.abort(),
  );
  await page.addInitScript(
    ({ chave, escuro }) => {
      if (escuro) localStorage.setItem(chave, "1");
      else localStorage.removeItem(chave);
      localStorage.setItem("agsus_aya_primeiros_passos_oferecidos_v1", "1");
    },
    { chave: CHAVE_DO_TEMA, escuro: tema === "escuro" },
  );
  await page.goto(caminho, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loginScreen")).toBeHidden();
  await page.waitForLoadState("networkidle").catch(() => {});
  const convite = page.getByRole("button", { name: "Agora não" });
  if (await convite.isVisible().catch(() => false))
    await convite.click({ timeout: 2000 }).catch(() => {});
  return { page, contexto, erros, semDados, toque };
}

async function medirEGuardar({ page, erros, semDados, toque }, dados) {
  // O mouse fora das linhas: o hover pinta a linha com outra cor.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(500);
  const nome = `${dados.tela}-${dados.estado}-${dados.largura}-${dados.tema}`;
  await page.screenshot({ path: `${PASTA}/${nome}.png` });
  const medicao = await page.evaluate(medirTela, { toque });
  writeFileSync(
    `${PASTA}/medicoes/${nome}.json`,
    JSON.stringify(
      {
        ...dados,
        captura: `${nome}.png`,
        semDados: [...semDados].sort(),
        errosDaPagina: erros,
        ...medicao,
      },
      null,
      1,
    ),
  );
  return medicao;
}

test.describe("auditoria visual", () => {
  test.describe.configure({ timeout: 90_000 });
  // Pula o bloco inteiro (sem abrir navegador) fora da auditoria.
  test.skip(!process.env.AUDITORIA, "auditoria visual: rode com AUDITORIA=1");
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar a auditoria.`,
    );
  });

  for (const { tela, caminho } of TELAS)
    for (const estado of ESTADOS)
      for (const largura of LARGURAS)
        for (const tema of TEMAS)
          test(`${tela} ${estado} ${largura}px ${tema}`, async ({
            browser,
          }) => {
            const aberta = await abrir(browser, {
              caminho,
              estado,
              largura,
              tema,
            });
            await medirEGuardar(aberta, {
              tela,
              caminho,
              estado,
              largura,
              tema,
            });
            await aberta.contexto.close();
          });

  for (const camada of CAMADAS)
    for (const largura of camada.larguras ?? LARGURAS)
      for (const tema of TEMAS)
        test(`${camada.tela} ${camada.estado} ${largura}px ${tema}`, async ({
          browser,
        }) => {
          const aberta = await abrir(browser, {
            caminho: camada.caminho,
            estado: "cheia",
            largura,
            tema,
          });
          await camada.abrir(aberta.page);
          await medirEGuardar(aberta, {
            tela: camada.tela,
            caminho: camada.caminho,
            estado: camada.estado,
            largura,
            tema,
          });
          await aberta.contexto.close();
        });
});

/*
  As travas dos lotes 3 e 4 do plano, no CI: nenhuma tela passa de 375 nem de
  320px (WCAG 1.4.10; a tabela rola dentro da própria caixa), e nenhum alvo de
  toque, na tela ou na moldura, tem menos de 44 × 44px (Design System, 16).
*/
test.describe("sem rolagem horizontal a 375 e 320px", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar este teste.`,
    );
  });

  for (const largura of [375, 320])
    for (const { tela, caminho } of TELAS)
      test(`${tela} cabe em ${largura}px`, async ({ browser }) => {
        const aberta = await abrir(browser, {
          caminho,
          estado: "cheia",
          largura,
          tema: "claro",
        });
        // A medida de medirTela pega também o que o overflow-x do body corta.
        const { achados } = await aberta.page.evaluate(medirTela, {
          toque: true,
        });
        await aberta.contexto.close();
        expect(
          achados.rolagem,
          `passa de ${largura}px: ${achados.rolagem?.culpados.map((c) => c.caminho).join("; ")}`,
        ).toBeNull();
        expect(
          achados.toque,
          `alvo < 44px: ${achados.toque.map((a) => `${a.caminho} (${a.tamanho})`).join("; ")}`,
        ).toEqual([]);
      });
});

/*
  Palavra inteira nas tabelas a 1280px: "Enfermeiro" não vira "Enfermeir/o".
  A palavra (sem espaço, hífen nem barra) de até 20 letras não pode cair em
  duas linhas; a mais comprida pode, para não alargar a tabela sem fim.
*/
function palavrasQuebradas() {
  const quebradas = [];
  for (const celula of document.querySelectorAll("td")) {
    const textos = document.createTreeWalker(celula, NodeFilter.SHOW_TEXT);
    for (let no = textos.nextNode(); no; no = textos.nextNode())
      for (const palavra of no.data.matchAll(/[^\s\-–/]+/g)) {
        if (palavra[0].length > 20) continue;
        const trecho = document.createRange();
        trecho.setStart(no, palavra.index);
        trecho.setEnd(no, palavra.index + palavra[0].length);
        const linhas = new Set(
          [...trecho.getClientRects()].map((r) => Math.round(r.top)),
        );
        if (linhas.size > 1) quebradas.push(palavra[0]);
      }
  }
  return [...new Set(quebradas)];
}

test.describe("palavra inteira nas tabelas a 1280px", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar este teste.`,
    );
  });

  for (const { tela, caminho } of TELAS.filter((t) =>
    ["editais", "aprovados"].includes(t.tela),
  ))
    test(`${tela}: nenhuma palavra curta quebrada`, async ({ browser }) => {
      const aberta = await abrir(browser, {
        caminho,
        estado: "cheia",
        largura: 1280,
        tema: "claro",
      });
      await expect(
        aberta.page.locator("tbody td:visible").first(),
      ).toBeVisible();
      const quebradas = await aberta.page.evaluate(palavrasQuebradas);
      await aberta.contexto.close();
      expect(quebradas, `quebradas: ${quebradas.join(", ")}`).toEqual([]);
    });
});

/*
  As travas do lote 2 do plano (grade da página e cabeçalho da tela): o
  padding lateral da página é 16, 24 e 32px (celular, tablet, desktop), e no
  celular o topo da tela mostra uma ação larga (40% da página ou mais), no
  máximo; as outras ficam em "Mais ações" (MaisAcoes, src/ui/).
*/
function acoesLargasNoTopo() {
  const pagina = document.querySelector(".content .page.active");
  if (!pagina) return [];
  const largura = pagina.getBoundingClientRect().width;
  const topos = pagina.querySelectorAll(
    ":is(.ui-topo, .ui-cabecalho-da-tela, .visao-geral-acoes)",
  );
  return [...topos].flatMap((topo) =>
    [...topo.querySelectorAll(".btn:not([data-acao='mais-acoes'])")]
      .filter((botao) => {
        const caixa = botao.getBoundingClientRect();
        return caixa.height > 0 && caixa.width >= largura * 0.4;
      })
      .map((botao) =>
        (botao.innerText || botao.getAttribute("aria-label") || "").trim(),
      ),
  );
}

test.describe("grade da página e topo da tela", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar este teste.`,
    );
  });

  for (const [largura, esperado] of [
    [375, "16px"],
    [768, "24px"],
    [1280, "32px"],
  ])
    test(`padding lateral da página em ${largura}px`, async ({ browser }) => {
      const aberta = await abrir(browser, {
        caminho: "/sede/editais",
        estado: "cheia",
        largura,
        tema: "claro",
      });
      const conteudo = aberta.page.locator(".content");
      await expect(conteudo).toHaveCSS("padding-left", esperado);
      await expect(conteudo).toHaveCSS("padding-right", esperado);
      await aberta.contexto.close();
    });

  for (const { tela, caminho } of TELAS)
    test(`${tela}: no máximo uma ação de largura cheia no topo a 375px`, async ({
      browser,
    }) => {
      const aberta = await abrir(browser, {
        caminho,
        estado: "cheia",
        largura: 375,
        tema: "claro",
      });
      await aberta.page.waitForTimeout(300);
      const largas = await aberta.page.evaluate(acoesLargasNoTopo);
      await aberta.contexto.close();
      expect(
        largas.length,
        `largas: ${largas.join(" | ")}`,
      ).toBeLessThanOrEqual(1);
    });
});
