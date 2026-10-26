/*
  A aba Pré-classificação sem DOM: contadores, vagas com os inscritos em
  ordem, tamanho sugerido do lote (prévia pela mesma conta do job), os lotes
  a publicar e os rótulos dos avisos e das situações. Sem estado.

  Os dados vêm de obter_pre_classificacao
  (supabase/migrations/20261006110000_pre_classificacao_e_lote.sql): o
  resultado que o job Python gravou. Aqui não se recalcula ninguém.
*/
import { normalizarRegraAnalise } from "./regra.ts";
import {
  PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA,
  PREFIXO_DO_AVISO_DE_SEM_NIVEL,
  tamanhoDoLote,
} from "./pre-classificacao.ts";
import type { TamanhoDoLote } from "./pre-classificacao.ts";
import type {
  CandidatoParaDecidir,
  DadosDaPreClassificacao,
  InscritoComDecisao,
  InscritoDaPre,
  VagaDaPre,
  VagaDaTela,
} from "../../modulos/avaliacao-documental/tipos-da-pre-classificacao.ts";

/** A regra (DS_CONFIGURACAO) vista só pelo lote: o resto não se lê aqui. */
export interface ConfiguracaoComLote {
  lote?: { por_vaga?: unknown; [chave: string]: unknown } | null;
  [chave: string]: unknown;
}

/** O que diz se o candidato pode entrar por decisão (pré-classificação ou fila). */
export interface SituacaoParaDecidir {
  situacao?: string | null;
  situacao_pre?: string | null;
  motivo_codigo?: string | null;
}

const lista: {
  <T>(v: readonly T[] | null | undefined): readonly T[];
  (v: unknown): readonly unknown[];
} = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);
const numero = (v: unknown): number =>
  Number.isFinite(Number(v)) ? Number(v) : 0;
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** O que cada aviso de vaga quer dizer (códigos gravados pelo job). */
export const AVISOS_DA_VAGA = Object.freeze({
  SEM_QUADRO: "Sem quadro de vagas: defina o tamanho do lote da vaga.",
  SEM_VAGAS: "Vaga sem vagas imediatas nem cadastro reserva.",
  SEM_NOTA_MINIMA: "Lote pela nota mínima sem a nota: informe-a na regra.",
  QUADRO_SEM_MODALIDADES: "Quadro sem vagas por modalidade: o lote saiu geral.",
  ART_AUSENTE:
    "Inscrito sem ART no arquivo: vale a nota recalculada pela regra.",
  SEM_DECLARADA_COMPLETA:
    "Inscrito sem nota declarada completa: o lote usou a ART dele. Confira a nota declarada na regra.",
  LINHA_PARADA: "Lugar aberto no lote: a regra não repõe.",
  FORA_DO_LOTE_ACIMA_DO_CORTE: "Fora do lote com nota acima da linha de corte.",
  LOTE_ACIMA_DO_TAMANHO: "Lote maior que o tamanho de agora.",
  REFAZER_RECUSADO: "O lote não foi refeito: já há fichas iniciadas.",
  DECISAO_SAIU_DA_EMPREGARE:
    "Candidato com decisão da coordenação saiu do arquivo da Empregare: ficou fora do lote. Revogue a decisão.",
});

/*
  Inclusão no lote por decisão da coordenação (TB_DECISAO_LOTE,
  supabase/migrations/20261007200000_inclusao_no_lote_por_decisao.sql): o
  candidato entra com a entrada DECISAO e o motivo; não conta para o tamanho
  do lote pela regra.
*/
export const ENTRADA_POR_DECISAO = "DECISAO";
export const MOTIVO_SUGERIDO_DA_DECISAO = "Critério CORES";
export const MOTIVO_DA_DECISAO = Object.freeze({ minimo: 5, maximo: 250 });
export const MOTIVO_DA_REVOGACAO = Object.freeze({ minimo: 10, maximo: 250 });

/** Entrou no lote por decisão da coordenação. */
export const entrouPorDecisao = (
  c: Pick<InscritoComDecisao, "entrada"> | null | undefined,
): boolean => c?.entrada === ENTRADA_POR_DECISAO;

/** O motivo da decisão do candidato (da pré-classificação ou da fila), ou "". */
export function motivoDaDecisao(
  c: InscritoComDecisao | null | undefined,
): string {
  if (!entrouPorDecisao(c)) return "";
  const motivo =
    typeof c?.decisao === "string"
      ? c.decisao
      : (c?.decisao?.motivo ?? c?.motivo_entrada);
  return String(motivo ?? "").trim();
}

