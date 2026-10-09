/*
  O "Apurado" dos itens que pontuam na ficha (Formação, Cursos, Experiência,
  critério étnico): de onde ele vem e o que a decisão faz com ele. Só a
  interação; a conta continua a de pontuacao.js (nota_ajustada por cima do
  que os itens lançados dão) e o banco confere o mesmo.

  - Vem do CALCULADO pelos itens registrados (títulos, cursos, vínculos); o
    Declarado não preenche mais o Apurado: o analista registra o que o
    documento comprova. Ajuste à mão (nota_ajustada) fica por cima, com
    justificativa.
  - Não conforme e Não enviado zeram o Apurado (nota_ajustada = 0) e tiram
    as justificativas da nota (o motivo do bloco já explica o zero). Voltar
    para Conforme (ou desmarcar) devolve o Calculado.
  - Com Declarado acima de 0, o Conforme pede ao menos um item completo e
    aceito (faltaDoComprovado, em ficha.js).
*/
import { BLOCOS_COM_ITENS } from "./ficha.js";
import { PARCIAL_DO_TIPO } from "./catalogo.js";
import { notaAjustada } from "./pontuacao.js";

type Situacao = "CONFORME" | "NAO_CONFORME" | "NAO_ENVIADO";
type BlocoQuePontua = { codigo: string; tipo: string };
type BlocoLancado = {
  situacao?: Situacao | null;
  motivos?: string[];
  nota_ajustada?: number | null;
  justificativas?: string[];
  justificativa_livre?: string;
} & Record<string, unknown>;
type LancamentoDaFicha = {
  nivel?: string | null;
  blocos?: Record<string, BlocoLancado | undefined>;
} & Record<string, unknown>;
type Declarada = { parciais?: Record<string, number | undefined> } | null;

export type OrigemDoApurado = "ajustado" | "calculado";

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

/** O Apurado que a tela mostra: o ajuste gravado ou o Calculado pelos itens. */
export function apuradoDoBloco(entrada: {
  bloco: BlocoQuePontua;
  lancamento: LancamentoDaFicha;
  calculado: number;
}): { valor: number; origem: OrigemDoApurado } {
  const ajuste = notaAjustada(
    entrada.lancamento.blocos?.[entrada.bloco.codigo],
  ) as number | null;
  if (ajuste !== null) return { valor: ajuste, origem: "ajustado" };
  return { valor: entrada.calculado, origem: "calculado" };
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
}: {
  bloco: BlocoQuePontua;
  lancamento: LancamentoDaFicha;
  situacao: Situacao | null;
}): BlocoLancado {
  const atual: BlocoLancado = lancamento.blocos?.[bloco.codigo] ?? {};
  const zera = ZERAM.includes(situacao ?? "");
  const novo: BlocoLancado = {
    ...atual,
    situacao,
    motivos: zera ? atual.motivos || [] : [],
  };
  if (!parcialDoBloco(bloco)) return novo;
  if (zera)
    return {
      ...novo,
      nota_ajustada: 0,
      justificativas: [],
      justificativa_livre: "",
    };
  if (apuradoZeradoPelaDecisao(atual)) return { ...novo, nota_ajustada: null };
  return novo;
}

type ParteDaComposicao = {
  bloco: string;
  parcial: string;
  apurado: number | null;
} & Record<string, unknown>;

/**
 * A composição da lateral com a PRÉVIA de cada item ainda sem decisão: o
 * Apurado que o item mostra (apuradoDoBloco: o ajuste ou o Calculado pelos
 * itens), para a nota mudar enquanto o analista registra vínculos, cursos e
 * títulos. Conferido, a prévia é null (vale o apurado).
 */
export function composicaoComPrevias<T extends ParteDaComposicao>(
  partes: T[],
  blocos: BlocoQuePontua[],
  lancamento: LancamentoDaFicha,
  calculados: Record<string, number | undefined> | null | undefined,
): (T & { previa: number | null })[] {
  return partes.map((p) => {
    const bloco = blocos.find((b) => b.codigo === p.bloco);
    if (p.apurado !== null || !bloco) return { ...p, previa: null };
    const calculado = calculados?.[p.parcial] ?? 0;
    return {
      ...p,
      previa: apuradoDoBloco({ bloco, lancamento, calculado }).valor,
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

const semAcento = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * O título que a resposta do candidato indica ("Mestrado" → MESTRADO), entre
 * as opções do nível: o de rótulo mais longo que aparece na resposta (null
 * se nenhum aparece).
 */
export function tituloDaResposta(
  opcoes: { codigo: string; rotulo: string }[],
  respostas: string[],
): string | null {
  const textos = respostas.map(semAcento).filter(Boolean);
  const achados = opcoes
    .filter((o) => {
      const rotulo = semAcento(o.rotulo);
      return rotulo && textos.some((t) => t.includes(rotulo));
    })
    .sort((a, b) => b.rotulo.length - a.rotulo.length);
  return achados[0]?.codigo ?? null;
}

/** Declarado acima de 0 e nenhum item: o cartão já abre com uma linha. */
export function abreComLinhaNova(
  bloco: BlocoQuePontua,
  lancamento: LancamentoDaFicha,
  declarada: Declarada,
): boolean {
  if (!ITENS[bloco.tipo] || temItensLancados(bloco, lancamento)) return false;
  if (ZERAM.includes(String(lancamento.blocos?.[bloco.codigo]?.situacao ?? "")))
    return false;
  const decl = declaradoDoBloco(bloco, declarada);
  return decl !== null && decl > 0;
}
