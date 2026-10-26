/*
  A fila da avaliação documental (aba Fila, fase F3), sem DOM e sem estado:
  as etapas com contadores, os filtros (e o formato dos filtros salvos), a
  reserva ("Em uso por … desde HH:MM"), o que cada ação em lote pode pegar da
  seleção, o plano da distribuição (a conta é de distribuicao.ts, a mesma do
  job Python) e, por aba, as colunas, a ordem por coluna e o CSV. Os dados
  vêm de obter_fila_avaliacao (supabase/migrations/20261006120000_fichas_fila_e_reserva.sql).
*/
import { sanitizeCsvCell } from "../csv-security";
import type { AndamentoDaVaga } from "./andamento-por-vaga.ts";
import type {
  AnalistaDaDistribuicao,
  CriterioDaDistribuicao,
} from "./distribuicao.ts";
import { distribuirFichas } from "./distribuicao.ts";
import type { InscritoDaFila } from "./fila-fora-do-lote.ts";
import {
  DICA_DA_ART,
  ROTULO_CURTO_DA_ART,
  ROTULO_DA_ART,
} from "./tela-da-pre-classificacao.ts";

/* ── Tipos (as linhas de obter_fila_avaliacao) ─────────────────────────── */

/** As abas de etapa da fila (e o valor do filtro "etapa"). */
export type EtapaDaFila =
  | "inscritos"
  | "lote"
  | "pendentes"
  | "em_analise"
  | "revisao"
  | "concluidas"
  | "eliminados";

/** A situação da ficha (TB_FICHA_ANALISE). */
export type SituacaoDaFicha =
  "PENDENTE" | "EM_ANALISE" | "REVISAR" | "CONCLUIDA" | "FORA_LOTE";

/** A reserva de uma ficha como a fila a traz ({ usuario, nome, desde, expira }). */
export interface ReservaNaFila {
  usuario?: string | null;
  nome?: string | null;
  desde?: string | null;
  expira?: string | null;
}

/** A ficha do inscrito na fila (as chaves nulas podem não vir). */
export interface FichaNaFila {
  id?: string;
  versao?: number | null;
  situacao?: string;
  resultado?: string | null;
  responsavel?: string | null;
  responsavel_nome?: string | null;
  atribuida_em?: string | null;
  motivo_saida?: string | null;
  lote?: number | null;
  rascunho_em?: string | null;
  nota_final?: number | string | null;
  motivo_revisao?: string | null;
  concluida_em?: string | null;
  reserva?: ReservaNaFila | null;
  [chave: string]: unknown;
}

/** O inscrito na fila com a ficha que as contas daqui leem. */
export interface InscritoNaFila extends InscritoDaFila {
  nome?: string | null;
  motivo_eliminacao?: string | null;
  motivo_codigo?: string | null;
  lote?: number | null;
  art?: number | string | null;
  nota?: number | string | null;
  entrada?: string | null;
  /** O motivo da decisão da coordenação (só com entrada DECISAO). */
  decisao?: string | null;
  ficha?: FichaNaFila | null;
}

/** O inscrito que tem ficha (com id). */
export type InscritoComFicha = InscritoNaFila & {
  ficha: FichaNaFila & { id: string };
};

/** Uma vaga da fila (dados.vagas), para a ordem e o andamento. */
export interface VagaNaFila {
  codigo: string | number;
  cargo?: string | null;
  lotacao?: string | null;
}

/** O filtro da fila (o que se salva e se lê de volta). */
export interface FiltroDaFila {
  etapa: EtapaDaFila;
  vaga: string;
  responsavel: string;
  modalidade: string;
  busca: string;
}

/** As contas do andamento (do edital ou de uma vaga). */
export interface ContagemDoAndamento {
  lote: number;
  concluidas: number;
  em_analise: number;
  revisao: number;
  pendentes: number;
}

export interface AndamentoDaFila {
  total: ContagemDoAndamento;
  vagas: AndamentoDaVaga[];
}

/** O lote na fila: pela regra e por decisão da coordenação. */
export interface LoteNaFila {
  pelaRegra: number;
  porDecisao: number;
}

export interface ResumoDaVagaNaFila extends LoteNaFila {
  total: number;
  corte: number | null;
}

