/*
  O CICLO DO EDITAL (13/11/2026: "os editais tiveram ciclos")

  O banco guardava o ciclo de vários jeitos ("1º CICLO", "4", "4º", "5º"); a
  migration 20261113210000 padronizou como "Nº ciclo". A tela e o formulário
  usam a mesma regra, para um valor antigo ou digitado à mão sair igual.
*/

/** "1º CICLO", "4", "4º" → "1º ciclo", "4º ciclo"; sem número, o texto como veio. */
export function cicloPadronizado(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  const numero = texto.match(/\d+/)?.[0];
  return numero ? `${Number(numero)}º ciclo` : texto;
}

/** O número do ciclo, para ordenar; sem número, nulo. */
export function numeroDoCiclo(valor: unknown): number | null {
  const numero = String(valor ?? "").match(/\d+/)?.[0];
  return numero ? Number(numero) : null;
}

/** As opções do formulário do edital: do 1º ao 9º ciclo e o valor atual, se for outro. */
export function opcoesDeCiclo(atual: unknown = ""): string[] {
  const opcoes = Array.from({ length: 9 }, (_, i) => `${i + 1}º ciclo`);
  const valor = cicloPadronizado(atual);
  return valor && !opcoes.includes(valor) ? [...opcoes, valor] : opcoes;
}
