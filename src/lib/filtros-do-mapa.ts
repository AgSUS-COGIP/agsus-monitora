/*
  FILTROS DO MAPA E DA TABELA DE PROCESSOS — LÓGICA PURA

  Tudo o que decide "esta linha entra no recorte?" e "que opções este filtro
  oferece?" vive aqui, sem DOM, para poder ser testado. O `legacy-app.js`
  guarda o estado (um Set de valores por campo) e só delega a estas funções.

  Duas regras que corrigiram bugs:

  1. Comparação por CHAVE normalizada (sem acento, sem caixa, espaços
     colapsados). "Médio" e "Medio" são a mesma opção; o rótulo mostrado é a
     grafia mais frequente nos dados.

  2. A poda repete até estabilizar. Tirar uma seleção que deixou de existir
     muda as opções dos outros campos, que por sua vez podem invalidar outra
     seleção. Uma passada só deixava seleções órfãs — os filtros "não
     encadeavam".
*/

/** Valores selecionados de um campo. */
export type SelecaoDoFiltro = ReadonlySet<string> | readonly string[];
/** Valores selecionados por campo. */
export type EstadoDosFiltros = Readonly<
  Record<string, SelecaoDoFiltro | null | undefined>
>;

export interface OpcoesDoFiltro<L> {
  /** Campos considerados (padrão: chaves do estado). */
  campos?: readonly string[];
  /** Campo desconsiderado (para montar as opções dele). */
  ignorarCampo?: string;
  /** Regra extra de exclusão (ex.: encerrados). */
  excluir?: (linha: L) => boolean;
  /** Chave do DSEI selecionado no mapa. */
  dsei?: string;
  /** Chave do DSEI da linha. */
  chaveDsei?: (linha: L) => string;
  comparar?: (a: string, b: string) => number;
}

/** Chave de comparação de um valor de filtro. */
export function chaveDeFiltro(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function valorDoCampo(linha: unknown, campo: string): string {
  return String(
    (linha as Record<string, unknown> | null | undefined)?.[campo] ?? "",
  ).trim();
}

function chavesSelecionadas(
  selecionados: SelecaoDoFiltro | null | undefined,
): Set<string> {
  const chaves = new Set<string>();
  (selecionados || []).forEach((valor) => {
    const chave = chaveDeFiltro(valor);
    if (chave) chaves.add(chave);
  });
  return chaves;
}

/**
 * A linha entra no recorte?
 *
 * `estado`: valores selecionados por campo.
 */
export function linhaAtende<L>(
  linha: L,
  estado: EstadoDosFiltros | null | undefined,
  opcoes: OpcoesDoFiltro<L> = {},
): boolean {
  const { ignorarCampo = "", excluir, dsei = "", chaveDsei } = opcoes;
  if (excluir && excluir(linha)) return false;
  if (dsei && chaveDsei && chaveDsei(linha) !== dsei) return false;
  const campos = opcoes.campos || Object.keys(estado || {});
  return campos.every((campo) => {
    if (campo === ignorarCampo) return true;
    const chaves = chavesSelecionadas(estado?.[campo]);
    if (!chaves.size) return true;
    return chaves.has(chaveDeFiltro(valorDoCampo(linha, campo)));
  });
}

/**
 * Opções que o filtro `campo` oferece: os valores das linhas que atendem aos
 * OUTROS filtros, sem duplicata pela chave. O rótulo é a grafia mais frequente
 * (empate: a primeira que apareceu).
 *
 * Devolve os rótulos, na ordem de `comparar` (ou alfabética).
 */
export function opcoesDoCampo<L>(
  linhas: readonly L[] | null | undefined,
  estado: EstadoDosFiltros | null | undefined,
  campo: string,
  opcoes: OpcoesDoFiltro<L> = {},
): string[] {
  const porChave = new Map<string, Map<string, number>>();
  (linhas || []).forEach((linha) => {
    if (!linhaAtende(linha, estado, { ...opcoes, ignorarCampo: campo })) return;
    const valor = valorDoCampo(linha, campo);
    const chave = chaveDeFiltro(valor);
    if (!chave) return;
    let grafias = porChave.get(chave);
    if (!grafias) porChave.set(chave, (grafias = new Map()));
    grafias.set(valor, (grafias.get(valor) || 0) + 1);
  });
  const rotulos = Array.from(porChave.values()).map((grafias) => {
    let melhor = "";
    let maior = 0;
    grafias.forEach((contagem, grafia) => {
      if (contagem > maior) {
        melhor = grafia;
        maior = contagem;
      }
    });
    return melhor;
  });
  const comparar =
    opcoes.comparar ||
    ((a: string, b: string) =>
      a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  return rotulos.sort(comparar);
}

/**
 * Remove, até estabilizar, as seleções que nenhuma opção oferece mais.
 * Uma seleção que sobrevive é reescrita com o rótulo canônico da opção.
 * Altera `estado` no lugar.
 *
 * Devolve se alguma seleção mudou.
 */
export function podarSelecoes<L>(
  linhas: readonly L[] | null | undefined,
  estado: Record<string, Set<string> | undefined>,
  opcoes: OpcoesDoFiltro<L> = {},
): boolean {
  const campos = opcoes.campos || Object.keys(estado || {});
  let mudou = false;
  // Cada volta só pode remover seleções; o limite é uma trava de segurança.
  for (let volta = 0; volta <= campos.length; volta += 1) {
    let mudouNestaVolta = false;
    campos.forEach((campo) => {
      const selecionados = estado[campo];
      if (!selecionados || !selecionados.size) return;
      const disponiveis = new Map(
        opcoesDoCampo(linhas, estado, campo, { ...opcoes, campos }).map(
          (rotulo) => [chaveDeFiltro(rotulo), rotulo],
        ),
      );
      const proximos = new Set<string>();
      selecionados.forEach((valor) => {
        const rotulo = disponiveis.get(chaveDeFiltro(valor));
        if (rotulo) proximos.add(rotulo);
      });
      const iguais =
        proximos.size === selecionados.size &&
        Array.from(proximos).every((v) => selecionados.has(v));
      if (!iguais) {
        estado[campo] = proximos;
        mudouNestaVolta = true;
      }
    });
    if (!mudouNestaVolta) break;
    mudou = true;
  }
  return mudou;
}