/** O que cada ação em lote pode pegar da seleção. */
export interface AcoesDaSelecao<T extends InscritoNaFila = InscritoNaFila> {
  distribuir: (T & InscritoComFicha)[];
  liberar: (T & InscritoComFicha)[];
  revisao: (T & InscritoComFicha)[];
}

/** Um analista da equipe do edital (dados.analistas). */
export interface AnalistaDaFila extends AnalistaDaDistribuicao {
  usuario: string;
  nome?: string | null;
}

/** A distribuição da regra do edital (regra.distribuicao). */
export interface DistribuicaoDaRegra {
  criterio?: CriterioDaDistribuicao | string;
  limite_por_analista?: number | null;
}

export interface AtribuicaoNoPlano {
  ficha: string;
  usuario: string | null;
  versao: number | null | undefined;
}

export interface ResumoDoPlano {
  usuario: string;
  nome: string;
  novas: number;
  total: number;
}

export interface PlanoDeDistribuicao {
  atribuicoes: AtribuicaoNoPlano[];
  sobra: string[];
  resumo: ResumoDoPlano[];
  redistribui: boolean;
}

/** Uma coluna da tabela da fila (e do CSV). */
export interface ColunaDaFila {
  rotulo: string;
  rotuloCurto?: string;
  dica?: string;
  numero?: boolean;
  valor: (c: InscritoNaFila) => string | number | null | undefined;
  texto?: (c: InscritoNaFila) => string;
}

export type ChaveDaColuna =
  | "vaga"
  | "posicao"
  | "codigo"
  | "nome"
  | "art"
  | "nota"
  | "situacao"
  | "resultado"
  | "motivo"
  | "motivo_revisao"
  | "responsavel"
  | "reserva"
  | "concluida_em";

export type SentidoDaOrdem = "asc" | "desc";

/** A ordem por coluna: sem chave, a ordem do banco. */
export interface OrdemDaFila {
  chave: string;
  sentido: SentidoDaOrdem | "";
}

/** As abas de etapa, na ordem do funil; cada uma é também um filtro. */
export const ETAPAS_DA_FILA: ReadonlyArray<{
  valor: EtapaDaFila;
  rotulo: string;
}> = Object.freeze([
  { valor: "inscritos", rotulo: "Inscritos" },
  { valor: "lote", rotulo: "No lote" },
  { valor: "pendentes", rotulo: "Pendentes" },
  { valor: "em_analise", rotulo: "Em análise" },
  { valor: "revisao", rotulo: "Em revisão" },
  { valor: "concluidas", rotulo: "Concluídas" },
  { valor: "eliminados", rotulo: "Eliminados" },
]);

export const SITUACOES_DA_FICHA: Readonly<
  Record<string, { rotulo: string; tom: string }>
> = Object.freeze({
  PENDENTE: { rotulo: "Pendente", tom: "pendente" },
  EM_ANALISE: { rotulo: "Em análise", tom: "revisar" },
  REVISAR: { rotulo: "Em revisão", tom: "revisar" },
  CONCLUIDA: { rotulo: "Concluída", tom: "aprovado" },
  FORA_LOTE: { rotulo: "Fora do lote", tom: "reprovado" },
});

const SITUACAO_DA_ETAPA: Readonly<Record<string, SituacaoDaFicha>> = {
  pendentes: "PENDENTE",
  em_analise: "EM_ANALISE",
  revisao: "REVISAR",
  concluidas: "CONCLUIDA",
};
const NO_LOTE: ReadonlySet<unknown> = new Set(["NO_LOTE", "ANALISADO"]);

/** O inscrito está na etapa? */
export function naEtapa(
  c: InscritoNaFila | null | undefined,
  etapa: string | null | undefined,
): boolean {
  if (!c) return false;
  if (etapa === "inscritos" || !etapa) return true;
  if (etapa === "lote") return NO_LOTE.has(c.situacao_pre);
  if (etapa === "eliminados") return c.situacao_pre === "ELIMINADO";
  const situacao = SITUACAO_DA_ETAPA[etapa];
  return Boolean(situacao) && c.ficha?.situacao === situacao;
}

