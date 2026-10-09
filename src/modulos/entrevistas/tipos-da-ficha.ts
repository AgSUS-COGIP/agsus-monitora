import type { Avaliador, Convocado } from "../../lib/fila-de-conducao.ts";
import type { Comparecimento } from "./cabecalho-da-ficha.tsx";
import type { CopiarTexto } from "./parecer-pronto.tsx";
import type { DadosDoEdital, Resultado } from "./tipos.ts";

export type CompetenciaDaFicha = {
  id: string;
  nome: string;
  ordem?: number | null;
  descricao?: string | null;
  nota_maxima?: number | string | null;
  nota_minima?: number | string | null;
  peso?: number | string | null;
  tipo_minimo?: string | null;
  avaliacao?: string | null;
};
export type AspectoDaFicha = {
  id: string;
  nome?: string;
  ordem?: number | null;
};
export type ModoDaFicha = "avaliador" | "competencia";
export type MapaDeNotas = Record<string, string>;
export type NotaParaSalvar = { competencia: string; avaliador: string } & (
  | { nota: number | null; aspectos?: never }
  | { aspectos: { aspecto: string; nota: number }[] | null; nota?: never }
);
export type PayloadDasNotas = {
  notas: NotaParaSalvar[];
  observacoes?: { avaliador: string; texto: string | null }[];
  justificativa?: string | null;
  compareceu?: Exclude<Comparecimento, null>;
  banca?: number;
};
export type EstadoLocalDaFicha = {
  compareceu: Comparecimento;
  banca: number | null;
  original: MapaDeNotas;
  mapa: MapaDeNotas;
  observacoesOriginais: Record<string, string>;
  observacoes: Record<string, string>;
  justificativaOriginal: string;
  justificativa: string;
};
export type ResultadoDoCalculoDaFicha = {
  competencias: {
    id: string;
    nome: string;
    quantidade: number;
    media: number | null;
    peso: number;
    nota: number | null;
    minimo: number | null;
    abaixoDoMinimo: boolean;
    eliminatoria: boolean;
  }[];
  total: number | null;
  parecer: "APTO" | "INAPTO" | "SEM_PARECER";
  falta: boolean;
  abaixoDoMinimoTotal: boolean;
  minimoTotal: number | null;
};
export type PropriedadesDaFicha = {
  dados: DadosDoEdital;
  convocado: Convocado;
  convocados?: readonly Convocado[] | null;
  salvando: boolean;
  aoSalvar: (dados: PayloadDasNotas) => Promise<Resultado | void>;
  aoAbrir: (id: string) => void;
  aoFechar: () => void;
  copiar?: CopiarTexto;
};
export type DadosDaLinha = {
  id: string;
  titulo: string;
  detalhe?: string;
  descricao?: string;
  c: CompetenciaDaFicha;
  a: Avaliador;
};
