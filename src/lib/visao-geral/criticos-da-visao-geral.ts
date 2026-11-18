/*
  Processos críticos da Visão geral são exclusivamente as marcações manuais
  do gestor, coordenador ou administrador global. O motivo e a autoria vêm
  de listar_editais_criticos_manuais. Cancelados não entram.
  Contratação baixa continua no acompanhamento pós-resultado; datas e
  inscrições não criam marcações automáticas de crítico.
*/

import {
  motivoPareceTexto,
  textoLimpo,
} from "../avaliacao-documental/qualidade-do-motivo.ts";
import { ehCancelado } from "./indicadores-do-monitoramento.ts";
import type {
  EtapaDoAcompanhamento,
  LinhaDoMonitoramento,
  Motivo,
} from "../../modulos/visao-geral/tipos.ts";

/** Os limites do crítico (`LIMITES_DO_CRITICO`, ou outros no teste). */
export interface LimitesDoCritico {
  diasDoPrazo: number;
  diasParado: number;
  contratacaoMinima: number;
}

/** Os códigos dos motivos de atenção (chaves de `MOTIVOS_DO_CRITICO`). */
export type CodigoDoMotivo =
  "marcado" | "atrasada" | "parado" | "sem_inscritos" | "contratacao_baixa";

/** A marcação manual de crítico de um edital (`listar_editais_criticos_manuais`). */
export interface MarcacaoDeCritico {
  motivo: string;
  quem?: string | null;
  quando?: string | null;
}

/** Uma etapa do cronograma: só as datas importam aqui. */
type EtapaDoCritico =
  Pick<EtapaDoAcompanhamento, "data_inicio" | "data_fim"> | null | undefined;

export const LIMITES_DO_CRITICO = Object.freeze({
  /** Próxima etapa em até N dias: só a cor vermelha na tabela (não é crítico). */
  diasDoPrazo: 3,
  /** Sem mudança de etapa há N dias ou mais. */
  diasParado: 15,
  /** Concluído com contratadas abaixo desta fração das vagas imediatas. */
  contratacaoMinima: 0.5,
});

/* Do mais grave ao menos grave: a ordem da tabela e dos selos. */
export const MOTIVOS_DO_CRITICO = Object.freeze({
  marcado: Object.freeze({ peso: 0, tom: "perigo" }),
  atrasada: Object.freeze({ peso: 1, tom: "perigo" }),
  parado: Object.freeze({ peso: 2, tom: "alerta" }),
  sem_inscritos: Object.freeze({ peso: 3, tom: "alerta" }),
  contratacao_baixa: Object.freeze({ peso: 4, tom: "alerta" }),
});

const txt = (valor: unknown) => String(valor ?? "").trim();
/** "AAAA-MM-DD…" → dia em número (dias desde 1970), ou null. */
export function diaDoCalendario(valor: unknown): number | null {
  const achado = txt(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!achado) return null;
  return Math.round(
    Date.UTC(Number(achado[1]), Number(achado[2]) - 1, Number(achado[3])) /
      86400000,
  );
}

/** Há alguma etapa em curso hoje (início ≤ hoje ≤ fim)? */
export function temEtapaEmCurso(
  etapas: readonly EtapaDoCritico[] | null | undefined,
  hoje: unknown,
): boolean {
  const dia = diaDoCalendario(hoje);
  if (dia === null) return false;
  return (etapas || []).some((etapa) => {
    const inicio = diaDoCalendario(etapa?.data_inicio);
    const fim = diaDoCalendario(etapa?.data_fim) ?? inicio;
    return inicio !== null && fim !== null && inicio <= dia && dia <= fim;
  });
}

/**
 * O último dia em que a etapa mudou até hoje: o início de uma etapa ou o dia
 * seguinte ao fim de outra. `null` sem etapa que já tenha começado.
 */
export function ultimaMudancaDeEtapa(
  etapas: readonly EtapaDoCritico[] | null | undefined,
  hoje: unknown,
): number | null {
  const dia = diaDoCalendario(hoje);
  if (dia === null) return null;
  let ultima: number | null = null;
  for (const etapa of etapas || []) {
    const inicio = diaDoCalendario(etapa?.data_inicio);
    const fim = diaDoCalendario(etapa?.data_fim);
    for (const mudanca of [inicio, fim === null ? null : fim + 1])
      if (
        mudanca !== null &&
        mudanca <= dia! &&
        (ultima === null || mudanca > ultima)
      )
        ultima = mudanca;
  }
  return ultima;
}

/**
 * Os motivos de atenção do edital: `[{ codigo, rotulo, tom }]`, do mais grave
 * ao menos grave; vazio = não é crítico.
 * `hoje`: "AAAA-MM-DD" (Brasília). `etapas`: as etapas do cronograma deste
 * edital (`null` = não carregadas).
 */
export function motivosDeAtencao(
  linha: LinhaDoMonitoramento | null | undefined,
  {
    marcacao = null,
  }: {
    hoje?: string;
    etapas?: readonly EtapaDoAcompanhamento[] | null;
    limites?: LimitesDoCritico;
    marcacao?: MarcacaoDeCritico | null;
  } = {},
): Motivo[] {
  if (!linha || ehCancelado(linha)) return [];
  const motivo = txt(marcacao?.motivo);
  if (!motivo) return [];
  const quem = txt(marcacao?.quem);
  return [
    {
      codigo: "marcado",
      rotulo: `Marcado como crítico${quem ? ` por ${quem}` : ""}: ${motivo}`,
      tom: MOTIVOS_DO_CRITICO.marcado.tom,
    },
  ];
}

/** Gravidade para ordenar: o peso do motivo mais grave; sem motivo, 99. */
export function gravidade(
  motivos: readonly Pick<Motivo, "codigo">[] | null | undefined,
): number {
  return (motivos || []).reduce(
    (menor, m) =>
      Math.min(
        menor,
        (
          MOTIVOS_DO_CRITICO as Readonly<
            Record<string, { readonly peso: number } | undefined>
          >
        )[m.codigo]?.peso ?? 99,
      ),
    99,
  );
}

/** Tamanho do motivo da marcação manual (o do banco, marcar_edital_critico). */
export const MOTIVO_DO_CRITICO = Object.freeze({ minimo: 10, maximo: 500 });

/**
 * O que falta no motivo de marcar ou desmarcar o edital como crítico ("" =
 * pode gravar). A mesma regra do banco: 10 a 500 caracteres e 2 palavras.
 */
export function erroDoMotivoDoCritico(texto: unknown): string {
  const limpo = textoLimpo(texto);
  if (
    limpo.length < MOTIVO_DO_CRITICO.minimo ||
    limpo.length > MOTIVO_DO_CRITICO.maximo
  )
    return `Escreva o motivo (${MOTIVO_DO_CRITICO.minimo} a ${MOTIVO_DO_CRITICO.maximo} caracteres).`;
  if (!motivoPareceTexto(limpo, 2))
    return "O motivo precisa de pelo menos 2 palavras.";
  return "";
}
