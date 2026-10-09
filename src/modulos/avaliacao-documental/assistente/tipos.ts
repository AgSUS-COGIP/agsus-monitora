/*
  Contratos do assistente da regra com o estado da tela (estado.js) e com as
  RPCs obter_regra_analise e obter_apoio_regra_analise. Dados externos: uma
  anotação não valida JSON; a regra é conferida por validarRegraAnalise antes
  de salvar, e o banco confere de novo.
*/
import type {
  ColunasDaVaga,
  ModeloDaRegra,
  Nivel,
  PerguntaDaCarga,
  RegraDeOutroEdital,
  RegraSalva,
} from "../../../lib/avaliacao-documental/tipos-da-regra.ts";

export type RegraDeClassificacaoSalva = {
  versao: number;
  nome?: string | null;
  configuracao: unknown;
  atualizado_em?: string;
  por?: string | null;
};

export type ApoioDaRegra = {
  perguntas_por_vaga: ColunasDaVaga[];
  regras_da_area: RegraDeOutroEdital[];
  classificacao: {
    pode_ler: boolean;
    pode_editar: boolean;
    regra: RegraDeClassificacaoSalva | null;
  };
  indisponivel?: boolean;
};

export type NotaMinimaDaClassificacao = {
  nota_minima: number | null;
  nota_minima_por_nivel?: Partial<Record<Nivel, number | null>>;
  versao_regra_classificacao?: number | null;
} | null;

export type DadosDaRegra = {
  edital: {
    id: string;
    edital: string;
    unidade: string | null;
    area: string;
    numero: string | null;
    id_unidade: string | number | null;
  };
  papel: string | null;
  pode_coordenar: boolean;
  regra: RegraSalva | null;
  modelos: ModeloDaRegra[];
  nota_minima: NotaMinimaDaClassificacao;
  perguntas: PerguntaDaCarga[];
};

export type SnapshotDaAvaliacao = {
  area: string;
  editalId: string;
  dados: DadosDaRegra | null;
  salvando: boolean;
  apoio: ApoioDaRegra | null;
  carregandoApoio: boolean;
  erroDoApoio: string;
  /** A versão que o assistente acabou de salvar (a aba remonta a cada versão). */
  regraSalvaAgora?: { editalId: string; versao: number } | null;
};

export type ResultadoDaGravacao = { ok: boolean; erro?: string };

export type EstadoDaRegra = {
  carregarApoio: (opcoes?: { recarregar?: boolean }) => Promise<unknown>;
  salvarRegra: (
    configuracao: unknown,
    motivo: string,
    /** Nome desta versão (null = sem nome). */
    nome?: string | null,
  ) => Promise<ResultadoDaGravacao>;
  salvarRegraClassificacao: (
    configuracao: unknown,
    versaoAtual: number,
    motivo: string,
  ) => Promise<ResultadoDaGravacao>;
  conferirRegra: () => Promise<ResultadoDaGravacao>;
  esquecerRegraSalvaAgora?: () => void;
  renomearVersao?: (
    versao: number,
    nome: string | null,
    motivo: string,
  ) => Promise<ResultadoDaGravacao>;
};
