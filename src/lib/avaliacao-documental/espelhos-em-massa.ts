/*
  ESPELHOS DE NOTA EM MASSA (Avaliação documental › Ações da coordenação):
  as regras puras da escolha (vaga, filtro ou lista de códigos colada), da
  ordem dos espelhos no documento e do relato dos códigos sem espelho. Sem DOM
  e sem banco: as fichas vêm de obter_espelhos_de_nota (migration
  20261015180000), em páginas; a montagem de cada espelho é a MESMA do
  individual (src/modulos/avaliacao-documental/ficha/espelho-de-nota.ts).
*/

export type FiltroDosEspelhos = "TODOS" | "INAPTOS" | "APTOS";

export const FILTROS_DOS_ESPELHOS: readonly {
  valor: FiltroDosEspelhos;
  rotulo: string;
}[] = [
  { valor: "TODOS", rotulo: "Todos os concluídos" },
  { valor: "INAPTOS", rotulo: "Só eliminados e inaptos" },
  { valor: "APTOS", rotulo: "Só aptos" },
];

/** Fichas por página (o banco aceita até 200: statement_timeout de 8 s). */
export const FICHAS_POR_PAGINA = 200;
/** Acima disso, a tela avisa antes de gerar (o navegador monta tudo de uma vez). */
export const AVISO_ACIMA_DE = 500;
/** O banco recusa mais que isso numa lista colada. */
export const MAXIMO_DE_CODIGOS = 5000;

/** Uma ficha concluída como obter_espelhos_de_nota a devolve (~1 KB). */
export type FichaDoEspelho = {
  id: string;
  codigo: string | number | null;
  nome: string | null;
  vaga: string | null;
  cargo: string | null;
  modalidade: string | null;
  posicao: number | null;
  art: number | null;
  resultado: string | null;
  nota_final: number | null;
  /** "co_regra:versao": a chave em `regras`. */
  regra: string;
  declarada: Record<string, number | undefined> | null;
  lancamento: Record<string, unknown> | null;
};

export type PaginaDosEspelhos = {
  edital?: { id?: string; rotulo?: string | null; area?: string | null };
  documental?: Record<string, unknown> | null;
  regras?: Record<string, unknown> | null;
  fichas?: FichaDoEspelho[];
  nao_concluidos?: { codigo: string | number; situacao: string }[] | null;
  proximo?: string | null;
};

export type EscolhaDosEspelhos =
  | { modo: "filtro"; vaga: string; filtro: FiltroDosEspelhos }
  | { modo: "codigos"; codigos: string[] };

/**
 * Os códigos colados (separados por vírgula, ponto e vírgula, espaço ou
 * linha), sem repetir e na ordem em que vieram.
 */
export function lerCodigos(texto: string | null | undefined): string[] {
  const vistos = new Set<string>();
  for (const parte of String(texto ?? "").split(/[\s,;]+/)) {
    const codigo = parte.trim();
    if (codigo) vistos.add(codigo);
  }
  return [...vistos];
}

/** Os argumentos de uma página de obter_espelhos_de_nota. */
export function argumentosDaPagina(
  editalId: string,
  escolha: EscolhaDosEspelhos,
  apos: string | null,
  regrasConhecidas: string[],
) {
  const comCodigos = escolha.modo === "codigos";
  return {
    p_edital: editalId,
    p_vagas: !comCodigos && escolha.vaga ? [escolha.vaga] : null,
    p_filtro: comCodigos ? "TODOS" : escolha.filtro,
    p_codigos: comCodigos ? escolha.codigos : null,
    p_apos: apos,
    p_limite: FICHAS_POR_PAGINA,
    p_regras: regrasConhecidas.length ? regrasConhecidas : null,
  };
}

/** A ficha da fila (obter_fila_avaliacao) para a estimativa antes de buscar. */
export type FichaDaFila = {
  vaga?: string | number | null;
  codigo?: string | number | null;
  ficha?: { situacao?: string | null; resultado?: string | null } | null;
};

