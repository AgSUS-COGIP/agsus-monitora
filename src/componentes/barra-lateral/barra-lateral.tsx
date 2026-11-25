import { useEffect, useState, useSyncExternalStore } from "react";
import { LOGO_PADRAO_DA_BARRA } from "../../lib/navegacao/marca-da-barra-lateral.ts";
import { SimboloDoYeende } from "../../ui/simbolo-do-yeende.tsx";
import { AlcaDeRecolher, AlcaNoCabecalho } from "./alca-de-recolher.tsx";
import { assinarBarraLateral, obterEstadoDaBarraLateral } from "./estado.ts";
import {
  aplicarMarcaDaBarraLateral,
  assinarMarcaDaBarraLateral,
  logoDaBarraLateral,
} from "./marca.ts";
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
  - a logo e a cor gravadas chegam por `marca.ts` (Configurações › Aparência
    e a leitura da configuração as aplicam);
  - uma folha continua do legado, e o React só a cria: o texto da versão
    (`applyConfigToUi`).

  As classes CSS e os ids são os de antes (`platform-shell.css`,
  `barra-lateral.css`), então o visual não depende de onde a barra é montada.

  A prévia de Configurações › Marca (`previa-da-barra-lateral.tsx`) desenha
  estas mesmas peças (`PecasDaBarraLateral`) com `previa`: logo, cor, tema e
  versão vêm do rascunho, não do legado, e nada grava nem avisa ninguém.
  Mudou a barra, mudou a prévia (`tests/componentes/previa-da-barra-lateral.test.js`).
*/

/*
  A logo: a gravada (`marca.ts`) ou, na prévia, a do rascunho. Se o endereço
  não carregar, volta para a padrão em vez de esconder a imagem — uma logo
  tem de aparecer mesmo quando a leitura do banco falha.
*/
function usarLogo(logo: string) {
  const [falhou, definirFalhou] = useState("");
  return {
    src: falhou === logo ? LOGO_PADRAO_DA_BARRA : logo,
    onError: () => definirFalhou(logo),
  };
}

/** A logo gravada, com a volta para a padrão: a da barra e a do cabeçalho no celular. */
export function usarLogoDaMarca(logo?: string) {
  const gravada = useSyncExternalStore(
    assinarMarcaDaBarraLateral,
    logoDaBarraLateral,
    logoDaBarraLateral,
  );
  return usarLogo(logo ?? gravada);
}

/*
  A logo padrão é o símbolo do Yeendé (25/11/2026), desenhado em linha
  (`SimboloDoYeende`): cores do manual e corpo na cor do texto da barra, sem o
  filtro que deixa branca a logo institucional enviada. Logo enviada em
  Configurações › Aparência continua `<img>`, com a volta para o símbolo.
*/
export function LogoDaMarca({
  logo,
  id,
  className,
  classeDoSimbolo,
  alt,
  altura,
}: {
  logo?: string;
  id?: string;
  className: string;
  classeDoSimbolo: string;
  alt: string;
  altura: number;
}) {
  const imagem = usarLogoDaMarca(logo);
  if (imagem.src === LOGO_PADRAO_DA_BARRA)
    return <SimboloDoYeende className={classeDoSimbolo} altura={altura} />;
  return <img id={id} className={className} alt={alt} {...imagem} />;
}

function Marca({ logo }: { logo?: string }) {
  return (
    <div className="side-brand" data-tour="barra-marca">
      <span className="side-logo-wrap">
        <LogoDaMarca
          logo={logo}
          id="sideLogo"
          className="side-logo"
          classeDoSimbolo="side-simbolo"
          alt="AgSUS"
          altura={22}
        />
      </span>
      <span className="side-brand-copy">
        <strong>Yeendé</strong>
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
