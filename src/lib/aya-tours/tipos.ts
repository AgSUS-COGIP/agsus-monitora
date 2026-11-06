/* Tours da Aya: tipos dos passos, tours, trilhas e do balão (API pública em ../aya-tours.ts). */

/* ---------- Tipos ---------- */

/** Uma regra do perfil (as mesmas funções que escondem o botão). */
export type RegraDoPerfil = (perfil: unknown) => boolean;

/** O seletor do elemento da vez, uma lista (vale o primeiro visível) ou nenhum. */
export type AlvoDoPasso = string | readonly string[] | null;

/** O que um passo pode trazer além de alvo, título e texto. */
export interface ExtraDoPasso {
  readonly areas?: readonly string[];
  readonly exige?: RegraDoPerfil;
  readonly antes?: string;
  readonly pagina?: string;
}

export interface PassoDoTour extends ExtraDoPasso {
  readonly alvo: AlvoDoPasso;
  readonly titulo: string;
  readonly texto: string;
}

export interface TourDaTela {
  readonly titulo: string;
  readonly passos: readonly PassoDoTour[];
}

/** O tour recortado da tela aberta, com a chave. */
export interface TourDaPagina extends TourDaTela {
  readonly chave: string;
}

export interface TrilhaDaAya {
  readonly id: string;
  readonly titulo: string;
  readonly resumo: string;
  readonly exige: RegraDoPerfil;
  readonly passos: readonly PassoDoTour[];
}

/** O perfil de quem faz o tour (o do app); só `ativo` é lido aqui. */
export type PerfilDoTour = { readonly ativo?: unknown } | null | undefined;

/** Onde a trilha parou. */
export interface ProgressoDaTrilha {
  passo: number;
  concluida: boolean;
}

export type ProgressoDasTrilhas = Record<string, ProgressoDaTrilha>;

/** O que está aberto: view, seção de Configurações e aba. */
export interface AberturaDoTour {
  view?: string;
  secao?: string;
  aba?: string;
}

/** Um retângulo na tela (getBoundingClientRect). */
export interface RetanguloNaTela {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface TamanhoNaTela {
  readonly largura: number;
  readonly altura: number;
}

export type LadoDoBalao = "baixo" | "cima" | "direita" | "esquerda";

export type PosicaoDoBalao =
  | { modo: "celular"; lado: "cima" | "baixo" }
  | { modo: "centro" | "sobre" | LadoDoBalao; top: number; left: number };

/** Uma faixa escura do véu. */
export interface FaixaDoVeu {
  top: number;
  left: number;
  width?: number;
  height?: number;
  right?: number;
  bottom?: number;
}

export interface GeometriaDoHolofote {
  recorte: { top: number; left: number; width: number; height: number };
  faixas: FaixaDoVeu[];
}
