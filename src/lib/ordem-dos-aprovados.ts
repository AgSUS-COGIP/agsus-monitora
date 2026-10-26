import type { CandidatoDasRegrasDeAprovados } from "./tipos-das-regras-de-aprovados.ts";
import { STATUS_CONTRATADO_EM_OUTRA_LISTA } from "./lista-aprovados-rules.ts";

/*
  A ordem da tabela da aba Aprovados, ao clicar no cabeçalho (o padrão das
  telas com TabelaInfinita): asc → desc → a ordem em que a lista chegou.

  Só reordena as linhas que o navegador já tem; não soma nem conta nada.
  Vazio vai sempre para o fim, nos dois sentidos, e o empate mantém a ordem
  de chegada (a do edital e da classificação).
*/

export type ChaveDaOrdemDosAprovados =
  "nome" | "cargo" | "modalidade" | "classificacao" | "nota" | "situacao";

export interface OrdemDosAprovados {
  chave: ChaveDaOrdemDosAprovados | "";
  sentido: "asc" | "desc" | "";
}

export const SEM_ORDEM: OrdemDosAprovados = Object.freeze({
  chave: "",
  sentido: "",
});

const NUMERICAS = new Set<string>(["classificacao", "nota"]);
const comparador = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});
const texto = (valor: unknown) => String(valor ?? "").trim();

/* A situação como o selo a mostra: o espelho da outra lista tem rótulo próprio. */
function situacaoDaLinha(linha: CandidatoDasRegrasDeAprovados) {
  const status = texto(linha.status);
  return status === "Contratado" &&
    texto(linha.contratacao_situacao) === "OUTRA_LISTA"
    ? STATUS_CONTRATADO_EM_OUTRA_LISTA
    : status;
}

function valorDaColuna(
  linha: CandidatoDasRegrasDeAprovados & { classificacao?: unknown },
  chave: ChaveDaOrdemDosAprovados,
): string | number | null {
  if (chave === "situacao") return situacaoDaLinha(linha) || null;
  const bruto = linha[chave];
  if (NUMERICAS.has(chave)) {
    if (bruto === null || bruto === undefined || texto(bruto) === "")
      return null;
    const numero = Number(String(bruto).replace(",", "."));
    return Number.isFinite(numero) ? numero : null;
  }
  return texto(bruto) || null;
}

/** As linhas na ordem pedida; sem ordem, a própria lista (mesma referência). */
export function ordenarAprovados<
  T extends CandidatoDasRegrasDeAprovados & { classificacao?: unknown },
>(linhas: readonly T[], ordem: OrdemDosAprovados): readonly T[] {
  const { chave, sentido } = ordem;
  if (!chave || !sentido) return linhas;
  const sinal = sentido === "desc" ? -1 : 1;
  return linhas
    .map((linha, indice) => ({
      linha,
      indice,
      valor: valorDaColuna(linha, chave),
    }))
    .sort((a, b) => {
      if (a.valor === null || b.valor === null)
        return a.valor === b.valor
          ? a.indice - b.indice
          : a.valor === null
            ? 1
            : -1;
      const r =
        typeof a.valor === "number" && typeof b.valor === "number"
          ? a.valor - b.valor
          : comparador.compare(String(a.valor), String(b.valor));
      return r ? r * sinal : a.indice - b.indice;
    })
    .map(({ linha }) => linha);
}

/** O próximo sentido ao clicar no cabeçalho: asc → desc → sem ordem. */
export function proximaOrdemDosAprovados(
  atual: OrdemDosAprovados,
  chave: ChaveDaOrdemDosAprovados,
): OrdemDosAprovados {
  if (atual.chave !== chave) return { chave, sentido: "asc" };
  if (atual.sentido === "asc") return { chave, sentido: "desc" };
  return SEM_ORDEM;
}