/** Os contadores de cada etapa (as abas do topo). */
export function contadoresDaFila(
  candidatos:
    ReadonlyArray<InscritoNaFila | null | undefined> | null | undefined,
): Record<EtapaDaFila, number> {
  const lista = Array.isArray(candidatos) ? candidatos : [];
  return Object.fromEntries(
    ETAPAS_DA_FILA.map(({ valor }) => [
      valor,
      lista.filter((c) => naEtapa(c, valor)).length,
    ]),
  ) as Record<EtapaDaFila, number>;
}

/** O lote do edital (ou da vaga) na fila: { pelaRegra, porDecisao } (decisão da coordenação). */
export function loteDaFila(
  candidatos: readonly InscritoNaFila[] | null | undefined,
  vaga: string = "",
): LoteNaFila {
  const noLote = (Array.isArray(candidatos) ? candidatos : []).filter(
    (c) =>
      (!vaga || c.vaga === vaga) &&
      (c.situacao_pre === "NO_LOTE" || c.situacao_pre === "ANALISADO"),
  );
  const porDecisao = noLote.filter((c) => c.entrada === "DECISAO").length;
  return { pelaRegra: noLote.length - porDecisao, porDecisao };
}

/* ── Andamento por vaga e agrupamento da tabela ───────────────────────── */

const noLote = (c: InscritoNaFila | null | undefined): boolean =>
  NO_LOTE.has(c?.situacao_pre);

/* A ordem das vagas: a do banco (dados.vagas) e, depois, as que só aparecem nos inscritos. */
function ordemDasVagas(
  candidatos:
    ReadonlyArray<InscritoNaFila | null | undefined> | null | undefined,
  vagas: readonly VagaNaFila[] | null | undefined,
): string[] {
  const codigos = (Array.isArray(vagas) ? vagas : []).map((v) =>
    String(v.codigo),
  );
  for (const c of Array.isArray(candidatos) ? candidatos : [])
    if (c?.vaga && !codigos.includes(String(c.vaga)))
      codigos.push(String(c.vaga));
  return codigos;
}

function contarAndamento(
  lista: readonly InscritoNaFila[],
): ContagemDoAndamento {
  const doLote = lista.filter(noLote);
  const conta = (situacao: SituacaoDaFicha) =>
    doLote.filter((c) => c.ficha?.situacao === situacao).length;
  const concluidas = conta("CONCLUIDA");
  const em_analise = conta("EM_ANALISE");
  const revisao = conta("REVISAR");
  return {
    lote: doLote.length,
    concluidas,
    em_analise,
    revisao,
    // Pendente: ficha na fila ou quem está no lote e ainda não tem ficha.
    pendentes: doLote.length - concluidas - em_analise - revisao,
  };
}

/**
 * O andamento do edital e de cada vaga (o resumo no alto da Fila), contado
 * com a lista já carregada: { total, vagas: [{ codigo, cargo, lotacao, lote,
 * concluidas, em_analise, revisao, pendentes }] }. Só as vagas com lote.
 */
export function andamentoDaFila(
  candidatos: readonly InscritoNaFila[] | null | undefined,
  vagas: readonly VagaNaFila[] | null | undefined = [],
): AndamentoDaFila {
  const lista = Array.isArray(candidatos) ? candidatos : [];
  const cargo: Record<string, string | null | undefined> = Object.fromEntries(
    (Array.isArray(vagas) ? vagas : []).map((v) => [String(v.codigo), v.cargo]),
  );
  const lotacao: Record<string, string | null | undefined> = Object.fromEntries(
    (Array.isArray(vagas) ? vagas : []).map((v) => [
      String(v.codigo),
      v.lotacao,
    ]),
  );
  return {
    total: contarAndamento(lista),
    vagas: ordemDasVagas(lista, vagas)
      .map((codigo) => ({
        codigo,
        cargo: cargo[codigo] || "",
        lotacao: lotacao[codigo] || "",
        ...contarAndamento(lista.filter((c) => String(c.vaga) === codigo)),
      }))
      .filter((v) => v.lote > 0),
  };
}