/** "Decisão: Critério CORES" (o selo nas listas e na ficha), ou "". */
export function seloDaDecisao(
  c: InscritoComDecisao | null | undefined,
): string {
  const motivo = motivoDaDecisao(c);
  return motivo ? `Decisão: ${motivo}` : "";
}

/** O motivo serve? Devolve o erro ("" quando serve). */
export function erroDoMotivo(
  motivo: unknown,
  { minimo, maximo }: { minimo: number; maximo: number },
): string {
  const n = String(motivo ?? "").trim().length;
  if (n < minimo) return `Diga o motivo (pelo menos ${minimo} caracteres).`;
  if (n > maximo) return `O motivo tem no máximo ${maximo} caracteres.`;
  return "";
}

/** Pode ser incluído por decisão: fora do lote pela regra (e não saiu da Empregare). */
export const podeIncluirPorDecisao = (
  c: SituacaoParaDecidir | null | undefined,
): boolean =>
  (c?.situacao ?? c?.situacao_pre) === "RANQUEADO" ||
  ((c?.situacao ?? c?.situacao_pre) === "ELIMINADO" &&
    c?.motivo_codigo !== "SAIU_DA_EMPREGARE");

/** Os candidatos escolhidos agrupados por vaga (uma chamada ao banco por vaga): [{ vaga, codigos }]. */
export function codigosPorVaga(
  candidatos: readonly CandidatoParaDecidir[] | null | undefined,
): { vaga: string | null; codigos: string[] }[] {
  const grupos = new Map<string, string[]>();
  for (const c of lista(candidatos)) {
    const codigo = String(c?.codigo ?? "").trim();
    if (!codigo) continue;
    const vaga = c?.vaga ? String(c.vaga) : "";
    if (!grupos.has(vaga)) grupos.set(vaga, []);
    // O grupo da vaga acabou de ser garantido.
    if (!grupos.get(vaga)!.includes(codigo)) grupos.get(vaga)!.push(codigo);
  }
  return [...grupos.entries()].map(([vaga, codigos]) => ({
    vaga: vaga || null,
    codigos,
  }));
}

/** "Lote: 11 pela regra + 6 por decisão" (sem decisão: "Lote: 11"). */
export function textoDoLote(
  pelaRegra: unknown,
  porDecisao: unknown,
  tamanho: number | null | undefined = null,
): string {
  const regra = `${numero(pelaRegra)}${tamanho === null || tamanho === undefined ? "" : ` de ${tamanho}`}`;
  return numero(porDecisao)
    ? `Lote: ${regra} pela regra + ${numero(porDecisao)} por decisão`
    : `Lote: ${regra}`;
}

/** O lote da vaga pela regra e por decisão (do banco; sem os campos, conta os inscritos). */
export function loteDaVaga(
  v: VagaDaPre | null | undefined,
  candidatos: readonly InscritoDaPre[] | null | undefined = [],
): { pelaRegra: number; porDecisao: number } {
  const daVaga = lista(candidatos).filter(
    (c) =>
      c.vaga === v?.codigo &&
      (c.situacao === "NO_LOTE" || c.situacao === "ANALISADO"),
  );
  const porDecisao =
    v?.no_lote_decisao ?? daVaga.filter((c) => entrouPorDecisao(c)).length;
  const pelaRegra = v?.no_lote_regra ?? numero(v?.no_lote) - porDecisao;
  return { pelaRegra: numero(pelaRegra), porDecisao: numero(porDecisao) };
}

export function textoDoAviso(codigo: unknown): string {
  const c = String(codigo ?? "");
  if (c.startsWith("COLUNA_AUSENTE:"))
    return `A coluna da regra ${c.slice(15)} não veio no arquivo.`;
  if (c.startsWith(PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA))
    return `${perguntaDoAviso(c.slice(PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA.length))} casa com mais de uma coluna do arquivo: na regra, use um começo de enunciado que só ela tenha.`;
  if (c.startsWith(PREFIXO_DO_AVISO_DE_SEM_NIVEL))
    return `${perguntaDoAviso(c.slice(PREFIXO_DO_AVISO_DE_SEM_NIVEL.length))} pontua por nível, e o nível da vaga não foi identificado (ou não tem pontos na regra): ficou fora da nota declarada e da conferência com a ART.`;
  return (
    (AVISOS_DA_VAGA as Readonly<Record<string, string | undefined>>)[c] ?? c
  );
}

