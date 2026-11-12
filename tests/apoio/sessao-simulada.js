/*
  Apoio dos specs com sessão simulada: o app aberto com sessão, sem Supabase de
  verdade. A sessão é semeada no armazenamento e cada chamada ao Supabase é
  respondida por `page.route`. Quem usa: `sessao-simulada.spec.js` (comportamento
  das rotas) e `acabamento-capturas.spec.js` (capturas das telas).
*/

export const SUPABASE = "https://teste.supabase.co";
/* O endereço inteiro, entre aspas, como o Vite o grava no bundle. */
export const SUPABASE_NO_BUNDLE = /["'`]https:\/\/teste\.supabase\.co["'`]/;
export const CHAVE_DA_SESSAO = "agsus-monitora-auth";

const base64url = (valor) =>
  Buffer.from(JSON.stringify(valor)).toString("base64url");

const agora = Math.floor(Date.now() / 1000);
export const USUARIO = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "pessoa.teste@agenciasus.org.br",
  app_metadata: { provider: "google" },
  user_metadata: { full_name: "Pessoa Teste" },
};
export const SESSAO = {
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
export const contextoDoAdmin = (
  areas = ["saude-indigena", "sede", "projetos"],
) => ({
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
export async function buildSimulado(request) {
  const texto = async (caminho) => (await request.get(caminho)).text();
  const entrada = (await texto("/")).match(/src="(\/assets\/main-[^"]+\.js)"/);
  if (!entrada) return false;
  const cliente = (await texto(entrada[1])).match(/supabaseClient-[\w-]+\.js/);
  return (
    Boolean(cliente) &&
    SUPABASE_NO_BUNDLE.test(await texto(`/assets/${cliente[0]}`))
  );
}

/**
 * Semeia a sessão e responde ao Supabase. `contexto` é a resposta de
 * `obter_contexto_monitora` (null = sem perfil). Devolve os erros da página.
 * `rpcs` mapeia o nome da RPC para o JSON devolvido (ou uma função que
 * devolve `{ status, json }`). `tabelas` faz o mesmo para leituras de tabela
 * (`/rest/v1/<tabela>`), que de outro modo voltam como "não simuladas".
 */
export async function abrirComSessao(
  page,
  {
    contexto = contextoDoAdmin(),
    situacao = null,
    rpcs = {},
    tabelas = {},
  } = {},
) {
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
    /* `rpcs`: nome da RPC -> JSON, ou função que devolve `{ status, json }`
       (para simular erro). Vale depois do contexto e antes do "não simulada". */
    const nome = pathname.replace("/rest/v1/rpc/", "");
    if (pathname.startsWith("/rest/v1/rpc/") && nome in rpcs) {
      const resposta = rpcs[nome];
      if (typeof resposta === "function") return rota.fulfill(resposta(rota));
      return rota.fulfill({ json: resposta });
    }
    const tabela = pathname.replace("/rest/v1/", "");
    if (!pathname.startsWith("/rest/v1/rpc/") && tabela in tabelas)
      return rota.fulfill({ json: tabelas[tabela] });
    if (situacao && pathname === "/rest/v1/rpc/obter_situacao_do_sistema")
      return rota.fulfill({ json: situacao });
    return rota.fulfill({
      status: 404,
      json: { code: "PGRST202", message: "Não simulada no teste." },
    });
  });
  return erros;
}