/** "Enfermeiro · concluídas 3 de 12 · em análise 2 · pendentes 7" (a revisão, quando houver). */
export function textoDoAndamento(
  a: ContagemDoAndamento & { cargo?: string | null },
): string {
  return [
    a.cargo,
    `concluídas ${a.concluidas} de ${a.lote}`,
    `em análise ${a.em_analise}`,
    a.revisao ? `em revisão ${a.revisao}` : "",
    `pendentes ${a.pendentes}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * O cabeçalho do grupo da vaga na tabela: o lote pela regra e por decisão e
 * a linha de corte (a menor nota do lote pela regra — a nota que o lote usou
 * para ordenar, ou a ART; quem entrou por decisão não muda o corte).
 */
export function resumoDaVagaNaFila(
  candidatos: readonly InscritoNaFila[] | null | undefined,
  vaga: string,
): ResumoDaVagaNaFila {
  const { pelaRegra, porDecisao } = loteDaFila(candidatos, vaga);
  const notas = (Array.isArray(candidatos) ? candidatos : [])
    .filter(
      (c) =>
        String(c.vaga) === String(vaga) && noLote(c) && c.entrada !== "DECISAO",
    )
    .map((c) => Number(c.nota ?? c.art))
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    pelaRegra,
    porDecisao,
    total: pelaRegra + porDecisao,
    corte: notas.length ? Math.min(...notas) : null,
  };
}

/** As linhas agrupadas por vaga (na ordem das vagas), mantendo a ordem de cada grupo. */
export function agruparPorVaga<T extends InscritoNaFila>(
  linhas: readonly T[] | null | undefined,
  vagas: readonly VagaNaFila[] | null | undefined = [],
): T[] {
  const lista = Array.isArray(linhas) ? linhas : [];
  const posicao = new Map(
    ordemDasVagas(lista, vagas).map((codigo, i) => [codigo, i]),
  );
  return lista
    .map((c, i): [T, number, number] => [
      c,
      posicao.get(String(c.vaga)) ?? Infinity,
      i,
    ])
    .sort(([, a, i], [, b, j]) => a - b || i - j)
    .map(([c]) => c);
}

export const FILTRO_INICIAL: Readonly<FiltroDaFila> = Object.freeze({
  etapa: "lote",
  vaga: "",
  responsavel: "",
  modalidade: "",
  busca: "",
});

const ETAPAS_VALIDAS: ReadonlySet<unknown> = new Set(
  ETAPAS_DA_FILA.map((e) => e.valor),
);
const textoCurto = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * O filtro só com as chaves conhecidas (é o que se salva e o que se lê de
 * volta do banco ou do navegador). responsavel: "" (todos), "eu", "ninguem"
 * ou o id de um analista.
 */
export function normalizarFiltro(filtro: unknown): FiltroDaFila {
  const f: Record<string, unknown> =
    filtro && typeof filtro === "object"
      ? (filtro as Record<string, unknown>)
      : {};
  return {
    etapa: ETAPAS_VALIDAS.has(f.etapa)
      ? (f.etapa as EtapaDaFila)
      : FILTRO_INICIAL.etapa,
    vaga: textoCurto(f.vaga, 20),
    responsavel: textoCurto(f.responsavel, 40),
    modalidade: textoCurto(f.modalidade, 10),
    busca: textoCurto(f.busca, 80),
  };
}

const semAcento = (texto: unknown): string =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .trim();

/** Os inscritos que passam pelo filtro (eu = o id de quem está logado). */
export function filtrarFila<T extends InscritoNaFila>(
  candidatos: readonly T[] | null | undefined,
  filtro: unknown,
  eu = "",
): T[] {
  const f = normalizarFiltro(filtro);
  const busca = semAcento(f.busca);
  return (Array.isArray(candidatos) ? candidatos : []).filter((c) => {
    if (!naEtapa(c, f.etapa)) return false;
    if (f.vaga && String(c.vaga) !== f.vaga) return false;
    if (f.modalidade && c.modalidade !== f.modalidade) return false;
    const responsavel = c.ficha?.responsavel || "";
    if (f.responsavel === "eu" && (!eu || responsavel !== eu)) return false;
    if (f.responsavel === "ninguem" && (!c.ficha || responsavel)) return false;
    if (
      f.responsavel &&
      f.responsavel !== "eu" &&
      f.responsavel !== "ninguem" &&
      responsavel !== f.responsavel
    )
      return false;
    if (
      busca &&
      !semAcento(c.codigo).includes(busca) &&
      !semAcento(c.nome).includes(busca)
    )
      return false;
    return true;
  });
}

/** O filtro é o inicial (nada a limpar)? */
export const filtroEhInicial = (filtro: unknown): boolean =>
  JSON.stringify(normalizarFiltro(filtro)) === JSON.stringify(FILTRO_INICIAL);

/** AM-6.4: o código digitado abre direto a ficha (um inscrito com ficha e esse código). */
export function fichaPeloCodigo<T extends InscritoNaFila>(
  candidatos: readonly T[] | null | undefined,
  texto: unknown,
): (T & InscritoComFicha) | null {
  const codigo = String(texto ?? "").trim();
  if (!codigo) return null;
  const achados = (Array.isArray(candidatos) ? candidatos : []).filter(
    (c) => c.ficha?.id && String(c.codigo) === codigo,
  ) as (T & InscritoComFicha)[];
  return achados.length === 1 ? achados[0]! : null;
}

/** A reserva ainda vale? */
export function reservaVigente(
  reserva: ReservaNaFila | null | undefined,
  agora: Date = new Date(),
): reserva is ReservaNaFila {
  if (!reserva?.expira) return false;
  const fim = new Date(reserva.expira);
  return !Number.isNaN(fim.getTime()) && fim > agora;
}

const hora = (iso: string | null | undefined): string => {
  // Sem data, Invalid Date (como no JS): o cast só cala o null.
  const d = new Date(iso as string);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

/** "Em uso por Ana desde 14:05" (AM-12.2) ou "Com você até 14:20"; "" sem reserva vigente. */
export function textoDaReserva(
  reserva: ReservaNaFila | null | undefined,
  eu = "",
  agora: Date = new Date(),
): string {
  if (!reservaVigente(reserva, agora)) return "";
  if (eu && reserva.usuario === eu)
    return `Com você até ${hora(reserva.expira)}`;
  return `Em uso por ${reserva.nome || "outra pessoa"} desde ${hora(reserva.desde)}`;
}

/** O que cada ação em lote da coordenação pode pegar da seleção (inscritos com ficha). */
export function acoesDaSelecao<T extends InscritoNaFila>(
  selecionados: readonly (T | null | undefined)[] | null | undefined,
  agora: Date = new Date(),
): AcoesDaSelecao<T> {
  const fichas = (Array.isArray(selecionados) ? selecionados : []).filter(
    (c) => c?.ficha?.id,
  ) as (T & InscritoComFicha)[];
  return {
    distribuir: fichas.filter(
      (c) =>
        !(["CONCLUIDA", "FORA_LOTE"] as unknown[]).includes(c.ficha.situacao),
    ),
    liberar: fichas.filter((c) => reservaVigente(c.ficha.reserva, agora)),
    revisao: fichas.filter((c) =>
      (["PENDENTE", "EM_ANALISE"] as unknown[]).includes(c.ficha.situacao),
    ),
  };
}

const ordemDaProvisoria = (a: InscritoComFicha, b: InscritoComFicha): number =>
  (a.posicao ?? Infinity) - (b.posicao ?? Infinity) ||
  String(a.vaga).localeCompare(String(b.vaga)) ||
  String(a.ficha.id).localeCompare(String(b.ficha.id));

/**
 * O plano da distribuição das fichas escolhidas (a prévia antes de gravar,
 * AM-6.2). As fichas escolhidas saem da carga de quem as tem hoje e voltam a
 * ser distribuídas na ordem da Provisória pela regra do edital.
 *   para: "" = distribuir entre a equipe; "fila" = devolver à fila; ou o id
 *         de um analista (todas para ele).
 * Devolve { atribuicoes: [{ ficha, versao, usuario }], sobra: [ids],
 *   resumo: [{ usuario, nome, novas, total }], redistribui: boolean }.
 */
export function planoDeDistribuicao(
  selecionados:
    readonly (InscritoNaFila | null | undefined)[] | null | undefined,
  analistas: readonly AnalistaDaFila[] | null | undefined,
  distribuicao: DistribuicaoDaRegra | null = {},
  para = "",
): PlanoDeDistribuicao {
  // A regra gravada sem distribuição vem null do banco: vale como vazia.
  const regra = distribuicao ?? {};
  const fichas = (
    (Array.isArray(selecionados) ? selecionados : []).filter(
      (c) => c?.ficha?.id,
    ) as InscritoComFicha[]
  ).sort(ordemDaProvisoria);
  const equipe = Array.isArray(analistas) ? analistas : [];
  const saindo: Record<string, number> = {};
  for (const c of fichas)
    if (
      c.ficha.responsavel &&
      (["PENDENTE", "EM_ANALISE"] as unknown[]).includes(c.ficha.situacao)
    )
      saindo[c.ficha.responsavel] = (saindo[c.ficha.responsavel] ?? 0) + 1;
  const redistribui = fichas.some((c) => c.ficha.responsavel);
  const versao: Record<string, number | null | undefined> = Object.fromEntries(
    fichas.map((c) => [c.ficha.id, c.ficha.versao]),
  );

  let atribuicoes: { ficha: string; usuario: string | null }[];
  let sobra: string[] = [];
  if (para === "fila") {
    atribuicoes = fichas.map((c) => ({ ficha: c.ficha.id, usuario: null }));
  } else {
    const r = distribuirFichas({
      fichas: fichas.map((c) => ({ id: c.ficha.id, vaga: c.vaga })),
      analistas: equipe
        .filter((a) => !para || a.usuario === para)
        .map((a) => ({
          ...a,
          pendentes: Math.max(0, (a.pendentes ?? 0) - (saindo[a.usuario] ?? 0)),
        })),
      criterio: para ? "PARTES_IGUAIS" : regra.criterio,
      limite_por_analista: para ? null : regra.limite_por_analista,
    });
    atribuicoes = r.atribuicoes;
    sobra = r.sobra;
  }
  const novas: Record<string, number> = {};
  for (const a of atribuicoes)
    if (a.usuario) novas[a.usuario] = (novas[a.usuario] ?? 0) + 1;
  const resumo = equipe
    .filter((a) => novas[a.usuario])
    .map((a) => ({
      usuario: a.usuario,
      nome: a.nome || "",
      // Só quem recebeu fichas (o filtro acima).
      novas: novas[a.usuario]!,
      total:
        Math.max(0, (a.pendentes ?? 0) - (saindo[a.usuario] ?? 0)) +
        novas[a.usuario]!,
    }));
  return {
    atribuicoes: atribuicoes.map((a) => ({ ...a, versao: versao[a.ficha] })),
    sobra,
    resumo,
    redistribui,
  };
}

/* ── Colunas de cada aba, ordenação e CSV ─────────────────────────────── */

const ROTULO_DA_PRE: Readonly<Record<string, string>> = {
  ELIMINADO: "Eliminado",
  RANQUEADO: "Fora do lote",
  NO_LOTE: "No lote",
  ANALISADO: "No lote",
};
const RESULTADO_DA_FICHA: Readonly<Record<string, string>> = {
  APTO: "Apto",
  INAPTO_REQUISITO: "Inapto (requisito)",
  INAPTO_NOTA: "Inapto (nota mínima)",
};

const numeroBR = (valor: unknown): string => {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : "";
};
const dataHoraBR = (iso: string | null | undefined): string => {
  const d = new Date(iso ?? "");
  return iso && !Number.isNaN(d.getTime())
    ? d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";
};

/** A situação da linha em texto ("Pendente", "Apto", "Fora do lote · sem ficha"). */
export function textoDaSituacaoNaFila(
  c: InscritoNaFila | null | undefined,
): string {
  if (c?.ficha?.situacao === "CONCLUIDA" && c.ficha.resultado)
    return RESULTADO_DA_FICHA[c.ficha.resultado] || c.ficha.resultado;
  if (c?.ficha)
    return (
      SITUACOES_DA_FICHA[c.ficha.situacao as string]?.rotulo ||
      String(c.ficha.situacao ?? "")
    );
  const rotulo =
    ROTULO_DA_PRE[c?.situacao_pre as string] || c?.situacao_pre || "";
  return c?.situacao_pre === "NO_LOTE" ? `${rotulo} · sem ficha` : rotulo;
}

/*
  As colunas: chave, rótulo (o do CSV; rotuloCurto na tela, com a dica), o
  valor para ordenar e o texto (tela e CSV).
  `numero`: alinha à direita e ordena como número.
*/
export const COLUNAS_DA_FILA: Readonly<Record<ChaveDaColuna, ColunaDaFila>> =
  Object.freeze({
    vaga: { rotulo: "Vaga", valor: (c) => String(c.vaga ?? "") },
    posicao: {
      rotulo: "Posição",
      numero: true,
      valor: (c) => (Number.isFinite(c.posicao) ? c.posicao : null),
      texto: (c) => (Number.isFinite(c.posicao) ? `${c.posicao}º` : ""),
    },
    codigo: { rotulo: "Código", valor: (c) => String(c.codigo ?? "") },
    nome: { rotulo: "Nome", valor: (c) => String(c.nome ?? "") },
    art: {
      rotulo: ROTULO_DA_ART,
      rotuloCurto: ROTULO_CURTO_DA_ART,
      dica: DICA_DA_ART,
      numero: true,
      valor: (c) =>
        c.art === null || c.art === undefined || c.art === ""
          ? null
          : Number(c.art),
      texto: (c) => numeroBR(c.art),
    },
    nota: {
      rotulo: "Nota",
      numero: true,
      valor: (c) =>
        c.ficha?.nota_final === null || c.ficha?.nota_final === undefined
          ? null
          : Number(c.ficha.nota_final),
      texto: (c) => numeroBR(c.ficha?.nota_final),
    },
    situacao: { rotulo: "Situação", valor: textoDaSituacaoNaFila },
    resultado: { rotulo: "Resultado", valor: textoDaSituacaoNaFila },
    motivo: {
      rotulo: "Motivo da eliminação",
      valor: (c) => String(c.motivo_eliminacao ?? "").trim(),
    },
    // O último motivo de "Mandar para revisão" (a coordenação ou a conferência
    // automática da ficha concluída que ficou com pendência: FC_LINHAS_DA_FILA).
    motivo_revisao: {
      rotulo: "Motivo da revisão",
      valor: (c) => String(c.ficha?.motivo_revisao ?? "").trim(),
    },
    responsavel: {
      rotulo: "Responsável",
      valor: (c) => String(c.ficha?.responsavel_nome ?? ""),
    },
    reserva: {
      rotulo: "Reserva",
      valor: (c) => String(c.ficha?.reserva?.expira ?? ""),
    },
    concluida_em: {
      rotulo: "Concluída em",
      valor: (c) => String(c.ficha?.concluida_em ?? ""),
      texto: (c) => dataHoraBR(c.ficha?.concluida_em),
    },
  });

const COLUNAS_DA_ETAPA: Readonly<
  Record<EtapaDaFila, readonly ChaveDaColuna[]>
> = Object.freeze({
  inscritos: [
    "vaga",
    "posicao",
    "codigo",
    "nome",
    "art",
    "situacao",
    "responsavel",
    "reserva",
  ],
  lote: [
    "vaga",
    "posicao",
    "codigo",
    "nome",
    "art",
    "situacao",
    "responsavel",
    "reserva",
  ],
  pendentes: [
    "vaga",
    "posicao",
    "codigo",
    "nome",
    "art",
    "responsavel",
    "reserva",
  ],
  em_analise: [
    "vaga",
    "posicao",
    "codigo",
    "nome",
    "art",
    "responsavel",
    "reserva",
  ],
  revisao: [
    "vaga",
    "posicao",
    "codigo",
    "nome",
    "art",
    "motivo_revisao",
    "responsavel",
    "reserva",
  ],
  concluidas: [
    "vaga",
    "codigo",
    "nome",
    "nota",
    "resultado",
    "responsavel",
    "concluida_em",
  ],
  eliminados: ["codigo", "nome", "vaga", "motivo", "art"],
});

/** As chaves das colunas da aba (Eliminados: código, nome, vaga, motivo e ART; …). */
export function colunasDaEtapa(
  etapa: string | null | undefined,
): readonly ChaveDaColuna[] {
  return (
    (
      COLUNAS_DA_ETAPA as Readonly<
        Record<string, readonly ChaveDaColuna[] | undefined>
      >
    )[etapa as string] || COLUNAS_DA_ETAPA.inscritos
  );
}

/** O texto da célula (o mesmo da tela e do CSV); "" quando não há valor. */
export function textoDaColuna(
  c: InscritoNaFila,
  chave: string,
  eu = "",
  agora: Date = new Date(),
): string {
  if (chave === "reserva") return textoDaReserva(c?.ficha?.reserva, eu, agora);
  /* A coluna pela chave (texto qualquer: a de fora some). */
  const coluna = (
    COLUNAS_DA_FILA as Readonly<Record<string, ColunaDaFila | undefined>>
  )[chave];
  if (!coluna) return "";
  return String((coluna.texto ?? coluna.valor)(c) ?? "");
}

const comparador = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

/**
 * A lista na ordem da coluna: ordem = { chave, sentido: "asc" | "desc" };
 * sem chave, a ordem do banco (vaga, posição). Vazio vai sempre para o fim.
 */
export function ordenarFila<T extends InscritoNaFila>(
  linhas: T[] | null | undefined,
  ordem: Partial<OrdemDaFila> | null | undefined,
): T[] {
  const lista = Array.isArray(linhas) ? linhas : [];
  const coluna = (
    COLUNAS_DA_FILA as Readonly<Record<string, ColunaDaFila | undefined>>
  )[ordem?.chave as string];
  if (!coluna || !(["asc", "desc"] as unknown[]).includes(ordem?.sentido))
    return lista;
  const sinal = ordem!.sentido === "desc" ? -1 : 1;
  const vazio = (v: unknown) => v === null || v === undefined || v === "";
  return lista
    .map((c, i): [T, ReturnType<ColunaDaFila["valor"]>, number] => [
      c,
      coluna.valor(c),
      i,
    ])
    .sort(([, a, i], [, b, j]) => {
      if (vazio(a) || vazio(b))
        return vazio(a) === vazio(b) ? i - j : vazio(a) ? 1 : -1;
      // Coluna de número dá número; as outras, texto.
      const r = coluna.numero
        ? (a as number) - (b as number)
        : comparador.compare(a as string, b as string);
      return r ? r * sinal : i - j;
    })
    .map(([c]) => c);
}

/** O próximo sentido ao clicar no cabeçalho: asc → desc → sem ordem. */
export function proximaOrdem(
  ordem: Partial<OrdemDaFila> | null | undefined,
  chave: string,
): OrdemDaFila {
  if (ordem?.chave !== chave) return { chave, sentido: "asc" };
  if (ordem!.sentido === "asc") return { chave, sentido: "desc" };
  return { chave: "", sentido: "" };
}

/** CSV (";", BOM, CRLF) da aba, nas colunas da aba e com cada célula protegida contra fórmula. */
export function csvDaFila(
  linhas: readonly InscritoNaFila[] | null | undefined,
  etapa: string | null | undefined,
  eu = "",
  agora: Date = new Date(),
): string {
  const chaves = colunasDaEtapa(etapa);
  const celula = (valor: unknown): string => {
    const seguro = sanitizeCsvCell(valor ?? "");
    return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  const conteudo = [
    chaves.map((k) => celula(COLUNAS_DA_FILA[k].rotulo)).join(";"),
    ...(Array.isArray(linhas) ? linhas : []).map((c) =>
      chaves.map((k) => celula(textoDaColuna(c, k, eu, agora))).join(";"),
    ),
  ];
  return `\uFEFF${conteudo.join("\r\n")}\r\n`;
}

/** "fila-93-2026-eliminados-2026-10-06.csv". */
export function nomeDoCsvDaFila(
  edital: unknown,
  etapa: string | null | undefined,
  agora: Date = new Date(),
): string {
  const base =
    String(edital ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036F]/g, "")
      .replace(/[^0-9A-Za-z]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "edital";
  const dois = (n: number) => String(n).padStart(2, "0");
  return `fila-${base}-${etapa || "inscritos"}-${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}.csv`;
}
