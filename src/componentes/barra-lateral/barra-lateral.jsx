import { useEffect, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { AlcaDeRecolher, AlcaNoCabecalho } from "./alca-de-recolher.jsx";
import { assinarBarraLateral, obterEstadoDaBarraLateral } from "./estado.js";
import { Navegacao } from "./menu-de-areas.jsx";
import { Rodape } from "./rodape.jsx";
import { usarBarraRecolhida, usarGaveta } from "./usar-ambiente.js";

/*
  A barra lateral, em React — o primeiro pedaço do front a migrar.

  O React é dono de tudo dentro de `<aside class="sidebar">`: marca, menu de
  áreas e rodapé (com o botão de recolher). O resto do sistema fala com ela sem tocar
  no DOM dela:
  - o legado empurra a árvore e a página ativa para `estado.js`;
  - a classe de `body` que recolhe a barra, o tema de `html` e a largura
    chegam por `usar-ambiente.js`, avisados por evento;
  - duas folhas continuam do legado, e o React só as cria: o `src` da logo
    (`sidebar-branding.js`) e o texto da versão (`applyConfigToUi`).

  As classes CSS e os ids são os de antes (`platform-shell.css`,
  `barra-lateral.css`), então o visual não depende de onde a barra é montada.
*/

function Marca() {
  return (
    <div className="side-brand" data-tour="barra-marca">
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
    </div>
  );
}

/*
  No trilho, todo controle só com ícone tem uma dica com o nome (`data-dica`,
  desenhada em `barra-lateral.css`), no ponteiro e no foco. A dica é
  `position: fixed` — a navegação rola e recortaria uma dica absoluta —, então
  a altura dela vem daqui: ao apontar ou focar um controle com dica, grava o
  centro dele em `--dica-topo`. Um ouvinte só, delegado no documento.
*/
function usarDicasDoTrilho(trilho) {
  useEffect(() => {
    if (!trilho) return undefined;
    const posicionar = (evento) => {
      const alvo = evento.target?.closest?.(".sidebar [data-dica]");
      if (!alvo) return;
      const caixa = alvo.getBoundingClientRect();
      alvo.style.setProperty(
        "--dica-topo",
        `${Math.round(caixa.top + caixa.height / 2)}px`,
      );
    };
    document.addEventListener("pointerover", posicionar);
    document.addEventListener("focusin", posicionar);
    return () => {
      document.removeEventListener("pointerover", posicionar);
      document.removeEventListener("focusin", posicionar);
    };
  }, [trilho]);
}

export function BarraLateral() {
  const { arvore, ativo, opcoes } = useSyncExternalStore(
    assinarBarraLateral,
    obterEstadoDaBarraLateral,
  );
  const recolhida = usarBarraRecolhida();
  const gaveta = usarGaveta();
  const trilho = recolhida && !gaveta;
  usarDicasDoTrilho(trilho);

  return (
    <>
      <Marca />
      <Navegacao
        arvore={arvore}
        ativo={ativo}
        opcoes={opcoes}
        trilho={trilho}
      />
      <Rodape alca={gaveta ? null : <AlcaDeRecolher recolhida={recolhida} />} />
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
  return montarModulo(aside, <BarraLateral />, {
    flushSync: true,
    nome: "a barra lateral",
  }).raiz;
}
