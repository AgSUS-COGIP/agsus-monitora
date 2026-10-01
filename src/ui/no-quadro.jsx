import { createContext, useContext } from "react";

/*
  TRANSIÇÃO DA ETAPA 2 (docs/arquitetura-react.md).

  Os componentes de src/ui/ desenham, por padrão, para dentro do app: classes
  `.ui-*` (ui.css, só tokens) e nenhum id fixo. Entrevistas e Seleção ainda
  rodam em página própria, num quadro, com o CSS de src/analises/: elas montam
  dentro de <PainelNoQuadro>, e aí os mesmos componentes devolvem a marcação de
  antes, idêntica (`.topbar`, `.kpi`, `.filter-panel`, `.analises-drawer`…, e
  os ids que aquele CSS e os testes deles usam).

  Quando Entrevistas e Seleção saírem do quadro, este arquivo e o ramo "no
  quadro" de cada componente saem juntos.
*/
const NoQuadro = createContext(false);

export function PainelNoQuadro({ children }) {
  return <NoQuadro.Provider value={true}>{children}</NoQuadro.Provider>;
}

/** Verdadeiro dentro de um painel que ainda roda no quadro (iframe). */
export function usarNoQuadro() {
  return useContext(NoQuadro);
}
