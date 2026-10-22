import type { PayloadDasNotas } from "./tipos-da-ficha.ts";
import type {
  DadosDoRoteiroParaSalvar,
  RoteiroDeEntrevista,
} from "../../lib/tipos-do-roteiro-de-entrevista.ts";

import type {
  Avaliador,
  Convocado,
  ItemDaAgendaNoBanco,
} from "../../lib/fila-de-conducao.ts";

/*
  Contratos de "Conduzir entrevistas" (conduzir.tsx, fila-do-dia.tsx) com o
  estado em TypeScript (estado-da-conducao.ts). Os campos usados pela tela
  são verificados na entrada por dados-da-conducao.ts; dados opacos do motor
  de classificação e campos adicionais permanecem unknown.
*/

export type Lista<T> = {
  lista: T[];
  carregando: boolean;
  carregado: boolean;
  erro: string;
};

export type EditalDaLista = {
  id: string;
  edital: string;
  unidade: string;
  treinamento: boolean;
  comEntrevistas?: boolean;
  naJanela?: boolean;
  janelaInicio?: string;
  janelaFim?: string;
  liberadoAte?: string;
  motivoLiberacao?: string;
  visivelPor?: string;
  pendentes?: number;
};

export type RoteiroDoEdital = RoteiroDeEntrevista;

export type DadosDoEdital = {
  edital: {
    id: string;
    edital?: string;
    unidade?: string;
    treinamento?: boolean;
  } | null;
  pode_editar?: boolean;
  pode_gerar_lista?: boolean;
  admin_global?: boolean;
  meu_perfil?: string | null;
  configuracao: {
    roteiro?: RoteiroDoEdital | null;
    lancamento?: string | null;
    banca?: { origem: string; quantidade: number }[] | null;
  } | null;
  regra_classificacao?: {
    versao?: number;
    convocacao?: unknown;
    desempate?: unknown;
    empate_final?: unknown;
  } | null;
  lista_convocacao?: {
    lista?: ({ id?: string } & Record<string, unknown>) | null;
    [campo: string]: unknown;
  } | null;
  [campo: string]: unknown;
  avaliadores: Avaliador[];
  convocados: Convocado[];
};

export type EstadoDaConducao = {
  area: string;
  roteiros: Lista<RoteiroDeEntrevista>;
  editais: Lista<EditalDaLista> & { admin: boolean; todos: boolean };
  editalId: string;
  edital: DadosDoEdital | null;
  agenda: { itens?: ItemDaAgendaNoBanco[] | null } | null;
  calculo: { resultado?: unknown; erro?: string } | null;
  carregandoEdital: boolean;
  erroDoEdital: string;
  podeEditar: boolean | null;
  acao: { tipo: TipoDaAcaoDaConducao; rotulo: string } | null;
  fichaAberta: string | null;
};

export type TipoDaAcaoDaConducao =
  "roteiro" | "liberar" | "configurar" | "convocar" | "desconvocar" | "notas";
export type DadosDaConfiguracaoDaEntrevista = {
  roteiro: string;
  lancamento: "AVALIADOR" | "SECRETARIA";
  banca: { origem: string; quantidade: number }[];
  avaliadores: {
    id?: string;
    nome: string;
    origem: string;
    banca: number;
    perfil: string | null;
    competencias: string[] | null;
  }[];
};
export type Resultado = {
  ok?: boolean;
  erro?: string;
  codigo?: string;
  dados?: DadosDoEdital | null;
  roteiro?: RoteiroDeEntrevista | null;
  convocados?: number;
};

export type EstadoDaConducaoComAcoes = {
  obter: () => EstadoDaConducao;
  assinar: (ouvinte: () => void) => () => void;
  trocarArea: (area: string) => void;
  carregarRoteiros: (area?: string) => Promise<boolean>;
  carregarEditais: (
    area?: string,
    doPainel?: unknown[],
    opcoes?: { todos?: boolean },
  ) => Promise<EditalDaLista[]>;
  abrirEdital: (id: string) => Promise<boolean>;
  recarregarEdital: () => Promise<boolean>;
  lancarNotas: (
    entrevista: string,
    dados: PayloadDasNotas,
  ) => Promise<Resultado>;
  abrirFicha: (id: string | null) => void;
  configurar: (dados: DadosDaConfiguracaoDaEntrevista) => Promise<Resultado>;
  convocar: (analises: string[]) => Promise<Resultado>;
  desconvocar: (entrevista: string, motivo: string) => Promise<Resultado>;
  salvarRoteiro: (dados: DadosDoRoteiroParaSalvar) => Promise<Resultado>;
  renomearRoteiro: (
    roteiro: string,
    nome: string | null,
    motivo: string,
  ) => Promise<Resultado>;
  liberarEdital: (
    id: string,
    ate: string | null,
    motivo: string,
    doPainel?: unknown[],
  ) => Promise<Resultado>;
};
