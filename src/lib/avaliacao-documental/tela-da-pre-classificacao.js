/*
  A aba Pré-classificação sem DOM: contadores, vagas com os inscritos em
  ordem, tamanho sugerido do lote (prévia pela mesma conta do job), os lotes
  a publicar e os rótulos dos avisos e das situações. Sem estado.

  Os dados vêm de obter_pre_classificacao
  (supabase/migrations/20261006110000_pre_classificacao_e_lote.sql): o
  resultado que o job Python gravou. Aqui não se recalcula ninguém.
*/
import { normalizarRegraAnalise } from "./regra.js";
import {
  PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA,
  PREFIXO_DO_AVISO_DE_SEM_NIVEL,
  tamanhoDoLote,
} from "./pre-classificacao.js";

const lista = (v) => (Array.isArray(v) ? v : []);
const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ehObjeto = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** O que cada aviso de vaga quer dizer (códigos gravados pelo job). */
export const AVISOS_DA_VAGA = Object.freeze({
  SEM_QUADRO: "Sem quadro de vagas: defina o tamanho do lote da vaga.",
  SEM_VAGAS: "Vaga sem vagas imediatas nem cadastro reserva.",
  SEM_NOTA_MINIMA: "Lote pela nota mínima sem a nota: informe-a na regra.",
  QUADRO_SEM_MODALIDADES: "Quadro sem vagas por modalidade: o lote saiu geral.",
  ART_AUSENTE:
    "Inscrito sem ART no arquivo: vale a nota recalculada pela regra.",
  LINHA_PARADA: "Lugar aberto no lote: a regra não repõe.",
  FORA_DO_LOTE_ACIMA_DO_CORTE: "Fora do lote com nota acima da linha de corte.",
  LOTE_ACIMA_DO_TAMANHO: "Lote maior que o tamanho de agora.",
  REFAZER_RECUSADO: "O lote não foi refeito: já há fichas.",
});

export function textoDoAviso(codigo) {
  const c = String(codigo ?? "");
  if (c.startsWith("COLUNA_AUSENTE:"))
    return `A coluna da regra ${c.slice(15)} não veio no arquivo.`;
  if (c.startsWith(PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA))
    return `${perguntaDoAviso(c.slice(PREFIXO_DO_AVISO_DE_PERGUNTA_AMBIGUA.length))} casa com mais de uma coluna do arquivo: na regra, use um começo de enunciado que só ela tenha.`;
  if (c.startsWith(PREFIXO_DO_AVISO_DE_SEM_NIVEL))
    return `${perguntaDoAviso(c.slice(PREFIXO_DO_AVISO_DE_SEM_NIVEL.length))} pontua por nível, e o nível da vaga não foi identificado (ou não tem pontos na regra): ficou fora da nota declarada e da conferência com a ART.`;
  return AVISOS_DA_VAGA[c] ?? c;
}

function perguntaDoAviso(origem) {
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
export function contadoresDaPreClassificacao(dados) {
  const vagas = lista(dados?.vagas);
  const conta = (campo) => vagas.reduce((s, v) => s + numero(v?.[campo]), 0);
  // "N de M": M soma o tamanho das vagas já pré-classificadas; vaga sem
  // tamanho (sem quadro) deixa o total em aberto.
  const tamanhos = vagas
    .filter((v) => v?.inscritos !== null && v?.inscritos !== undefined)
    .map((v) => v?.tamanho);
  return {
    inscritos: conta("inscritos"),
    eliminados: conta("eliminados"),
    ranqueados: conta("ranqueados"),
    noLote: conta("no_lote"),
    tamanho:
      !tamanhos.length || tamanhos.some((t) => t === null || t === undefined)
        ? null
        : tamanhos.reduce((s, t) => s + numero(t), 0),
    divergencias: conta("divergencias"),
    vagasSemPreClassificacao: vagas.filter(
      (v) => v?.inscritos === null || v?.inscritos === undefined,
    ).length,
  };
}

const porPosicao = (a, b) =>
  (a.posicao ?? Infinity) - (b.posicao ?? Infinity) ||
  String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""));

/** As vagas com os inscritos separados: no lote, fora do lote e eliminados. */
export function vagasDaTela(dados) {
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
export function tamanhoSugerido(configuracao, vaga) {
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
export function tamanhoDefinido(configuracao, codigo) {
  const porVaga = configuracao?.lote?.por_vaga;
  const n = ehObjeto(porVaga) ? porVaga[String(codigo)] : undefined;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * A regra com os tamanhos por vaga trocados. `tamanhos` = { codigo: número
 * ou "" }; vazio tira a vaga (volta ao sugerido). Não muda a entrada.
 */
export function regraComTamanhos(configuracao, tamanhos) {
  const regra = structuredClone(ehObjeto(configuracao) ? configuracao : {});
  const atual = ehObjeto(regra.lote?.por_vaga)
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
export function lotesAPublicar(dados) {
  const publica = Boolean(dados?.regra?.configuracao?.lote?.publica_reposicao);
  const registrados = new Set(
    lista(dados?.listas)
      .filter((l) => l?.meta?.tipo === "LOTE" && l.lote !== null)
      .map((l) => Number(l.lote)),
  );
  const contagem = new Map();
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
/* A "nota declarada" da regra (regra.provisoria.nota_declarada) recalcula a ART pelas respostas. */
export const DICA_DA_RECALCULADA =
  "A mesma nota recalculada pela regra a partir das respostas do questionário, para conferir a ART";

/** "24,5" (ou "—"). */
export function nota(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—";
}
