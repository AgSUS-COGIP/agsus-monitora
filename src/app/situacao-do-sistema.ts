import {
  normalizarSituacaoDoSistema,
  SITUACAO_PADRAO,
} from "../lib/situacao-dos-modulos.ts";
import type {
  RespostaDaSituacao,
  SituacaoDoSistema,
} from "../lib/situacao-dos-modulos.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OpcoesDaCargaDoBanco,
  RespostaDaConsulta,
} from "../modules/catalogo-de-abas.ts";

/*
  A situação do sistema e das áreas (`obter_situacao_do_sistema`): sistema,
  áreas e abas em manutenção ou desativados, e as comemorações ligadas. Sem
  DOM e sem React.

  Quem decide o que vale é `src/lib/situacao-dos-modulos.ts`. O app só:
    - dispara a consulta junto com as outras da entrada
      (`consultaDaSituacaoDoSistema`, src/app/carga.ts) e aplica a resposta
      (`carregarSituacaoDoSistema`) antes de montar o menu, que tira as áreas
      desativadas (`situacaoDoSistema()`);
    - pergunta, a cada troca de tela, se a página abre (src/app/navegacao.ts,
      `avisoDaPagina`): quem não é administrador global vê o aviso de
      manutenção no lugar da página, e o administrador vê a página com a
      faixa — os dois desenhados pela rota (src/app/telas.tsx).

  A situação NÃO vai na cópia da sessão: é sempre a do banco, nesta entrada
  (e relida no meio da sessão pelo vigia do catálogo,
  src/app/vigia-do-catalogo.ts, quando a versão muda). Falhou a consulta
  (rede, função ainda não publicada), vale tudo ativo — a tela nunca tranca
  ninguém por erro de rede.
*/

const RPC_SITUACAO_DO_SISTEMA = "obter_situacao_do_sistema";
/* PostgREST: a função não existe (migration ainda não aplicada). Não é falha. */
const FUNCAO_AUSENTE = "PGRST202";

let situacao: SituacaoDoSistema = SITUACAO_PADRAO;

/** Dispara a consulta já; nunca rejeita. */
export function consultaDaSituacaoDoSistema(
  sb: Pick<SupabaseClient, "rpc"> | null | undefined,
): Promise<RespostaDaConsulta> {
  if (!sb) return Promise.resolve({ data: null, error: null });
  return Promise.resolve(sb.rpc(RPC_SITUACAO_DO_SISTEMA)).catch((error) => ({
    data: null,
    error,
  }));
}

/** Aplica a resposta; sem ela, tudo ativo. Devolve a situação em uso. */
export async function carregarSituacaoDoSistema({
  consulta,
}: OpcoesDaCargaDoBanco = {}): Promise<SituacaoDoSistema> {
  let resposta: { data?: unknown; error?: unknown } | null | undefined;
  try {
    resposta = await consulta;
  } catch (error) {
    resposta = { data: null, error };
  }
  const { data, error } = resposta || {};
  if (error && (error as { code?: unknown }).code !== FUNCAO_AUSENTE)
    console.warn("Situação do sistema indisponível; tudo ativo:", error);
  situacao = error
    ? SITUACAO_PADRAO
    : normalizarSituacaoDoSistema(
        data as RespostaDaSituacao | null | undefined,
      );
  return situacao;
}

export function situacaoDoSistema(): SituacaoDoSistema {
  return situacao;
}

/** Ao sair da conta: a próxima pessoa não herda a situação lida. */
export function esquecerSituacaoDoSistema(): void {
  situacao = SITUACAO_PADRAO;
}
