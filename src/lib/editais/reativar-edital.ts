/*
  Reativar edital (Editais, "⋯" da linha no Histórico): o edital concluído
  pelo cronograma volta a andar com uma etapa nova, de hoje até a data
  informada. Nada de RPC própria: a etapa entra no cronograma pelo mesmo
  `salvar_monitoramento_com_cronograma_v2` do formulário, com o motivo no
  histórico (`TH_CRONOGRAMA_MONIT_INDIG`, com quem e quando). Com o cálculo
  automático, o status recalculado vira "Em andamento" e o edital sai do
  Histórico.

  Não se reativa por aqui: o edital com status excepcional (Cancelado,
  Suspenso, Paralisado: tira-se no formulário), o de cálculo manual (o status
  é o digitado; a etapa nova não o mudaria) e o que o cronograma não dá como
  concluído. A validade da lista de aprovados segue a regra dela
  (`validade-do-edital.ts`): lista já inativada continua inativa.

  Sem DOM nem banco: a tela é `src/modulos/editais/reativar-edital.tsx`, a
  gravação é `estado.reativarEdital` (`src/modulos/editais/estado.ts`).
*/

import {
  atividadeLimpa,
  estadoDoCronograma,
  hojeEmBrasilia,
  novaEtapa,
  renumerar,
} from "../cronograma/cronograma-do-edital.ts";
import type {
  CronogramaNoBanco,
  EtapaDoCronograma,
} from "../cronograma/cronograma-do-edital.ts";
import {
  ANO_MAXIMO,
  dataPlausivel,
} from "../cronograma/datas-do-cronograma.ts";
import {
  editalParaSalvar,
  formularioDoEdital,
  periodoDoCronograma,
} from "./editais-do-nucleo.ts";
import type {
  CronogramaParaSalvar,
  LinhaDeEditalDoNucleo,
} from "./editais-do-nucleo.ts";
import {
  VALIDADE_NAO_LIDA,
  prazoDaValidade,
  validadeDoBanco,
} from "./validade-do-edital.ts";
import type { ValidadeDoFormulario } from "./validade-do-edital.ts";

const txt = (valor: unknown) => String(valor ?? "").trim();
const dataCurta = (iso: string) =>
  iso.slice(0, 10).split("-").reverse().join("/");

/** O nome da etapa nova quando ninguém digita outro. */
export const ETAPA_PADRAO_DA_REATIVACAO = "Convocação de remanescentes";
/** O motivo: de 10 a 500 caracteres, como nas outras ações com motivo de Editais. */
export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;
/** O nome da etapa: o mesmo limite prático das atividades do cronograma. */
export const ATIVIDADE_MAXIMA = 200;

/** A linha da tabela no que a reativação lê (a de `LinhaDoMonitoramento`). */
export interface LinhaParaReativar extends LinhaDeEditalDoNucleo {
  readonly ativo?: boolean | null;
}

/** O que o "⋯" da linha oferece (mora com Ativos e Histórico, no pacote de entrada). */
export { acaoDeReativarNaLinha } from "./editais-ativos.ts";

/** O cronograma gravado no que a reativação usa (a leitura de `get_monitoramento_cronograma`). */
export interface CronogramaDaReativacao extends CronogramaParaSalvar {
  readonly automatico: boolean;
  readonly etapas: EtapaDoCronograma[];
  readonly statusExcepcional: string;
  readonly etapaExcepcional: string;
  readonly motivoExcepcional: string;
  readonly dataExcepcional: string;
  readonly retomada: string;
  readonly validade: ValidadeDoFormulario;
}

/**
 * A resposta de `get_monitoramento_cronograma` no que a reativação usa: as
 * etapas, o cálculo, o status excepcional e a validade (sem a validade no
 * banco, "não lida": nada dela vai no payload).
 */
