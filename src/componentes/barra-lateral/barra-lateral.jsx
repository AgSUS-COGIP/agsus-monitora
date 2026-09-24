import { StrictMode, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AlcaDeRecolher, AlcaNoCabecalho } from "./alca-de-recolher.jsx";
import { assinarBarraLateral, obterEstadoDaBarraLateral } from "./estado.js";
import { Navegacao } from "./menu-de-areas.jsx";
import { Rodape } from "./rodape.jsx";
import { usarBarraRecolhida, usarGaveta } from "./usar-ambiente.js";

/*
  A barra lateral, em React — o primeiro pedaço do front a migrar.

  O React é dono de tudo dentro de `<aside class="sidebar">`: marca, alça de
  recolher, menu de áreas e rodapé. O resto do sistema fala com ela sem tocar
  no DOM dela:
  - o legado empurra a árvore e a página ativa para `estado.js`;
  - a classe de `body` que recolhe a barra, o tema de `html` e a largura
    chegam por `usar-ambiente.js`, avisados por evento;
  - duas folhas continuam do legado, e o React só as cria: o `src` da logo
    (`sidebar-branding.js`) e o texto da versão (`applyConfigToUi`).

  As classes CSS e os ids são os de antes (`platform-shell.css`,
  `barra-lateral.css`), então o visual não depende de onde a barra é montada.
*/

function Marca({ children }) {
  return (
    <div className="side-brand">
      <span className="side-logo-wrap">
        {/*
          O `src` é de `sidebar-branding.js`, dono único da logo (com a volta
          para a padrão no `onerror`). O React cria o <img> uma vez, com a logo
          local, e não mexe mais no `src`: a prop nunca muda.
        */}
        <img
          id="sideLogo"
          className="side-logo"
          src="/assets/agsus-logo.webp"
          alt="AgSUS"
        />
      </span>
      <span className="side-brand-copy">
        <strong>MONITORA</strong>
      </span>
      {children}
    </div>
  );
}

export function BarraLateral() {
  const { arvore, ativo, opcoes } = useSyncExternalStore(
    assinarBarraLateral,
    obterEstadoDaBarraLateral,
  );
  const recolhida = usarBarraRecolhida();
  const gaveta = usarGaveta();
  const trilho = recolhida && !gaveta;

  return (
    <>
      <Marca>{gaveta ? null : <AlcaDeRecolher recolhida={recolhida} />}</Marca>
      <Navegacao
        arvore={arvore}
        ativo={ativo}
        opcoes={opcoes}
        trilho={trilho}
      />
      <Rodape />
      {gaveta ? <AlcaNoCabecalho recolhida={recolhida} /> : null}
    </>
  );
}

/*
  Monta de forma síncrona (`flushSync`): quem roda logo depois — o branding,
  o legado — encontra `#sideLogo`, `#sidebarVersion` e `#nav` no DOM.
*/
export function montarBarraLateral(
  aside = document.querySelector("#appScreen .sidebar"),
) {
  if (!aside) return null;
  const raiz = createRoot(aside);
  flushSync(() => {
    raiz.render(
      <StrictMode>
        <BarraLateral />
      </StrictMode>,
    );
  });
  return raiz;
}
