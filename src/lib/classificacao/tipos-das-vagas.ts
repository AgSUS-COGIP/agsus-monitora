export type VagasPorModalidade = Record<string, number>;

export interface CategoriaDaConvocacao {
  id: string;
  rotulo: string;
  sigla: string;
  ampla: boolean;
  acumulavel: boolean;
  percentual: number;
  arredondamento: string;
  teto: number;
  minimo: number;
  termos: string[];
  posicoes: number[];
  intervalo: number;
  cascata: string[];
  ordem: number;
}

export interface ModeloDaConvocacao {
  id: string;
  nome: string;
  distribuicao: string;
  cotaMultipla: string;
  categorias: CategoriaDaConvocacao[];
}

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
