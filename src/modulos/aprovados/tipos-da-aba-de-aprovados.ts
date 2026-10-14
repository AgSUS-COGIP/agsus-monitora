import type {
  CandidatoDasRegrasDeAprovados,
  PaginaDosAprovados,
  OpcaoDosAprovados,
  ListaParaFiltroDeAprovados,
} from "../../lib/tipos-das-regras-de-aprovados.ts";
import type { EstadoDaAcao } from "../../ui/botao-de-acao.tsx";
import type { ConvocacoesDaTabela } from "./tipos-da-aba-de-convocacao.ts";
export interface CandidatoDaTabelaDeAprovados extends CandidatoDasRegrasDeAprovados {
  candidato_id: string;
  nome: string;
  cargo?: string | null;
  edital?: string | null;
  classificacao?: string | number | null;
  lista_ativa?: boolean;
  sub_judice?: boolean;
}
export interface FiltrosDaTabelaDeAprovados {
  candidatos: string[];
  editalId: string[];
  cargo: string[];
  modalidade: string[];
  status: string[];
}
export interface EstadoDaAbaDeAprovados extends EstadoDaAcao {
  abrirCandidato: (id: string) => void;
  abrirAnexos: (id: string) => void;
  abrirStatus: (id: string) => void;
  abrirCarta: (ids: readonly string[]) => void;
  abrirAlteracaoJudicial: (id: string) => void;
  removerSubJudice: (id: string) => Promise<unknown>;
}
export interface PropsDaAbaDeAprovados {
  ativa: boolean;
  estado: EstadoDaAbaDeAprovados;
  perfil: unknown;
  candidatos: readonly CandidatoDaTabelaDeAprovados[];
  listas?: readonly ListaParaFiltroDeAprovados[];
  anexos: ReadonlyMap<string, readonly unknown[]>;
  convocacoes?: ConvocacoesDaTabela;
  carregado: boolean;
  erroAoCarregar: string | boolean;
  opcoes: {
    editais: readonly OpcaoDosAprovados[];
    cargos: readonly string[];
    modalidades: readonly string[];
  };
  filtros: FiltrosDaTabelaDeAprovados;
  aoMudarFiltro: (
    campo: keyof FiltrosDaTabelaDeAprovados,
    valores: string[],
  ) => void;
  aoLimparFiltros: () => void;
  pagina: PaginaDosAprovados<CandidatoDaTabelaDeAprovados>;
  tamanho: number;
  aoIrPara: (pagina: number) => boolean;
  aoMudarTamanho: (tamanho: number) => void;
}
