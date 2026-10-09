import type { Convocado } from "./fila-de-conducao.ts";

export type ListaDaConvocacao = {
  id: string;
  gerada_em?: string | null;
  por?: string | null;
  versao_regra?: number | string | null;
  publicada?: boolean;
  [campo: string]: unknown;
};
export type FonteDaConvocacao =
  | {
      tipo: "LISTA";
      lista: ListaDaConvocacao;
      resultado: Record<string, unknown>;
    }
  | { tipo: "CALCULO"; lista: null; resultado: Record<string, unknown> }
  | { tipo: "NENHUMA"; lista: null; resultado: null };
export type CandidatoDaConvocacao = {
  analiseId: string;
  nome: string;
  posicao: number | null;
  nota: number | null;
  modalidades: string[];
  situacao: string;
  lista: string;
};
export type VagaDaConvocacao = {
  vaga: string;
  cargo: string;
  lotacao: string;
  cabecalho: string;
  total: number | null;
  semVagasNaLista: boolean;
  cadastroReserva: boolean;
  origemDasVagas: string | null;
  limite: number | null;
  origemDoLimite: string;
  candidatos: CandidatoDaConvocacao[];
};
export type GrupoDaConvocacao = Omit<VagaDaConvocacao, "candidatos"> & {
  candidatos: (CandidatoDaConvocacao & { convocado: Convocado | null })[];
  fora: Convocado[];
};
export type OrigemDaVaga = {
  rotulo: string;
  view: "nucleo" | "aprovados" | "classificacao";
  onde: string;
};
export type AvisoDaConvocacao = {
  codigo: "SEM_LISTA" | "REGRA_MUDOU" | "FORA_DA_LISTA";
  tom: "warning" | "info";
  texto: string;
};
export type CriterioDeDesempateDaEntrevista = {
  codigo: string;
  nome: string;
  direcao: string;
};
