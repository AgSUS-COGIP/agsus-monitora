import type { RegistroDaCarta } from "./tipos-da-carta.ts";
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
