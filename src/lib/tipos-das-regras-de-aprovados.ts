export interface CandidatoDasRegrasDeAprovados {
  candidato_id?: unknown;
  edital_id?: unknown;
  nome?: unknown;
  cargo?: unknown;
  edital?: unknown;
  unidade?: unknown;
  modalidade?: unknown;
  matricula?: unknown;
  status?: unknown;
  lista_ativa?: unknown;
  sub_judice?: unknown;
  alterado_judicialmente?: unknown;
  nota?: unknown;
  nota_original?: unknown;
  modalidade_original?: unknown;
  classificacao_original?: unknown;
}
export type EscolhasDosFiltros =
  string | number | readonly (string | number)[] | null;
export interface FiltrosDasRegrasDeAprovados {
  query?: unknown;
  candidatos?: EscolhasDosFiltros;
  editalId?: EscolhasDosFiltros;
  cargo?: EscolhasDosFiltros;
  modalidade?: EscolhasDosFiltros;
  status?: EscolhasDosFiltros;
}
export interface PaginaDosAprovados<T> {
  rows: T[];
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
}
export interface ListaParaFiltroDeAprovados {
  edital_id?: unknown;
  edital?: unknown;
  unidade?: unknown;
}
export interface OpcaoDosAprovados {
  value: string;
  label: string;
}
