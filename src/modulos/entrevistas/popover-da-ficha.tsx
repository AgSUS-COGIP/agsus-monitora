import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { classes } from "../../ui/classes.js";

/*
  Botão pequeno e redondo que abre um painel por cima, na ficha de notas: o
  "i" dos detalhes do cabeçalho (lançamento, gravado, roteiro) e o "?" dos
  atalhos do rodapé. Esc, clicar fora ou de novo no botão fecham; Esc devolve
  o foco ao botão. O painel é uma região com o nome do botão.

  A ficha da Avaliação documental ganha um Popover em src/ui/ no mesmo
  desenho; quando ele estiver na main, esta peça passa a usá-lo.
*/

export type PropriedadesDoPopover = {
  rotulo: string;
  gatilho: ReactNode;
  lado?: "direita" | "esquerda";
  acima?: boolean;
  acao?: string;
  tour?: string;
  className?: string;
  children: ReactNode;
};

export function PopoverDaFicha({
  rotulo,
  gatilho,
  lado = "direita",
  acima = false,
  acao,
  tour,
  className,
  children,
}: PropriedadesDoPopover) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (ev: MouseEvent) => {
      if (!raiz.current?.contains(ev.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div
      className={classes("entrevistas-popover", className)}
      ref={raiz}
      data-tour={tour}
      onKeyDown={(ev) => {
        if (!aberto || ev.key !== "Escape") return;
        ev.preventDefault();
        ev.stopPropagation();
        setAberto(false);
        botao.current?.focus();
      }}
    >
      <button
        type="button"
        ref={botao}
        className="entrevistas-popover-botao"
        aria-label={rotulo}
        title={rotulo}
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        data-acao={acao}
        onClick={() => setAberto(!aberto)}
      >
        {gatilho}
      </button>
      {aberto ? (
        <div
          className="entrevistas-popover-painel"
          id={id}
          role="region"
          aria-label={rotulo}
          data-lado={lado}
          data-acima={acima || undefined}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
