/*
  Distribuição das fichas da avaliação documental entre os analistas do
  edital (docs/analises-no-monitora/, fase F3). Sem DOM e sem estado.

  A mesma conta existe em Python (python/monitora/avaliacao_documental/
  distribuicao.py), que o job da triagem usa para dar as fichas
  que entram depois a quem tem menos pendentes. Os dois lados rodam os
  MESMOS casos dourados: tests/fixtures/avaliacao-documental/
  casos-de-distribuicao.json (vitest e pytest). Mudou aqui, muda lá.

  Regra: as fichas vão na ordem recebida (a da Provisória); cada uma vai
  para o analista que pode pegá-la (analisa a vaga e cabe no limite) com a
  menor carga (as pendentes que já tem + as que recebeu agora); empate fica
  com quem vem primeiro na lista de analistas (o banco manda na ordem do id).
  Com todos começando do zero, dá partes iguais (300 fichas, 3 analistas:
  100 cada). O limite de cada um é o da equipe (QT_LIMITE_FICHA) e, no
  critério LIMITE, também o da regra (limite_por_analista); o menor vale.
  Ficha que ninguém pode pegar fica na sobra (livre na fila).
*/

/** Uma ficha a distribuir, na ordem da Provisória. */
export interface FichaADistribuir {
  id: string;
  vaga?: string | number | null;
}

/** Um analista da equipe: vagas null = todas; limite = QT_LIMITE_FICHA. */
export interface AnalistaDaDistribuicao {
  usuario?: string | null;
  vagas?: ReadonlyArray<string | number> | null;
  limite?: number | null;
  pendentes?: number | null;
}

export type CriterioDaDistribuicao = "PARTES_IGUAIS" | "LIMITE";

export interface PedidoDeDistribuicao {
  fichas?: ReadonlyArray<FichaADistribuir>;
  analistas?: ReadonlyArray<AnalistaDaDistribuicao>;
  criterio?: CriterioDaDistribuicao | string;
  limite_por_analista?: number | null;
}

export interface AtribuicaoDaFicha {
  ficha: string;
  usuario: string;
}

export interface ResultadoDaDistribuicao {
  atribuicoes: AtribuicaoDaFicha[];
  sobra: string[];
  por_analista: Record<string, number>;
}

/** O analista já normalizado, com a carga contada durante a distribuição. */
interface PessoaNaDistribuicao {
  usuario: string;
  vagas: string[] | null;
  teto: number | null;
  carga: number;
  novas: number;
}

const inteiroPositivo = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.floor(v) : null;

/** O teto de fichas (pendentes + novas) de um analista; null = sem teto. */
export function tetoDoAnalista(
  analista: AnalistaDaDistribuicao | null | undefined,
  criterio: string | null | undefined,
  limitePorAnalista: unknown,
): number | null {
  const tetos = [inteiroPositivo(analista?.limite)];
  if (criterio === "LIMITE") tetos.push(inteiroPositivo(limitePorAnalista));
  const validos = tetos.filter((t) => t !== null);
  return validos.length ? Math.min(...validos) : null;
}

const analisaVaga = (
  analista: PessoaNaDistribuicao,
  vaga: FichaADistribuir["vaga"],
): boolean =>
  !Array.isArray(analista?.vagas) || analista.vagas.includes(String(vaga));

/**
 * Distribui as fichas.
 *   fichas      [{ id, vaga }] na ordem em que devem ser dadas
 *   analistas   [{ usuario, vagas (null = todas), limite, pendentes }]
 *   criterio    "PARTES_IGUAIS" (padrão) ou "LIMITE"
 *   limite_por_analista  número ou null
 * Devolve { atribuicoes: [{ ficha, usuario }], sobra: [ids], por_analista: { usuario: novas } }.
 */
export function distribuirFichas({
  fichas = [],
  analistas = [],
  criterio = "PARTES_IGUAIS",
  limite_por_analista: limitePorAnalista = null,
}: PedidoDeDistribuicao = {}): ResultadoDaDistribuicao {
  const pessoas = (Array.isArray(analistas) ? analistas : [])
    .filter((a) => a?.usuario)
    .map((a): PessoaNaDistribuicao => ({
      usuario: String(a.usuario),
      vagas: Array.isArray(a.vagas) ? a.vagas.map(String) : null,
      teto: tetoDoAnalista(a, criterio, limitePorAnalista),
      carga:
        typeof a.pendentes === "number" && Number.isFinite(a.pendentes)
          ? a.pendentes
          : 0,
      novas: 0,
    }));
  const atribuicoes: AtribuicaoDaFicha[] = [];
  const sobra: string[] = [];
  for (const ficha of Array.isArray(fichas) ? fichas : []) {
    let escolhido: PessoaNaDistribuicao | null = null;
    for (const p of pessoas) {
      if (!analisaVaga(p, ficha.vaga)) continue;
      if (p.teto !== null && p.carga >= p.teto) continue;
      if (!escolhido || p.carga < escolhido.carga) escolhido = p;
    }
    if (!escolhido) {
      sobra.push(ficha.id);
      continue;
    }
    escolhido.carga += 1;
    escolhido.novas += 1;
    atribuicoes.push({ ficha: ficha.id, usuario: escolhido.usuario });
  }
  const porAnalista: Record<string, number> = {};
  for (const p of pessoas) porAnalista[p.usuario] = p.novas;
  return { atribuicoes, sobra, por_analista: porAnalista };
}
