export interface CandidatoAprovado extends Record<string, unknown> {
  candidato_id: string;
  nome: string;
  classificacao?: string | number | null;
  lista_ativa?: boolean | null;
  sub_judice?: boolean | null;
  edital_id?: string | null;
  cargo?: string | null;
  edital?: string | null;
  unidade?: string | null;
  codigo_vaga?: string | number | null;
  lotacao?: string | null;
  modalidade?: string | null;
  status?: string | null;
  matricula?: string | null;
  processo_sei?: string | null;
  contratacao_situacao?: string | null;
  contratacao_motivo?: string | null;
}
export interface ListaDeAprovados extends Record<string, unknown> {
  edital_id: string;
  lista_id?: string;
  ativo?: boolean;
  origem?: string | null;
  arquivo_nome?: string | null;
  arquivo_path?: string | null;
}
export interface AnexoDoAprovado extends Record<string, unknown> {
  anexo_id: string;
  candidato_id: string;
  arquivo_nome?: string;
  incluido_em?: string | null;
}

export interface PublicacaoDoHistorico extends Record<string, unknown> {
  id: string;
  origem?: string | null;
  em?: string | null;
  por?: string | null;
  motivo?: string | null;
  versao_regra?: number | string | null;
  candidatos?: number | string | null;
  entram?: number | string | null;
  saem?: number | string | null;
  mudam?: number | string | null;
  pendencias: { nome?: string | null }[];
}
export interface DadosDaPublicacaoDoEdital extends Record<string, unknown> {
  resultado_final:
    (Record<string, unknown> & { gerada_em?: string | null }) | null;
  tem_analises?: boolean | null;
  publicacoes: PublicacaoDoHistorico[];
}
export interface ConvocacaoDoAprovado {
  data: string;
  cartas: number;
  ultimaCarta: string;
}
