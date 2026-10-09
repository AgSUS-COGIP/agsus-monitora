/*
  A decisão de cada item da ficha e o "Apurado" dos itens que pontuam
  (Titulação, Cursos, Experiência, critério étnico). Só a interação; a conta
  continua a de pontuacao.js (nota_ajustada por cima do que os itens
  lançados dão) e o banco confere o mesmo (FC_PENDENCIAS_FICHA).

  Três escolhas lado a lado, sobre as situações que o banco já conhece:
  - CONFERE (situacao CONFORME): aceita o que o candidato declarou; nos
    blocos que pontuam, a pontuação fica igual ao declarado
    (nota_ajustada = declarado). Com Declarado acima de 0, o registro
    continua exigido (faltaDoComprovado, em ficha.js): a primeira linha já
    abre, com o título da resposta pré-escolhido.
  - NAO_CONFERE (situacao NAO_CONFORME, ou NAO_ENVIADO quando o candidato
    não enviou o documento): só o motivo; pontuação 0 (nota_ajustada = 0) e
    sem justificativa da nota.
  - EDITAR (situacao CONFORME com edita_nota = true; só nos blocos que
    pontuam): o analista registra o que comprovou e a pontuação vem do
    calculado pelos itens; o ajuste fino (nota_ajustada) fica por cima e,
    diferente do declarado, pede justificativa. "Usar o calculado" volta.
  Rascunhos sem edita_nota (antes desta tela): o Apurado igual ao declarado
  (inclusive o Declarado gravado como ajuste) é Confere; diferente, Editar.
*/
import { BLOCOS_COM_ITENS, titulosDoNivel } from "./ficha.js";
import { itensSugeridos } from "./respostas-do-candidato.ts";
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
  edita_nota?: boolean;
} & Record<string, unknown>;
type LancamentoDaFicha = {
  nivel?: string | null;
  blocos?: Record<string, BlocoLancado | undefined>;
} & Record<string, unknown>;
type Declarada = { parciais?: Record<string, number | undefined> } | null;

export type OrigemDoApurado = "ajustado" | "calculado";
export type Escolha = "CONFERE" | "NAO_CONFERE" | "EDITAR";

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

type Item = Record<string, unknown>;
type BlocoComItens = BlocoQuePontua & {
  categorias?: { codigo: string }[];
} & Record<string, unknown>;

/**
 * A linha nova da lista do bloco: o título que a resposta indica (ou o
 * primeiro do nível), o curso sem horas, o vínculo sem datas.
 */
export function novoItemDoBloco(
  bloco: BlocoComItens,
  nivel: string | null | undefined,
  respostas: string[],
): Item | null {
  const chave = ITENS[bloco.tipo];
  if (chave === "titulos") {
    const titulos = titulosDoNivel(bloco, nivel) as {
      codigo: string;
      rotulo: string;
    }[];
    return {
      titulo:
        tituloDaResposta(titulos, respostas) ||
        titulos[0]?.codigo ||
        "ESPECIALIZACAO",
      nome: "",
      aceito: true,
    };
  }
  if (chave === "cursos") return { nome: "", horas: "", aceito: true };
  if (chave === "vinculos")
    return {
      empregador: "",
      categoria: bloco.categorias?.[0]?.codigo,
      inicio: "",
      fim: "",
      aceito: true,
    };
  return null;
}

/**
 * Confere (com Declarado acima de 0) ou Editar nota, e nenhum item: a lista
 * já abre com uma linha.
 */
export function abreComLinhaNova(
  bloco: BlocoQuePontua,
  lancamento: LancamentoDaFicha,
  declarada: Declarada,
): boolean {
  if (!ITENS[bloco.tipo] || temItensLancados(bloco, lancamento)) return false;
  const lancado = lancamento.blocos?.[bloco.codigo];
  if (lancado?.situacao !== "CONFORME") return false;
  if (lancado.edita_nota === true) return true;
  const decl = declaradoDoBloco(bloco, declarada);
  return decl !== null && decl > 0;
}

/**
 * As primeiras linhas da lista: as que o job Python tirou das respostas do
 * candidato (`sugestoes` da ficha, marcadas `da_resposta`); sem elas, uma
 * linha vazia (o título já vem com o nível da resposta).
 */
export function linhasDasRespostas(
  bloco: BlocoComItens,
  nivel: string | null | undefined,
  respostas: string[],
  sugestoes?: unknown,
): Item[] {
  const sugeridos = itensSugeridos(sugestoes, bloco);
  if (sugeridos.length) return sugeridos;
  const vazia = novoItemDoBloco(bloco, nivel, respostas);
  return vazia ? [vazia] : [];
}

