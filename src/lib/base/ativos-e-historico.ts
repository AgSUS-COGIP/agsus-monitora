/*
  "Ativos" e "Histórico" de uma lista (o padrão das telas do SIGEPSI): a lista
  de trabalho mostra só o que está em curso; o que já terminou fica a um
  clique, no Histórico. Ao lado, quantos há de cada situação na vista
  escolhida ("Em andamento 12 · Suspenso 1").

  Genérico: quem usa diz o que vai para o histórico (`ehHistorico`) e qual é a
  situação de cada item (`situacao`). A regra dos editais está em
  src/lib/editais/editais-ativos.ts. O componente é `AtivosEHistorico`
  (src/ui/ativos-e-historico.tsx).
*/

/** "todas" junta as duas (a tela que a oferece: a Lista de aprovados). */
export type VistaDaLista = "ativos" | "historico" | "todas";

export const VISTAS_DA_LISTA: readonly VistaDaLista[] = Object.freeze([
  "ativos",
  "historico",
  "todas",
]);

/** A vista guardada (sessão, endereço): o padrão é "ativos". */
export const vistaDaLista = (valor: unknown): VistaDaLista =>
  valor === "historico" || valor === "todas" ? valor : "ativos";

export interface SituacaoContada {
  /** O nome da situação como aparece na tela ("Em andamento"). */
  rotulo: string;
  quantos: number;
}

export interface ListaSeparada<T> {
  ativos: T[];
  historico: T[];
}

/** Separa a lista, na ordem em que veio. */
export function separarAtivosEHistorico<T>(
  itens: ReadonlyArray<T> | null | undefined,
  ehHistorico: (item: T) => boolean,
): ListaSeparada<T> {
  const ativos: T[] = [];
  const historico: T[] = [];
  for (const item of Array.isArray(itens) ? itens : []) {
    (ehHistorico(item) ? historico : ativos).push(item);
  }
  return { ativos, historico };
}

const chaveDaSituacao = (rotulo: string) =>
  rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const ORDEM_ALFABETICA = new Intl.Collator("pt-BR", { sensitivity: "base" });

/**
 * Quantos de cada situação, da mais numerosa para a menos (empate: ordem
 * alfabética). Grafias diferentes da mesma situação ("Em Andamento",
 * "em andamento") contam juntas, com o rótulo da primeira que apareceu; sem
 * situação conta como `semSituacao`.
 */
export function contarPorSituacao<T>(
  itens: ReadonlyArray<T> | null | undefined,
  situacao: (item: T) => unknown,
  semSituacao = "Sem situação",
): SituacaoContada[] {
  const contagem = new Map<string, SituacaoContada>();
  for (const item of Array.isArray(itens) ? itens : []) {
    const texto = String(situacao(item) ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const rotulo = texto || semSituacao;
    const chave = chaveDaSituacao(rotulo);
    const atual = contagem.get(chave);
    if (atual) atual.quantos += 1;
    else contagem.set(chave, { rotulo, quantos: 1 });
  }
  return [...contagem.values()].sort(
    (a, b) =>
      b.quantos - a.quantos || ORDEM_ALFABETICA.compare(a.rotulo, b.rotulo),
  );
}

const MILHAR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "Em andamento 12 · Suspenso 1" (o nome acessível da contagem). */
export const textoDasSituacoes = (
  situacoes: ReadonlyArray<SituacaoContada>,
): string =>
  situacoes
    .map(({ rotulo, quantos }) => `${rotulo} ${MILHAR.format(quantos)}`)
    .join(" · ");