function perguntaDoAviso(origem: string): string {
  if (origem === "MODALIDADE") return "A pergunta do sistema de concorrência";
  if (origem === "EXPERIENCIA_DECLARADA")
    return "A pergunta de experiência do desempate";
  if (origem.startsWith("NOTA_"))
    return `A pergunta da nota declarada ${origem.slice(5)}`;
  return `A pergunta da eliminação ${origem}`;
}

/** Por que a última execução não tratou o edital (situação gravada pelo job). */
export const SITUACOES_DO_EDITAL = Object.freeze({
  SEM_REGRA:
    "Edital sem regra conferida: crie a regra e marque como conferida.",
  REGRA_NAO_CONFERIDA:
    "Edital sem regra conferida: marque a regra como conferida e recalcule.",
  SEM_VAGAS: "Nenhuma vaga da Empregare no edital: rode o robô.",
  FALHOU: "A última pré-classificação deste edital falhou.",
});

export const ROTULOS_DA_SITUACAO = Object.freeze({
  ELIMINADO: "Eliminado",
  RANQUEADO: "Fora do lote",
  NO_LOTE: "No lote",
  ANALISADO: "Analisado",
});

/** A faixa de contadores (AM-4.4). */
export function contadoresDaPreClassificacao(
  dados: DadosDaPreClassificacao | null | undefined,
) {
  const vagas = lista(dados?.vagas);
  const conta = (campo: string) =>
    vagas.reduce((s, v) => s + numero(v?.[campo]), 0);
  // "N de M": M soma o tamanho das vagas já pré-classificadas; vaga sem
  // tamanho (sem quadro) deixa o total em aberto.
  const tamanhos = vagas
    .filter((v) => v?.inscritos !== null && v?.inscritos !== undefined)
    .map((v) => v?.tamanho);
  const lotes = vagas.map((v) => loteDaVaga(v, dados?.candidatos));
  return {
    inscritos: conta("inscritos"),
    eliminados: conta("eliminados"),
    ranqueados: conta("ranqueados"),
    noLote: conta("no_lote"),
    noLotePelaRegra: lotes.reduce((s, l) => s + l.pelaRegra, 0),
    noLotePorDecisao: lotes.reduce((s, l) => s + l.porDecisao, 0),
    tamanho:
      !tamanhos.length || tamanhos.some((t) => t === null || t === undefined)
        ? null
        : tamanhos.reduce((s: number, t) => s + numero(t), 0),
    divergencias: conta("divergencias"),
    vagasSemPreClassificacao: vagas.filter(
      (v) => v?.inscritos === null || v?.inscritos === undefined,
    ).length,
  };
}

const porPosicao = (a: InscritoDaPre, b: InscritoDaPre): number =>
  (a.posicao ?? Infinity) - (b.posicao ?? Infinity) ||
  String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""));

/** As vagas com os inscritos separados: no lote, fora do lote e eliminados. */
export function vagasDaTela(
  dados: DadosDaPreClassificacao | null | undefined,
): VagaDaTela[] {
  const candidatos = lista(dados?.candidatos);
  return lista(dados?.vagas).map((v) => {
    const daVaga = candidatos.filter((c) => c.vaga === v.codigo);
    return {
      ...v,
      lote: daVaga
        .filter((c) => c.situacao === "NO_LOTE" || c.situacao === "ANALISADO")
        .sort(porPosicao),
      fora: daVaga.filter((c) => c.situacao === "RANQUEADO").sort(porPosicao),
      eliminados: daVaga
        .filter((c) => c.situacao === "ELIMINADO")
        .sort((a, b) =>
          String(a.codigo ?? "").localeCompare(String(b.codigo ?? "")),
        ),
    };
  });
}

/** O tamanho que a regra sugere para a vaga (sem o definido à mão). */
export function tamanhoSugerido(
  configuracao: unknown,
  vaga: VagaDaPre | null | undefined,
): TamanhoDoLote {
  const regra = normalizarRegraAnalise(configuracao);
  const { por_vaga: _porVaga, ...lote } = regra.lote;
  return tamanhoDoLote(lote, {
    codigo: vaga?.codigo,
    vagas_imediatas: vaga?.vagas_imediatas ?? null,
    cadastro_reserva: Boolean(vaga?.cadastro_reserva),
    modalidades: vaga?.modalidades ?? null,
  });
}

