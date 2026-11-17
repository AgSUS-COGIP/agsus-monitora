/*
  Rótulo de gráfico em linhas: o Chart.js desenha um array como várias linhas.
  Sem isto, no celular os rótulos do eixo se sobrepunham ("Cancelados",
  "Questionário não finalizado" e "Eliminados por nota" viravam um borrão) e
  os nomes longos das unidades eram cortados à esquerda.

  Quebra entre palavras, até `largura` caracteres por linha e no máximo
  `linhas` linhas; o que sobrar vira reticências na última. Palavra maior que
  a largura fica inteira na sua linha (cortar no meio confunde mais).
*/
export function rotuloEmLinhas(
  rotulo: unknown,
  largura = 14,
  linhas = 3,
): string[] {
  const palavras = String(rotulo ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const saida: string[] = [];
  for (const palavra of palavras) {
    const atual = saida.at(-1);
    if (atual !== undefined && `${atual} ${palavra}`.length <= largura)
      saida[saida.length - 1] = `${atual} ${palavra}`;
    else saida.push(palavra);
  }
  if (saida.length <= linhas) return saida;
  const cabem = saida.slice(0, linhas);
  cabem[linhas - 1] = `${cabem[linhas - 1]}…`;
  return cabem;
}
