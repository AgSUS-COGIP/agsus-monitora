/*
  Formato do skeleton da entrada: o desenho do conteúdo enquanto o sistema carrega.

  O skeleton imita a tela que vai abrir, e a tela que abre é a última guardada
  (`startView` no legado). Três formatos cobrem as telas:

  - "painel": Saúde Indígena (filtros, indicadores e mapa). É também a tela
    inicial quando não há nada guardado ou quando o guardado é um painel
    externo, que `startView` nunca reabre;
  - "calendario": o Calendário de Editais;
  - "tabela": o resto (Editais, Lista de aprovados, Configurações...).

  O script `marcarSessaoGuardada`, no <head> do index.html, repete esta regra
  antes da primeira pintura, porque lá não dá para importar módulo.
  `tests/esqueleto-da-entrada.test.js` garante que os dois dão o mesmo formato.
*/

export const FORMATOS_DO_ESQUELETO = Object.freeze([
  "painel",
  "tabela",
  "calendario",
]);

export function formatoDoEsqueleto(visao) {
  const tela = String(visao ?? "").trim();
  if (tela === "calendario") return "calendario";
  if (!tela || tela === "dashboard" || tela.startsWith("panel:"))
    return "painel";
  return "tabela";
}
