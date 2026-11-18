/*
  O alcance da seleção em lote, sem DOM: quantos estão marcados e se isso é
  "esta página" (as linhas já desenhadas na tabela) ou "todos os N
  resultados" (o recorte inteiro dos filtros e da busca). Revisão de
  17/11/2026: a Lista de aprovados oferecia marcar 13.184 registros numa
  caixa só; agora as duas escolhas são separadas e a confirmação da ação diz
  quantos serão afetados. Quem usa: a BarraDeSelecao (src/ui/), a Lista de
  aprovados e a Fila da Avaliação documental.
*/
import { formatNumberBR } from "./formatters";

/** nenhum · parte (alguns, à mão) · pagina (a página inteira) · todos (o recorte inteiro). */
export type TipoDoAlcance = "nenhum" | "parte" | "pagina" | "todos";

export interface AlcanceDaSelecao {
  tipo: TipoDoAlcance;
  /** Marcados que estão no recorte. */
  quantos: number;
  /** Linhas da página (as desenhadas). */
  naPagina: number;
  /** Marcados que estão na página. */
  marcadosNaPagina: number;
  /** O recorte inteiro (filtros e busca). */
  total: number;
}

/** O nome do que se seleciona: "candidato"/"candidatos", "ficha"/"fichas". */
export interface NomeDosItens {
  singular: string;
  plural: string;
  /** Concordância: "selecionada", "afetadas", "Todas as". */
  feminino?: boolean;
}

const n = formatNumberBR;
const contar = (quantos: number, nome: NomeDosItens) =>
  `${n(quantos)} ${quantos === 1 ? nome.singular : nome.plural}`;
/* "selecionado", "selecionadas", "afetado"… na concordância do nome. */
const participio = (raiz: string, quantos: number, nome: NomeDosItens) =>
  `${raiz}${nome.feminino ? "a" : "o"}${quantos === 1 ? "" : "s"}`;

/**
 * O alcance: `pagina` são os ids desenhados (os primeiros do recorte),
 * `recorte` todos os ids que passam pelos filtros e pela busca. Marcado fora
 * do recorte não conta (a tela limpa a seleção quando o recorte muda).
 */
export function alcanceDaSelecao(
  marcados: ReadonlySet<string>,
  pagina: readonly string[],
  recorte: readonly string[],
): AlcanceDaSelecao {
  const conta = (ids: readonly string[]) =>
    ids.reduce((s, id) => s + (marcados.has(id) ? 1 : 0), 0);
  const quantos = conta(recorte);
  const marcadosNaPagina = conta(pagina);
  const total = recorte.length;
  const tipo: TipoDoAlcance = !quantos
    ? "nenhum"
    : quantos === total
      ? "todos"
      : pagina.length > 0 &&
          marcadosNaPagina === pagina.length &&
          quantos === pagina.length
        ? "pagina"
        : "parte";
  return { tipo, quantos, naPagina: pagina.length, marcadosNaPagina, total };
}

/** O alcance de uma ação avulsa (o "⋯" de uma linha): só os itens dela. */
export const alcanceAvulso = (quantos: number): AlcanceDaSelecao => ({
  tipo: quantos ? "parte" : "nenhum",
  quantos,
  naPagina: 0,
  marcadosNaPagina: 0,
  total: quantos,
});

/** A mesma página (mesmos ids na mesma ordem)? Evita trocar o estado à toa. */
export const mesmaPagina = (
  a: readonly string[],
  b: readonly string[],
): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

/** A seleção com a página marcada (sim) ou desmarcada (não), sem mexer no resto. */
export function marcarPagina(
  marcados: ReadonlySet<string>,
  pagina: readonly string[],
  sim: boolean,
): Set<string> {
  const novo = new Set(marcados);
  for (const id of pagina) {
    if (sim) novo.add(id);
    else novo.delete(id);
  }
  return novo;
}

/** A página inteira está marcada? (a caixa "Selecionar esta página") */
export const paginaMarcada = (alcance: AlcanceDaSelecao): boolean =>
  alcance.naPagina > 0 && alcance.marcadosNaPagina === alcance.naPagina;

/** O rótulo da caixa da página: "Selecionar esta página (50)". */
export const rotuloDaPagina = (alcance: AlcanceDaSelecao): string =>
  `Selecionar esta página (${n(alcance.naPagina)})`;

/**
 * O convite para passar ao recorte inteiro, quando a página toda está marcada
 * e o recorte é maior que ela: "Selecionar todos os 13.184 resultados".
 * "" quando não cabe.
 */
export function conviteParaTodos(alcance: AlcanceDaSelecao): string {
  if (!paginaMarcada(alcance) || alcance.tipo === "todos") return "";
  return `Selecionar todos os ${n(alcance.total)} resultados`;
}

/** O que está marcado, sem ambiguidade (a linha da barra, lida pelo leitor de tela). */
export function textoDoAlcance(
  alcance: AlcanceDaSelecao,
  nome: NomeDosItens,
): string {
  const { tipo, quantos, total } = alcance;
  const marcados = participio("selecionad", quantos, nome);
  if (tipo === "nenhum")
    return `${nome.feminino ? "Nenhuma" : "Nenhum"} ${nome.singular} ${marcados}`;
  if (tipo === "todos")
    return total === 1
      ? `O único resultado está ${marcados}`
      : `${nome.feminino ? "Todas as" : "Todos os"} ${contar(total, nome)} do resultado ${marcados}`;
  const de = `(de ${n(total)} no resultado)`;
  if (tipo === "pagina")
    return `${contar(quantos, nome)} desta página ${marcados} ${de}`;
  return `${contar(quantos, nome)} ${marcados} ${de}`;
}

/**
 * A linha da confirmação: quantos a ação vai afetar e de onde vêm.
 * `afetados` é quantos a ação pega de fato (pode ser menos que os marcados,
 * quando a ação não se aplica a parte deles).
 */
export function textoDaConfirmacao(
  alcance: AlcanceDaSelecao,
  afetados: number,
  nome: NomeDosItens,
): string {
  const verbo = afetados === 1 ? "será" : "serão";
  const partes = [
    `${contar(afetados, nome)} ${verbo} ${participio("afetad", afetados, nome)}`,
  ];
  if (alcance.tipo === "todos" && alcance.total > alcance.naPagina)
    partes.push(
      `todos os resultados do filtro, não só os ${n(alcance.naPagina)} desta página`,
    );
  else if (alcance.tipo === "pagina") partes.push("só esta página");
  const fora = alcance.quantos - afetados;
  if (fora > 0) partes.push(`${n(fora)} dos marcados não se aplicam`);
  return partes.join(" · ");
}