/** O lançamento com as primeiras linhas abertas, quando abreComLinhaNova. */
export function comLinhaAberta<T extends LancamentoDaFicha>(
  bloco: BlocoComItens,
  lancamento: T,
  declarada: Declarada,
  respostas: string[],
  sugestoes?: unknown,
): T {
  const chave = ITENS[bloco.tipo];
  if (!chave || !abreComLinhaNova(bloco, lancamento, declarada))
    return lancamento;
  const linhas = linhasDasRespostas(
    bloco,
    lancamento.nivel,
    respostas,
    sugestoes,
  );
  return linhas.length ? { ...lancamento, [chave]: linhas } : lancamento;
}

/** A escolha oferece "Editar nota"? Só nos blocos que pontuam. */
export const blocoEditaNota = (bloco: BlocoQuePontua) =>
  parcialDoBloco(bloco) !== null;

/**
 * A escolha marcada no bloco (null sem decisão). Sem edita_nota gravado
 * (rascunhos de antes), o Apurado igual ao declarado é Confere e diferente
 * é Editar; `calculado` é o que os itens dão.
 */
export function escolhaDoBloco(
  bloco: BlocoQuePontua,
  lancado: BlocoLancado | undefined,
  declarada: Declarada,
  calculado: number | null | undefined,
): Escolha | null {
  const situacao = lancado?.situacao;
  if (!situacao) return null;
  if (ZERAM.includes(situacao)) return "NAO_CONFERE";
  if (!blocoEditaNota(bloco)) return "CONFERE";
  if (typeof lancado?.edita_nota === "boolean")
    return lancado.edita_nota ? "EDITAR" : "CONFERE";
  const decl = declaradoDoBloco(bloco, declarada);
  if (decl === null) return "CONFERE";
  const apurado = notaAjustada(lancado) ?? calculado ?? 0;
  return Math.abs(Number(apurado) - decl) > 1e-4 ? "EDITAR" : "CONFERE";
}

/**
 * O bloco lançado depois de uma escolha (null desmarca). `naoEnviou`: no
 * Não confere, o candidato não enviou o documento (NAO_ENVIADO).
 */
export function blocoComEscolha({
  bloco,
  lancamento,
  escolha,
  declarada,
  naoEnviou = false,
}: {
  bloco: BlocoQuePontua;
  lancamento: LancamentoDaFicha;
  escolha: Escolha | null;
  declarada: Declarada;
  naoEnviou?: boolean;
}): BlocoLancado {
  const atual: BlocoLancado = lancamento.blocos?.[bloco.codigo] ?? {};
  if (escolha === "NAO_CONFERE")
    return blocoComDecisao({
      bloco,
      lancamento,
      situacao: naoEnviou ? "NAO_ENVIADO" : "NAO_CONFORME",
    });
  if (escolha === null) {
    // Desmarcar: sem escolha, sem ajuste (a prévia volta a ser o calculado).
    const { edita_nota: _escolha, ...semEscolha } = blocoComDecisao({
      bloco,
      lancamento,
      situacao: null,
    });
    return blocoEditaNota(bloco)
      ? {
          ...semEscolha,
          nota_ajustada: null,
          justificativas: [],
          justificativa_livre: "",
        }
      : semEscolha;
  }
  const novo = blocoComDecisao({ bloco, lancamento, situacao: "CONFORME" });
  if (!blocoEditaNota(bloco)) return novo;
  if (escolha === "CONFERE")
    return {
      ...novo,
      edita_nota: false,
      nota_ajustada: declaradoDoBloco(bloco, declarada),
      justificativas: [],
      justificativa_livre: "",
    };
  // Editar: a pontuação vem do calculado (o ajuste de quem já editava fica).
  const jaEditava = atual.situacao === "CONFORME" && atual.edita_nota === true;
  return {
    ...novo,
    edita_nota: true,
    nota_ajustada: jaEditava ? (notaAjustada(atual) as number | null) : null,
  };
}

/**
 * O lançamento depois de uma escolha (botões ou teclas 1, 2 e 3): o bloco
 * (blocoComEscolha) e, no Confere ou no Editar sem nada registrado, a
 * primeira linha da lista já aberta.
 */
export function lancamentoComEscolha<T extends LancamentoDaFicha>(entrada: {
  bloco: BlocoComItens;
  lancamento: T;
  escolha: Escolha | null;
  declarada: Declarada;
  respostas: string[];
  naoEnviou?: boolean;
  /** As sugestões da ficha (obter_ficha_analise → sugestoes). */
  sugestoes?: unknown;
}): T {
  const { bloco, lancamento } = entrada;
  const decidido: T = {
    ...lancamento,
    blocos: {
      ...lancamento.blocos,
      [bloco.codigo]: blocoComEscolha(entrada),
    },
  };
  return entrada.escolha === "CONFERE" || entrada.escolha === "EDITAR"
    ? comLinhaAberta(
        bloco,
        decidido,
        entrada.declarada,
        entrada.respostas,
        entrada.sugestoes,
      )
    : decidido;
}
