export type CelulaDaPlanilha = string | number | boolean | null | undefined;
export interface PlanilhaDaClassificacao {
  nome: string;
  linhas: readonly (readonly CelulaDaPlanilha[])[];
}
export interface ModalidadeDoRetrato {
  codigo: string;
  nome: string;
}
export interface LinhaDoRetrato {
  nome: string;
  analise_id?: string;
  posicao?: number;
  nota?: number | null;
  modalidades?: string[];
  situacao?: string | null;
  decisao?: string;
  parciais?: Record<string, number | null>;
  recursos?: number[];
}
export interface EliminadoDoRetrato extends LinhaDoRetrato {
  motivo: string;
  detalhe: string;
}
export interface VagaDoRetrato {
  chave: string;
  codigo: string;
  cargo: string;
  lotacao: string;
  cabecalho: string;
  geral: LinhaDoRetrato[];
  listas: Record<string, LinhaDoRetrato[]>;
  eliminados: EliminadoDoRetrato[];
}
export interface RetratoParaDocumento {
  tipo: string;
  edital?: {
    id?: unknown;
    edital?: unknown;
    unidade?: unknown;
    treinamento?: unknown;
  };
  casas?: number | null;
  lote?: unknown;
  rodape?: string;
  parciais?: string[];
  modalidades: ModalidadeDoRetrato[];
  vagas: VagaDoRetrato[];
}
export interface ColunaDisponivel {
  id: string;
  rotulo: string;
  obrigatoria: boolean;
  ajuda: string;
}
export interface ColunaDaTabela {
  rotulo: string;
  largura: number;
  alinhamento: "esquerda" | "centro";
}
export interface TabelaDoDocumento {
  titulo: string;
  colunas: ColunaDaTabela[];
  linhas: string[][];
  vazia: string;
  notas?: string[];
}
export interface BlocoDoDocumento {
  cabecalho: string;
  tabelas: TabelaDoDocumento[];
  notaDeDesempate?: string;
}
export interface ItemDoDocumento {
  nivel: number;
  texto: string;
}
export interface DocumentoOficial {
  chave: string;
  tipo: string;
  lista: string;
  fase: string | null;
  titulo: string[];
  localData: string;
  localDataPorExtenso: string;
  preliminares: ItemDoDocumento[];
  finais: ItemDoDocumento[];
  blocos: BlocoDoDocumento[];
  nome: string;
  treinamento: boolean;
  edital: string;
  processo: string;
}
export interface MarcaDaPrevia {
  cabecalho?: string;
  logo?: string;
}
export interface LogoDoDocumento {
  bytes: Uint8Array;
  largura: number;
  altura: number;
}
export interface OpcoesDoDocx {
  cabecalho?: string;
  logo?: LogoDoDocumento | null;
  quando?: Date;
}
export interface PartesDoDocx {
  nome: string;
  processo?: string;
  documento: string;
}
export interface ArquivoDoDocx {
  nome: string;
  conteudo: string | Uint8Array;
}
export interface EstiloDaCorrida {
  negrito?: boolean;
  italico?: boolean;
  tamanho?: number;
  cor?: string;
  caixaAlta?: boolean;
}
export type AgendaDoDocumento = ReadonlyMap<
  string,
  { data?: string | null; inicio?: string | null }
>;
export interface OpcoesDoDocumento {
  lista?: string;
  fase?: string | null;
  regra?: unknown;
  hoje?: Date;
  agenda?: unknown;
  treinamento?: boolean;
}
