/*
  Validade do processo seletivo (cartão #57) — o que o formulário do edital
  mostra e manda, sem DOM nem rede. A tela é `src/modulos/editais/`.

  O banco guarda o prazo em TB_MONITORAMENTO_INDIGENA: "NU_ANOS_VALIDADE"
  (0 a 10), "NU_MESES_VALIDADE" (0 a 11) e "ST_PRORROGADO"; a CHECK
  CK_MONITORAMENTO_INDIGENA_VALIDADE recusa o resto. O último dia de validade
  é private."FC_VENCIMENTO_DO_EDITAL"(data_fim, anos, meses, prorrogado):

    data_fim + make_interval(months => (anos * 12 + meses) * (prorrogado ? 2 : 1))

  e NULL sem data de encerramento ou com prazo 0 (não vence). A lista de
  aprovados vigente fica inativa quando esse dia é ANTES de hoje em Brasília
  (FC_INATIVAR_LISTAS_VENCIDAS, ao salvar o edital e todo dia às 00:05): no
  próprio último dia ela ainda vale. `vencimentoDoEdital` espelha a função
  letra por letra, inclusive a soma de meses do PostgreSQL: o dia que não
  existe no mês de chegada vira o último dia dele (31/01 + 1 mês = 28/02 ou
  29/02; 29/02 + 1 ano = 28/02).

  A gravação é `salvar_monitoramento_com_cronograma_v2`, que só mexe em cada
  coluna quando a chave vem no p_payload (`nu_anos_validade`,
  `nu_meses_validade`, `st_prorrogado`). A leitura é
  `get_monitoramento_cronograma` (monitoramento.nu_anos_validade, …), desde a
  migration 20261111200000. Banco sem ela: os três chegam ausentes, a
  validade fica "não lida" (`lida: false`), os campos abrem vazios e só vai no
  payload o campo que a pessoa preencher — nada gravado é sobrescrito por um
  zero que ninguém escolheu.
*/

import { hojeEmBrasilia } from "./cronograma-do-edital.ts";

export const ANOS_MAXIMOS = 10;
export const MESES_MAXIMOS = 11;

/** A validade como o formulário a guarda (textos dos campos). */
export interface ValidadeDoFormulario {
  /** "0" a "10"; "" = não informado (só quando não foi lida). */
  anos: string;
  /** "0" a "11"; "" = não informado. */
  meses: string;
  /** "sim", "nao" ou "" (não informado). */
  prorrogado: "" | "sim" | "nao";
  /** O banco devolveu a validade gravada (ou o edital é novo: os padrões do banco). */
  lida: boolean;
}

/** Edital novo: os padrões das colunas (0, 0, não prorrogado). */
export const VALIDADE_NOVA: Readonly<ValidadeDoFormulario> = Object.freeze({
  anos: "0",
  meses: "0",
  prorrogado: "nao",
  lida: true,
});

/** Banco sem a leitura da validade: nada informado, nada a sobrescrever. */
export const VALIDADE_NAO_LIDA: Readonly<ValidadeDoFormulario> = Object.freeze({
  anos: "",
  meses: "",
  prorrogado: "",
  lida: false,
});

const inteiroNoIntervalo = (valor: unknown, maximo: number): number | null => {
  const texto =
    typeof valor === "number" || typeof valor === "string"
      ? String(valor).trim()
      : "";
  if (!/^\d+$/.test(texto)) return null;
  const n = Number(texto);
  return n <= maximo ? n : null;
};

/**
 * A validade do `monitoramento` de `get_monitoramento_cronograma`. Lida só
 * quando os três campos vêm (a RPC de antes da migration não manda nenhum).
 */
export function validadeDoBanco(monitor: unknown): ValidadeDoFormulario {
  const m = (
    typeof monitor === "object" && monitor !== null ? monitor : {}
  ) as Record<string, unknown>;
  if (
    !("nu_anos_validade" in m) ||
    !("nu_meses_validade" in m) ||
    !("st_prorrogado" in m)
  )
    return { ...VALIDADE_NAO_LIDA };
  const anos = inteiroNoIntervalo(m.nu_anos_validade ?? 0, ANOS_MAXIMOS);
  const meses = inteiroNoIntervalo(m.nu_meses_validade ?? 0, MESES_MAXIMOS);
  return {
    anos: String(anos ?? 0),
    meses: String(meses ?? 0),
    prorrogado: m.st_prorrogado === true ? "sim" : "nao",
    lida: true,
  };
}

/** Os erros de cada campo, com a mensagem que aparece embaixo dele. */
export function errosDaValidade(validade: ValidadeDoFormulario): {
  anos: string;
  meses: string;
  prorrogado: string;
} {
  const exigir = validade.lida;
  const erro = (valor: string, maximo: number, nome: string) => {
    if (valor.trim() === "")
      return exigir ? `Informe os ${nome} (0 a ${maximo}).` : "";
    return inteiroNoIntervalo(valor, maximo) === null
      ? `Use um número inteiro de 0 a ${maximo} ${nome}.`
      : "";
  };
  return {
    anos: erro(validade.anos, ANOS_MAXIMOS, "anos"),
    meses: erro(validade.meses, MESES_MAXIMOS, "meses"),
    prorrogado:
      exigir && !validade.prorrogado ? "Diga se o prazo foi prorrogado." : "",
  };
}

