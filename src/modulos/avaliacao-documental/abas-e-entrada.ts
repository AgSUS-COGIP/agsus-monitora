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

export type Visao = "regra" | "equipe" | "pre" | "fila";

export const VISOES: ReadonlyArray<{
  valor: Visao;
  rotulo: string;
  icone: string;
}> = Object.freeze([
  { valor: "regra", rotulo: "Regra", icone: "fa-sliders" },
  { valor: "equipe", rotulo: "Equipe", icone: "fa-users" },
  { valor: "pre", rotulo: "Pré-classificação", icone: "fa-ranking-star" },
  { valor: "fila", rotulo: "Fila", icone: "fa-list-check" },
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

/** As abas que a pessoa vê no edital escolhido ([] = nenhuma: sem seletor). */
export function visoesDaPessoa(e: EstadoDasAbas): typeof VISOES {
  return coordenaOEdital(e) === true ? VISOES : [];
}

/** A aba que a tela mostra: quem não coordena (ou ainda não se sabe) fica na Fila. */
export function visaoNaTela(e: EstadoDasAbas): Visao {
  const visao = e.visao as Visao;
  if (visao === VISAO_DE_QUEM_AVALIA) return visao;
  return coordenaOEdital(e) === true && VISOES.some((v) => v.valor === visao)
    ? visao
    : VISAO_DE_QUEM_AVALIA;
}

/** A visão guardada no estado precisa cair para a Fila? (só quando já se sabe que não coordena) */
export function visaoProibida(e: EstadoDasAbas): boolean {
  return (
    e.visao !== VISAO_DE_QUEM_AVALIA &&
    Boolean(e.editalId) &&
    coordenaOEdital(e) === false
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
