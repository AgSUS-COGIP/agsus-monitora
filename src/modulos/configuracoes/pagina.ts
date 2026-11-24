import { createContext } from "react";

/*
  O que a página de Configurações (src/app/telas.tsx) entrega à moldura
  (configuracoes.tsx): a `<section id="page-config">` (o Ctrl+S só vale com
  ela ativa), o corpo de cada seção (`.config-secao__corpo`), onde as
  seções da moldura entram por portal, e o pé da página (`.config-rodape`),
  onde entra a barra de salvar. A seção aberta vem da navegação
  (`/administracao/configuracoes/<seção>`).
*/
export interface PaginaDeConfiguracoes {
  pagina: Element | null;
  corpos: Partial<Record<string, Element | null>>;
  rodape: Element | null;
}

export const ContextoDaPaginaDeConfiguracoes =
  createContext<PaginaDeConfiguracoes>({
    pagina: null,
    corpos: {},
    rodape: null,
  });
