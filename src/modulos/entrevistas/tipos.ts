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
};

export type DadosDoEdital = {
  edital: {
    id: string;
    edital?: string;
    unidade?: string;
    treinamento?: boolean;
  } | null;
  pode_editar?: boolean;
  configuracao: {
    roteiro?: { competencias?: { id: string }[] | null } | null;
  } | null;
  regra_classificacao?: unknown;
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
  lancarNotas: (entrevista: string, dados: unknown) => Promise<Resultado>;
  abrirFicha: (id: string | null) => void;
};
