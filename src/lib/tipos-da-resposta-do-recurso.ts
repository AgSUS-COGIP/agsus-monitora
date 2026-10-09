import type { IdentificadorDoRecurso as Id } from "./tipos-dos-recursos.ts";
export interface ModeloEscolhivel {
  id: Id | null;
  versao: number | null;
  nome: string;
  corpo: string;
  situacao: string;
  emUso?: boolean;
}
export interface ModeloDaResposta extends ModeloEscolhivel {
  id: Id;
  versao: number;
  origem: string;
  area: string;
  ativo: boolean;
  em_uso: number;
  arquivado_em: string;
  arquivado_por: string;
  motivo_arquivamento: string;
}
export interface RascunhoDoModelo {
  id: Id | null;
  versao: number | null;
  nome: string;
  situacao: string;
  origem: string;
  area: string;
  corpo: string;
}
export interface RespostaDoRecurso extends Record<string, unknown> {
  id: Id;
  revisao: number;
  estado: string;
  modelo_id: Id | null;
  modelo_versao: number | null;
  modelo_nome: string;
  modelo_corpo: string;
  modelo_situacao: string;
  modelo_vigente: boolean;
  fundamentacao: string;
  texto_final: string;
  autor: string;
  autor_id: Id | null;
  envio_revisao_por_id: Id | null;
  passou_revisao: boolean;
  atualizado_em: string;
  envio_revisao_em: string;
  envio_revisao_por: string;
  revisor: string;
  revisao_em: string;
  enviada_em: string;
  enviada_por: string;
  comentario_revisao: string;
  historico: { acao: string; comentario: string; em: string; autor: string }[];
}
export interface DadosDosModelos {
  erro?: string;
  modelos: ModeloDaResposta[];
  areas: { id: string; rotulo: string }[];
  origens: { id: string; rotulo: string }[];
}
