/*
  Carregamento contínuo das listas que não cabem na TabelaInfinita (blocos por
  dia, por vaga, cartões): a tela desenha 50 itens por vez e mais 50 ao rolar
  perto do fim ou em "Carregar mais". Desenhar tudo de uma vez travava a tela
  com milhares de linhas. A peça visual e o estado estão em
  src/ui/carga-continua.tsx; aqui, só o recorte.

  `gruposAteOLimite` recorta uma lista de grupos (cada um com os seus itens)
  até `limite` itens no total, na ordem: os grupos inteiros que cabem e, do
  grupo que passa do limite, só os primeiros (com `cortar`) ou ele inteiro
  (sem `cortar`, para grupos curtos que não se partem). Grupo sem item conta
  como um, para o cabeçalho dele não ficar de fora sem fim.
*/

export const ITENS_POR_VEZ = 50;

export interface RecorteDosGrupos<G> {
  grupos: G[];
  /** Itens desenhados (soma dos itens dos grupos recortados). */
  mostrados: number;
  /** Itens de todos os grupos. */
  total: number;
}

export function totalDosGrupos<G>(
  grupos: readonly G[],
  contar: (grupo: G) => number,
): number {
  let total = 0;
  for (const grupo of grupos) total += Math.max(1, contar(grupo));
  return total;
}

export function gruposAteOLimite<G>(
  grupos: readonly G[],
  limite: number,
  {
    contar,
    cortar,
  }: {
    contar: (grupo: G) => number;
    /** Devolve o grupo só com os `quantos` primeiros itens. */
    cortar?: (grupo: G, quantos: number) => G;
  },
): RecorteDosGrupos<G> {
  const saida: G[] = [];
  let mostrados = 0;
  let total = 0;
  for (const grupo of grupos) {
    const quantos = Math.max(1, contar(grupo));
    total += quantos;
    if (mostrados >= limite) continue;
    const cabem = limite - mostrados;
    if (quantos <= cabem || !cortar) {
      saida.push(grupo);
      mostrados += quantos;
    } else {
      saida.push(cortar(grupo, cabem));
      mostrados += cabem;
    }
  }
  return { grupos: saida, mostrados, total };
}
