import type { SupabaseClient } from "@supabase/supabase-js";
export type RpcDaConducao =
  | "listar_roteiros_entrevista"
  | "salvar_roteiro_entrevista"
  | "renomear_versao_roteiro_entrevista"
  | "obter_entrevistas_do_edital"
  | "configurar_entrevista_edital"
  | "convocar_para_entrevista"
  | "desconvocar_da_entrevista"
  | "lancar_notas_entrevista"
  | "concluir_entrevista"
  | "reabrir_entrevista"
  | "listar_editais_entrevista"
  | "liberar_entrevista_edital"
  | "obter_previsao_entrevista_edital"
  | "definir_previsao_entrevista_edital"
  | "obter_agenda_entrevista"
  | "obter_classificacao_do_edital"
  | "listar_configuracao_convocacao"
  | "listar_modelos_convocacao";
export type ClienteDaConducao = {
  rpc: (
    nome: RpcDaConducao,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  auth?: Pick<SupabaseClient["auth"], "onAuthStateChange">;
};
/*
  As cópias da condução no aparelho (src/app/copias-da-conducao.ts): a lista
  de editais da área e o edital aberto, lidas só quando o banco não responde
  por falta de conexão.
*/
export type CopiasDaConducao = {
  ler(chave: string): Promise<{ payload: unknown; guardadoEm: number } | null>;
  guardar(chave: string, payload: unknown): Promise<unknown>;
};
export type OpcoesDoEstadoDaConducao = {
  supabase?: ClienteDaConducao | null;
  copias?: CopiasDaConducao | null;
  toast?: (mensagem: string, tom?: string) => void;
  aoMudarResultados?: () => void;
  tempoLimiteMs?: number;
};
