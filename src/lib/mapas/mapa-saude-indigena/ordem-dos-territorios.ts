/*
  A ORDEM DA LISTA "TERRITÓRIOS" (ao lado do mapa nacional da Saúde Indígena)

  A lista chega por vagas (`territoriosPorVagas`, mapa-nacional.ts: desempate
  pela população). A pessoa pode reordenar:
  - "Vagas": a ordem de chegada, sem mexer;
  - "A–Z": pelo nome, com `Intl.Collator("pt-BR")` (acentos no lugar certo);
  - "Nº do DSEI": a numeração 1–34 do mapa (dseis-oficiais.ts), que é a do
    "Mapa DSEIs"; sem número, no fim;
  - "% preenchidas": da mais preenchida à menos; quem não tem vaga, no fim;
  - "Ociosas": das mais vagas ociosas às menos.
  Empate em qualquer ordem: desempate pelo nome.

  Padrão: "Vagas" no Mapa e no Satélite; "Nº do DSEI" no Mapa DSEIs. Depois
  que a pessoa escolhe, a escolha vale para os dois (o gancho guarda no
  navegador, mapa-nacional.tsx).
*/
import type { TerritorioDoMapa } from "./tipos.ts";
import { numeroDoDsei } from "./dseis-oficiais.ts";

export type OrdemDosTerritorios =
  "vagas" | "alfabetica" | "numero" | "preenchidas" | "ociosas";

export const OPCOES_DE_ORDEM: readonly {
  valor: OrdemDosTerritorios;
  rotulo: string;
  titulo: string;
}[] = Object.freeze([
  { valor: "vagas", rotulo: "Vagas", titulo: "Territórios por vagas" },
  { valor: "alfabetica", rotulo: "A–Z", titulo: "Territórios — A–Z" },
  {
    valor: "numero",
    rotulo: "Nº do DSEI",
    titulo: "Territórios por nº do DSEI",
  },
  {
    valor: "preenchidas",
    rotulo: "% preenchidas",
    titulo: "Territórios por % preenchidas",
  },
  {
    valor: "ociosas",
    rotulo: "Ociosas",
    titulo: "Territórios por vagas ociosas",
  },
]);

/* A ordem guardada, se for uma das opções; senão nenhuma. */
export function ordemValida(valor: unknown): OrdemDosTerritorios | null {
  return OPCOES_DE_ORDEM.some((o) => o.valor === valor)
    ? (valor as OrdemDosTerritorios)
    : null;
}

/* O padrão de cada fundo, enquanto a pessoa não escolhe. */
export function ordemPadrao(simples: boolean): OrdemDosTerritorios {
  return simples ? "numero" : "vagas";
}

export function tituloDaOrdem(ordem: OrdemDosTerritorios): string {
  return (
    OPCOES_DE_ORDEM.find((o) => o.valor === ordem)?.titulo ??
    "Territórios por vagas"
  );
}

const COLADOR = new Intl.Collator("pt-BR", { sensitivity: "base" });
const nomeDe = (t: TerritorioDoMapa) => String(t?.dsei?.n ?? "");
const porNome = (a: TerritorioDoMapa, b: TerritorioDoMapa) =>
  COLADOR.compare(nomeDe(a), nomeDe(b));
const numeroDe = (t: TerritorioDoMapa) =>
  numeroDoDsei(t?.dsei?.k) ?? numeroDoDsei(t?.dsei?.n) ?? Infinity;

const COMPARAR: Record<
  Exclude<OrdemDosTerritorios, "vagas">,
  (a: TerritorioDoMapa, b: TerritorioDoMapa) => number
> = {
  alfabetica: () => 0,
  numero: (a, b) => {
    const na = numeroDe(a);
    const nb = numeroDe(b);
    return na === nb ? 0 : na < nb ? -1 : 1;
  },
  preenchidas: (a, b) =>
    Number(!a.vagas) - Number(!b.vagas) || b.preenchidas - a.preenchidas,
  ociosas: (a, b) => b.ociosas - a.ociosas,
};

/*
  A lista na ordem escolhida, com a `posicao` (o número da linha fora do Mapa
  simples) refeita para a nova ordem. "Vagas" devolve a mesma lista.
*/
export function ordenarTerritorios(
  territorios: readonly TerritorioDoMapa[],
  ordem: OrdemDosTerritorios,
): TerritorioDoMapa[] {
  const lista = Array.isArray(territorios) ? territorios : [];
  if (ordem === "vagas") return [...lista];
  const comparar = COMPARAR[ordem];
  return [...lista]
    .sort((a, b) => comparar(a, b) || porNome(a, b))
    .map((t, indice) => ({ ...t, posicao: indice + 1 }));
}
