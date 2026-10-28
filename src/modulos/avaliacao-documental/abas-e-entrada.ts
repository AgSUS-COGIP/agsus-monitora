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
  { valor: "espelhos", rotulo: "Documentos", icone: "fa-file-pdf" },
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
  editais?: ReadonlyArray<EditalDaLista> | null;
  editalId?: string;
  dados?: { pode_coordenar?: boolean | null } | null;
  visao?: string;
}

/**
 * Quem está na tela coordena o edital escolhido? `true`/`false` ou `null`
 * (ainda não se sabe: sem edital, ou lista sem `papel` e edital carregando).
 */
export function coordenaOEdital(e: EstadoDasAbas): boolean | null {
  if (!e.editalId) return null;
  if (e.dados) return Boolean(e.dados.pode_coordenar);
  const ed = (e.editais || []).find((x) => x.id === e.editalId);
  if (!ed || ed.papel === undefined) return null;
  return ed.papel === "COORDENADOR";
}

/** A leitura de resultados já existentes não concede ações de coordenação. */
const VISOES_DE_LEITURA = VISOES.filter((v) => v.valor === "fila");

/** As abas que a pessoa vê após confirmar seu papel no edital. */
export function visoesDaPessoa(e: EstadoDasAbas): typeof VISOES {
  if (!e.dados) return [];
  const coordena = coordenaOEdital(e);
  return coordena === true
    ? VISOES
    : coordena === false
      ? VISOES_DE_LEITURA
      : [];
}

/**
 * Regra e Equipe antigas convergem em Configurações. A Pré-classificação
 * continua acessível por atalho somente até ganhar sua entrada independente.
 * Quem não coordena nunca vê Espelhos em massa, Configurações ou Pré.
 */
export function visaoNaTela(e: EstadoDasAbas): Visao {
  const visao = e.visao as Visao;
  if (visao === "fila" || visao === "resultados") return "fila";
  if (coordenaOEdital(e) !== true) return VISAO_DE_QUEM_AVALIA;
  if (visao === "pre" || visao === "espelhos") return visao;
  if (visao === "regra" || visao === "equipe" || visao === "configuracoes")
    return "configuracoes";
  return VISAO_DE_QUEM_AVALIA;
}

/** Descarta visões privilegiadas guardadas quando a pessoa não coordena. */
export function visaoProibida(e: EstadoDasAbas): boolean {
  return (
    Boolean(e.editalId) &&
    coordenaOEdital(e) === false &&
    !["fila", "resultados"].includes(e.visao || "")
  );
}

/**
 * O edital que a tela abre sozinha ao chegar (ou "" para mostrar os
 * cartões): o primeiro dos `preferidos` que está na lista (a ficha que
 * estava aberta, o último edital aberto) e, sem eles, o único edital vigente
 * da área ou o único vigente em que a pessoa está na equipe.
 */
export function editalParaAbrir(
  editais: ReadonlyArray<EditalDaLista>,
  vigente: (ed: EditalDaLista) => boolean,
  preferidos: ReadonlyArray<string | null | undefined> = [],
): string {
  const ids = new Set(editais.map((ed) => ed.id));
  const preferido = preferidos.find((id) => id && ids.has(id));
  if (preferido) return preferido;
  const vigentes = editais.filter(vigente);
  if (vigentes.length === 1) return vigentes[0]?.id ?? "";
  const naEquipe = vigentes.filter((ed) => Boolean(ed.papel));
  if (naEquipe.length === 1) return naEquipe[0]?.id ?? "";
  return "";
}

/* ---------- O último edital aberto, por pessoa e área (localStorage) ---------- */

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const chaveDoEdital = (usuario: string, area: string) =>
  `monitora:avaliacao-documental:edital:${usuario}:${area}`;

function armazenamentoPadrao(): Armazenamento | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** O último edital aberto por esta pessoa nesta área ("" sem lembrança). */
export function lerEditalLembrado(
  usuario: string | null | undefined,
  area: string,
  armazenamento: Armazenamento | null = armazenamentoPadrao(),
): string {
  if (!usuario || !area) return "";
  try {
    return armazenamento?.getItem(chaveDoEdital(usuario, area)) || "";
  } catch {
    return "";
  }
}

/** Guarda (ou esquece, com "") o edital aberto. Sem armazenamento: nada. */
export function lembrarEdital(
  usuario: string | null | undefined,
  area: string,
  editalId: string,
  armazenamento: Armazenamento | null = armazenamentoPadrao(),
): void {
  if (!usuario || !area) return;
  try {
    if (editalId)
      armazenamento?.setItem(chaveDoEdital(usuario, area), editalId);
    else armazenamento?.removeItem(chaveDoEdital(usuario, area));
  } catch {
    /* Navegador sem armazenamento: a próxima entrada mostra os cartões. */
  }
}
