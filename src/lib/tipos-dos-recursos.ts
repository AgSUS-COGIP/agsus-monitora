/** Dados usados pelo painel; campos adicionais do banco são preservados no enriquecimento. */
export type IdentificadorDoRecurso = string | number;
export type DataDoRecurso = string | number | Date;
export type EtapaDoRecurso =
  "download_empregare" | "processo_sei" | "upload_sei" | "resposta_candidato";
export type TomDoRecurso =
  "neutral" | "warning" | "success" | "info" | "danger";
export interface OrigemDoRecurso {
  id: string;
  rotulo: string;
  ativo?: boolean;
}
export interface DadosDoRecurso {
  id: IdentificadorDoRecurso;
  nu?: number;
  edital_id?: IdentificadorDoRecurso | null;
  edital?: string;
  unidade?: string;
  origem?: string;
  analise_id?: IdentificadorDoRecurso | null;
  fora_analise?: boolean;
  candidato?: string;
  codigo?: string | number | null;
  cargo?: string;
  vaga?: string;
  nota_anterior?: string | number | null;
  nota_atual?: string | number | null;
  analista?: string | null;
  situacao?: string | null;
  processo_sei?: string | null;
  mudou_classificacao?: boolean;
  criado_em?: DataDoRecurso;
  decisao_em?: DataDoRecurso | null;
  devolvido_em?: string | null;
  download_empregare_em?: DataDoRecurso | null;
  processo_sei_em?: DataDoRecurso | null;
  upload_sei_em?: DataDoRecurso | null;
  resposta_candidato_em?: DataDoRecurso | null;
  resposta_estado?: string | null;
  qt_anexos?: string | number | null;
  revisao?: number;
}
export interface EtapaDoCronogramaDoRecurso {
  edital_id?: IdentificadorDoRecurso | null;
  ordem?: string | number | null;
  atividade?: string | null;
  inicio?: string | null;
  fim?: string | null;
}
export interface PrazoDoRecurso {
  data: string | null;
  fonte: "resposta" | "abertura" | null;
  atividade: string;
  aviso: string;
}
export interface CalculosDoRecurso {
  situacao: string;
  analista: string;
  etapas: Record<EtapaDoRecurso, boolean>;
  decidido: boolean;
  mudouNota: boolean;
  mudouClassificacao: boolean;
  mudouResultado: boolean;
  prazo: PrazoDoRecurso;
  diasEmAberto: number | null;
  diasParaPrazo: number | null;
  atrasado: boolean;
  vencendo: boolean;
  aguardandoParecer: boolean;
  devolvido: boolean;
  noPrazo: boolean | null;
  etapasFeitas: number;
  respostaEstado: string | null;
  qtAnexos: number;
}
export type RecursoDoPainel = Omit<DadosDoRecurso, keyof CalculosDoRecurso> &
  CalculosDoRecurso;
export interface FiltrosDosRecursos {
  edital: string;
  origem: string;
  analista: string;
  situacao: string;
  pendencia: string;
  busca: string;
}
export type CampoDoFiltroDosRecursos = keyof FiltrosDosRecursos;
export type AoFiltrarRecursos = (
  campo: CampoDoFiltroDosRecursos,
  valor: string,
) => void;
export interface RascunhoDoRecurso {
  edital_id: string;
  origem: string;
  analise: { id?: IdentificadorDoRecurso | null } | null;
  fora_analise: boolean;
  nome_informado: string;
  codigo_informado: string | number;
  cargo_informado: string;
  vaga_informada: string;
  analista: string;
  processo_sei: string;
  observacao: string;
}
export type DetalheParaRascunho = Partial<
  Pick<
    RascunhoDoRecurso,
    | "nome_informado"
    | "codigo_informado"
    | "cargo_informado"
    | "vaga_informada"
    | "observacao"
  >
>;
