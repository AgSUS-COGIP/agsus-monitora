import { objetoDosRecursos as objeto } from "./dados-dos-recursos.ts";
export { objeto };
export const textoDaAgenda = (v: unknown) => (typeof v === "string" ? v : "");
export function registrosDaAgenda(v: unknown): Record<string, unknown>[] {
  if (v == null) return [];
  if (
    !Array.isArray(v) ||
    !v.every(
      (r): r is Record<string, unknown> =>
        r !== null && typeof r === "object" && !Array.isArray(r),
    )
  )
    throw new Error("Dados da agenda inválidos. Recarregue o edital.");
  return v;
}
export function regraRegistradaDaAgenda(v: unknown) {
  if (v == null) return null;
  const r = objeto(v);
  if (
    typeof r.versao !== "number" ||
    !Number.isInteger(r.versao) ||
    r.versao < 1 ||
    (r.configuracao != null &&
      (typeof r.configuracao !== "object" || Array.isArray(r.configuracao)))
  )
    throw new Error("Regra da agenda inválida.");
  return {
    ...r,
    versao: r.versao,
    configuracao: objeto(r.configuracao),
    atualizado_em: textoDaAgenda(r.atualizado_em),
    por: textoDaAgenda(r.por),
    versoes: registrosDaAgenda(r.versoes).map((x) => ({
      ...x,
      versao: typeof x.versao === "number" ? x.versao : 0,
      em: textoDaAgenda(x.em),
      por: textoDaAgenda(x.por),
      motivo: textoDaAgenda(x.motivo),
    })),
  };
}
export function dadosDaAgenda(v: unknown) {
  const d = objeto(v),
    edital = objeto(d.edital);
  if (typeof edital.id !== "string" || !edital.id)
    throw new Error("Edital da agenda inválido.");
  const itens = registrosDaAgenda(d.itens);
  for (const i of itens)
    if (typeof i.analise_id !== "string" || !i.analise_id)
      throw new Error("Candidato da agenda inválido.");
  for (const i of itens) {
    const partes = [i.data, i.inicio, i.fim, i.banca].filter(
      (v) => v != null && v !== "",
    );
    if (!partes.length) continue;
    if (
      partes.length !== 4 ||
      typeof i.data !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(i.data) ||
      typeof i.inicio !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(i.inicio) ||
      typeof i.fim !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(i.fim) ||
      typeof i.banca !== "number" ||
      !Number.isInteger(i.banca) ||
      i.banca < 1 ||
      i.banca > 20
    )
      throw new Error("Horário da agenda incompleto ou inválido.");
  }
  if (d.ultimo_registro != null && typeof d.ultimo_registro !== "string")
    throw new Error("Registro da agenda inválido.");
  return {
    ...d,
    edital: { ...edital, id: edital.id, edital: textoDaAgenda(edital.edital) },
    pode_editar: d.pode_editar === true,
    regra: regraRegistradaDaAgenda(d.regra),
    itens,
    ultimo_registro:
      typeof d.ultimo_registro === "string" ? d.ultimo_registro : null,
    bancas: registrosDaAgenda(d.bancas).map((b) => ({
      ...b,
      banca: typeof b.banca === "number" ? b.banca : 1,
      membros: registrosDaAgenda(b.membros).map((m) => ({
        ...m,
        nome: textoDaAgenda(m.nome),
      })),
    })),
    historico: registrosDaAgenda(d.historico).map((h) => ({
      ...h,
      id: textoDaAgenda(h.id),
      acao: textoDaAgenda(h.acao),
      em: textoDaAgenda(h.em),
      por: textoDaAgenda(h.por),
      motivo: textoDaAgenda(h.motivo),
      itens: typeof h.itens === "number" ? h.itens : 0,
      alteracoes: typeof h.alteracoes === "number" ? h.alteracoes : 0,
    })),
  };
}
export type DadosDaAgenda = ReturnType<typeof dadosDaAgenda>;
