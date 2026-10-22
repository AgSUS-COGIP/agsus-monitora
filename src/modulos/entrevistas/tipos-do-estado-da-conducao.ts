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
  | "listar_editais_entrevista"
  | "liberar_entrevista_edital"
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
export type OpcoesDoEstadoDaConducao = {
  supabase?: ClienteDaConducao | null;
  toast?: (mensagem: string, tom?: string) => void;
  aoMudarResultados?: () => void;
  tempoLimiteMs?: number;
};
