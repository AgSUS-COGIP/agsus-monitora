/*
  As páginas (views) que usam as linhas do monitoramento
  (`listar_monitoramento_operacional`, via src/componentes/dados-do-monitoramento.ts).

  Só elas fazem a carga pedir as linhas (src/app/pagina-aberta.ts): a consulta
  é das mais caras do banco e quem só usa, por exemplo, a Avaliação documental
  nunca precisou dela. Levantado pelos imports em 19/10/2026:

  - `dashboard` (Visão geral): recorte, indicadores, tabela, mapas e
    boas-vindas leem as linhas da área (src/modulos/visao-geral/);
  - `nucleo` (Editais): a tabela é das linhas da área (`usarAreaAtual().linhas`);
  - `calendario` (Cronograma) e `approved` (Lista de aprovados): recortam pelos
    ids dos editais da área (`usarAreaAtual().ids`).

  As outras páginas que importam dados-do-monitoramento.ts leem só a área
  atual (Análises, Avaliação documental, Classificação, Entrevistas,
  Recursos, Seleção, Conferências, Aya, menu). Fora das páginas, quem usa as
  linhas pede sozinho, enquanto está montado (`usarLinhasDoMonitoramento`): a
  busca global (Ctrl+K) e o editor de Coordenações, em Acessos.
*/

export const TELAS_COM_LINHAS: ReadonlySet<string> = new Set([
  "dashboard",
  "nucleo",
  "calendario",
  "approved",
]);

/** A página (view) usa as linhas do monitoramento? */
export function telaUsaAsLinhas(view: string | null | undefined): boolean {
  return TELAS_COM_LINHAS.has(String(view ?? ""));
}
