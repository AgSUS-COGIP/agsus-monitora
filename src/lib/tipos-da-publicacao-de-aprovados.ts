export interface CandidatoAnterior {
  candidato_id: string;
  analise_id?: string | null;
  nome?: string | null;
  cargo?: string | null;
  codigo_vaga?: string | null;
  classificacao?: number | null;
  status?: string | null;
  matricula?: string | null;
  processo_sei?: string | null;
  sub_judice?: boolean | null;
  alterado_judicialmente?: boolean | null;
}

export interface CandidatoDaListaFinal {
  analise_id: string;
  nome: string;
  cargo: string;
  codigo_vaga: string;
  posicao: number | null;
  nota: number | null;
  situacao: "VAGA" | "CR" | null;
  modalidades: unknown[];
}
export type FormaDoVinculo = "ANALISE" | "NOME" | "NOME_VAGA" | "MANUAL";
export interface VinculoDaPublicacao {
  candidato_id: string;
  analise_id: string;
  forma: FormaDoVinculo;
}
export interface CasamentoDeCandidatos {
  vinculos: VinculoDaPublicacao[];
  naoCasados: (CandidatoAnterior & { ambiguo: boolean; decidido: boolean })[];
}
export interface OrigemDaLista {
  tipo: "CLASSIFICACAO" | "XLSX";
  texto: string;
}
export interface ListaVigenteDaPublicacao {
  lista_id: string;
  origem: string;
  importado_em: string | null;
  candidatos: CandidatoAnterior[];
}
export interface SituacaoDaPublicacao {
  vigente: ListaVigenteDaPublicacao | null;
  /** Pode substituir a lista vigente (admin da Importação, ou o edital nunca teve lista). */
  pode_substituir: boolean;
}
export interface ResultadoDaPublicacao {
  candidatos: number;
  pendencias: unknown[];
}
