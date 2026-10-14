import type { EstadoDaAcao } from "../ui/botao-de-acao.tsx";
export type ArredondamentoDaConvocacao = "meio_acima" | "sempre_acima";
export type DistribuicaoDaConvocacao =
  "proporcional" | "serie_mgi" | "posicao_fixa";
export type CotaMultiplaDaConvocacao =
  "maior_percentual" | "acumula_com_acumulavel" | "todas";
export interface OpcaoDaConvocacao<T extends string = string> {
  id: T;
  rotulo: string;
  ajuda: string;
}
export interface CategoriaDaConvocacao {
  id: string;
  rotulo: string;
  sigla: string;
  ampla: boolean;
  acumulavel: boolean;
  percentual: number;
  arredondamento: ArredondamentoDaConvocacao;
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
  distribuicao: DistribuicaoDaConvocacao;
  cotaMultipla: CotaMultiplaDaConvocacao;
  categorias: CategoriaDaConvocacao[];
  editais?: number;
}
export interface ReferenciaDoModelo {
  id: string;
  nome: string;
  descricao: string;
  distribuicao: DistribuicaoDaConvocacao;
  cotaMultipla: CotaMultiplaDaConvocacao;
  categorias: readonly Partial<CategoriaDaConvocacao>[];
}
export interface VagaDaConfiguracao {
  cargo: string;
  imediatas: number;
  manual: boolean;
  quadro: Record<string, unknown>;
}
export interface ConfiguracaoDaConvocacao {
  modeloId: string;
  padraoImediata: number;
  proporcionalidade: boolean;
  vagas: Map<string, VagaDaConfiguracao>;
}
export type ConfiguracoesDaConvocacao = ReadonlyMap<
  string,
  ConfiguracaoDaConvocacao
>;
export type ModelosDaConvocacao = ReadonlyMap<string, ModeloDaConvocacao>;
export interface CandidatoDaConfiguracao {
  edital_id?: unknown;
  codigo_vaga?: unknown;
  cargo?: unknown;
}
export interface VagaDoFormulario extends VagaDaConfiguracao {
  codigo: string;
  na_lista: boolean;
  total: number;
}
export interface FormularioDaConvocacao {
  editalId: string;
  proporcionalidade: boolean;
  modeloId: string;
  padraoImediata: number;
  vagas: VagaDoFormulario[];
}
export type MudancasDaCategoria =
  | Partial<CategoriaDaConvocacao>
  | ((atual: CategoriaDaConvocacao) => Partial<CategoriaDaConvocacao>);
export interface EditorDaConvocacao {
  novo: boolean;
  base: string | null;
  modelo: ModeloDaConvocacao;
  editais: number;
  abertura: number;
}
export interface EstadoDaConfiguracao extends EstadoDaAcao {
  toast: (mensagem: string) => void;
  salvarModelo: (modelo: ModeloDaConvocacao) => Promise<string | null>;
  removerModelo: (
    modelo: ModeloDaConvocacao,
    editais: number,
  ) => Promise<unknown>;
  salvarConfiguracao: (formulario: FormularioDaConvocacao) => Promise<unknown>;
}
