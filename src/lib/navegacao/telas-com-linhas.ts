/*
  As páginas (views) que usam as linhas do monitoramento
  (`listar_monitoramento_operacional`, via src/componentes/dados-do-monitoramento.ts).

  Só elas fazem a carga pedir as linhas (src/app/pagina-aberta.ts): a consulta
  é das mais caras do banco e quem só usa, por exemplo, a Avaliação documental
  nunca precisou dela. Levantado pelos imports em 19/10/2026:

  - `dashboard` (Visão geral): recorte, indicadores, tabela, mapas e
    boas-vindas leem as linhas da área (src/modulos/visao-geral/);
  - `mapa` (Mapa, Saúde Indígena): as bolhas e os territórios contam as
    linhas da área, pelo estado da Visão geral (src/modulos/mapa/);
  - `nucleo` (Editais): a tabela é das linhas da área (`usarAreaAtual().linhas`);
  - `calendario` (Cronograma) e `approved` (Lista de aprovados): recortam pelos
    ids dos editais da área (`usarAreaAtual().ids`);
  - `edital` (a página do edital): acha o edital do endereço entre as linhas;
  - `classificacao` e `conduzir-entrevistas`: desde o #927 a entrada da
    Classificação e o seletor de Conduzir entrevistas separam Ativos e
    Histórico pelo status das linhas (`comSituacaoDoMonitoramento`). A entrada
    da Classificação espera as linhas: aberta direto pelo endereço (F5,
    favorito) sem estar aqui, ninguém as pedia e ela ficava no esqueleto para
    sempre (achado da auditoria visual, 23/11/2026).

  As outras páginas que importam dados-do-monitoramento.ts leem só a área
  atual (Análises, Avaliação documental, painel de Entrevistas, Recursos,
  Seleção, Conferências, Aya, menu). Fora das páginas, quem usa as
  linhas pede sozinho, enquanto está montado (`usarLinhasDoMonitoramento`): a
  busca global (Ctrl+K) e o editor de Coordenações, em Acessos.
*/

export const TELAS_COM_LINHAS: ReadonlySet<string> = new Set([
  "dashboard",
  "mapa",
  "nucleo",
  "calendario",
  "approved",
  "edital",
  "classificacao",
  "conduzir-entrevistas",
]);

/** A página (view) usa as linhas do monitoramento? */
export function telaUsaAsLinhas(view: string | null | undefined): boolean {
  return TELAS_COM_LINHAS.has(String(view ?? ""));
}
