/*
  As datas de um vínculo da ficha que valem para concluir: AAAA-MM-DD, fim
  depois do início, nada antes de 1960 (OCR ou digitação: "1902", "0202") e
  nada depois de hoje (fim previsto de contrato, ano trocado). O banco recusa
  o mesmo em FC_PENDENCIAS_FICHA ("vínculo com data inválida", "antes de
  1960", "fim depois de hoje"). A data limite da regra (data_limite do bloco)
  não recusa a linha: só corta a conta (diasDosIntervalos, em pontuacao.ts).
*/

/** A data mais antiga aceita num vínculo (início ou fim). */
export const PRIMEIRA_DATA_DO_VINCULO = "1960-01-01";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Vinculo = { inicio?: unknown; fim?: unknown } | null | undefined;

/** AAAA-MM-DD de verdade (sem 2026-02-30). */
export function dataValida(texto: unknown): texto is string {
  if (typeof texto !== "string" || !DATA.test(texto)) return false;
  const t = Date.parse(`${texto}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === texto;
}

/** Hoje em Brasília (AAAA-MM-DD), como o banco (now() em America/Sao_Paulo). */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
  return `${de("year")}-${de("month")}-${de("day")}`;
}

/**
 * O que falta nas datas do vínculo aceito para concluir (o texto da
 * pendência "datas") ou null. `hoje` em AAAA-MM-DD (padrão: hoje em Brasília).
 */
export function faltaNasDatasDoVinculo(
  vinculo: Vinculo,
  hoje: string = hojeEmBrasilia(),
): string | null {
  const inicio = vinculo?.inicio;
  const fim = vinculo?.fim;
  if (!dataValida(inicio) || !dataValida(fim) || fim < inicio)
    return "Confira o início e o fim do vínculo.";
  if (inicio < PRIMEIRA_DATA_DO_VINCULO)
    return "Vínculo com data antes de 1960: confira o início.";
  if (fim > hoje)
    return "Vínculo com fim depois de hoje: o tempo comprovado vai até a data do documento.";
  return null;
}

/**
 * O fim do vínculo "atual" (até o momento) ao virar linha da ficha: a data
 * limite do bloco (o fim das inscrições, que o banco põe na regra quando ela
 * não diz outra: FC_REGRA_COM_DATA_LIMITE), e não a data de hoje; se o
 * documento foi emitido antes dela, a emissão (o documento só comprova até
 * ali). Sem data limite, a emissão (ou vazio). Nunca depois de hoje. O robô
 * de leitura faz o mesmo (fim_do_vinculo_atual, em experiencia.py).
 */
export function fimDoVinculoAtual({
  emissao,
  dataLimite,
  hoje = hojeEmBrasilia(),
}: {
  emissao?: string | null;
  dataLimite?: string | null;
  hoje?: string;
}): string {
  const ate = dataValida(dataLimite)
    ? dataLimite < hoje
      ? dataLimite
      : hoje
    : null;
  if (!ate) return dataValida(emissao) && emissao <= hoje ? emissao : "";
  return dataValida(emissao) && emissao < ate ? emissao : ate;
}
