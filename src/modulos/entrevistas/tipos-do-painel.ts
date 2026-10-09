export type CampoDoFiltro =
  | "busca"
  | "unidade"
  | "edital"
  | "vaga"
  | "cargo"
  | "parecer"
  | "comparecimento"
  | "modalidade"
  | "ligacao"
  | "andamento";
export type FiltrosDoPainel = Record<CampoDoFiltro, string>;
export type ListaDoFiltro =
  | "unidades"
  | "editais"
  | "vagas"
  | "cargos"
  | "pareceres"
  | "comparecimentos"
  | "modalidades"
  | "ligacoes"
  | "andamentos";
export type OpcoesDosFiltros = Record<
  ListaDoFiltro,
  readonly { valor: string; rotulo: string }[]
>;
export type FiltroAtivo = [campo: CampoDoFiltro, rotulo: string, valor: string];
export type AoFiltrar = (campo: CampoDoFiltro, valor: string) => void;
export interface CriterioDoPainel {
  indice: number;
  texto: string;
  curto: string;
}
export interface AnaliseDaEntrevista {
  id: unknown;
  ligacao: string | null;
  nota: number | null;
  resultado: string;
  etapa: string;
  responsavel: string;
  ativo: boolean;
}
export interface EntrevistaDoPainel {
  id: string;
  edital_id: unknown;
  edital: string;
  edital_planilha: string;
  unidade: string;
  vaga: string;
  cargo: string;
  candidato: string;
  codigo: string | null;
  modalidade: string | null;
  nota: number | null;
  parecer: string;
  compareceu: "S" | "N" | null;
  link: string | null;
  busca: string;
  notas: { indice: number; criterio: string; curto: string; nota: number }[];
  somaDasNotas: number | null;
  divergente: boolean;
  semEdital: boolean;
  analise: AnaliseDaEntrevista | null;
}
export interface AprovadoSemEntrevista {
  analise_id: unknown;
  candidato: string;
  codigo: string | null;
  vaga: string;
  cargo: string;
  edital: string;
  unidade: string;
  nota: number | null;
  modalidade: string | null;
}
export interface GrupoDosSemEntrevista {
  chave: string;
  edital: string;
  vaga: string;
  cargo: string;
  unidade: string;
  candidatos: AprovadoSemEntrevista[];
}
export interface IndicadoresDoPainel {
  vagas: number;
  candidatos: number;
  compareceram: number;
  aptos: number;
  inaptos: number;
  media: number | null;
  semEntrevista: number;
}
export interface PendenciaDoPainel {
  chave: string;
  titulo: string;
  subtitulo: string;
  unidade: [string, string];
  valor: number;
  severidade: "alta" | "media" | "baixa";
  campo?: CampoDoFiltro;
}
export interface PropsDosIndicadores {
  indicadores: IndicadoresDoPainel;
  carregado: boolean;
  filtros: FiltrosDoPainel;
  aoFiltrar: AoFiltrar;
  aoAbrirSemEntrevista(): void;
}
export interface PropsDasPendencias {
  pendencias: readonly PendenciaDoPainel[];
  carregado: boolean;
  filtros: FiltrosDoPainel;
  aoFiltrar: AoFiltrar;
  aoAbrirSemEntrevista(): void;
}
export interface PropsDosGraficos extends PropsDasPendencias {
  entrevistas: readonly EntrevistaDoPainel[];
  criterios: readonly CriterioDoPainel[];
  escuro: boolean;
}
