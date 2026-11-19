/*
  O fluxo entre as etapas do processo seletivo, sem DOM: Triagem →
  Avaliação documental → Recursos → Entrevistas → Classificação → Lista de
  aprovados, com o edital (e a vaga, onde a tela recorta por vaga) seguindo
  junto. A faixa é src/componentes/fluxo-das-etapas.tsx; quem navega é
  src/app/abrir-tela-do-edital.ts.

  As etapas são as telas da página do edital (TELAS_DO_EDITAL, aba
  "Candidatos"), sem o Painel da Seleção: o destino é um só.
*/
import { numeroDoEdital } from "../editais/numero-do-edital.ts";
import { TELAS_DO_EDITAL } from "../pagina-do-edital/pagina-do-edital.ts";
import type { TelaDoEdital } from "../pagina-do-edital/pagina-do-edital.ts";

/** O edital que segue entre as telas: o id do monitoramento e o número. */
export interface EditalDoFluxo {
  id?: string | null;
  numero?: string | null;
}

/** As etapas do fluxo, na ordem do processo. */
export const ETAPAS_DO_FLUXO: readonly TelaDoEdital[] = Object.freeze(
  TELAS_DO_EDITAL.filter((tela) => tela.view !== "selecao"),
);

const texto = (valor: unknown) => String(valor ?? "").trim();

/** A etapa da tela (`view`), ou `undefined` se a tela não é do fluxo. */
export function etapaDoFluxo(view: string): TelaDoEdital | undefined {
  return ETAPAS_DO_FLUXO.find((etapa) => etapa.view === view);
}

/** As etapas que o perfil abre (`permitida(view)`), na ordem do processo. */
export function etapasDoFluxo(
  permitida: (view: string) => boolean,
): TelaDoEdital[] {
  return ETAPAS_DO_FLUXO.filter((etapa) => permitida(etapa.view));
}

/** "Documental do 93/2026"; sem número, só o nome curto da etapa. */
export function tituloDoFluxo(view: string, numero: unknown): string {
  const etapa = etapaDoFluxo(view);
  if (!etapa) return "";
  const n = numeroDoEdital(numero);
  return n ? `${etapa.curto} do ${n}` : etapa.curto;
}

/**
 * Como ir à tela já no edital: a navegação leva o id (`extras.edital`, a tela
 * abre o edital) e, nas que recortam pelo rótulo, um pedido de filtro com o
 * número e o id. A vaga vai no pedido só para a tela que recorta por vaga.
 * `null` quando falta o que a tela precisa (id ou número).
 */
export interface IdaParaAEtapa {
  view: string;
  extras?: { edital: string };
  filtro?: { edital?: string; editalId?: string; vaga?: string };
}

export function idaParaAEtapa(
  tela: TelaDoEdital,
  edital: EditalDoFluxo,
  vaga: unknown = "",
): IdaParaAEtapa | null {
  const id = texto(edital.id);
  const numero = numeroDoEdital(edital.numero);
  const codigo = tela.vaga ? texto(vaga) : "";
  if (tela.como === "numero") {
    if (!numero) return null;
    return {
      view: tela.view,
      filtro: { edital: numero, ...(id ? { editalId: id } : {}) },
    };
  }
  if (!id) return null;
  return {
    view: tela.view,
    extras: { edital: id },
    ...(codigo ? { filtro: { editalId: id, vaga: codigo } } : {}),
  };
}

/**
 * A vaga da Classificação é a chave do motor: o código da vaga, ou
 * `quadro:<id>` na linha do quadro sem código (essa não segue: as outras
 * telas recortam pelo código).
 */
export function vagaDaChave(chave: unknown): string {
  const valor = texto(chave);
  return valor.startsWith("quadro:") ? "" : valor;
}