/** O tamanho definido à mão para a vaga (lote.por_vaga), ou null. */
export function tamanhoDefinido(
  configuracao: unknown,
  codigo: unknown,
): number | null {
  const porVaga = (configuracao as ConfiguracaoComLote | null | undefined)?.lote
    ?.por_vaga;
  const n = ehObjeto(porVaga) ? porVaga[String(codigo)] : undefined;
  return Number.isInteger(n) && (n as number) >= 1 ? (n as number) : null;
}

/**
 * A regra com os tamanhos por vaga trocados. `tamanhos` = { codigo: número
 * ou "" }; vazio tira a vaga (volta ao sugerido). Não muda a entrada.
 */
export function regraComTamanhos(
  configuracao: unknown,
  tamanhos: Readonly<Record<string, unknown>> | null | undefined,
): ConfiguracaoComLote {
  const regra: ConfiguracaoComLote = structuredClone(
    ehObjeto(configuracao) ? configuracao : {},
  );
  const atual: Record<string, unknown> = ehObjeto(regra.lote?.por_vaga)
    ? { ...regra.lote.por_vaga }
    : {};
  for (const [codigo, valor] of Object.entries(tamanhos ?? {})) {
    const n = Number(valor);
    if (valor === "" || valor === null || valor === undefined)
      delete atual[codigo];
    else if (Number.isInteger(n) && n >= 1) atual[codigo] = n;
  }
  regra.lote = { ...(ehObjeto(regra.lote) ? regra.lote : {}) };
  if (Object.keys(atual).length) regra.lote.por_vaga = atual;
  else delete regra.lote.por_vaga;
  return regra;
}

/**
 * Os lotes a publicar: com "publica cada reposição", cada número de lote com
 * gente que ainda não tem lista LOTE registrada; sem, só o lote inicial.
 * Devolve [{ lote, quantidade }].
 */
export function lotesAPublicar(
  dados: DadosDaPreClassificacao | null | undefined,
): { lote: number; quantidade: number }[] {
  const configuracao = dados?.regra?.configuracao as
    ConfiguracaoComLote | null | undefined;
  const publica = Boolean(configuracao?.lote?.publica_reposicao);
  const registrados = new Set(
    lista(dados?.listas)
      .filter((l) => l?.meta?.tipo === "LOTE" && l.lote !== null)
      .map((l) => Number(l.lote)),
  );
  const contagem = new Map<number, number>();
  for (const c of lista(dados?.candidatos))
    if (c.lote) contagem.set(c.lote, (contagem.get(c.lote) ?? 0) + 1);
  return [...contagem.entries()]
    .filter(([lote]) => (publica || lote === 1) && !registrados.has(lote))
    .sort(([a], [b]) => a - b)
    .map(([lote, quantidade]) => ({ lote, quantidade }));
}

/*
  A ART na tela: "Nota declarada (ART)" (ou só "Nota declarada" em coluna
  estreita), sempre com a dica. Nome interno e coluna do banco continuam "art".
  Na ficha, o "Declarado" de cada bloco é a parte da ART daquele bloco.
*/
export const ROTULO_DA_ART = "Nota declarada (ART)";
export const ROTULO_CURTO_DA_ART = "Nota declarada";
export const DICA_DA_ART =
  "ART: Autodeclaração de Requisitos e Títulos — nota calculada pela Empregare a partir das respostas do questionário, antes da conferência dos documentos";
/*
  A "nota declarada" da regra (regra.provisoria.nota_declarada) recalcula a
  autodeclaração pelas respostas da inscrição. Com a base da nota DECLARADA
  (item 8.2.6), é ela que faz o corte e a ordem do lote; a ART só compara.
*/
export const DICA_DA_RECALCULADA =
  "A nota da autodeclaração recalculada pela regra a partir das respostas da inscrição; congelada depois do fim das inscrições";
export const DICA_DA_NOTA_DO_LOTE = "Usada no corte e na ordem do lote";

/**
 * As notas declaradas congeladas do edital: quantas e desde quando (a
 * primeira data). { quantidade: 0, em: null } sem nenhuma.
 */
export function declaradasCongeladas(
  dados: DadosDaPreClassificacao | null | undefined,
): { quantidade: number; em: string | null } {
  const datas = lista(dados?.candidatos)
    .filter(
      (c) =>
        c?.declarada_congelada !== null && c?.declarada_congelada !== undefined,
    )
    .map((c) => String(c.congelada_em ?? ""));
  const validas = datas.filter(Boolean).sort();
  return { quantidade: datas.length, em: validas[0] ?? null };
}

/** "24,5" (ou "—"). */
export function nota(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—";
}
