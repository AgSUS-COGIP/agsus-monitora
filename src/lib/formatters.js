export function formatNumberBR(value, options = {}) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-BR", options)
    : "0";
}
