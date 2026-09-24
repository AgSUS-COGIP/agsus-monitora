import { useState } from "react";
import { createPortal } from "react-dom";
import { Icone } from "../icone.jsx";

/*
  Um controle só para recolher a barra, em toda largura e todo modo.

  Havia dois (o hambúrguer do cabeçalho e um botão flutuante), cada um visível
  numa faixa de largura; dentro de um painel externo o cabeçalho some e levava
  o hambúrguer junto, e não sobrava nenhum (#176). Agora é este botão, com o id
  de sempre, `#globalSidebarToggle`, e ele muda de casa conforme a largura:

    acima de 900px  -> dentro da marca, como alça redonda na borda da barra
    até 900px       -> no cabeçalho, na vaga do hambúrguer (portal)

  No estreito ele não pode ficar dentro da barra: a gaveta é `position: fixed`
  com `transform: translateX(-105%)`, e um botão lá dentro sairia da tela junto
  com ela — inalcançável justamente com a gaveta fechada. O `#hambToggle` fica
  no markup, escondido pelo CSS, porque `applyConfigToUi` ainda escreve nele.

  Quem recolhe é `window.toggleSidebar` (legado: classes de `body`,
  preferência salva, redesenho do mapa). Os dois ícones vão juntos; o CSS
  mostra a seta na alça e o hambúrguer no cabeçalho.
*/
export function AlcaDeRecolher({ recolhida }) {
  const rotulo = recolhida ? "Expandir menu lateral" : "Recolher menu lateral";
  return (
    <button
      id="globalSidebarToggle"
      type="button"
      className="global-side-toggle side-collapse-toggle"
      title={rotulo}
      aria-label={rotulo}
      aria-expanded={!recolhida}
      onClick={() => window.toggleSidebar?.()}
    >
      <Icone nome="chevron-left" tamanho={16} className="icone-recolher" />
      <Icone nome="menu" tamanho={20} className="icone-menu" />
    </button>
  );
}

/* Até 900px: a mesma alça, no `.title-row` do cabeçalho (legado). */
export function AlcaNoCabecalho({ recolhida }) {
  const [destino] = useState(() =>
    document.querySelector("#appScreen .main > header.top .title-row"),
  );
  return destino
    ? createPortal(<AlcaDeRecolher recolhida={recolhida} />, destino)
    : null;
}
