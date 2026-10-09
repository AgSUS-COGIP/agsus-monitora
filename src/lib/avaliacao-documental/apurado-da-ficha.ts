/*
  O "Apurado" dos itens que pontuam na ficha (Formação, Cursos, Experiência,
  critério étnico): de onde ele começa e o que a decisão faz com ele. Só a
  interação; a conta continua a de pontuacao.js (nota_ajustada por cima do
  que os itens lançados dão) e o banco confere o mesmo.

  - Começa PREENCHIDO: com o ajuste já gravado; senão com o Calculado quando
    há títulos, cursos ou vínculos lançados; senão com o Declarado (limitado
    ao teto). Sem declarada, o Calculado.
  - Conforme sem ajuste grava o valor explícito (nota_ajustada = declarado)
    quando o Apurado vinha do Declarado: na regra, nota_ajustada vazia segue
    o cálculo dos itens (0 sem item), e o "Conforme" quer dizer "o documento
    comprova o declarado".
  - Não conforme e Não enviado zeram o Apurado (nota_ajustada = 0). Voltar
    para Conforme (ou desmarcar) devolve o valor de partida.
  - O primeiro título, curso ou vínculo lançado devolve o Apurado ao
    Calculado quando ele só repetia o Declarado.
*/
import { BLOCOS_COM_ITENS } from "./ficha.js";
import { PARCIAL_DO_TIPO } from "./catalogo.js";
import { notaAjustada, tetoDoBloco } from "./pontuacao.js";

type Situacao = "CONFORME" | "NAO_CONFORME" | "NAO_ENVIADO";
type BlocoQuePontua = { codigo: string; tipo: string };
type BlocoLancado = {
  situacao?: Situacao | null;
  motivos?: string[];
  nota_ajustada?: number | null;
} & Record<string, unknown>;
type LancamentoDaFicha = {
  nivel?: string | null;
  blocos?: Record<string, BlocoLancado | undefined>;
} & Record<string, unknown>;
type Declarada = { parciais?: Record<string, number | undefined> } | null;

export type OrigemDoApurado = "ajustado" | "calculado" | "declarado";

const ZERAM: ReadonlyArray<string> = ["NAO_CONFORME", "NAO_ENVIADO"];
const PARCIAL = PARCIAL_DO_TIPO as Readonly<Record<string, string | undefined>>;
const ITENS = BLOCOS_COM_ITENS as Readonly<Record<string, string | undefined>>;

/** A parcial que o bloco pontua (null nos que não pontuam). */
export function parcialDoBloco(bloco: BlocoQuePontua): string | null {
  return PARCIAL[bloco.tipo] ?? null;
}

/** O bloco tem títulos, cursos ou vínculos lançados? */
export function temItensLancados(
  bloco: BlocoQuePontua,
  lancamento: LancamentoDaFicha,
): boolean {
  const chave = ITENS[bloco.tipo];
  const itens = chave ? lancamento[chave] : null;
  return Array.isArray(itens) && itens.length > 0;
}

