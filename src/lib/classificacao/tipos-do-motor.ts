import type { CamposNumericosDoCriterio } from "./catalogo.ts";
import type { normalizarRegra } from "./regra.ts";
import type { AvisoDaClassificacao } from "./tipos-do-resultado.ts";

export type RegraDoMotor = ReturnType<typeof normalizarRegra>;
export type RegistroDoMotor = Record<string, unknown>;
export interface EntradaDoMotor {
  tipo?: string;
  regra?: unknown;
  candidatos?: readonly RegistroDoMotor[];
  entrevistas?: readonly RegistroDoMotor[];
  quadro?: readonly RegistroDoMotor[];
  unidade?: string;
  dataCorte?: string | null;
  desempates?: readonly RegistroDoMotor[];
  convocacao?: unknown;
  ajustes?: readonly RegistroDoMotor[];
}
export interface NotaDaCompetencia {
  ordem: number;
  criterio: string;
  nota: number | null;
}
export interface EntrevistaDoMotor {
  id: string;
  analiseId: string;
  nome: string;
  vaga: string;
  nota: number | null;
  notaBruta: unknown;
  parecer: string;
  compareceu: string | null;
  ligacao: string;
  origem: string;
  notas: NotaDaCompetencia[];
}
export interface ComposicaoDaNota {
  nota: number | null;
  partes: { codigo: string; valor: number; peso: number }[];
  faltando: string[];
}
export type CandidatoDoMotor = Record<
  Exclude<CamposNumericosDoCriterio, "notaEntrevista"> | "notaArt",
  number | null
> & {
  analiseId: string;
  codigo: string;
  nome: string;
  vaga: string;
  cargo: string;
  categoria: string;
  modalidadeTexto: string;
  pcd: boolean | null;
  dataNascimento: string;
  horaNascimento: string;
  status: string;
  etapa: string;
  quadroId: string;
  modalidadeIdentificada: boolean;
  modalidades: string[];
  entrevista?: EntrevistaDoMotor | null;
  notaEntrevista?: number | null;
  nota?: number | null;
  modalidadesNaLista?: string[];
  grupoDaNota?: CandidatoDoMotor[];
  composicao?: ComposicaoDaNota;
  ajustes?: {
    numero: number | null;
    recursoId: unknown;
    itens: { codigo: string; anterior: number | null; novo: number }[];
  }[];
};
export interface DesempateDoMotor {
  id?: unknown;
  chave: string;
  metodo: string;
  ordem: string[];
  semente?: unknown;
  justificativa?: unknown;
  tipo_lista?: unknown;
  vaga?: string;
}
export type CriterioDoMotor = RegraDoMotor["desempate"][number];
export interface ContextoDoMotor {
  regra: RegraDoMotor;
  criterios: CriterioDoMotor[];
  casas: number;
  dataCorte: string | null;
  desempates: DesempateDoMotor[];
  desempatesUsados: Set<unknown>;
  avisos: AvisoDaClassificacao[];
  nivelDesconhecido: Set<string>;
  horaDecide: Set<string>;
}
export type BlocoDeEmpate =
  | {
      membros: CandidatoDoMotor[];
      resolucao: "PENDENTE";
      chave: string;
      metodo: "SORTEIO" | "MANUAL";
      registro?: undefined;
    }
  | {
      membros: CandidatoDoMotor[];
      resolucao:
        | "UNICO"
        | "CRITERIOS"
        | "MESMA_POSICAO_LISTA"
        | "MESMA_POSICAO"
        | "INSCRICAO"
        | "SORTEIO"
        | "MANUAL";
      chave?: string;
      metodo?: undefined;
      registro?: DesempateDoMotor;
    };
export interface LinhaDoMotor {
  c: CandidatoDoMotor;
  posicao: number;
  bloco: BlocoDeEmpate;
  empatados: number;
}
export interface AlocacaoDoMotor {
  situacao: "VAGA" | "CR";
  modalidade: string | null;
}