export function cronogramaDaReativacao(
  dados: CronogramaNoBanco | null | undefined,
): CronogramaDaReativacao {
  const monitor = dados?.monitoramento || null;
  return {
    automatico: monitor?.cronograma_automatico !== false,
    etapas: Array.isArray(dados?.etapas)
      ? dados.etapas.map((etapa, indice) => novaEtapa(etapa, indice + 1))
      : [],
    statusExcepcional: txt(monitor?.status_override),
    etapaExcepcional: txt(monitor?.etapa_override),
    motivoExcepcional: txt(monitor?.status_override_motivo),
    dataExcepcional: txt(monitor?.status_override_data),
    retomada: txt(monitor?.status_override_previsao_retomada),
    validade: monitor ? validadeDoBanco(monitor) : { ...VALIDADE_NAO_LIDA },
  };
}

export type MotivoDoBloqueio =
  "excepcional" | "manual" | "sem-cronograma" | "nao-concluido";

/** Por que este edital não se reativa por aqui, com o texto para quem usa. */
export interface BloqueioDaReativacao {
  motivo: MotivoDoBloqueio;
  texto: string;
  /** O caminho é o formulário do edital (Editar). */
  peloFormulario: boolean;
}

/**
 * Pode reativar? `null` quando pode; senão, o porquê. A ordem importa: o
 * status excepcional passa por cima do cálculo, e o manual ignora as datas.
 */
export function bloqueioDaReativacao(
  cronograma: CronogramaDaReativacao,
  hoje: Date = new Date(),
): BloqueioDaReativacao | null {
  if (cronograma.statusExcepcional)
    return {
      motivo: "excepcional",
      texto: `O edital está com o status excepcional "${cronograma.statusExcepcional}". Para reativá-lo, tire o status excepcional no formulário do edital.`,
      peloFormulario: true,
    };
  if (!cronograma.automatico)
    return {
      motivo: "manual",
      texto:
        "O status deste edital é digitado (cálculo manual). Para reativá-lo, ligue o cálculo automático ou mude o status no formulário do edital.",
      peloFormulario: true,
    };
  if (!cronograma.etapas.length)
    return {
      motivo: "sem-cronograma",
      texto:
        "O edital não tem cronograma. Cadastre as etapas no formulário do edital.",
      peloFormulario: true,
    };
  const calculado = estadoDoCronograma(cronograma.etapas, {
    automatico: true,
    hoje,
  });
  if (calculado.status !== "Concluído")
    return {
      motivo: "nao-concluido",
      texto: `Pelo cronograma, o edital não está concluído (${calculado.status}). Atualize a tela.`,
      peloFormulario: false,
    };
  return null;
}

/** O que a pessoa preenche no modal. */
export interface DadosDaReativacao {
  motivo: string;
  /** A nova data de fim, "AAAA-MM-DD" (o `<input type="date">`). */
  dataFim: string;
  atividade: string;
}

export type ErrosDaReativacao = Partial<
  Record<keyof DadosDaReativacao, string>
>;

/**
 * Os erros de cada campo (vazio = pode reativar). A data precisa ser depois
 * de hoje em Brasília; o nome da etapa não pode repetir uma do cronograma
 * (o banco recusa atividade duplicada).
 */
export function errosDaReativacao(
  dados: DadosDaReativacao,
  etapas: readonly EtapaDoCronograma[],
  agora: Date = new Date(),
): ErrosDaReativacao {
  const erros: ErrosDaReativacao = {};
  const motivo = txt(dados.motivo);
  if (motivo.length < MOTIVO_MINIMO || motivo.length > MOTIVO_MAXIMO)
    erros.motivo = `Informe o motivo, de ${MOTIVO_MINIMO} a ${MOTIVO_MAXIMO} caracteres.`;

  const data = txt(dados.dataFim).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
    erros.dataFim = "Informe a nova data de fim.";
  else if (!dataPlausivel(data))
    erros.dataFim = `Data impossível. Use um ano até ${ANO_MAXIMO}.`;
  else if (data <= hojeEmBrasilia(agora))
    erros.dataFim = "A data de fim precisa ser depois de hoje.";

  const atividade = atividadeLimpa(dados.atividade);
  if (!atividade) erros.atividade = "Informe o nome da etapa.";
  else if (atividade.length > ATIVIDADE_MAXIMA)
    erros.atividade = `Use até ${ATIVIDADE_MAXIMA} caracteres.`;
  else if (
    etapas.some(
      (etapa) =>
        atividadeLimpa(etapa.atividade).toLowerCase() ===
        atividade.toLowerCase(),
    )
  )
    erros.atividade =
      "Já existe uma etapa com esse nome no cronograma. Use outro nome.";
  return erros;
}