/** Quantos espelhos a escolha deve gerar, pela fila já carregada (sem ir ao banco). */
export function estimativaDosEspelhos(
  fila: FichaDaFila[],
  escolha: EscolhaDosEspelhos,
): number {
  if (escolha.modo === "codigos") return escolha.codigos.length;
  return fila.filter((c) => {
    if (c.ficha?.situacao !== "CONCLUIDA") return false;
    if (escolha.vaga && String(c.vaga ?? "") !== escolha.vaga) return false;
    if (escolha.filtro === "APTOS") return c.ficha.resultado === "APTO";
    if (escolha.filtro === "INAPTOS") return c.ficha.resultado !== "APTO";
    return true;
  }).length;
}

const GRUPO_DO_RESULTADO: Readonly<Record<string, number>> = {
  APTO: 0,
  INAPTO_NOTA: 1,
  INAPTO_REQUISITO: 2,
};
const numeroOu = (v: unknown, padrao: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : padrao;
const porNome = (a: FichaDoEspelho, b: FichaDoEspelho) =>
  String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR", {
    sensitivity: "base",
  });

/**
 * A ordem dos espelhos no documento. Com a lista colada, a ordem colada.
 * Senão, por vaga e, dentro dela, os aptos pela nota final (maior primeiro;
 * empate pela posição da pré-classificação e pelo nome), depois os inaptos
 * pela nota e por fim os eliminados (inapto por requisito) pelo nome.
 */
export function ordenarParaOsEspelhos(
  fichas: FichaDoEspelho[],
  codigos: string[] | null = null,
): FichaDoEspelho[] {
  if (codigos?.length) {
    const posicao = new Map(codigos.map((c, i) => [c, i]));
    return [...fichas].sort(
      (a, b) =>
        numeroOu(posicao.get(String(a.codigo ?? "")), Infinity) -
          numeroOu(posicao.get(String(b.codigo ?? "")), Infinity) ||
        porNome(a, b),
    );
  }
  return [...fichas].sort((a, b) => {
    const vaga = String(a.vaga ?? "").localeCompare(
      String(b.vaga ?? ""),
      "pt-BR",
      { numeric: true },
    );
    if (vaga) return vaga;
    const ga = GRUPO_DO_RESULTADO[a.resultado ?? ""] ?? 3;
    const gb = GRUPO_DO_RESULTADO[b.resultado ?? ""] ?? 3;
    if (ga !== gb) return ga - gb;
    if (ga === 2) return porNome(a, b);
    return (
      numeroOu(b.nota_final, -Infinity) - numeroOu(a.nota_final, -Infinity) ||
      numeroOu(a.posicao, Infinity) - numeroOu(b.posicao, Infinity) ||
      porNome(a, b)
    );
  });
}

const SITUACOES_SEM_ESPELHO: Readonly<Record<string, string>> = {
  PENDENTE: "pendente",
  EM_ANALISE: "em análise",
  REVISAR: "em revisão",
  FORA_LOTE: "fora do lote",
};

/**
 * Os códigos colados que não viraram espelho: os sem ficha no edital (não
 * encontrados) e os com ficha ainda não concluída (com a situação).
 */
export function codigosSemEspelho(
  codigos: string[],
  fichas: FichaDoEspelho[],
  naoConcluidos: { codigo: string | number; situacao: string }[] = [],
) {
  const comEspelho = new Set(fichas.map((f) => String(f.codigo ?? "")));
  const situacao = new Map(
    naoConcluidos.map((n) => [String(n.codigo), n.situacao]),
  );
  const naoEncontrados: string[] = [];
  const pendentes: { codigo: string; situacao: string }[] = [];
  for (const codigo of codigos) {
    if (comEspelho.has(codigo)) continue;
    const s = situacao.get(codigo);
    if (s)
      pendentes.push({
        codigo,
        situacao: SITUACOES_SEM_ESPELHO[s] ?? s.toLowerCase(),
      });
    else naoEncontrados.push(codigo);
  }
  return { naoEncontrados, naoConcluidos: pendentes };
}

/** "Vai gerar 1.234 páginas; pode demorar." acima do limite; senão, vazio. */
export function avisoDoTamanho(quantos: number): string {
  if (quantos <= AVISO_ACIMA_DE) return "";
  return `Vai gerar ${quantos.toLocaleString("pt-BR")} páginas; pode demorar e pesar no navegador. Se preferir, gere por vaga.`;
}
