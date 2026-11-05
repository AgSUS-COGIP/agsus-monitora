import { createContext } from "react";

/*
  O que a página de Configurações (src/app/telas.tsx) entrega à moldura
  (configuracoes.tsx): a `<section id="page-config">` (o Ctrl+S só vale com
  ela ativa) e o corpo de cada seção (`.config-secao__corpo`), onde as
  seções da moldura entram por portal. A seção aberta vem da navegação
  (`/administracao/configuracoes/<seção>`).
*/
export interface PaginaDeConfiguracoes {
  pagina: Element | null;
  corpos: Partial<Record<string, Element | null>>;
}

export const ContextoDaPaginaDeConfiguracoes =
  createContext<PaginaDeConfiguracoes>({ pagina: null, corpos: {} });
