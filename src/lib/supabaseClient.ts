import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_AUTH_STORAGE_KEY,
  SUPABASE_KEY,
  SUPABASE_URL,
  hasSupabaseEnv,
} from "./env";
import { createSafeAuthStorage } from "../modules/auth-storage.ts";
import {
  EVENTO_TELA_ANTIGA,
  observarRespostasDoBanco,
  type SinalDeTelaAntiga,
} from "./versao-do-sistema.ts";
import { comNovasTentativas, criarOrcamento } from "./novas-tentativas.ts";

type ArmazenamentoDaSessao = ReturnType<typeof createSafeAuthStorage>;

let supabaseClient: SupabaseClient | null = null;
let authStorage: ArmazenamentoDaSessao | null = null;

export function getSupabaseAuthStorage(): ArmazenamentoDaSessao {
  if (!authStorage) {
    authStorage = createSafeAuthStorage(SUPABASE_AUTH_STORAGE_KEY);
  }
  return authStorage;
}

/*
  RPC que falhou como "tela antiga" (src/lib/versao-do-sistema.ts) vira um
  evento: o aviso de versão (src/app/aviso-de-versao.ts) confere se há versão
  nova e pede para atualizar. A resposta segue igual para quem chamou.
*/
function avisarTelaAntiga(sinal: SinalDeTelaAntiga) {
  if (typeof CustomEvent !== "function") return;
  globalThis.dispatchEvent?.(
    new CustomEvent(EVENTO_TELA_ANTIGA, { detail: sinal }),
  );
}

/*
  Token vencido (401 do PostgREST): uma renovação para todas as chamadas que
  falharam juntas. Se outra já renovou, usa o token novo da sessão.
*/
let renovacao: Promise<string | null> | null = null;
function renovarToken(antigo: string): Promise<string | null> {
  if (renovacao) return renovacao;
  renovacao = (async () => {
    const auth = supabaseClient?.auth;
    if (!auth) return null;
    const { data } = await auth.getSession();
    const atual = data.session?.access_token || null;
    if (atual && atual !== antigo) return atual;
    const renovada = await auth.refreshSession();
    return renovada.error ? null : renovada.data.session?.access_token || null;
  })().finally(() => {
    renovacao = null;
  });
  return renovacao;
}

/*
  Registro de navegação e de auditoria: ninguém espera por eles, e eles não
  podem se perder quando a pessoa fecha ou troca a página. `keepalive` deixa a
  chamada terminar depois que a página sai (o corpo é pequeno, bem abaixo do
  limite de 64 KB do navegador).
*/
const RPCS_SEM_ESPERA =
  /\/rest\/v1\/rpc\/(registrar_navegacao_monitora|registrar_evento_acesso)$/;

function semPrenderAPagina(base: typeof fetch): typeof fetch {
  return (entrada, opcoes) =>
    typeof entrada === "string" && RPCS_SEM_ESPERA.test(entrada)
      ? base(entrada, { ...opcoes, keepalive: true })
      : base(entrada, opcoes);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseEnv()) return null;

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: getSupabaseAuthStorage(),
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
        // O AgSUS Monitora trata o parâmetro ?code explicitamente no bootstrap
        // principal e em auth/callback.ts. Desativar a deteção automática evita
        // duas tentativas concorrentes de exchangeCodeForSession.
        detectSessionInUrl: false,
      },
      // Repetir chamada é com src/lib/novas-tentativas.ts, não com a biblioteca.
      db: { retry: false },
      global: {
        fetch: observarRespostasDoBanco(
          comNovasTentativas(
            semPrenderAPagina((...argumentos) =>
              globalThis.fetch(...argumentos),
            ),
            { orcamento: criarOrcamento(), renovarToken },
          ),
          avisarTelaAntiga,
        ),
      },
    });
    lerSessaoTambemSemRede(supabaseClient);
  }

  return supabaseClient;
}

/*
  Sem rede e com o token vencido (1 h), o auth-js devolve `session: null`
  embora a sessão continue guardada: a leitura da sessão do cliente passa a
  devolver a guardada, por até 48 h (src/lib/sessao-sem-rede.ts). É aqui, onde
  o cliente nasce, para valer em todas as telas que pedem o usuário ao
  `getSession()`. Com a rede de volta, a leitura da biblioteca renova o token.
*/
function lerSessaoTambemSemRede(cliente: SupabaseClient) {
  const auth = cliente.auth;
  const daBiblioteca = auth.getSession.bind(auth);
  auth.getSession = (async () => {
    const lida = await daBiblioteca();
    // Com sessão, ou sem erro (não há sessão), segue como veio. A regra só
    // baixa quando a leitura falhou: fora do pedaço da entrada.
    if (lida.data.session || !lida.error) return lida;
    try {
      const { sessaoSemRede } = await import("./sessao-sem-rede.ts");
      return sessaoSemRede(lida, {
        guardada: getSupabaseAuthStorage().getItem(SUPABASE_AUTH_STORAGE_KEY),
        agora: Date.now(),
        online: globalThis.navigator?.onLine !== false,
      });
    } catch {
      return lida;
    }
  }) as typeof auth.getSession;
}
