/*
  As abas da Avaliação documental por papel e a entrada da tela (sem React,
  sem DOM): quem vê Regra, Equipe e Pré-classificação, a aba que a tela
  mostra, o edital que abre sozinho e o último edital aberto, lembrado no
  navegador.

  Quem coordena o edital (gestor do edital, coordenação na equipe ou
  administrador global: FC_PAPEL_AVALIACAO = 'COORDENADOR', o mesmo
  `pode_coordenar` das "Ações da coordenação") vê as quatro abas; os demais
  (analista, revisor, leitor) veem só a Fila, sem o seletor de abas. Antes de
  o edital carregar, o `papel` de cada edital da lista
  (listar_editais_avaliacao) já diz quem coordena: a aba proibida não pisca.
  Lista sem `papel` (banco antigo): espera o edital carregar (`null`).
*/

export type Visao =
  | "fila"
  | "resultados"
  | "espelhos"
  | "configuracoes"
  | "pre"
  | "regra"
  | "equipe";

export const VISOES: ReadonlyArray<{
  valor: Visao;
  rotulo: string;
  icone: string;
}> = Object.freeze([
  { valor: "fila", rotulo: "Fila de análise", icone: "fa-list-check" },
  {
    valor: "resultados",
    rotulo: "Resultados",
    icone: "fa-square-poll-vertical",
  },
  { valor: "espelhos", rotulo: "Espelhos", icone: "fa-file-pdf" },
  { valor: "configuracoes", rotulo: "Configurações", icone: "fa-sliders" },
]);

/** A aba de quem não coordena (e o destino de uma visão proibida). */
export const VISAO_DE_QUEM_AVALIA: Visao = "fila";

export interface EditalDaLista {
  id: string;
  edital?: string | null;
  unidade?: string | null;
  ativo?: boolean | null;
  status?: string | null;
  papel?: string | null;
  versao_regra?: number | null;
  nome_regra?: string | null;
  situacao_regra?: string | null;
  treinamento?: boolean | null;
  /* Contagens das fichas, quando o banco as manda (proposta: listar_editais_avaliacao). */
  fichas?: {
    concluidas?: number | null;
    pendentes?: number | null;
    em_analise?: number | null;
    minhas_em_analise?: number | null;
  } | null;
}

export interface EstadoDasAbas {
 ...[truncated]