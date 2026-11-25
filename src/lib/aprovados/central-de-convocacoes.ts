/*
  A Central de convocações (Lista de aprovados › Convocação, #581) no
  endereço e quem a vê. Sem React e sem DOM.

  - A aba da Lista de aprovados e o tipo da central vão na URL
    (`/<área>/aprovados?aba=convocacao&tipo=entrevista`; o padrão não
    aparece): o link copiado e o atalho "Ver em Convocações" abrem no bloco
    certo. Quem escreve é `usarFiltrosNaUrl` (src/app/usar-filtros-na-url.ts).
  - "Para entrevistas" só existe com acesso às Entrevistas e com Conduzir
    entrevistas ligada na área; o atalho das telas de origem (Classificação ›
    Listas e Conduzir › Preparar › Convocação) pede também a própria Lista de
    aprovados, permitida e ligada.
*/

export const ABAS_DOS_APROVADOS = Object.freeze([
  "aprovados",
  "convocacao",
  "pendencias",
] as const);
export type AbaDosAprovados = (typeof ABAS_DOS_APROVADOS)[number];

export const TIPOS_DA_CENTRAL = Object.freeze([
  "contratacao",
  "entrevista",
] as const);
export type TipoDaCentralDeConvocacoes = (typeof TIPOS_DA_CENTRAL)[number];

export const ehAbaDosAprovados = (valor: string): valor is AbaDosAprovados =>
  (ABAS_DOS_APROVADOS as readonly string[]).includes(valor);

export const ehTipoDaCentral = (
  valor: string,
): valor is TipoDaCentralDeConvocacoes =>
  (TIPOS_DA_CENTRAL as readonly string[]).includes(valor);

/**
 * A busca da Lista de aprovados ("a=b", sem "?") que abre a central em "Para
 * entrevistas", a partir da que a tela deixou guardada: os outros filtros
 * dela (o recorte das listas) ficam.
 */
export function buscaDaCentralDasEntrevistas(guardada: string): string {
  const parametros = new URLSearchParams(guardada || "");
  parametros.set("aba", "convocacao");
  parametros.set("tipo", "entrevista");
  return parametros.toString();
}

/** "Para entrevistas" aparece na central (a regra de `podeEntrevistas`). */
export function podeVerEntrevistasNaCentral({
  verEntrevistas,
  conducaoLigada,
}: {
  verEntrevistas: boolean;
  conducaoLigada: boolean;
}): boolean {
  return verEntrevistas && conducaoLigada;
}

/** O atalho "Ver em Convocações" aparece: a central abriria em "Para entrevistas". */
export function podeAbrirCentralDasEntrevistas({
  verAprovados,
  aprovadosLigada,
  verEntrevistas,
  conducaoLigada,
}: {
  verAprovados: boolean;
  aprovadosLigada: boolean;
  verEntrevistas: boolean;
  conducaoLigada: boolean;
}): boolean {
  return (
    verAprovados &&
    aprovadosLigada &&
    podeVerEntrevistasNaCentral({ verEntrevistas, conducaoLigada })
  );
}
