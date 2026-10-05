import { useState } from "react";
import { createPortal } from "react-dom";
import { Icone } from "../icone.jsx";

/*
  Um controle só para recolher a barra, com o id de sempre,
  `#globalSidebarToggle`. Ele muda de casa conforme a largura:

    acima de 900px  -> no rodapé da barra, entre o tema e o Sair, no mesmo
                       lugar com a barra expandida ou recolhida (ícone
                       "panel-left"; expandida, com o texto ao lado)
    até 900px       -> no cabeçalho, na vaga do hambúrguer (portal)

  Antes, acima de 900px, era uma alça redonda pendurada na borda da barra,
  sobre a logo: pequena, longe dos outros controles da barra e fácil de não
  ver. No rodapé ela fica junto do tema e do Sair, onde se procura.

  No estreito ele não pode ficar dentro da barra: a gaveta é `position: fixed`
  com `transform: translateX(-105%)`, e um botão lá dentro sairia da tela junto
  com ela — inalcançável justamente com a gaveta fechada. O `#hambToggle` fica
  no markup, escondido pelo CSS, porque `applyConfigToUi` ainda escreve nele.

  Quem recolhe é `window.toggleSidebar` (legado: classes de `body`,
  preferência salva, redesenho do mapa).
*/

/*
  No rodapé (acima de 900px). Recolhida, só o ícone fica à vista: o nome sai
  com o padrão de texto só para leitor de tela e aparece na dica (`data-dica`,
  desenhada pelo CSS do trilho).
*/
export function AlcaDeRecolher({ recolhida }) {
  const rotulo = recolhida ? "Expandir menu" : "Recolher menu";
  return (
    <button
      id="globalSidebarToggle"
      type="button"
      className="global-side-toggle side-recolher"
      data-tour="barra-recolher"
      aria-label={rotulo}
      aria-expanded={!recolhida}
      data-dica={rotulo}
      onClick={() => window.toggleSidebar?.()}
    >
      <Icone nome="panel-left" />
      <span className="side-recolher__rotulo">{rotulo}</span>
    </button>
  );
}

/*
  Até 900px: no `.title-row` do cabeçalho (legado), abre e fecha a gaveta.
  Aqui `sidebar-collapsed` quer dizer gaveta fechada.
*/
export function AlcaNoCabecalho({ recolhida }) {
  const [destino] = useState(() =>
    document.querySelector("#appScreen .main > header.top .title-row"),
  );
  if (!destino) return null;
  const rotulo = recolhida ? "Abrir menu" : "Fechar menu";
  return createPortal(
    <button
      id="globalSidebarToggle"
      type="button"
      className="global-side-toggle"
      data-tour="barra-abrir-menu"
      title={rotulo}
      aria-label={rotulo}
      aria-expanded={!recolhida}
      onClick={() => window.toggleSidebar?.()}
    >
      <Icone nome="menu" tamanho={20} />
    </button>,
    destino,
  );
}
