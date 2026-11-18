/*
  A data da cópia guardada no aparelho, para o status discreto do topo das
  telas (src/lib/cache-de-payload.ts guarda a hora). À parte do cache, que
  está no pedaço da entrada: só as telas, que baixam sob demanda, a usam.
*/

/**
 * "Dados de 17/11, 10:14": a data da cópia mostrada quando a versão nova não
 * pôde ser buscada (sem rede ou servidor fora). Vai no status discreto do topo
 * da tela, uma vez só; vazio se a hora for inválida. `fuso` só para o teste.
 */
export function rotuloDaCopia(guardadoEm: unknown, fuso?: string): string {
  const data = new Date(Number(guardadoEm));
  if (!guardadoEm || !Number.isFinite(data.getTime())) return "";
  const dia = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: fuso,
  });
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fuso,
  });
  return `Dados de ${dia}, ${hora}`;
}
