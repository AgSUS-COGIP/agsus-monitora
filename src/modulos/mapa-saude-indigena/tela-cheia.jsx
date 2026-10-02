import { useEffect, useState } from "react";

/*
  A tela cheia dos mapas da Visão geral (Saúde Indígena e Projetos): o
  estado, o botão "Tela cheia"/"Sair da tela cheia" do cabeçalho e o Esc que
  sai. O CSS é o `.mapa-si--tela-cheia` (mapa-saude-indigena.css).
*/
export function usarTelaCheia() {
  const [telaCheia, definirTelaCheia] = useState(false);

  useEffect(() => {
    if (!telaCheia) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (evento) => {
      if (evento.key !== "Escape") return;
      evento.preventDefault();
      definirTelaCheia(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [telaCheia]);

  const botao = (
    <button
      type="button"
      className="btn small mapa-si-tela-cheia"
      aria-pressed={telaCheia}
      title={telaCheia ? "Sair da tela cheia (Esc)" : "Ampliar o mapa"}
      onClick={() => definirTelaCheia((valor) => !valor)}
    >
      {telaCheia ? "Sair da tela cheia" : "Tela cheia"}
    </button>
  );

  return [telaCheia, botao];
}
