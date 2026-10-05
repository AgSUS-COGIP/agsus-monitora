import { useEffect, useState } from "react";

/*
  A rolagem da página fica travada enquanto um painel cobre a tela (a tela
  cheia, o modo de edição de coordenadas). Contada: os dois podem estar
  ligados ao mesmo tempo, e a página só volta a rolar — com o `overflow` que
  tinha antes — quando o último sai.
*/
let travas = 0;
let overflowAnterior = "";

export function travarRolagemDaPagina() {
  if (travas === 0) {
    overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  travas += 1;
  let solta = false;
  return () => {
    if (solta) return;
    solta = true;
    travas -= 1;
    if (travas === 0) document.body.style.overflow = overflowAnterior;
  };
}

/*
  A tela cheia dos mapas da Visão geral (Saúde Indígena e Projetos): o
  estado, o botão "Tela cheia"/"Sair da tela cheia" do cabeçalho e o Esc que
  sai. Esc já usado por outro (`defaultPrevented`: a volta do DSEI ao Brasil,
  volta-ao-brasil.js, ou o modo de edição de coordenadas) não sai — o
  seguinte sai. O CSS é o `.mapa-si--tela-cheia` (mapa-saude-indigena.css).
*/
export function usarTelaCheia() {
  const [telaCheia, definirTelaCheia] = useState(false);

  useEffect(() => {
    if (!telaCheia) return undefined;
    const soltar = travarRolagemDaPagina();
    const aoTeclar = (evento) => {
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
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
      className="btn small mapa-si-tela-cheia"
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
