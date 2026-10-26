/*
  Os editais que aparecem no seletor da Avaliação documental: só os vigentes
  (nem concluídos nem cancelados, pela mesma regra dos indicadores do
  monitoramento, ehEditalEncerrado) e ativos, como nos outros seletores de
  edital do app; "Mostrar todos os editais da área" traz todos. O edital já
  escolhido continua na lista mesmo se não for vigente.
*/
import { ehEditalEncerrado } from "../indicadores-do-monitoramento.ts";

/** O mínimo de um edital da lista que o seletor confere (id e ativo). */
export interface EditalDaEscolha {
  id?: string | null;
  ativo?: boolean | null;
}

/** O edital está vigente (ativo e nem concluído nem cancelado)? */
export const editalVigente = (
  edital: EditalDaEscolha | null | undefined,
): boolean =>
  Boolean(edital) && edital!.ativo !== false && !ehEditalEncerrado(edital);

/**
 * Os editais da escolha: os vigentes (ou todos, com `todos`) e o escolhido.
 * Devolve { lista, ocultos } — ocultos = quantos ficaram de fora.
 */
export function editaisDaEscolha<T extends EditalDaEscolha>(
  editais: ReadonlyArray<T> | null | undefined,
  {
    todos = false,
    escolhido = "",
  }: { todos?: boolean; escolhido?: string } = {},
): { lista: ReadonlyArray<T>; ocultos: number } {
  const base: ReadonlyArray<T> = Array.isArray(editais) ? editais : [];
  const lista = todos
    ? base
    : base.filter((e) => editalVigente(e) || (escolhido && e.id === escolhido));
  return { lista, ocultos: base.length - lista.length };
}
