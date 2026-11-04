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

const SUPABASE = "https://teste.supabase.co";
const CHAVE_DA_SESSAO = "agsus-monitora-auth";

const base64url = (valor) =>
  Buffer.from(JSON.stringify(valor)).toString("base64url");

const agora = Math.floor(Date.now() / 1000);
const USUARIO = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "pessoa.teste@agenciasus.org.br",
  app_metadata: { provider: "google" },
  user_metadata: { full_name: "Pessoa Teste" },
};
const SESSAO = {
  access_token: [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({ sub: USUARIO.id, role: "authenticated", exp: agora + 3600 }),
    "assinatura",
  ].join("."),
  refresh_token: "renovacao",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: agora + 3600,
  user: USUARIO,
};
/** O contexto de `obter_contexto_monitora` para um administrador global. */
const contextoDoAdmin = (areas = ["saude-indigena", "sede", "projetos"]) => ({
  profile: {
    id: USUARIO.id,
    nome: "Pessoa Teste",
    email: USUARIO.email,
    ativo: true,
    admin_global: true,
    role: "admin",
    areas,
  },
  panel_ids: [],
});

/**
 * O build aponta para o Supabase simulado? O endereço vai no pedaço do
 * cliente (src/lib/supabaseClient.ts), importado pela entrada.
 */
async function buildSimulado(request) {
  const texto = async (caminho) => (await request.get(caminho)).text();
  const entrada = (await texto("/")).match(/src="(\/assets\/main-[^"]+\.js)"/);
  if (!entrada) return false;
  const cliente = (await texto(entrada[1])).match(/supabaseClient-[\w-]+\.js/);
  return (
    Boolean(cliente) &&
    (await texto(`/assets/${cliente[0]}`)).includes(SUPABASE)
  );
}

/**
 * Semeia a sessão e responde ao Supabase. `contexto` é a resposta de
 * `obter_contexto_monitora` (null = sem perfil). Devolve os erros da página.
 */
async function abrirComSessao(page, { contexto = contextoDoAdmin() } = {}) {
  const erros = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await page.addInitScript(
    ({ chave, valor }) => localStorage.setItem(chave, valor),
    { chave: CHAVE_DA_SESSAO, valor: JSON.stringify(SESSAO) },
  );
  await page.route(`${SUPABASE}/**`, (rota) => {
    const { pathname } = new URL(rota.request().url());
    if (pathname === "/auth/v1/user") return rota.fulfill({ json: USUARIO });
    if (pathname === "/rest/v1/rpc/obter_contexto_monitora")
      return rota.fulfill({ json: contexto });
    if (pathname === "/rest/v1/rpc/meu_usuario")
      return rota.fulfill({ json: [] });
    return rota.fulfill({
      status: 404,
      json: { code: "PGRST202", message: "Não simulada no teste." },
    });
  });
  return erros;
}

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
