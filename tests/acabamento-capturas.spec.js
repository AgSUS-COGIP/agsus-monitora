import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  abrirComSessao,
  buildSimulado,
  SUPABASE,
} from "./apoio/sessao-simulada.js";
import {
  CENARIOS,
  modulosEAbas,
  monitoramento,
  resumoDoNucleo,
} from "./fixtures/acabamento/dados.js";

/*
  Capturas do acabamento visual (norma: docs/design-system-agsus.md): as telas
  da base abertas com sessão simulada, em tema claro e escuro, a 375px e
  1280px, com quatro cenários de dados — tabela cheia (220 linhas), texto
  longo (200 caracteres), lista vazia e erro 500 da RPC. Cada captura vai para
  `test-results/acabamento/<tela>-<tema>-<largura>-<cenario>.png`, para olhar.

  O que o teste prova sozinho: nenhuma `pageerror` e nenhuma rolagem
  horizontal da página. O resto (contraste, camadas, quebra de texto, estado
  vazio e de erro) é conferido por olho, nas imagens.

  O tema é o do app: a chave `agsus_dark_mode_v1` = "1" no armazenamento, que o
  <head> lê antes do primeiro quadro e marca `html[data-theme="dark"]`.
*/

const PASTA = "test-results/acabamento";
const TEMAS = ["claro", "escuro"];
const LARGURAS = { 375: 800, 1280: 900 };
const CHAVE_DO_TEMA = "agsus_dark_mode_v1";

mkdirSync(PASTA, { recursive: true });

/** O que a tela mostra com os dados de cada cenário (um teste por combinação). */
function rpcsDoCenario(cenario, area) {
  return {
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
}

async function abrir(page, { caminho, tema, largura, cenario, area }) {
  const erros = await abrirComSessao(page, {
    rpcs: rpcsDoCenario(cenario, area),
    // Leituras de tabela da entrada: vazias, para não virar toast de erro.
    tabelas: { TB_CONFIGURACAO: [], TB_PAINEL_EXTERNO: [], TD_UNIDADE: [] },
  });
  // Mapas e fontes de fora não entram: sem rede, sem espera.
  await page.route(
    (url) => !["127.0.0.1", "teste.supabase.co"].includes(url.hostname),
    (rota) => rota.abort(),
  );
  await page.addInitScript(
    ({ chave, escuro }) => {
      if (escuro) localStorage.setItem(chave, "1");
      else localStorage.removeItem(chave);
      // O convite do tour da Aya não é parte do que se confere aqui.
      localStorage.setItem("agsus_aya_primeiros_passos_oferecidos_v1", "1");
    },
    { chave: CHAVE_DO_TEMA, escuro: tema === "escuro" },
  );
  await page.setViewportSize({ width: largura, height: LARGURAS[largura] });
  await page.goto(caminho, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loginScreen")).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    tema === "escuro" ? "dark" : "",
  );
  return erros;
}

async function assentar(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  // O convite do tour da tela cobre o canto: fica fora da captura.
  const convite = page.getByRole("button", { name: "Agora não" });
  if (await convite.isVisible()) {
    await convite.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function capturar(page, erros, { tela, tema, largura, cenario }) {
  await assentar(page);
  await page.screenshot({
    path: `${PASTA}/${tela}-${tema}-${largura}-${cenario}.png`,
  });
  const rolagem = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(
    rolagem.pagina,
    `rolagem horizontal da página (${rolagem.pagina}px > ${rolagem.janela}px)`,
  ).toBeLessThanOrEqual(rolagem.janela);
  expect(erros).toEqual([]);
}

test.describe("capturas do acabamento", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await buildSimulado(request)),
      `Compile com VITE_SUPABASE_URL=${SUPABASE} para rodar estes testes.`,
    );
  });

  for (const tema of TEMAS)
    for (const largura of Object.keys(LARGURAS).map(Number)) {
      const base = { tema, largura };

      // Editais: a tabela com TabelaInfinita, nos quatro cenários.
      for (const cenario of CENARIOS)
        test(`editais ${tema} ${largura}px ${cenario}`, async ({ page }) => {
          const opcoes = { ...base, cenario, area: "sede" };
          const erros = await abrir(page, {
            ...opcoes,
            caminho: "/sede/editais",
          });
          await expect(page.locator("#pageTitle")).toHaveText("Editais");
          await capturar(page, erros, { ...opcoes, tela: "editais" });
        });

      // O modal do edital (Novo edital), com a tabela cheia por trás.
      test(`editais modal ${tema} ${largura}px`, async ({ page }) => {
        const opcoes = { ...base, cenario: "cheia", area: "sede" };
        const erros = await abrir(page, {
          ...opcoes,
          caminho: "/sede/editais",
        });
        await assentar(page);
        await page.locator("#newEditalBtn").click();
        await expect(page.locator(".modal.show .modal-card")).toBeVisible();
        await capturar(page, erros, { ...opcoes, tela: "editais-modal" });
      });

      // Visão geral: cenários cheia, longo, vazio e erro.
      for (const cenario of CENARIOS)
        test(`visão geral ${tema} ${largura}px ${cenario}`, async ({
          page,
        }) => {
          const opcoes = { ...base, cenario, area: "sede" };
          const erros = await abrir(page, {
            ...opcoes,
            caminho: "/sede/visao-geral",
          });
          await capturar(page, erros, { ...opcoes, tela: "visao-geral" });
        });

      // A gaveta do processo: clique na primeira linha da Visão geral.
      test(`visão geral gaveta ${tema} ${largura}px`, async ({ page }) => {
        const opcoes = { ...base, cenario: "cheia", area: "sede" };
        const erros = await abrir(page, {
          ...opcoes,
          caminho: "/sede/visao-geral",
        });
        await assentar(page);
        await page.locator("tr[data-linha]").first().click();
        await expect(page.locator(".ui-gaveta-topo")).toBeVisible();
        await capturar(page, erros, { ...opcoes, tela: "visao-geral-gaveta" });
      });

      // Configurações → Módulos e abas, nos quatro cenários.
      for (const cenario of CENARIOS)
        test(`configurações módulos ${tema} ${largura}px ${cenario}`, async ({
          page,
        }) => {
          const opcoes = { ...base, cenario, area: "sede" };
          const erros = await abrir(page, {
            ...opcoes,
            caminho: "/administracao/configuracoes/modulos",
          });
          await expect(
            page.locator('.config-secao[data-secao="modulos"]'),
          ).toBeVisible();
          await capturar(page, erros, {
            ...opcoes,
            tela: "configuracoes-modulos",
          });
        });
    }
});
