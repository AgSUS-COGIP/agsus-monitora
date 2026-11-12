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
  NOME_DE_200,
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

  Roda só sob demanda (`CAPTURAS=1`): são 56 capturas, e o que elas dão é para
  olhar. Comando em docs/biblioteca/testes-de-navegador.md.

  O tema é o do app: a chave `agsus_dark_mode_v1` = "1" no armazenamento, que o
  <head> lê antes do primeiro quadro e marca `html[data-theme="dark"]`.
*/

const PASTA = "test-results/acabamento";
const TEMAS = ["claro", "escuro"];
const LARGURAS = { 375: 800, 1280: 900 };
const CHAVE_DO_TEMA = "agsus_dark_mode_v1";
/** O começo do texto de 200 caracteres: basta para saber que ele chegou à tela. */
const TRECHO_LONGO = NOME_DE_200.slice(0, 40);

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
  // O convite do tour da tela cobre o canto: fica fora da captura.
  const convite = page.getByRole("button", { name: "Agora não" });
  if (await convite.isVisible()) {
    await convite.click({ timeout: 2000 }).catch(() => {});
    await expect(convite).toBeHidden();
  }
}

/*
  O que cada cenário tem de mostrar na tela: sem isto a captura poderia ser de
  um esqueleto ou de uma tela quebrada e o teste passaria. Cada tela diz onde
  estão as linhas, a mensagem de vazio e o erro.
*/
async function conferirCenario(
  page,
  cenario,
  { linhas, minimo = 50, vazio, erro, texto },
) {
  if (cenario === "cheia")
    // Tabela contínua: desenha 50 por vez, das 220 que vieram.
    await expect.poll(() => linhas.count()).toBeGreaterThanOrEqual(minimo);
  if (cenario === "longo") await expect(texto).toBeVisible();
  if (cenario === "vazio") await expect(vazio).toBeVisible();
  if (cenario === "erro") await expect(erro).toBeVisible();
}

async function capturar(page, erros, { tela, tema, largura, cenario }) {
  await assentar(page);
  // Uma pausa curta só para as transições de entrada (toast, gaveta) terminarem antes da foto.
  await page.waitForTimeout(400);
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
      !process.env.CAPTURAS,
      "capturas do acabamento: rode com CAPTURAS=1",
    );
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
          await conferirCenario(page, cenario, {
            linhas: page.locator("#nucleoRows tr[data-record-id]"),
            vazio: page.getByText("Nenhum edital nesta área."),
            erro: page.locator("#nucleoRows").getByRole("alert"),
            texto: page.locator("#nucleoRows").getByText(TRECHO_LONGO).first(),
          });
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
          await conferirCenario(page, cenario, {
            linhas: page.locator("tr[data-linha]"),
            vazio: page.getByText("Nenhum processo seletivo nesta área."),
            erro: page.locator(".visao-geral-tabela-caixa").getByRole("alert"),
            texto: page
              .locator(".visao-geral-tabela-caixa")
              .getByText(TRECHO_LONGO)
              .first(),
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
          const secao = page.locator('.config-secao[data-secao="modulos"]');
          await expect(secao).toBeVisible();
          await conferirCenario(page, cenario, {
            // Cheia: 12 abas em cada uma das 3 áreas.
            linhas: secao.getByText(/^Aba \d+ de /),
            minimo: 30,
            vazio: secao.getByText("Nenhum painel externo cadastrado."),
            erro: secao.getByRole("alert"),
            texto: secao.getByText(TRECHO_LONGO).first(),
          });
          await capturar(page, erros, {
            ...opcoes,
            tela: "configuracoes-modulos",
          });
        });
    }
});