export const semErros = (erros: ErrosDaReativacao) =>
  !Object.values(erros).some(Boolean);

/**
 * A etapa nova: de hoje (Brasília) até a data de fim, no fim do cronograma.
 * Devolve todas as etapas, renumeradas.
 */
export function etapasComReativacao(
  etapas: readonly EtapaDoCronograma[],
  dados: Pick<DadosDaReativacao, "atividade" | "dataFim">,
  agora: Date = new Date(),
): EtapaDoCronograma[] {
  const nova = novaEtapa(
    {
      atividade: atividadeLimpa(dados.atividade),
      data_inicio: hojeEmBrasilia(agora),
      data_fim: txt(dados.dataFim).slice(0, 10),
      origem: "MANUAL",
    },
    etapas.length + 1,
  );
  return renumerar([...etapas, nova]);
}

/** O motivo que vai ao histórico do cronograma: diz que foi uma reativação. */
export const motivoDaReativacao = (motivo: string) =>
  `Reativação do edital: ${txt(motivo)}`;

/**
 * O `p_payload` de `salvar_monitoramento_com_cronograma_v2` para reativar: o
 * edital como está gravado na linha (unidade, UF, responsável, link, risco,
 * observações), com o cronograma novo e o que sai dele (datas, status e
 * etapa calculados). É o que o formulário gravaria se a pessoa só
 * acrescentasse a etapa.
 */
export function editalParaReativar(
  linha: LinhaParaReativar,
  cronograma: CronogramaDaReativacao,
  etapas: readonly EtapaDoCronograma[],
  area: string,
  agora: Date = new Date(),
) {
  const base = formularioDoEdital(linha, [], []);
  const formulario = {
    ...base,
    idUnidade: txt(linha.id_unidade) || base.idUnidade,
    siglaUnidade: txt(linha.sigla_unidade) || base.siglaUnidade,
    tipoUnidade: txt(linha.tipo_unidade) || base.tipoUnidade,
    uf: txt(linha.uf) || base.uf,
  };
  const unidade = {
    nome_oficial: txt(linha.unidade),
    id_unidade: formulario.idUnidade,
    sigla: formulario.siglaUnidade,
    tipo: formulario.tipoUnidade,
    uf_sede: formulario.uf,
  };
  const comEtapa = { ...cronograma, etapas: [...etapas] };
  const previa = estadoDoCronograma(comEtapa.etapas, {
    automatico: comEtapa.automatico,
    statusExcepcional: comEtapa.statusExcepcional,
    etapaExcepcional: comEtapa.etapaExcepcional,
    hoje: agora,
  });
  return editalParaSalvar(formulario, unidade, comEtapa, previa, area);
}

/**
 * O aviso da validade, quando a lista de aprovados já venceu pela data de
 * encerramento atual: reativar não a traz de volta. `null` sem prazo, sem
 * validade lida ou ainda vigente.
 */
export function avisoDaValidadeNaReativacao(
  cronograma: CronogramaDaReativacao,
  agora: Date = new Date(),
): string | null {
  const fim = periodoDoCronograma(cronograma.etapas)?.fim ?? null;
  const prazo = prazoDaValidade(cronograma.validade, fim, agora);
  if (prazo.tipo !== "vencido") return null;
  return `A validade da lista de aprovados venceu em ${dataCurta(prazo.vencimento)}. Reativar o edital não reativa a lista.`;
}

/** O que vai acontecer, em uma frase, para o modal. */
export function textoDaReativacao(
  dados: Pick<DadosDaReativacao, "atividade" | "dataFim">,
  agora: Date = new Date(),
): string {
  const data = txt(dados.dataFim).slice(0, 10);
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(data)
    ? `até ${dataCurta(data)}`
    : "até a data informada";
  const etapa = atividadeLimpa(dados.atividade) || "a etapa nova";
  return `O edital volta para Ativos, com status "Em andamento" ${ate}. A etapa "${etapa}" entra no cronograma a partir de hoje (${dataCurta(hojeEmBrasilia(agora))}), e o motivo fica no histórico do edital.`;
}
