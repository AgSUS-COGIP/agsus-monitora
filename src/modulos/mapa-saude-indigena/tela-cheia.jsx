import { useEffect, useState } from "react";

/*
  A tela cheia dos mapas da Visão geral (Saúde Indígena e Projetos): o
  estado, o botão "Tela cheia"/"Recolher" do cabeçalho do painel e o Esc que
  sai. O CSS é o `.mapa-si--tela-cheia` (mapa-saude-indigena.css).
*/
export function usarTelaCheia() {
  const [telaCheia, definirTelaCheia] = useState(false);

  useEffect(() => {
    if (!telaCheia) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key !== "Escape") return;
      evento.preventDefault();
      definirTelaCheia(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [telaCheia]);

  const botao = (
    <button
      type="button"
      className="btn small"
      aria-pressed={telaCheia}
      onClick={() => definirTelaCheia((valor) => !valor)}
    >
      {telaCheia ? "Recolher" : "Tela cheia"}
    </button>
  );

  return [telaCheia, botao];
}
