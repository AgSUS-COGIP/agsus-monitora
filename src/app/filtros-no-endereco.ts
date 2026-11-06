/*
  Os filtros de uma tela no endereço (`/projetos/triagem?edital=…&aba=pessoas`),
  sem React: as regras de ler e escrever a busca da URL e o que cada tela
  deixou nela. O hook é src/app/usar-filtros-na-url.ts.

  - Só filtros estruturais vão para a URL (edital, aba, situação, card, vaga):
    nome, CPF e o texto da busca nunca (`naUrl: false` fica só na tela e na
    sessão da aba).
  - O valor padrão não aparece: a URL só tem o que foi mudado.
  - `visao` é da navegação (src/lib/rotas.ts) e não é filtro.
  - A tela fica montada quando se vai a outra (src/app/telas.tsx): o que ela
    deixou na URL fica guardado aqui (`guardarFiltrosDaTela`), e a navegação
    devolve ao voltar a ela pelo menu (src/app/navegacao.ts, caminhoAtual).
*/
import { destinoDoCaminho } from "../lib/rotas.ts";
import type { LocalDoEndereco } from "./endereco.ts";

/** Um filtro da tela. O valor é sempre texto (o da URL). */
export interface CampoDoFiltro {
  padrao: string;
  /** O valor vindo de fora (URL, sessão) vale? Recusado, fica o padrão. */
  aceita?: (valor: string) => boolean;
  /** Mudar este campo é ir a outro lugar: entrada nova no histórico. */
  empilha?: boolean;
  /** `false`: fica fora da URL (a busca por nome ou CPF). */
  naUrl?: boolean;
}

export type EsquemaDosFiltros<C extends string> = Readonly<
  Record<C, CampoDoFiltro>
>;
export type ValoresDosFiltros<C extends string> = Record<C, string>;

/** O parâmetro da navegação (abre a visão de uma tela uma vez). */
const DA_NAVEGACAO = "visao";

const campos = <C extends string>(esquema: EsquemaDosFiltros<C>) =>
  Object.keys(esquema) as C[];

const vaiNaUrl = (campo: CampoDoFiltro) => campo.naUrl !== false;

function valorAceito(campo: CampoDoFiltro, valor: unknown): string {
  const texto = typeof valor === "string" ? valor.trim().slice(0, 120) : "";
  if (!texto) return campo.padrao;
  return !campo.aceita || campo.aceita(texto) ? texto : campo.padrao;
}

/** Os valores padrão do esquema. */
export function padroesDosFiltros<C extends string>(
  esquema: EsquemaDosFiltros<C>,
): ValoresDosFiltros<C> {
  const valores = {} as ValoresDosFiltros<C>;
  for (const c of campos(esquema)) valores[c] = esquema[c].padrao;
  return valores;
}

/** O que veio guardado (sessão), no formato do esquema. */
export function normalizarFiltros<C extends string>(
  esquema: EsquemaDosFiltros<C>,
  guardado: unknown,
): ValoresDosFiltros<C> {
  const v =
    guardado && typeof guardado === "object"
      ? (guardado as Record<string, unknown>)
      : {};
  const valores = {} as ValoresDosFiltros<C>;
  for (const c of campos(esquema)) valores[c] = valorAceito(esquema[c], v[c]);
  return valores;
}

/**
 * Os filtros do esquema que estão na busca da URL (os ausentes, no padrão),
 * ou `null` se nenhum está. Só os campos que vão na URL.
 */
export function filtrosDaBusca<C extends string>(
  esquema: EsquemaDosFiltros<C>,
  busca: string,
): Partial<ValoresDosFiltros<C>> | null {
  const parametros = new URLSearchParams(busca || "");
  const valores: Partial<ValoresDosFiltros<C>> = {};
  let algum = false;
  for (const c of campos(esquema)) {
    if (!vaiNaUrl(esquema[c])) continue;
    const lido = parametros.get(c);
    if (lido !== null) algum = true;
    valores[c] = valorAceito(esquema[c], lido);
  }
  return algum ? valores : null;
}

/**
 * A busca da URL com os valores do esquema (o padrão sai). Os outros
 * parâmetros ficam — os de outra parte da tela —, menos quando `manter` vem:
 * aí só ficam os dele (ir a outra aba deixa para trás os filtros da anterior).
 * Devolve "" ou "?a=b".
 */
export function buscaComFiltros<C extends string>(
  busca: string,
  esquema: EsquemaDosFiltros<C>,
  valores: Partial<ValoresDosFiltros<C>>,
  manter: readonly string[] | null = null,
): string {
  const antes = new URLSearchParams(busca || "");
  const proprios = new Set<string>(campos(esquema));
  const novo = (c: C): string => {
    const campo = esquema[c];
    if (!vaiNaUrl(campo)) return "";
    const valor = c in valores ? String(valores[c] ?? "") : antes.get(c) || "";
    return valor !== campo.padrao ? valor : "";
  };
  // Cada parâmetro fica no lugar em que estava; os novos vão para o fim.
  const depois = new URLSearchParams();
  for (const [chave, valor] of antes) {
    if (proprios.has(chave)) {
      const proprio = novo(chave as C);
      if (proprio && !depois.has(chave)) depois.append(chave, proprio);
      continue;
    }
    if (manter && chave !== DA_NAVEGACAO && !manter.includes(chave)) continue;
    depois.append(chave, valor);
  }
  for (const c of campos(esquema)) {
    const valor = novo(c);
    if (valor && !depois.has(c)) depois.append(c, valor);
  }
  const texto = depois.toString();
  return texto ? `?${texto}` : "";
}

/** Algum campo que empilha mudou de um para outro? */
export function mudouOQueEmpilha<C extends string>(
  esquema: EsquemaDosFiltros<C>,
  antes: ValoresDosFiltros<C>,
  depois: Partial<ValoresDosFiltros<C>>,
): boolean {
  return campos(esquema).some(
    (c) =>
      esquema[c].empilha &&
      vaiNaUrl(esquema[c]) &&
      c in depois &&
      depois[c] !== antes[c],
  );
}

/** Os mesmos valores (nos campos do esquema)? */
export function mesmosFiltros<C extends string>(
  esquema: EsquemaDosFiltros<C>,
  a: Partial<ValoresDosFiltros<C>>,
  b: Partial<ValoresDosFiltros<C>>,
): boolean {
  return campos(esquema).every((c) => (a[c] ?? "") === (b[c] ?? ""));
}

/** O endereço é o da tela (`view` da rota)? */
export function enderecoDaTela(local: LocalDoEndereco, tela: string): boolean {
  return destinoDoCaminho(local.caminho, local.busca)?.view === tela;
}

/** A busca sem o parâmetro da navegação: os filtros ("" ou "a=b"). */
export function soOsFiltros(busca: string): string {
  const parametros = new URLSearchParams(busca || "");
  parametros.delete(DA_NAVEGACAO);
  return parametros.toString();
}

// ── O que cada tela deixou na URL ─────────────────────────────────────────

const porTela = new Map<string, string>();

/** Os filtros que a tela deixou na URL ("" ou "a=b"). */
export function filtrosGuardadosDaTela(tela: string): string {
  return porTela.get(tela) || "";
}

/** Guarda os filtros da tela (a busca da URL; `visao` sai). */
export function guardarFiltrosDaTela(tela: string, busca: string) {
  if (!tela) return;
  const filtros = soOsFiltros(busca);
  if (filtros) porTela.set(tela, filtros);
  else porTela.delete(tela);
}

/** Esquece o guardado (saída do sistema; testes). */
export function esquecerFiltrosDasTelas() {
  porTela.clear();
}
