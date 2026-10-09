import type {
  RecursoDoPainel,
  IdentificadorDoRecurso,
  EtapaDoRecurso,
  OrigemDoRecurso,
} from "../../lib/tipos-dos-recursos.ts";
import type {
  EstadoDosRecursos,
  SnapshotDosRecursos,
  RegistroDosRecursos,
  DetalheDoRecurso,
} from "./tipos-do-estado.ts";
import type {
  RespostaDoRecurso,
  ModeloDaResposta,
} from "../../lib/tipos-da-resposta-do-recurso.ts";

export interface HistoricoDoRecurso {
  acao: string;
  campo: string;
  anterior: string | null;
  novo: string | null;
  motivo: string;
  em: string;
  autor: string;
}
export interface AnexoDoRecurso extends RegistroDosRecursos {
  id: IdentificadorDoRecurso;
  nome: string;
  tipo: string;
  mime: string;
  bytes: number;
  ativo: boolean;
  incluido_em: string;
  incluido_por: string;
  arquivado_em: string;
  arquivado_por: string;
  motivo_arquivamento: string;
}
export interface CamposDoDetalheDaGaveta {
  modalidade?: string;
  responsavel_analise?: string;
  criado_por?: string;
  parecer_enviado_por?: string;
  decisao_por?: string;
  devolvido_por?: string;
  comentario_devolucao?: string;
  parecer?: string;
  etapas?: Partial<Record<EtapaDoRecurso, string>>;
  historico?: HistoricoDoRecurso[];
  anexos?: AnexoDoRecurso[];
  resposta?: RespostaDoRecurso | null;
  eu?: IdentificadorDoRecurso | null;
}
export interface PropsDaSecaoDoRecurso {
  estado: EstadoDosRecursos;
  recurso: RecursoDoPainel;
  detalhe?: DetalheDoRecurso | null;
  podeEditar: boolean;
  acao: SnapshotDosRecursos["acao"];
}
export interface PropsDaGavetaDoRecurso extends Omit<
  PropsDaSecaoDoRecurso,
  "acao"
> {
  origens: readonly OrigemDoRecurso[];
  podeDecidir?: boolean;
  modelos?: ModeloDaResposta[];
  area?: string;
}
