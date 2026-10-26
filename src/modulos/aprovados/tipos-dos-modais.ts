import type { ReactNode } from "react";
import type {
  EstadoDosAprovados,
  SnapshotDosAprovados,
  CandidatoAprovado,
  ListaDeAprovados,
  AnexoDoAprovado,
  ConvocacaoDoAprovado,
} from "./tipos-do-estado.ts";

export interface PropsDoCabecalhoDoModal {
  tituloId: string;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  subtituloId?: string;
  aoFechar: () => void;
}
export interface PropsDoCampoDeAnexos {
  jaAnexados: number;
  arquivos: readonly File[];
  aoMudar: (arquivos: File[]) => void;
}
export interface PropsDoModalDeStatus {
  estado: EstadoDosAprovados;
  perfil: unknown;
  candidato: CandidatoAprovado;
  /** Os candidatos carregados: para achar a mesma matrícula em outra linha do edital. */
  candidatos?: readonly CandidatoAprovado[];
  jaAnexados?: number;
  dataConvocacao?: string;
}
export interface PropsDoModalDeAnexos {
  estado: EstadoDosAprovados;
  perfil: unknown;
  candidato: CandidatoAprovado;
  anexos: readonly AnexoDoAprovado[];
}
export interface PropsDoModalSubJudice {
  estado: EstadoDosAprovados;
  perfil: unknown;
  listas: readonly ListaDeAprovados[];
  candidatos: readonly CandidatoAprovado[];
  aba?: "novo" | "aprovado";
  candidatoId?: string;
}
export interface PropsDoPainelSubJudice {
  ativa: boolean;
  estado: EstadoDosAprovados;
  ativas: readonly ListaDeAprovados[];
  candidatos: readonly CandidatoAprovado[];
}
export interface PropsDoPainelDoAprovado extends PropsDoPainelSubJudice {
  perfil: unknown;
  candidatoInicial?: CandidatoAprovado;
}
export interface PropsDaDecisao {
  estado: EstadoDosAprovados;
  perfil: unknown;
  candidato: CandidatoAprovado;
  candidatos: readonly CandidatoAprovado[];
}
export interface PropsDosCamposDaDecisao {
  prefixo: string;
  processo: string;
  observacao: string;
  aoMudarProcesso: (valor: string) => void;
  aoMudarObservacao: (valor: string) => void;
}
export interface PropsDoModalListas {
  estado: EstadoDosAprovados;
  dados: SnapshotDosAprovados;
  editalId: string;
  rotulo: string;
}
export interface PropsDaOrigemDaClassificacao {
  estado: EstadoDosAprovados;
  editalId: string;
  rotulo: string;
  publicacao: SnapshotDosAprovados["publicacao"];
}
export interface PropsDoPainelDoArquivo extends PropsDaOrigemDaClassificacao {
  ativa: boolean;
  perfil: unknown;
  lista: ListaDeAprovados | undefined;
}
export interface PropsDaGavetaDoAprovado {
  estado: EstadoDosAprovados;
  perfil: unknown;
  candidato: CandidatoAprovado;
  convocacao?: ConvocacaoDoAprovado;
}
