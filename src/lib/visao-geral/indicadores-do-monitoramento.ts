/*
  Os indicadores da Visão geral, sem DOM. Contam as linhas de
  `TB_MONITORAMENTO_INDIGENA` do recorte (área atual, filtros, busca, DSEI).

  As contas fecham:

    Vagas imediatas = Contratadas + Em seleção + Ociosas

  - Contratadas (imediatas): por edital, contratados limitados às vagas
    imediatas — min(contratados, vagas_total).
  - Contratações além das vagas imediatas (antes "Cadastro reserva"): o que
    passa das vagas imediatas — max(0, contratados − vagas_total). Fica à
    parte.
  - Em seleção: vagas − contratadas dos editais ainda sem resultado.
  - Ociosas: vagas − contratadas dos editais com resultado (concluídos ou na
    fase Contratação).
  - Cancelados não entram em nenhum (nem em Inscritos): as vagas deles não
    estão em seleção nem ociosas.
  - Críticos: editais marcados manualmente (`criticos-da-visao-geral.ts`).
  - Vaga reaberta conta uma vez só (`vagas-reabertas.ts`): a vaga sem
    contratação que um edital mais novo da mesma unidade reabriu sai do
    edital antigo (`vagas_reabertas`, preenchido no enriquecimento) e fica no
    novo. `reabertas` diz quantas saíram da soma.

  `contratados` vem da lista de aprovados vigente (Contratado/Migração) e
  `vagas_total` do cadastro do edital.

  Cada número diz de quantos editais ele vem (`editais`, `inscritosInformados`,
  `editaisComResultado`, `editaisSemResultado`), para a tela separar o zero
  confirmado do dado ausente e do que não se aplica (`situacaoDoIndicador`).
*/

import { faseDoEdital } from "./fases-do-processo.ts";
import type {
  Indicadores,
  LinhaDoMonitoramento,
} from "../../modulos/visao-geral/tipos.ts";

type Linha = LinhaDoMonitoramento | null | undefined;

const num = (valor: unknown) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
};
const status = (linha: unknown) =>
  String((linha as { status?: unknown } | null | undefined)?.status ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Edital cancelado (qualquer grafia). */
export const ehCancelado = (linha: unknown): boolean =>
  status(linha).includes("cancel");
/*
  Edital concluído: o cronograma terminou (qualquer grafia). Na Visão geral, o
  "Concluído" que só vem das datas aparece como "Cronograma encerrado"
  (statusDaVisaoGeral) e continua contando aqui.
*/
export const ehConcluido = (linha: unknown): boolean =>
  status(linha).includes("conclu") ||
  status(linha).includes("cronograma encerrado");
/** Edital concluído ou cancelado. */
export const ehEditalEncerrado = (linha: unknown): boolean =>
  ehCancelado(linha) || ehConcluido(linha);

/** Já saiu o resultado: concluído ou na fase Contratação. */
export function temResultado(linha: Linha): boolean {
  if (ehConcluido(linha)) return true;
  return (linha?.fase || faseDoEdital(linha)) === "Contratação";
}

/** O campo tem número (nulo, vazio e texto são dado ausente, não zero). */
export function temNumero(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === "") return false;
  return Number.isFinite(Number(valor));
}

/** Soma de um campo numérico das linhas; vazio e texto contam zero. */
export function somarCampo(
  linhas: readonly Linha[] | null | undefined,
  campo: string,
): number {
  return (Array.isArray(linhas) ? linhas : []).reduce(
    (total: number, linha: Linha) => total + num(linha?.[campo]),
    0,
  );
}

/** As vagas do edital sem as reabertas depois em edital mais novo. */
export const vagasEfetivas = (linha: Linha): number =>
  Math.max(0, num(linha?.vagas_total) - num(linha?.vagas_reabertas));
/** Contratações do edital dentro das vagas imediatas. */
export const contratadasImediatas = (linha: Linha): number =>
  Math.min(num(linha?.contratados), num(linha?.vagas_total));
