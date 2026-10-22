import { useEffect, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.js";
import { AlcaDeRecolher, AlcaNoCabecalho } from "./alca-de-recolher.tsx";
import { assinarBarraLateral, obterEstadoDaBarraLateral } from "./estado.ts";
import { Navegacao } from "./menu-de-areas.tsx";
import { Rodape } from "./rodape.tsx";
import type {
  ArvoreDoMenu,
  ItemAtivoDoMenu,
  OpcoesDaBarraLateral,
  PreviaDaBarraLateral,
} from "./tipos.ts";
import { usarBarraRecolhida, usarGaveta } from "./usar-ambiente.ts";

/*
  A barra lateral, em React — o primeiro pedaço do front a migrar.

  O React é dono de tudo dentro de `<aside class="sidebar">`: marca, menu de
  áreas e rodapé (com o botão de recolher). O resto do sistema fala com ela sem tocar
  no DOM dela:
  - o legado empurra a árvore e a página ativa para `estado.ts`;
  - a classe de `body` que recolhe a barra, o tema de `html` e a largura
    chegam por `usar-ambiente.ts`, avisados por evento;
  - duas folhas continuam do legado, e o React só as cria: o `src` da logo
    (`sidebar-branding.js`) e o texto da versão (`applyConfigToUi`).

  As classes CSS e os ids são os de antes (`platform-shell.css`,
  `barra-lateral.css`), então o visual não depende de onde a barra é montada.

  A prévia de Configurações › Marca (`previa-da-barra-lateral.tsx`) desenha
  estas mesmas peças (`PecasDaBarraLateral`) com `previa`: logo, cor, tema e
  versão vêm do rascunho, não do legado, e nada grava nem avisa ninguém.
  Mudou a barra, mudou a prévia (`tests/componentes/previa-da-barra-lateral.test.js`).
*/

/*
  Na prévia, a logo é a do rascunho, com a volta para a padrão se o endereço
  não carregar (o que `sidebar-branding.js` faz na barra de verdade).
*/
function usarLogoDaPrevia(logo: string | undefined) {
  const [falhou, definirFalhou] = useState("");
  if (logo === undefined) return { src: LOGO_PADRAO_DA_BARRA };
  return {
    src: falhou === logo ? LOGO_PADRAO_DA_BARRA : logo,
    onError: () => definirFalhou(logo),
  };
}

function Marca({ logo }: { logo?: string }) {
  const imagem = usarLogoDaPrevia(logo);
  return (
    <div className="side-brand" data-tour="barra-marca">
      <span className="side-logo-wrap">
        {/*
          O `src` é de `sidebar-branding.js`, dono único da logo (com a volta
          para a padrão no `onerror`). O React cria o <img> uma vez, com a logo
          local, e não mexe mais no `src`: a prop nunca muda (só na prévia).
        */}
        <img id="sideLogo" className="side-logo" alt="AgSUS" {...imagem} />
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
function usarDicasDoTrilho(trilho: boolean) {
  useEffect(() => {
    if (!trilho) return undefined;
    const posicionar = (evento: Event) => {
      const alvo =
        evento.target instanceof Element
          ? evento.target.closest<HTMLElement>(".sidebar [data-dica]")
          : null;
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

/** As peças da barra (marca, menu e rodapé), as mesmas na barra e na prévia. */
export function PecasDaBarraLateral({
  arvore,
  ativo,
  opcoes,
  trilho,
  recolhida,
  gaveta,
  previa = null,
}: {
  arvore: ArvoreDoMenu;
  ativo: ItemAtivoDoMenu;
  opcoes: OpcoesDaBarraLateral;
  trilho: boolean;
  recolhida: boolean;
  gaveta: boolean;
  previa?: PreviaDaBarraLateral | null;
}) {
  return (
    <>
      <Marca logo={previa?.logo} />
      <Navegacao
        arvore={arvore}
        ativo={ativo}
        opcoes={opcoes}
        trilho={trilho}
        previa={Boolean(previa)}
      />
      <Rodape
        previa={previa}
        alca={gaveta ? null : <AlcaDeRecolher recolhida={recolhida} />}
      />
      {gaveta ? <AlcaNoCabecalho recolhida={recolhida} /> : null}
    </>
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
  usarDicasDoTrilho(trilho);

  return (
    <PecasDaBarraLateral
      arvore={arvore}
      ativo={ativo}
      opcoes={opcoes}
      trilho={trilho}
      recolhida={recolhida}
      gaveta={gaveta}
    />
  );
}

/*
  Monta de forma síncrona (`flushSync`): quem roda logo depois — o branding,
  o legado — encontra `#sideLogo`, `#sidebarVersion` e `#nav` no DOM.
*/
export function montarBarraLateral(
  aside: Element | null = document.querySelector("#appScreen .sidebar"),
) {
  if (!aside) return null;
  return montarModulo(aside, <BarraLateral />, {
    flushSync: true,
    nome: "a barra lateral",
  }).raiz;
}
