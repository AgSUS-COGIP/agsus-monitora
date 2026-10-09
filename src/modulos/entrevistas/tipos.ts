import type { CompetenciaDaFicha, PayloadDasNotas } from "./tipos-da-ficha.ts";

import type {
  Avaliador,
  Convocado,
  ItemDaAgendaNoBanco,
} from "../../lib/fila-de-conducao.ts";

/*
  Contratos de "Conduzir entrevistas" (conduzir.tsx, fila-do-dia.tsx) com o
  estado da condução, que é JavaScript (estado-da-conducao.js). Só os campos
  que a tela nova lê; o payload vem do banco sem validação em tempo de
  execução (as regras de src/lib/fila-de-conducao.ts toleram campo faltando).
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

export type RoteiroDoEdital = {
  id: string;
  nome?: string;
  versao?: number;
  nome_versao?: string | null;
  competencias?: CompetenciaDaFicha[] | null;
  aspectos?: { id: string; nome?: string; ordem?: number | null }[] | null;
  escala?: string | null;
  ausencia_elimina?: boolean;
  [campo: string]: unknown;
};

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
  lista_convocacao?: unknown;
  avaliadores: Avaliador[];
  convocados: Convocado[];
};

export type EstadoDaConducao = {
  area: string;
  roteiros: Lista<unknown>;
  editais: Lista<EditalDaLista> & { admin: boolean; todos: boolean };
  editalId: string;
  edital: DadosDoEdital | null;
  agenda: { itens?: ItemDaAgendaNoBanco[] | null } | null;
  calculo: unknown;
  carregandoEdital: boolean;
  erroDoEdital: string;
  podeEditar: boolean | null;
  acao: { tipo: string; rotulo: string } | null;
  fichaAberta: string | null;
};

export type Resultado = { ok?: boolean; erro?: string };

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
  configurar: (dados: unknown) => Promise<Resultado>;
  convocar: (analises: string[]) => Promise<Resultado>;
  desconvocar: (entrevista: string, motivo: string) => Promise<Resultado>;
  salvarRoteiro: (dados: unknown) => Promise<Resultado>;
  renomearRoteiro: (
    roteiro: string,
    nome: string,
    motivo: string,
  ) => Promise<Resultado>;
  liberarEdital: (
    id: string,
    ate: string | null,
    motivo: string,
    doPainel?: unknown[],
  ) => Promise<Resultado>;
};
