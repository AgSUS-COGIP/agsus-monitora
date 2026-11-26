/*
  Um formatador por combinação de opções, criado uma vez: `toLocaleString`
  monta um `Intl.NumberFormat` novo a cada chamada, e a Visão geral formata
  milhares de números na abertura (era a função com mais tempo próprio no
  perfil de CPU, auditoria de 26/11/2026, #10). O resultado é o mesmo.
*/
const formatadores = new Map<string, Intl.NumberFormat>();

function formatador(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const chave = JSON.stringify(options);
  let pronto = formatadores.get(chave);
  if (!pronto) {
    pronto = new Intl.NumberFormat("pt-BR", options);
    formatadores.set(chave, pronto);
  }
  return pronto;
}

export function formatNumberBR(
  value: unknown,
  options: Intl.NumberFormatOptions = {},
): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? formatador(options).format(number) : "0";
}
