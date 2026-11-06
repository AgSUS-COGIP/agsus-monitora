/* Fogos: os tipos do show, dos foguetes e das partículas (API pública em src/lib/fogos.ts). */

import type { DancaDaAya, TrajetoDaAya } from "./fogos-cena.ts";
import type { PontoDaForma } from "./fogos-formas.ts";

/** Sorteio de 0 (inclusive) a 1 (exclusive), como Math.random. */
export type Aleatorio = () => number;

/** Ponto em px CSS. */
export interface PontoXY {
  x: number;
  y: number;
}

export interface IntensidadeDoShow {
  explosoes: number;
  final: number;
  duracaoMs: number;
  /** Rajadas: sequências de estouros pequenos do mesmo ponto. */
  rajadas: number;
  /** Tiros de cada rajada. */
  tiros: number;
  /** A apoteose: estouros juntos no fim, depois do grande final. */
  apoteose: number;
  /** A Aya volta para dançar no fim (e solta confete). */
  danca: boolean;
  /** O texto do marco escrito no céu no grande final. */
  letreiro: boolean;
}

export type NomeDoFormato =
  | "peonia"
  | "crisantemo"
  | "anel"
  | "salgueiro"
  | "estalinho"
  | "kamuro"
  | "glitter"
  | "palmeira"
  | "pistilo"
  | "bombaDupla"
  | "coracao"
  | "estrela"
  | "cometa"
  | "crepitante";

/** Um formato de estouro (ver o comentário de FORMATOS). */
export interface FormatoDosFogos {
  faiscas: number;
  forca: number;
  atrito: number;
  peso: number;
  vida: readonly [number, number];
  rastro: number;
  tamanho: number;
  cintila?: boolean;
  dourado?: boolean;
  estala?: boolean;
  pisca?: readonly [number, number];
  emite?: number;
  nucleo?: number;
  segundo?: { formato: NomeDoFormato; atraso: number };
  /** As brasas que solta (`emite`) são da cor da faísca, não douradas. */
  brasaDaCor?: boolean;
  /** Não encolhe em tela pequena (poucos braços: palmeira, cometa). */
  inteiro?: boolean;
}

/** O formato pelo nome, de um texto qualquer. */
export type FormatosPorNome = Readonly<
  Record<string, FormatoDosFogos | undefined>
>;

export interface PaletaDosFogos {
  cores: string[];
  dourado: string;
  ambar: string;
  centelha: string;
  fumaca: string;
  composicao: GlobalCompositeOperation;
  /** A cor da área atual (SI, SEDE, Projetos), quando o tema a tem. */
  area?: string | null;
}

export type PapelDoEstouro =
  "aya" | "comum" | "rajada" | "marco" | "letreiro" | "final" | "apoteose";

/** Um foguete do roteiro. `formato` é um NomeDoFormato ou "marco". */
export interface PlanoDoFoguete {
  formato: string;
  papel: PapelDoEstouro;
  estouro: number;
  lancamento: number;
  xBase: number;
  yBase: number;
  xAlvo: number;
  yAlvo: number;
  cor: string;
  cor2: string | null;
  corFinal: string | null;
  vidaFator: number;
  /** Rajada: estouro menor (fração das faíscas e da força). */
  porte?: number;
  /** O foguete assobia ao subir (o som). */
  assobia?: boolean;
  /** Só no marco com forma: os pontos do desenho. */
  pontos?: readonly PontoDaForma[] | null;
  fimDaForma?: number;
}

export interface FogueteNoAr extends PontoXY {
  plano: PlanoDoFoguete;
  vx: number;
  vy: number;
  gravidade: number;
  idade: number;
  subida: number;
}

/** O que toda partícula dos fogos tem. */
export interface BaseDaParticula extends PontoXY {
  vx: number;
  vy: number;
  atrito: number;
  gravidade: number;
  vida: number;
  vidaMax: number;
  cor: string;
  tamanho: number;
  rastro: number;
  corFinal?: string | null;
  cintila?: boolean;
  estala?: boolean;
  /** Glitter: piscadas por segundo (0, não pisca). */
  pisca?: number;
  fase?: number;
  /** Palmeira: brasas por segundo. */
  emite?: number;
  /** Fumaça: quanto cresce por segundo. */
  cresce?: number;
  /** A cor das brasas que solta (cometa); sem ela, dourado. */
  brasa?: string;
}
export interface ParticulaComum extends BaseDaParticula {
  tipo: "faisca" | "clarao" | "fumaca" | "centelha";
}
/** A faísca do marco: curva até o lugar, brilha e cai. */
export interface ParticulaDoAlvo extends BaseDaParticula {
  tipo: "alvo";
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  xa: number;
  ya: number;
  idade: number;
  convergencia: number;
  segura: number;
  fase: number;
  caindo?: number;
}
/** O segundo tempo da bomba dupla: estoura de novo ao apagar. */
export interface SementeDosFogos extends BaseDaParticula {
  tipo: "semente";
  plano: PlanoDoFoguete;
}
export type ParticulaDosFogos =
  ParticulaComum | ParticulaDoAlvo | SementeDosFogos;

/**
 * Evento ainda não tocado (som): o estouro, o lançamento de um foguete que
 * assobia (`subida`: quanto sobe, em s) e o confete da Aya dançando.
 */
export interface EventoDoEstouro extends PontoXY {
  tipo: "estouro" | "lancamento" | "confete";
  formato: string;
  papel: PapelDoEstouro;
  subida?: number;
}

export interface ShowDeFogos {
  t: number;
  duracao: number;
  escala: number;
  fator: number;
  paleta: PaletaDosFogos;
  limite: number;
  aleatorio: Aleatorio;
  aya: TrajetoDaAya | null;
  /** A Aya dançando no fim (Normal e Festa). */
  danca: DancaDaAya | null;
  /** O confete da dança já saiu. */
  confeteSolto: boolean;
  pontos: PontoDaForma[];
  /** O letreiro: o texto do marco escrito no céu. */
  letreiro: PontoDaForma[];
  planos: PlanoDoFoguete[];
  proximo: number;
  foguetes: FogueteNoAr[];
  particulas: ParticulaDosFogos[];
  estouros: number;
  eventos: EventoDoEstouro[];
}

export interface ContextoDoPlano {
  largura: number;
  altura: number;
  duracao: number;
  gravidade: number;
  paleta: PaletaDosFogos;
  aleatorio: Aleatorio;
}
