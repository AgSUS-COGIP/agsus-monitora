/* Tours da Aya: seletor, regras de perfil e passos repetidos (API pública em ../aya-tours.ts). */

import { hasResource } from "../permissoes-recursos.ts";
import type { AlvoDoPasso, ExtraDoPasso, PassoDoTour } from "./tipos.ts";

export const passo = (
  alvo: AlvoDoPasso,
  titulo: string,
  texto: string,
  extra: ExtraDoPasso = {},
): PassoDoTour => Object.freeze({ alvo, titulo, texto, ...extra });

/** O seletor de um `data-tour`. */
export const t = (nome: string): string => `[data-tour='${nome}']`;

export const editaEntrevistas = (p: unknown) =>
  hasResource(p, "entrevistas", 2);
export const decideRecursos = (p: unknown) =>
  hasResource(p, "recursos_parecer", 2);
export const administraRecursos = (p: unknown) => hasResource(p, "recursos", 3);
export const analisaDocumentos = (p: unknown) =>
  hasResource(p, "avaliacao_documental", 2);
export const coordenaAvaliacao = (p: unknown) =>
  hasResource(p, "avaliacao_documental", 3);

/* ---------- Pedaços repetidos ---------- */

export const PASSO_DA_AYA = passo(
  ".aya-arara, .aya-painel",
  "Pergunte à Aya",
  "Dúvida sobre esta tela ou uma regra? Me chame aqui; também digo números, como quantas análises estão pendentes.",
);

export const ABA = Object.freeze({
  fila: `${t("conduzir-visoes")} [data-valor='fila']`,
  preparar: `${t("conduzir-visoes")} [data-valor='preparar']`,
  listas: `${t("classificacao-abas")} [data-valor='listas']`,
  agenda: `${t("classificacao-abas")} [data-valor='agenda']`,
  regra: `${t("classificacao-abas")} [data-valor='regra']`,
  aprovados: "[data-approved-tab='aprovados']",
  convocacao: "[data-approved-tab='convocacao']",
  pendentes: `${t("acessos-situacao")} [data-valor='pendentes']`,
  /* Os passos de Conduzir entrevistas › Preparar. */
  roteiro: `${t("entrevistas-preparar-passos")} button[data-passo='roteiro']`,
  banca: `${t("entrevistas-preparar-passos")} button[data-passo='banca']`,
  convocar: `${t("entrevistas-preparar-passos")} button[data-passo='convocacao']`,
  agendaDoEdital: `${t("entrevistas-preparar-passos")} button[data-passo='agenda']`,
});

export const PUBLICAR = passo(
  t("config-publicar"),
  "Publicar",
  "Nada vale até publicar; a publicação fica no histórico e pode ser restaurada.",
);
