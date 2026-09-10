/*
  Busca a identidade da tela de acesso antes de qualquer autenticação.

  POR QUE ISTO EXISTE
  O cache resolve a segunda visita e todas as seguintes, mas não a primeira.
  Navegador novo, aba anónima, máquina nova ou armazenamento limpo abriam sem
  identidade nenhuma. A identidade da tela de login é informação pública por
  natureza: o visitante precisa vê-la justamente antes de se autenticar.

  POR QUE NÃO USA O CLIENTE COMPARTILHADO
  `getSupabaseClient()` carrega a sessão do utilizador e envia-a em
  `Authorization`. Uma sessão inválida no armazenamento faz o PostgREST responder
  `401 PGRST301` — "None of the keys was able to decode the JWT" — e a chamada
  falharia por um motivo que nada tem a ver com ela ser pública.

  Esta chamada é, portanto, isolada por construção: um `fetch` que envia apenas
  `apikey`. Não é um segundo cliente Supabase — o singleton continua a ser o
  único, e `tests/supabase-cliente-unico.test.js` continua a valer.

  MEDIDO NO BANCO REAL EM 09/09/2026

    cabeçalhos                      GET /configuracoes    POST /rpc/…
    só apikey                       200, dez chaves       404 PGRST202
    apikey + Bearer <chave>         200, dez chaves       404 PGRST202
    apikey + Bearer <JWT expirado>  401 PGRST301          401 PGRST301

  As duas primeiras linhas dão no mesmo hoje, mas só a primeira está certa: a
  segunda apresenta uma credencial de projeto onde se espera identidade de
  utilizador, e depende de o gateway continuar a tolerar isso. A terceira é a
  razão de não usar o cliente compartilhado.

  DEGRADAÇÃO
  Qualquer falha devolve `null` e nada acontece: a última marca válida permanece;
  se não houver, a tela fica neutra. Uma falha nunca troca uma identidade correta.
*/

import { SUPABASE_KEY, SUPABASE_URL } from "./env.js";

export const RPC_BRANDING_PUBLICO = "obter_branding_acesso_publico";

/** Tempo máximo de espera: isto corre no arranque de toda visita. */
const LIMITE_MS = 4000;

/*
  As chaves do banco e os campos do cache têm nomes diferentes por razões
  históricas. Este mapa é a única tradução entre os dois, e é também a segunda
  barreira: mesmo que a função no banco passasse a devolver mais do que devia,
  só o que está aqui seria lido.
*/
const CHAVES_DE_BRANDING = {
  auth_access_background_url: "backgroundUrl",
  auth_access_logo_url: "logoUrl",
  auth_access_panel_color: "panelColor",
  auth_access_greeting: "greeting",
  auth_access_instruction: "instruction",
  auth_google_button_text: "buttonText",
  auth_access_texto_modo: "textoModo",
};

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Traduz a resposta da RPC para os campos do cache, descartando o resto.
 * @returns {object|null} `null` quando não sobra nada de útil.
 */
export function mapearBrandingPublico(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;

  const marca = {};
  for (const [chave, campo] of Object.entries(CHAVES_DE_BRANDING)) {
    const valor = texto(dados[chave]);
    if (valor) marca[campo] = valor;
  }

  return Object.keys(marca).length ? marca : null;
}

/**
 * Pergunta ao banco qual é a identidade da tela de acesso.
 *
 * @param {object} [opcoes]
 * @param {typeof fetch} [opcoes.buscar] injetável para teste
 * @param {string} [opcoes.url]
 * @param {string} [opcoes.chave] credencial **pública**; nunca a sessão
 * @returns {Promise<object|null>} `null` em qualquer falha — nunca lança.
 */
export async function buscarMarcaPublica({
  buscar = globalThis.fetch,
  url = SUPABASE_URL,
  chave = SUPABASE_KEY,
} = {}) {
  if (!buscar || !url || !chave) return null;

  const controlo =
    typeof AbortController === "function" ? new AbortController() : null;
  const relogio = controlo
    ? setTimeout(() => controlo.abort(), LIMITE_MS)
    : null;

  try {
    const resposta = await buscar(
      `${url.replace(/\/+$/, "")}/rest/v1/rpc/${RPC_BRANDING_PUBLICO}`,
      {
        method: "POST",
        /*
          `apikey` e mais nada. **Sem `Authorization`.**

          O cabeçalho `Authorization` é o lugar do JWT de quem está autenticado.
          A chave publicável do projeto não é um JWT — `sb_publishable_…` não tem
          sequer o formato — e enviá-la ali é pedir que seja lida como se fosse.
          O gateway identifica a aplicação pela `apikey`; sem utilizador
          autenticado, o PostgreSQL executa como `anon`, que é exatamente o que
          esta chamada quer.

          Assim, de uma vez: nenhuma sessão válida é herdada, nenhum JWT expirado
          é herdado, e nenhuma credencial pública é apresentada como se fosse
          identidade de utilizador.
        */
        headers: {
          "Content-Type": "application/json",
          apikey: chave,
        },
        body: "{}",
        signal: controlo?.signal,
        // A resposta muda quando alguém edita Configurações; não guardar em cache HTTP.
        cache: "no-store",
      },
    );

    if (!resposta?.ok) return null;
    return mapearBrandingPublico(await resposta.json());
  } catch {
    /*
      Silêncio deliberado. Este caminho corre no arranque de toda visita, antes
      de haver interface para mostrar erro — e a consequência de falhar já é a
      correta: manter o que estava.
    */
    return null;
  } finally {
    if (relogio) clearTimeout(relogio);
  }
}
