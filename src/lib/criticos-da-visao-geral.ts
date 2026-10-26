/*
  O "crítico" da Visão geral, CALCULADO (o campo manual `risco` não entra).

  Um edital é crítico quando tem ao menos um motivo de atenção. Os mesmos
  motivos alimentam o KPI Críticos, o bloco Atenção e a ordem da tabela.

  Edital aberto (nem concluído nem cancelado):
  - atrasada — o fim do cronograma (`data_fim`) já passou e o edital não
    concluiu: "Etapa atrasada há N dias";
  - parado — em andamento, sem etapa em curso hoje e sem mudança de etapa
    (início ou fim de uma etapa do cronograma) há 15 dias ou mais: "Parado há
    N dias". Precisa das etapas do cronograma (`listar_acompanhamento_da_
    visao_geral`); sem elas, não é avaliado. Não conta junto com atrasada;
  - sem inscritos — em andamento, já depois das inscrições (fase além de
    Edital e Inscrições) e com 0 inscritos. Inscritos nulo é "a fonte do
    funil não tem o número" (só as análises, migration 20261022200000), não
    zero: não acende.
  Edital concluído:
  - contratação baixa — vagas imediatas contratadas abaixo de 50% das vagas.
  Cancelado nunca é crítico. Etapa chegando (próxima em até 3 dias) é agenda,
  não problema: não faz o edital crítico (pedido de 02/10) — fica nas
  boas-vindas e na cor da próxima etapa da tabela.

  Os limites ficam em LIMITES_DO_CRITICO (e em docs/aya/regras-da-visao-geral.md).
*/

import { faseDoEdital } from "./fases-do-processo.ts";
import {
  contratadasImediatas,
  ehCancelado,
  ehConcluido,
} from "./indicadores-do-monitoramento.ts";
import type {
  EtapaDoAcompanhamento,
  LinhaDoMonitoramento,
  Motivo,
} from "../modulos/visao-geral/tipos.ts";

/** Os limites do crítico (`LIMITES_DO_CRITICO`, ou outros no teste). */
export interface LimitesDoCritico {
  diasDoPrazo: number;
  diasParado: number;
  contratacaoMinima: number;
}

/** Os códigos dos motivos de atenção (chaves de `MOTIVOS_DO_CRITICO`). */
export type CodigoDoMotivo =
  "atrasada" | "parado" | "sem_inscritos" | "contratacao_baixa";

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
  atrasada: Object.freeze({ peso: 1, tom: "perigo" }),
  parado: Object.freeze({ peso: 2, tom: "alerta" }),
  sem_inscritos: Object.freeze({ peso: 3, tom: "alerta" }),
  contratacao_baixa: Object.freeze({ peso: 4, tom: "alerta" }),
});

const txt = (valor: unknown) => String(valor ?? "").trim();
const num = (valor: unknown) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};

/** "AAAA-MM-DD…" → dia em número (dias desde 1970), ou null. */
export function diaDoCalendario(valor: unknown): number | null {
  const achado = txt(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!achado) return null;
  return Math.round(
    Date.UTC(Number(achado[1]), Number(achado[2]) - 1, Number(achado[3])) /
      86400000,
  );
}

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

/** Há alguma etapa em curso hoje (início ≤ hoje ≤ fim)? */
export function temEtapaEmCurso(
  etapas: readonly EtapaDoCritico[] | null | undefined,
  hoje: unknown,
): boolean {
  const dia = diaDoCalendario(hoje);
  return (etapas || []).some((etapa) => {
    const inicio = diaDoCalendario(etapa?.data_inicio);
    const fim = diaDoCalendario(etapa?.data_fim) ?? inicio;
    return inicio !== null && inicio <= dia! && dia! <= fim!;
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

const emAndamento = (linha: LinhaDoMonitoramento) =>
  txt(linha?.status)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("andamento");

/**
 * Os motivos de atenção do edital: `[{ codigo, rotulo, tom }]`, do mais grave
 * ao menos grave; vazio = não é crítico.
 * `hoje`: "AAAA-MM-DD" (Brasília). `etapas`: as etapas do cronograma deste
 * edital (`null` = não carregadas).
 */
export function motivosDeAtencao(
  linha: LinhaDoMonitoramento | null | undefined,
  {
    hoje,
    etapas = null,
    limites = LIMITES_DO_CRITICO,
  }: {
    hoje?: string;
    etapas?: readonly EtapaDoAcompanhamento[] | null;
    limites?: LimitesDoCritico;
  } = {},
): Motivo[] {
  if (!linha || ehCancelado(linha)) return [];
  const motivo = (codigo: CodigoDoMotivo, rotulo: string) => ({
    codigo,
    rotulo,
    tom: MOTIVOS_DO_CRITICO[codigo].tom,
  });
  const motivos: { codigo: CodigoDoMotivo; rotulo: string; tom: string }[] = [];
  const dia = diaDoCalendario(hoje);

  if (ehConcluido(linha)) {
    const vagas = num(linha.vagas_total);
    if (
      vagas > 0 &&
      contratadasImediatas(linha) / vagas < limites.contratacaoMinima
    )
      motivos.push(
        motivo(
          "contratacao_baixa",
          `Contratação abaixo de ${Math.round(limites.contratacaoMinima * 100)}%`,
        ),
      );
    return motivos;
  }

  const fim = diaDoCalendario(linha.data_fim);
  const atrasada = dia !== null && fim !== null && fim < dia;
  if (atrasada)
    motivos.push(
      motivo(
        "atrasada",
        `Etapa atrasada há ${plural(dia - fim, "dia", "dias")}`,
      ),
    );

  if (
    !atrasada &&
    emAndamento(linha) &&
    Array.isArray(etapas) &&
    etapas.length
  ) {
    const ultima = ultimaMudancaDeEtapa(etapas, hoje);
    if (
      ultima !== null &&
      !temEtapaEmCurso(etapas, hoje) &&
      dia! - ultima >= limites.diasParado
    )
      motivos.push(
        motivo("parado", `Parado há ${plural(dia! - ultima, "dia", "dias")}`),
      );
  }

  const fase = linha.fase || faseDoEdital(linha);
  if (
    emAndamento(linha) &&
    !["Edital", "Inscrições", "Sem cronograma"].includes(fase) &&
    linha.inscritos !== null &&
    linha.inscritos !== undefined &&
    linha.inscritos !== "" &&
    num(linha.inscritos) === 0
  )
    motivos.push(motivo("sem_inscritos", "Sem inscritos"));

  return motivos.sort(
    (a, b) =>
      MOTIVOS_DO_CRITICO[a.codigo].peso - MOTIVOS_DO_CRITICO[b.codigo].peso,
  );
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
