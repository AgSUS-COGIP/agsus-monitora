/*
  O mês da agenda das entrevistas (Classificação › Agenda): quando a agenda
  passa de um mês, a lista mostra um mês por vez, com o navegador de mês
  (anterior, atual, próximo; `NavegadorDeMes`, src/ui/). O mês é a chave
  "AAAA-MM"; o navegador anda mês a mês entre o primeiro e o último da agenda
  (o mês sem entrevista aparece vazio). Quem está sem horário aparece em todos
  os meses: é o que falta resolver.
*/
import { MESES } from "../cronograma/calendario-editais.ts";

const CHAVE = /^(\d{4})-(\d{2})$/;

/** "2026-11" de "2026-11-19"; "" sem data válida. */
export function mesDaData(data: string | null | undefined): string {
  const mes = String(data ?? "").slice(0, 7);
  return CHAVE.test(mes) ? mes : "";
}

/** O mês `passo` meses depois (ou antes) de "AAAA-MM". */
export function somarMesesNaChave(mes: string, passo: number): string {
  const m = CHAVE.exec(mes);
  if (!m) return "";
  const indice = Number(m[1]) * 12 + Number(m[2]) - 1 + passo;
  const ano = Math.floor(indice / 12);
  return `${ano}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

/** "Novembro 2026" (como o título do Cronograma). */
export function rotuloDoMesDaChave(mes: string): string {
  const m = CHAVE.exec(mes);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : "";
}

/** Os meses que têm entrevista, em ordem. */
export function mesesDaAgenda(
  itens: ReadonlyArray<{ data?: string | null }>,
): string[] {
  return [
    ...new Set(itens.map((i) => mesDaData(i.data)).filter(Boolean)),
  ].sort();
}

/**
 * O mês em que a agenda abre: o de hoje, se estiver entre o primeiro e o
 * último; antes da agenda, o primeiro; depois, o último.
 */
export function mesInicialDaAgenda(
  meses: ReadonlyArray<string>,
  hoje: string,
): string {
  if (!meses.length) return "";
  return limitarMes(mesDaData(hoje), meses);
}

/** O mês dentro do intervalo da agenda (o primeiro ou o último, fora dele). */
export function limitarMes(mes: string, meses: ReadonlyArray<string>): string {
  if (!meses.length) return "";
  const primeiro = meses[0]!;
  const ultimo = meses[meses.length - 1]!;
  if (!mes || mes < primeiro) return primeiro;
  return mes > ultimo ? ultimo : mes;
}

/** Os itens do mês e os sem horário, na ordem em que vieram. */
export function itensDoMes<T extends { data?: string | null }>(
  itens: ReadonlyArray<T>,
  mes: string,
): T[] {
  return itens.filter((i) => !i.data || mesDaData(i.data) === mes);
}
