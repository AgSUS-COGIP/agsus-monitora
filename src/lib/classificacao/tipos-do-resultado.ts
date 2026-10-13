/** Saída pública do motor, compartilhada pela tela, recursos e exportações. */
export type TipoDeLista = "PRELIMINAR" | "CONVOCACAO" | "ENTREVISTA" | "FINAL";
export type SituacaoDaLinha = "VAGA" | "CR" | "CONVOCADO" | "APTO";
export interface LinhaDaLista {
  analiseId: string;
  nome: string;
  nota: number | null;
  posicao: number;
  empatados: number;
  modalidades: string[];
  situacao: SituacaoDaLinha | null;
  vagaPor: string | null;
  recursos?: number[];
  parciais?: Record<string, number | null>;
}
export interface EliminadoDaLista {
  analiseId: string;
  nome: string;
  motivo: string;
  detalhe: string;
  recursos?: number[];
  nota?: number | null;
  parciais?: Record<string, number | null>;
}
export interface VagaDoResultado {
  chave: string;
  codigo: string;
  cargo: string;
  lotacao: string;
  cabecalho: string;
  total: number | null;
  vagasPorModalidade: Record<string, number> | null;
  cadastroReserva: boolean;
  origemDasVagas: string | null;
  limiteConvocacao: { limite: number; origem: string } | null;
  geral: LinhaDaLista[];
  porModalidade: Record<string, LinhaDaLista[]>;
  eliminados: EliminadoDaLista[];
}
export interface ExplicacaoDoCandidato {
  analiseId: string;
  nome: string;
  vaga: string;
  elegivel: boolean;
  nota?: number | null;
  posicaoGeral?: number | null;
  posicoes?: Record<string, number>;
  modalidades?: string[];
  situacao?: SituacaoDaLinha | null;
  recursos?: number[];
  motivo?: string;
  horaNascimento?: string | null;
  horaDecide?: boolean;
  explicacao: string[];
}
export interface PendenciaDeEmpate {
  chave: string;
  tipoLista: string;
  vaga: string;
  vagaTexto: string;
  metodo: "SORTEIO" | "MANUAL";
  nota: number | null;
  candidatos: { analiseId: string; nome: string; codigo: string }[];
}
export interface AvisoDaClassificacao {
  codigo: string;
  tom?: string;
  vaga?: string;
  analiseId?: string;
  texto: string;
}
export interface ResultadoDoMotor {
  tipo: string;
  dataCorte: string | null;
  casas: number;
  vagas: VagaDoResultado[];
  explicacoes: Record<string, ExplicacaoDoCandidato>;
  pendencias: PendenciaDeEmpate[];
  avisos: AvisoDaClassificacao[];
  totais: {
    candidatos: number;
    elegiveis: number;
    eliminados: number;
    vagas: number;
    avisos: number;
    pendencias: number;
  };
}
export interface RecorteDasListas {
  vaga: string;
  lista: string;
  busca: string;
}
export type VagaRecortada = VagaDoResultado & {
  linhas: LinhaDaLista[];
  eliminadosFiltrados: EliminadoDaLista[];
};
