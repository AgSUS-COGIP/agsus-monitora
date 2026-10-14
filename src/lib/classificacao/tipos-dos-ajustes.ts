import type { IdentificadorDoRecurso as Id } from "../tipos-dos-recursos.ts";
export type RegistroDaClassificacao = Record<string, unknown>;
export type ListaDaPrevia = "PRELIMINAR" | "ENTREVISTA" | "FINAL";
export interface ItemDoAjuste {
  codigo: string;
  rotulo: string;
  atual: number | null;
  calculado: boolean;
  grupo: string | null;
}
export interface ItemMontadoDoAjuste extends ItemDoAjuste {
  novo: number | null;
  invalido: boolean;
  justificativa: string;
  mudou: boolean;
}
export interface ItemParaEnviar {
  codigo: string;
  anterior: number | null;
  novo: number | null;
  justificativa?: string;
}
export interface ResumoDaPosicao {
  naLista: boolean;
  elegivel?: boolean;
  nota?: number | null;
  posicao?: number | null;
  situacao?: string | null;
  motivo?: string | null;
}
export interface PreviaDoAjuste extends RegistroDaClassificacao {
  tipo: string;
  vaga: string | null;
  antes: ResumoDaPosicao;
  depois: ResumoDaPosicao;
  mudou: boolean;
  afetados: {
    nome: string;
    antes?: number | null;
    depois?: number | null;
    situacaoAntes?: string | null;
    situacaoDepois?: string | null;
  }[];
  totalAfetados: number;
}
export interface VersaoDoAjuste {
  id: Id;
  versao: number;
  situacao: string;
  lista: string;
  itens: ItemParaEnviar[];
  justificativa: string;
  proposto_em: string;
  proposto_por: string;
  aprovado_em: string;
  aprovado_por: string;
  cancelado_em: string;
  cancelado_por: string;
  motivo_cancelamento: string;
  mudou_posicao: boolean;
  previa: PreviaDoAjuste | null;
  previa_aprovacao: PreviaDoAjuste | null;
}
export interface DadosDosAjustes extends RegistroDaClassificacao {
  erro?: string;
  ajustes: VersaoDoAjuste[];
  pode_propor: boolean;
  pode_aprovar: boolean;
  pode_cancelar: boolean;
}
export interface DadosParaPreviaDoAjuste extends RegistroDaClassificacao {
  erro?: string;
  regra: { configuracao: RegistroDaClassificacao } | null;
  edital: RegistroDaClassificacao & { unidade: string };
  candidatos: RegistroDaClassificacao[];
  entrevistas: RegistroDaClassificacao[];
  quadro: RegistroDaClassificacao[];
  cronograma: RegistroDaClassificacao[];
  desempates: RegistroDaClassificacao[];
  ajustes: RegistroDaClassificacao[];
  convocacao: RegistroDaClassificacao | null;
}
export interface CandidatoParaAjuste extends RegistroDaClassificacao {
  analiseId: Id;
  notaDocumental: number | null;
  notaEntrevista: number | null;
  notaArt: number | null;
  entrevista: {
    notas: { ordem: number; nota: number | null; criterio: string }[];
  } | null;
}
export interface ExplicacaoParaPrevia {
  analiseId: Id;
  nome: string;
  vaga: string;
  elegivel: boolean;
  nota: number | null;
  posicaoGeral: number | null;
  situacao: string | null;
  motivo: string | null;
}
export type { EntradaDoMotor } from "./tipos-do-motor.ts";
export interface PropostaDoAjuste {
  lista: ListaDaPrevia;
  justificativa: string | null;
  itens: ItemParaEnviar[];
  previa: PreviaDoAjuste;
}
