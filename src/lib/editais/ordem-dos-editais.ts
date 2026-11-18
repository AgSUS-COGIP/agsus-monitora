/*
  A ordem da tabela de Editais (src/modulos/editais/nucleo.tsx).

  Padrão: cronológica, do edital mais recente para o mais antigo (coluna
  Edital, decrescente). Clicar numa coluna ordena por ela: o 1º clique é
  crescente (mais antigo → mais novo, menor → maior, A → Z), o 2º inverte, e
  assim alternando. Trocar de coluna recomeça no crescente.

  - Edital: cronológica — a data de início do edital (`data_inicio`) e, sem
    ela ou no empate, o ano e o número de "NNN/AAAA".
  - Vagas, Contratados, Ociosas: numérica.
  - Risco: pela gravidade (Baixo → Médio → Alto).
  - Unidade, Status, Etapa: alfabética (pt-BR, sem caixa nem acento, "DSEI 2"
    antes de "DSEI 10").
  Valor vazio fica sempre no fim, nos dois sentidos. No empate, vale a ordem
  cronológica (mais recente primeiro).
*/

export type ChaveDaOrdemDosEditais =
  | "unidade"
  | "edital"
  | "status"
  | "etapa"
  | "vagas"
  | "contratados"
  | "ociosas"
  | "risco";

export type SentidoDaOrdem = "asc" | "desc";

export interface OrdemDosEditais {
  readonly chave: ChaveDaOrdemDosEditais;
  readonly sentido: SentidoDaOrdem;
}

/** A linha do monitoramento no que a ordem lê. */
export interface LinhaParaOrdenar {
  readonly edital?: unknown;
  readonly data_inicio?: unknown;
  readonly unidade?: unknown;
  readonly status?: unknown;
  readonly etapa?: unknown;
  readonly vagas_total?: unknown;
  readonly contratados?: unknown;
  readonly vagas_ociosas?: unknown;
  readonly risco?: unknown;
}

export const ORDEM_PADRAO_DOS_EDITAIS: OrdemDosEditais = Object.freeze({
  chave: "edital",
  sentido: "desc",
});

/** O clique no cabeçalho: outra coluna começa crescente; a mesma alterna. */
export function proximaOrdemDosEditais(
  atual: OrdemDosEditais,
  chave: ChaveDaOrdemDosEditais,
): OrdemDosEditais {
  if (atual.chave !== chave) return { chave, sentido: "asc" };
  return { chave, sentido: atual.sentido === "asc" ? "desc" : "asc" };
}

const texto = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

type Valor = string | number | null;

/* A data de início como número (AAAAMMDD), ou null. */
function dataDeInicio(valor: unknown): number | null {
  const achado = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? "").trim());
  return achado ? Number(achado.slice(1, 4).join("")) : null;
}

/* "120/2026" → 2026 * 1e6 + 120; sem o padrão, null. */
function numeroDoEdital(valor: unknown): number | null {
  const achado = /(\d+)\s*\/\s*(\d{4})/.exec(String(valor ?? ""));
  return achado ? Number(achado[2]) * 1e6 + Number(achado[1]) : null;
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function gravidade(risco: unknown): number | null {
  const r = String(risco ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  if (!r) return null;
  if (r === "baixo") return 1;
  if (r === "medio") return 2;
  if (r === "alto") return 3;
  return 4;
}

function textoDe(valor: unknown): string | null {
  const t = String(valor ?? "").trim();
  return t || null;
}

/* Vazio no fim; senão, a comparação no sentido pedido. */
function comparar(a: Valor, b: Valor, sentido: SentidoDaOrdem): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const base =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : texto.compare(String(a), String(b));
  return sentido === "asc" ? base : -base;
}

/* Cronológica: data de início e, no empate ou sem ela, o NNN/AAAA. */
function compararCronologia(
  a: LinhaParaOrdenar,
  b: LinhaParaOrdenar,
  sentido: SentidoDaOrdem,
): number {
  return (
    comparar(
      dataDeInicio(a.data_inicio),
      dataDeInicio(b.data_inicio),
      sentido,
    ) || comparar(numeroDoEdital(a.edital), numeroDoEdital(b.edital), sentido)
  );
}

const VALOR: Record<
  Exclude<ChaveDaOrdemDosEditais, "edital">,
  (linha: LinhaParaOrdenar) => Valor
> = {
  unidade: (l) => textoDe(l.unidade),
  status: (l) => textoDe(l.status),
  etapa: (l) => textoDe(l.etapa),
  vagas: (l) => numero(l.vagas_total),
  contratados: (l) => numero(l.contratados),
  ociosas: (l) => numero(l.vagas_ociosas),
  risco: (l) => gravidade(l.risco),
};

/** Os itens na ordem pedida (cópia; `linhaDe` tira a linha do item). */
export function ordenarEditais<T>(
  itens: readonly T[],
  ordem: OrdemDosEditais,
  linhaDe: (item: T) => LinhaParaOrdenar,
): T[] {
  const { chave, sentido } = ordem;
  return [...itens].sort((x, y) => {
    const a = linhaDe(x);
    const b = linhaDe(y);
    if (chave === "edital") return compararCronologia(a, b, sentido);
    return (
      comparar(VALOR[chave](a), VALOR[chave](b), sentido) ||
      compararCronologia(a, b, "desc")
    );
  });
}
