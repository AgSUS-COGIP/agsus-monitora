import { useEffect, useRef } from "react";
import {
  barraRecolhida,
  emGaveta,
  usarBarraRecolhida,
  usarGaveta,
} from "../../componentes/barra-lateral/usar-ambiente.ts";
import { chamarAcaoDaCasca } from "./acoes.ts";

/*
  No celular (até 900px) a navegação é uma só: o ☰ do cabeçalho
  (`#globalSidebarToggle`, da barra lateral) abre a própria barra lateral como
  gaveta, por cima do conteúdo. Não há menu preso ao pé da tela.

  Quem abre e fecha é `window.toggleSidebar` (src/app/moldura.ts: classes de
  `body`); aqui a gaveta é acompanhada e fechada:
  - escolher uma página fecha (abrir uma área do menu ou trocar o tema, não:
    a pessoa ainda está escolhendo; o Sair abre a confirmação dele);
  - tocar fora (o véu `#sidebarOverlay`) e o Esc fecham;
  - fechada, a gaveta fica `inert` (sai só pelo transform, então sem isso os
    links continuavam no Tab e no leitor de tela); aberta, o resto da página
    (`#conteudoPrincipal`) é que fica `inert`, e o foco vai para a página
    atual no menu; ao fechar, volta para o ☰.

  No computador nada disso vale: a barra recolhida continua navegável.
*/

const ITEM_DE_PAGINA = ".sidebar [data-view]";

const abertaAgora = () => emGaveta() && !barraRecolhida();

function fecharGaveta() {
  if (abertaAgora()) chamarAcaoDaCasca("toggleSidebar");
}

/*
  A página atual no menu; senão, o primeiro controle da gaveta que aceita o
  foco (o de uma área fechada não aceita).
*/
function focarNaGaveta(gaveta: Element) {
  const candidatos = [
    gaveta.querySelector<HTMLElement>('#nav [aria-current="page"]'),
    ...gaveta.querySelectorAll<HTMLElement>("button, a[href]"),
  ];
  for (const alvo of candidatos) {
    alvo?.focus({ preventScroll: true });
    if (alvo && document.activeElement === alvo) return;
  }
}

export function usarGavetaDoCelular() {
  const gaveta = usarGaveta();
  const recolhida = usarBarraRecolhida();
  const aberta = gaveta && !recolhida;
  const estavaAberta = useRef(aberta);

  useEffect(() => {
    const barra = document.querySelector("#appScreen .sidebar");
    const conteudo = document.getElementById("conteudoPrincipal");
    barra?.toggleAttribute("inert", gaveta && !aberta);
    conteudo?.toggleAttribute("inert", aberta);

    const abriu = aberta && !estavaAberta.current;
    const fechou = !aberta && estavaAberta.current;
    estavaAberta.current = aberta;
    if (abriu && barra) focarNaGaveta(barra);
    if (fechou && gaveta) {
      const foco = document.activeElement;
      const perdido = !foco || foco === document.body || barra?.contains(foco);
      if (perdido) document.getElementById("globalSidebarToggle")?.focus();
    }
  }, [gaveta, aberta]);

  useEffect(() => {
    const aoClicar = (evento: MouseEvent) => {
      const alvo = evento.target;
      if (alvo instanceof Element && alvo.closest(ITEM_DE_PAGINA))
        fecharGaveta();
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fecharGaveta();
    };
    document.addEventListener("click", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("click", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return aberta;
}

/** O véu atrás da gaveta aberta: tocar nele fecha. */
export function GavetaDoCelular() {
  const aberta = usarGavetaDoCelular();
  return (
    <button
      id="sidebarOverlay"
      type="button"
      className="sidebar-overlay"
      aria-label="Fechar menu"
      hidden={!aberta}
      onClick={fecharGaveta}
    />
  );
}
