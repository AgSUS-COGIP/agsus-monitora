import type {
  CompetenciaDaFicha,
  AspectoDaFicha,
} from "../modulos/entrevistas/tipos-da-ficha.ts";
import type { Renomeacao } from "../ui/nome-da-versao.tsx";

export type ModoDoEditorDeRoteiro = "novo" | "editar" | "duplicar" | "ver";
export type NumeroDoRoteiro = number | string | null;
export type ConvocacaoDoRoteiro = {
  multiplo_imediatas?: NumeroDoRoteiro;
  posicao_cadastro_reserva?: NumeroDoRoteiro;
  excecoes?:
    | {
        termo_cargo?: string | null;
        multiplo_imediatas?: NumeroDoRoteiro;
        posicao_cadastro_reserva?: NumeroDoRoteiro;
      }[]
    | null;
};
/** Campos lidos do banco. O estado da condução ainda não valida todo o JSON. */
export type RoteiroDeEntrevista = {
  id: string;
  origem?: string | null;
  nome?: string;
  versao?: number;
  nome_versao?: string | null;
  renomeacoes?: Renomeacao[] | null;
  descricao?: string | null;
  etapa?: string | null;
  area?: string | null;
  ativo?: boolean;
  editais_em_uso?: number | null;
  escala?: string | null;
  passo?: NumeroDoRoteiro;
  notas_permitidas?: NumeroDoRoteiro[] | null;
  niveis?:
    | {
        nota?: NumeroDoRoteiro;
        nome?: string | null;
        descricao?: string | null;
      }[]
    | null;
  competencias?: CompetenciaDaFicha[] | null;
  aspectos?: AspectoDaFicha[] | null;
  nota_minima_total?: NumeroDoRoteiro;
  notas_eliminatorias?: NumeroDoRoteiro[] | null;
  ausencia_elimina?: boolean;
  soma_analise?: boolean;
  desempate?: string[] | null;
  convocacao_padrao?: ConvocacaoDoRoteiro | null;
  banca_padrao?:
    { origem?: string | null; quantidade?: NumeroDoRoteiro }[] | null;
  [campo: string]: unknown;
};
export type CompetenciaDoRascunho = {
  chave: string;
  nome: string;
  descricao: string;
  nota_maxima: string;
  peso: string;
  minimo: string;
  tipo_minimo: string;
  avaliacao: string;
};
export type NivelDoRascunho = {
  chave: string;
  nota: string;
  nome: string;
  descricao: string;
};
export type BancaDoRascunho = {
  chave: string;
  origem: string;
  quantidade: string | number;
};
export type RascunhoDoRoteiro = {
  origem: string | null;
  versao: number | null;
  nome: string;
  descricao: string;
  etapa: string;
  area: string;
  escala: string;
  passo: string;
  notas_permitidas: string;
  niveis: NivelDoRascunho[];
  competencias: CompetenciaDoRascunho[];
  aspectos: { chave: string; nome: string }[];
  nota_minima_total: string;
  notas_eliminatorias: number[];
  ausencia_elimina: boolean;
  desempate: string[];
  soma_analise: boolean;
  convocacao: {
    multiplo_imediatas: string;
    posicao_cadastro_reserva: string;
    excecoes: {
      chave: string;
      termo_cargo: string;
      multiplo_imediatas: string;
      posicao_cadastro_reserva: string;
    }[];
  };
  banca: BancaDoRascunho[];
};
/** Resultado da conversão dos campos do formulário, depois da validação. */
export type DadosDoRoteiroParaSalvar = {
  origem?: string;
  nome_versao?: string;
  nome: string;
  descricao: string | null;
  etapa: string;
  area: string | null;
  escala: string;
  passo: number | null;
  notas_permitidas: number[];
  niveis: { nota: number | null; nome: string; descricao: string | null }[];
  competencias: {
    nome: string;
    descricao: string | null;
    nota_maxima: number | null;
    peso: number;
    minimo: number | null;
    tipo_minimo: "VALOR" | "PERCENTUAL";
    avaliacao: "INDIVIDUAL" | "GRUPO";
  }[];
  aspectos: { nome: string }[];
  nota_minima_total: number | null;
  notas_eliminatorias: number[];
  ausencia_elimina: boolean;
  desempate: string[];
  soma_analise: boolean;
  convocacao_padrao: {
    multiplo_imediatas: number | null;
    posicao_cadastro_reserva: number | null;
    excecoes: {
      termo_cargo: string;
      multiplo_imediatas: number | null;
      posicao_cadastro_reserva: number | null;
    }[];
  };
  banca_padrao: { origem: string; quantidade: number }[];
};
export type ResumoDoRoteiro = {
  competencias: number;
  escala: string;
  maxima: number;
  minimo: number | null;
  emUso: number;
  versao: number;
  grupo: boolean;
  aspectos: string[];
};