/** O declarado da parcial do bloco (null sem nota declarada). */
export function declaradoDoBloco(
  bloco: BlocoQuePontua,
  declarada: Declarada,
): number | null {
  const parcial = parcialDoBloco(bloco);
  const v = parcial ? declarada?.parciais?.[parcial] : undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** O Apurado de partida, sem contar o ajuste gravado. */
export function apuradoDePartida({
  bloco,
  lancamento,
  declarada,
  calculado,
}: {
  bloco: BlocoQuePontua;
  lancamento: LancamentoDaFicha;
  declarada: Declarada;
  calculado: number;
}): { valor: number; origem: Exclude<OrigemDoApurado, "ajustado"> } {
  const decl = declaradoDoBloco(bloco, declarada);
  if (decl === null || temItensLancados(bloco, lancamento))
    return { valor: calculado, origem: "calculado" };
  const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
  return {
    valor: Math.max(0, teto !== null ? Math.min(teto, decl) : decl),
    origem: "declarado",
  };
}

/** O Apurado que a tela mostra: o ajuste gravado ou o de partida. */
export function apuradoDoBloco(entrada: {
  bloco: BlocoQuePontua;
  lancamento: LancamentoDaFicha;
  declarada: Declarada;
  calculado: number;
}): { valor: number; origem: OrigemDoApurado } {
  const ajuste = notaAjustada(
    entrada.lancamento.blocos?.[entrada.bloco.codigo],
  ) as number | null;
  if (ajuste !== null) return { valor: ajuste, origem: "ajustado" };
  return apuradoDePartida(entrada);
}

/** O Apurado foi zerado pela decisão (Não conforme ou Não enviado com 0)? */
export function apuradoZeradoPelaDecisao(lancado: BlocoLancado | undefined) {
  return (
    ZERAM.includes(String(lancado?.situacao ?? "")) &&
    notaAjustada(lancado) === 0
  );
}

/**
 * O bloco lançado depois de uma decisão (Conforme, Não conforme, Não
 * enviado ou desmarcar = null): a situação, os motivos (só nos que pedem) e,
 * nos blocos que pontuam, o Apurado (nota_ajustada) conforme as regras acima.
 */
export function blocoComDecisao({
  bloco,
  lancamento,
  situacao,
  declarada,
  calculado,
}: {
  bloco: BlocoQuePontua;
  lancamento: LancamentoDaFicha;
  situacao: Situacao | null;
  declarada: Declarada;
  calculado: number;
}): BlocoLancado {
  const atual: BlocoLancado = lancamento.blocos?.[bloco.codigo] ?? {};
  const novo: BlocoLancado = {
    ...atual,
    situacao,
    motivos: ZERAM.includes(situacao ?? "") ? atual.motivos || [] : [],
  };
  if (!parcialDoBloco(bloco)) return novo;
  if (situacao && ZERAM.includes(situacao))
    return { ...novo, nota_ajustada: 0 };
  const ajuste = notaAjustada(atual) as number | null;
  const vinhaZerado = apuradoZeradoPelaDecisao(atual);
  if (situacao === "CONFORME" && (ajuste === null || vinhaZerado)) {
    const partida = apuradoDePartida({
      bloco,
      lancamento,
      declarada,
      calculado,
    });
    return {
      ...novo,
      nota_ajustada: partida.origem === "declarado" ? partida.valor : null,
    };
  }
  if (situacao === null && vinhaZerado) return { ...novo, nota_ajustada: null };
  return novo;
}

/**
 * Depois de mexer nos títulos, cursos ou vínculos: no PRIMEIRO item lançado,
 * o Apurado que só repetia o Declarado (o de partida, gravado pelo Conforme)
 * volta a seguir o Calculado (nota_ajustada = null). Um ajuste diferente do
 * declarado fica. Devolve o lançamento (mesmo objeto, alterado).
 */
export function comItensLancados<T extends LancamentoDaFicha>(
  bloco: BlocoQuePontua,
  antes: { tinhaItens: boolean },
  lancamento: T,
  declarada: Declarada,
): T {
  if (antes.tinhaItens || !temItensLancados(bloco, lancamento))
    return lancamento;
  const atual = lancamento.blocos?.[bloco.codigo];
  const ajuste = notaAjustada(atual) as number | null;
  if (ajuste === null || apuradoZeradoPelaDecisao(atual)) return lancamento;
  const partida = apuradoDePartida({
    bloco,
    lancamento: { ...lancamento, [ITENS[bloco.tipo] ?? ""]: [] },
    declarada,
    calculado: 0,
  });
  if (partida.origem === "declarado" && partida.valor === ajuste)
    lancamento.blocos = {
      ...lancamento.blocos,
      [bloco.codigo]: { ...atual, nota_ajustada: null },
    };
  return lancamento;
}

type ParteDaComposicao = {
  bloco: string;
  parcial: string;
  apurado: number | null;
} & Record<string, unknown>;

/**
 * A composição da lateral com a PRÉVIA de cada item ainda sem decisão: o
 * Apurado que o item mostra (apuradoDoBloco: o ajuste, o Calculado pelos
 * itens lançados ou o Declarado), para a nota mudar enquanto o analista lança
 * vínculos, cursos e títulos. Conferido, a prévia é null (vale o apurado).
 */
export function composicaoComPrevias<T extends ParteDaComposicao>(
  partes: T[],
  blocos: BlocoQuePontua[],
  lancamento: LancamentoDaFicha,
  declarada: Declarada,
  calculados: Record<string, number | undefined> | null | undefined,
): (T & { previa: number | null })[] {
  return partes.map((p) => {
    const bloco = blocos.find((b) => b.codigo === p.bloco);
    if (p.apurado !== null || !bloco) return { ...p, previa: null };
    const calculado = calculados?.[p.parcial] ?? 0;
    return {
      ...p,
      previa: apuradoDoBloco({ bloco, lancamento, declarada, calculado }).valor,
    };
  });
}

/** A nota parcial: os apurados dos conferidos mais as prévias dos outros. */
export function notaComPrevias(
  partes: { apurado: number | null; previa?: number | null }[],
): { nota: number; comPrevia: boolean } {
  let nota = 0;
  let comPrevia = false;
  for (const p of partes) {
    if (p.apurado !== null) nota += p.apurado;
    else if (typeof p.previa === "number") {
      nota += p.previa;
      comPrevia = true;
    }
  }
  return { nota: Math.round(nota * 10000) / 10000, comPrevia };
}

const NOME_DOS_ITENS: Record<string, string> = {
  titulos: "títulos",
  cursos: "cursos",
  vinculos: "vínculos",
};

/**
 * O que o Conforme faz no modo foco, num bloco de títulos, cursos ou
 * vínculos: com itens lançados, ou com Declarado 0 (a resposta "Não
 * possuo"), avança como os outros. Declarado acima de 0 e nenhum item: avisa
 * "Lance os cursos comprovados ou ajuste o Apurado" e avança (depois do
 * aviso) se o Apurado está definido — o Conforme grava o pré-preenchido
 * (nota_ajustada), que conta como definido; sem Apurado definido, fica.
 */
export function avancoDoConforme({
  bloco,
  lancamento,
  declarada,
}: {
  bloco: BlocoQuePontua;
  lancamento: LancamentoDaFicha;
  declarada: Declarada;
}): { avanca: boolean; aviso: string | null } {
  const chave = ITENS[bloco.tipo];
  if (!chave || temItensLancados(bloco, lancamento))
    return { avanca: true, aviso: null };
  const decl = declaradoDoBloco(bloco, declarada);
  if (decl !== null && decl <= 0) return { avanca: true, aviso: null };
  const definido = notaAjustada(lancamento.blocos?.[bloco.codigo]) !== null;
  return {
    avanca: definido,
    aviso: `Lance os ${NOME_DOS_ITENS[chave] ?? "itens"} comprovados ou ajuste o Apurado`,
  };
}
