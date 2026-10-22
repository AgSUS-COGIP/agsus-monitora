import type { RegistroDaCarta, CartaDoHistorico } from "./tipos-da-carta.ts";
export function objetoDaCarta(v: unknown): RegistroDaCarta {
  if (v == null) return {};
  if (typeof v !== "object" || Array.isArray(v))
    throw new Error("Dados da carta inválidos. Recarregue os modelos.");
  return Object.fromEntries(Object.entries(v));
}
export function registrosDaCarta(v: unknown): RegistroDaCarta[] {
  if (v == null) return [];
  if (
    !Array.isArray(v) ||
    v.some((r) => !r || typeof r !== "object" || Array.isArray(r))
  )
    throw new Error("Dados da carta inválidos. Recarregue os modelos.");
  return v.map(objetoDaCarta);
}

/** Todas as cartas são conferidas antes de mostrar o histórico. */
export function cartasDoHistorico(v: unknown): CartaDoHistorico[] {
  return registrosDaCarta(v).map((r) => {
    if (
      typeof r.carta_id !== "string" ||
      !r.carta_id.trim() ||
      [
        r.modelo,
        r.emitida_em,
        r.usuario,
        r.saida,
        r.data_limite,
        r.convocacao_marcada,
      ].some((x) => x != null && typeof x !== "string") ||
      [r.versao, r.candidatos].some(
        (x) => x != null && typeof x !== "string" && typeof x !== "number",
      )
    )
      throw new Error(
        "Histórico de cartas inválido. Tente carregar novamente.",
      );
    return {
      ...r,
      carta_id: r.carta_id,
      modelo: textoDoHistorico(r.modelo),
      emitida_em: textoDoHistorico(r.emitida_em),
      usuario: textoDoHistorico(r.usuario),
      saida: textoDoHistorico(r.saida),
      data_limite: textoDoHistorico(r.data_limite),
      convocacao_marcada: textoDoHistorico(r.convocacao_marcada),
      versao: numeroOuTextoDoHistorico(r.versao),
      candidatos: numeroOuTextoDoHistorico(r.candidatos),
    };
  });
}
function textoDoHistorico(v: unknown) {
  return typeof v === "string" ? v : null;
}
function numeroOuTextoDoHistorico(v: unknown) {
  return typeof v === "number" || typeof v === "string" ? v : null;
}
export function resultadoDeMarcar(
  v: unknown,
): (RegistroDaCarta & { marcados: number }) | null {
  if (!v) return null;
  const r = objetoDaCarta(v);
  return typeof r.marcados === "number" &&
    Number.isSafeInteger(r.marcados) &&
    r.marcados >= 0
    ? { ...r, marcados: r.marcados }
    : null;
}

export const MENSAGEM_CONFIRMACAO_DA_CARTA =
  "A solicitação da carta foi enviada, mas a confirmação está incompleta. Confira o histórico antes de tentar outra emissão.";
export function idConfirmadoDaCarta(v: unknown): string {
  const id = objetoDaCarta(v).carta_id;
  if (
    (typeof id === "string" && id.trim()) ||
    (typeof id === "number" && Number.isFinite(id))
  )
    return String(id).trim();
  throw new Error(MENSAGEM_CONFIRMACAO_DA_CARTA);
}
