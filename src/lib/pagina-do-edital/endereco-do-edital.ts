/*
  O endereço da página do edital (`/<área>/edital/<número-ano>`), sem DOM e
  leve: quem leva à página (gaveta da Visão geral, Editais, Cronograma, busca
  global) importa só isto, não a página (src/lib/pagina-do-edital/pagina-do-edital.ts).

  O endereço usa o número do edital ("105-2026"), que é o que a pessoa lê e
  compartilha. Dois editais de mesmo número na área (raro, mas acontece entre
  unidades) não cabem num endereço só: o de cada um passa a ser o id do
  monitoramento, e o número abre a escolha entre eles.
*/

import { numeroDoEdital } from "../editais/numero-do-edital.ts";

const txt = (valor: unknown) => String(valor ?? "").trim();

/** O que a página usa de uma linha do monitoramento (`TB_MONITORAMENTO_INDIGENA`). */
export interface LinhaDoEdital {
  [campo: string]: unknown;
  id?: string | number | undefined;
  edital?: string | undefined;
  unidade?: string | undefined;
  vagas_total?: number | string | undefined;
  vagas_reabertas?: number | undefined;
  contratados?: number | string | undefined;
  /** Pessoas na lista de aprovados vigente; nulo sem lista. */
  aprovados?: number | null | undefined;
  /** Aprovados da lista vigente ainda sem status; nulo sem lista. */
  cadastro_reserva?: number | null | undefined;
  desistentes?: number | undefined;
}

/** O que o endereço pede: um edital, a escolha entre vários, ou nenhum. */
export type EditalDoEndereco<T> =
  | { tipo: "um"; linha: T }
  | { tipo: "varios"; linhas: T[] }
  | { tipo: "nenhum" };

const NUMERO_NO_ENDERECO = /^(\d{1,4})-(\d{4})$/;

/** "105/2026" → "105-2026" (o pedaço do endereço); "" sem número. */
export function numeroNoEndereco(edital: unknown): string {
  return numeroDoEdital(edital).replace("/", "-");
}

/**
 * O edital que o endereço pede, entre as linhas da área: pelo id do
 * monitoramento ou pelo número ("105-2026", "091-2026" vale como "91/2026").
 */
export function editalDoEndereco<T extends LinhaDoEdital>(
  pedaco: unknown,
  linhas: readonly T[] | null | undefined,
): EditalDoEndereco<T> {
  const pedido = txt(pedaco);
  const lista = Array.isArray(linhas) ? linhas : [];
  if (!pedido) return { tipo: "nenhum" };
  const peloId = lista.find((linha) => txt(linha.id) === pedido);
  if (peloId) return { tipo: "um", linha: peloId };
  const partes = pedido.match(NUMERO_NO_ENDERECO);
  if (!partes) return { tipo: "nenhum" };
  const numero = `${Number(partes[1])}/${partes[2]}`;
  const doNumero = lista.filter(
    (linha) => numeroDoEdital(linha.edital) === numero,
  );
  if (doNumero.length === 1) return { tipo: "um", linha: doNumero[0]! };
  if (doNumero.length > 1) return { tipo: "varios", linhas: doNumero };
  return { tipo: "nenhum" };
}

/**
 * O pedaço do endereço de um edital: o número, se só ele tem esse número na
 * área; senão (ou sem número), o id do monitoramento.
 */
export function enderecoDoEdital(
  linha: LinhaDoEdital,
  linhasDaArea: readonly LinhaDoEdital[] | null | undefined,
): string {
  const numero = numeroDoEdital(linha.edital);
  const id = txt(linha.id);
  if (!numero) return id;
  const iguais = (linhasDaArea || []).filter(
    (outra) => numeroDoEdital(outra.edital) === numero,
  ).length;
  return iguais <= 1
    ? numero.replace("/", "-")
    : id || numero.replace("/", "-");
}