/** Contratações acima das vagas imediatas do edital. */
export const contratacoesAlemDasVagas = (linha: Linha): number =>
  Math.max(0, num(linha?.contratados) - num(linha?.vagas_total));
/** Vagas imediatas ainda sem contratação (as reabertas depois saem). */
export const vagasSemContratacao = (linha: Linha): number =>
  Math.max(0, vagasEfetivas(linha) - contratadasImediatas(linha));

/** A linha tem marcação manual de crítico (`atencao`, preenchido pelo recorte). */
export const ehCritica = (linha: Linha): boolean =>
  !ehCancelado(linha) &&
  Array.isArray(linha?.atencao) &&
  linha.atencao.some((motivo) => motivo.codigo === "marcado");

/** Os números da faixa de indicadores. */
export function indicadoresDoMonitoramento(
  linhas: readonly LinhaDoMonitoramento[] | null | undefined,
  {
    critica = ehCritica,
  }: { critica?: (linha: LinhaDoMonitoramento) => boolean } = {},
): Indicadores {
  const lista = Array.isArray(linhas) ? linhas : [];
  const validas = lista.filter((linha) => !ehCancelado(linha));
  let contratadas = 0;
  let emSelecao = 0;
  let ociosas = 0;
  let alemDasVagas = 0;
  let vagas = 0;
  let reabertas = 0;
  let editaisComResultado = 0;
  let inscritosInformados = 0;
  for (const linha of validas) {
    vagas += vagasEfetivas(linha);
    reabertas += num(linha?.vagas_total) - vagasEfetivas(linha);
    contratadas += contratadasImediatas(linha);
    alemDasVagas += contratacoesAlemDasVagas(linha);
    if (temNumero(linha?.inscritos)) inscritosInformados += 1;
    if (temResultado(linha)) {
      editaisComResultado += 1;
      ociosas += vagasSemContratacao(linha);
    } else emSelecao += vagasSemContratacao(linha);
  }
  return {
    processos: lista.length,
    vagas,
    reabertas,
    contratadas,
    emSelecao,
    ociosas,
    alemDasVagas,
    criticos: lista.filter(critica).length,
    inscritos: somarCampo(validas, "inscritos"),
    editais: validas.length,
    inscritosInformados,
    editaisComResultado,
    editaisSemResultado: validas.length - editaisComResultado,
  };
}

/*
  Como a tela mostra um indicador (revisão de 17/11/2026): o zero confirmado
  é "0"; o dado ausente (nenhum edital informou) e o que não se aplica
  (nenhum edital daquele tipo no recorte) são "—" com o porquê; e, quando só
  parte dos editais informou, a cobertura: "informado em X de Y editais".
  A carga pendente é da tela (o esqueleto), não daqui.
*/
export type SituacaoDoIndicador =
  | { tipo: "valor"; valor: number; cobertura: string }
  | { tipo: "ausente"; motivo: string }
  | { tipo: "nao_se_aplica"; motivo: string };

const editais = (n: number) => (n === 1 ? "edital" : "editais");

/** "informado em X de Y editais", só quando falta algum. */
export function textoDaCobertura(informados: number, total: number): string {
  if (!(total > 0) || informados >= total) return "";
  return `informado em ${informados.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${editais(total)}`;
}

export function situacaoDoIndicador(
  k: Indicadores,
  chave: "inscritos" | "emSelecao" | "ociosas",
): SituacaoDoIndicador {
  if (chave === "inscritos") {
    if (k.editais > 0 && k.inscritosInformados === 0)
      return { tipo: "ausente", motivo: "sem dado nos editais" };
    return {
      tipo: "valor",
      valor: k.inscritos,
      cobertura: textoDaCobertura(k.inscritosInformados, k.editais),
    };
  }
  const daquele =
    chave === "ociosas" ? k.editaisComResultado : k.editaisSemResultado;
  if (k.editais > 0 && daquele === 0)
    return {
      tipo: "nao_se_aplica",
      motivo:
        chave === "ociosas"
          ? "nenhum edital com resultado"
          : "nenhum edital sem resultado",
    };
  return { tipo: "valor", valor: k[chave], cobertura: "" };
}
