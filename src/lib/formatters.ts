export function formatNumberBR(
  value: unknown,
  options: Intl.NumberFormatOptions = {},
): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-BR", options)
    : "0";
}