export const validadeValida = (validade: ValidadeDoFormulario) =>
  Object.values(errosDaValidade(validade)).every((erro) => !erro);

/**
 * As chaves do p_payload: cada uma só quando o campo tem valor válido. Com a
 * validade lida, vão as três; sem ela, só o que a pessoa preencheu.
 */
export function validadeParaSalvar(
  validade: ValidadeDoFormulario | null | undefined,
): {
  nu_anos_validade?: number;
  nu_meses_validade?: number;
  st_prorrogado?: boolean;
} {
  if (!validade) return {};
  const anos = inteiroNoIntervalo(validade.anos, ANOS_MAXIMOS);
  const meses = inteiroNoIntervalo(validade.meses, MESES_MAXIMOS);
  return {
    ...(anos !== null ? { nu_anos_validade: anos } : {}),
    ...(meses !== null ? { nu_meses_validade: meses } : {}),
    ...(validade.prorrogado
      ? { st_prorrogado: validade.prorrogado === "sim" }
      : {}),
  };
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const diasNoMes = (ano: number, mes: number) =>
  new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * `data + make_interval(months => meses)` do PostgreSQL, em "AAAA-MM-DD":
 * soma ao mês e, se o dia não existe no mês de chegada, fica o último dia
 * dele. Data ilegível → null. Sem fuso: só calendário.
 */
export function somarMesesComoNoBanco(
  data: string,
  meses: number,
): string | null {
  const partes = ISO.exec(String(data || "").slice(0, 10));
  if (!partes || !Number.isInteger(meses)) return null;
  const [ano, mes, dia] = [
    Number(partes[1]),
    Number(partes[2]),
    Number(partes[3]),
  ];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return null;
  const total = ano * 12 + (mes - 1) + meses;
  const anoFinal = Math.floor(total / 12);
  const mesFinal = total - anoFinal * 12 + 1;
  const diaFinal = Math.min(dia, diasNoMes(anoFinal, mesFinal));
  return `${String(anoFinal).padStart(4, "0")}-${doisDigitos(mesFinal)}-${doisDigitos(diaFinal)}`;
}

/**
 * private."FC_VENCIMENTO_DO_EDITAL": o último dia de validade ("AAAA-MM-DD"),
 * ou null sem data de encerramento ou sem prazo (não vence).
 */
export function vencimentoDoEdital(
  dataFim: string | null | undefined,
  anos: number | null | undefined,
  meses: number | null | undefined,
  prorrogado: boolean | null | undefined,
): string | null {
  const prazo = (anos ?? 0) * 12 + (meses ?? 0);
  if (!dataFim || prazo <= 0) return null;
  return somarMesesComoNoBanco(dataFim, prazo * (prorrogado ? 2 : 1));
}

const dataCurta = (iso: string) => iso.split("-").reverse().join("/");

/** O que o formulário mostra do prazo calculado. */
export type PrazoDaValidade =
  | { tipo: "incompleto"; texto: string }
  | { tipo: "sem-data"; texto: string }
  | { tipo: "nao-vence"; texto: string }
  | { tipo: "vigente" | "vencido"; texto: string; vencimento: string };

/**
 * O prazo calculado para o formulário, com `dataFim` a data de encerramento
 * que vai ser gravada. Vencido = último dia antes de hoje em Brasília (a
 * regra de FC_INATIVAR_LISTAS_VENCIDAS).
 */
export function prazoDaValidade(
  validade: ValidadeDoFormulario,
  dataFim: string | null | undefined,
  agora: Date = new Date(),
): PrazoDaValidade {
  const anos = inteiroNoIntervalo(validade.anos, ANOS_MAXIMOS);
  const meses = inteiroNoIntervalo(validade.meses, MESES_MAXIMOS);
  if (!validadeValida({ ...validade, lida: false }))
    return {
      tipo: "incompleto",
      texto: "Corrija a validade para calcular o prazo.",
    };
  if (anos === null || meses === null || !validade.prorrogado)
    return {
      tipo: "incompleto",
      texto: "Preencha anos, meses e prorrogação para calcular o prazo.",
    };
  if (anos * 12 + meses <= 0)
    return { tipo: "nao-vence", texto: "Sem prazo: a lista não vence." };
  const vencimento = vencimentoDoEdital(
    dataFim,
    anos,
    meses,
    validade.prorrogado === "sim",
  );
  if (!vencimento)
    return {
      tipo: "sem-data",
      texto: "Sem data de encerramento: o prazo conta a partir dela.",
    };
  const vencido = vencimento < hojeEmBrasilia(agora);
  return vencido
    ? {
        tipo: "vencido",
        vencimento,
        texto: `Venceu em ${dataCurta(vencimento)}: ao salvar, a lista de aprovados vigente fica inativa.`,
      }
    : {
        tipo: "vigente",
        vencimento,
        texto: `Válida até ${dataCurta(vencimento)}.`,
      };
}
