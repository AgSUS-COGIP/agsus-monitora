import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { travarRolagemDaPagina } from "../../lib/base/trava-de-rolagem.ts";
import { haModalAberto } from "../../ui/modal.tsx";

/*
  A tela cheia dos mapas da Visão geral (Saúde Indígena e Projetos): o
  estado, o botão "Tela cheia"/"Sair da tela cheia" do cabeçalho e o Esc que
  sai. Esc já usado por outro (`defaultPrevented`: a volta do DSEI ao Brasil,
  volta-ao-brasil.js, ou o modo de edição de coordenadas) não sai — o
  seguinte sai. Com um modal aberto por cima (a busca, Ctrl+K), o Esc é dele:
  fecha o modal, e o mapa segue em tela cheia. O CSS é o `.mapa-si--tela-cheia` (mapa-saude-indigena.css).
*/

export function usarTelaCheia(): [boolean, ReactElement] {
  const [telaCheia, definirTelaCheia] = useState(false);

  useEffect(() => {
    if (!telaCheia) return undefined;
    const soltar = travarRolagemDaPagina();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
      if (haModalAberto()) return;
      evento.preventDefault();
      definirTelaCheia(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      soltar();
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [telaCheia]);

  const botao = (
    <button
      type="button"
      className="btn secondary small mapa-si-tela-cheia"
      data-tour="visao-geral-mapa-tela-cheia"
      aria-pressed={telaCheia}
      title={telaCheia ? "Sair da tela cheia (Esc)" : "Ampliar o mapa"}
      onClick={() => definirTelaCheia((valor) => !valor)}
    >
      {telaCheia ? "Sair da tela cheia" : "Tela cheia"}
    </button>
  );

  return [telaCheia, botao];
}
