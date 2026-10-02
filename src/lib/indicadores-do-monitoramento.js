/*
  Os indicadores da Visão geral, sem DOM. Contam as linhas de
  `TB_MONITORAMENTO_INDIGENA` do recorte (área atual, filtros, busca, DSEI).

  As contas fecham:

    Vagas imediatas = Contratadas + Em seleção + Ociosas

  - Contratadas (imediatas): por edital, contratados limitados às vagas
    imediatas — min(contratados, vagas_total).
  - Cadastro reserva: o que passa das vagas imediatas —
    max(0, contratados − vagas_total). Fica à parte.
  - Em seleção: vagas − contratadas dos editais ainda sem resultado.
  - Ociosas: vagas − contratadas dos editais com resultado (concluídos ou na
    fase Contratação).
  - Cancelados não entram em nenhum (nem em Inscritos): as vagas deles não
    estão em seleção nem ociosas.
  - Críticos: editais com algum motivo de atenção (`criticos-da-visao-geral.js`).

  `contratados` vem da lista de aprovados vigente (Contratado/Migração) e
  `vagas_total` do cadastro do edital.
*/

import { faseDoEdital } from "./fases-do-processo.js";

const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
};
const status = (linha) =>
  String(linha?.status ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Edital cancelado (qualquer grafia). */
export const ehCancelado = (linha) => status(linha).includes("cancel");
/** Edital concluído: o cronograma terminou (qualquer grafia). */
export const ehConcluido = (linha) => status(linha).includes("conclu");
/** Edital concluído ou cancelado. */
export const ehEditalEncerrado = (linha) =>
  ehCancelado(linha) || ehConcluido(linha);

/** Já saiu o resultado: concluído ou na fase Contratação. */
export function temResultado(linha) {
  if (ehConcluido(linha)) return true;
  return (linha?.fase || faseDoEdital(linha)) === "Contratação";
}

/** Soma de um campo numérico das linhas; vazio e texto contam zero. */
export function somarCampo(linhas, campo) {
  return (Array.isArray(linhas) ? linhas : []).reduce(
    (total, linha) => total + num(linha?.[campo]),
    0,
  );
}

/** Contratações do edital dentro das vagas imediatas. */
export const contratadasImediatas = (linha) =>
  Math.min(num(linha?.contratados), num(linha?.vagas_total));
/** Contratações acima das vagas imediatas (cadastro reserva). */
export const contratacoesDoCadastroReserva = (linha) =>
  Math.max(0, num(linha?.contratados) - num(linha?.vagas_total));
/** Vagas imediatas ainda sem contratação. */
export const vagasSemContratacao = (linha) =>
  num(linha?.vagas_total) - contratadasImediatas(linha);

/** A linha tem algum motivo de atenção (`atencao`, preenchido pelo recorte). */
export const ehCritica = (linha) =>
  Array.isArray(linha?.atencao) && linha.atencao.length > 0;

/** Os números da faixa de indicadores. */
export function indicadoresDoMonitoramento(
  linhas,
  { critica = ehCritica } = {},
) {
  const lista = Array.isArray(linhas) ? linhas : [];
  const validas = lista.filter((linha) => !ehCancelado(linha));
  let contratadas = 0;
  let emSelecao = 0;
  let ociosas = 0;
  let cadastroReserva = 0;
  for (const linha of validas) {
    contratadas += contratadasImediatas(linha);
    cadastroReserva += contratacoesDoCadastroReserva(linha);
    if (temResultado(linha)) ociosas += vagasSemContratacao(linha);
    else emSelecao += vagasSemContratacao(linha);
  }
  return {
    processos: lista.length,
    vagas: somarCampo(validas, "vagas_total"),
    contratadas,
    emSelecao,
    ociosas,
    cadastroReserva,
    criticos: lista.filter(critica).length,
    inscritos: somarCampo(validas, "inscritos"),
  };
}
