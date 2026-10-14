export type VagasPorModalidade = Record<string, number>;

import type {
  CategoriaDaConvocacao,
  ModeloDaConvocacao,
} from "../tipos-da-configuracao-de-convocacao.ts";
export type {
  CategoriaDaConvocacao,
  ModeloDaConvocacao,
} from "../tipos-da-configuracao-de-convocacao.ts";

export interface ConvocacaoDoEdital {
  editalId: string;
  modeloId: string;
  modeloNome: string;
  modelo: ModeloDaConvocacao | null;
  configs: Map<
    string,
    {
      modeloId: string;
      padraoImediata: number;
      proporcionalidade: boolean;
      vagas: Map<
        string,
        {
          cargo: string;
          imediatas: number;
          manual: boolean;
          quadro: Record<string, unknown>;
        }
      >;
    }
  >;
  modelos: Map<string, ModeloDaConvocacao>;
}

export interface QuadroDaVaga {
  id?: unknown;
  cargo?: unknown;
  lotacao?: unknown;
  ordem?: unknown;
  vagas_imediatas?: unknown;
  modalidades?: Record<string, unknown> | null;
  cadastro_reserva?: unknown;
}

export interface CandidatoDaVaga {
  vaga?: unknown;
  cargo?: unknown;
  quadroId?: unknown;
}

export interface BaseDaVaga {
  chave: string;
  codigo: string;
  cargo: string;
  lotacao: string;
}

export interface VagaMontada extends BaseDaVaga {
  total: number | null;
  porModalidade: VagasPorModalidade | null;
  cadastroReserva: boolean;
  semQuadro: boolean;
  origemDasVagas: "QUADRO" | "CONVOCACAO" | "REGRA" | null;
  quadroId?: string;
  ordemQuadro?: number;
  totalNaConvocacao?: number | null;
  cabecalho: string;
}
