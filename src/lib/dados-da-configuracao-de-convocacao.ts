/** Respostas incompletas não podem produzir uma configuração parcial de vagas. */
const erro = () =>
  new Error(
    "Configuração de convocação inválida. Recarregue os modelos e as vagas.",
  );
export function registroDaConfiguracao(
  valor: unknown,
): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw erro();
  return Object.fromEntries(Object.entries(valor));
}
export function linhasDaConfiguracao(
  valor: unknown,
): Record<string, unknown>[] {
  if (valor == null) return [];
  if (!Array.isArray(valor)) throw erro();
  return valor.map(registroDaConfiguracao);
}
export function identificadorDaConfiguracao(valor: unknown): string {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  throw erro();
}
export function chaveUnicaDaConfiguracao(
  chave: string,
  usadas: Set<string>,
): string {
  if (usadas.has(chave)) throw erro();
  usadas.add(chave);
  return chave;
}
export function quadroDaConfiguracao(valor: unknown): Record<string, unknown> {
  return valor == null ? {} : registroDaConfiguracao(valor);
}
