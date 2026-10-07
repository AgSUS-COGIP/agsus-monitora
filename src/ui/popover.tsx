import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { classes } from "./classes.js";

export type PropriedadesDoPopover = {
  /** Nome acessível do botão (e o title, quando não há `dica`). */
  rotulo: string;
  /** O que o botão mostra: um ícone, um texto curto ou os dois. */
  gatilho: ReactNode;
  /** Título que aparece ao passar o mouse; padrão: o `rotulo`. */
  dica?: string;
  /** Classe do botão (padrão: "ui-popover-botao", redondo e discreto). */
  classeDoBotao?: string;
  className?: string;
  /** Lado em que o painel abre, alinhado ao botão. */
  lado?: "direita" | "esquerda";
  /** data-acao do botão (testes e tour). */
  acao?: string;
  tour?: string;
  /** O conteúdo; a função recebe `fechar` para quem fecha ao escolher. */
  children: ReactNode | ((fechar: () => void) => ReactNode);
};

/*
  Popover: um botão pequeno que abre um painel por cima (informações, a
  legenda de atalhos, ações secundárias). Esc, clicar fora ou de novo no botão
  fecham; o foco volta ao botão com Esc. O painel é uma região com o nome do
  botão (não um menu: pode ter texto, links, campos). `.ui-popover`.

  Usado pela ficha da Avaliação documental (info do cabeçalho, atalhos, "⋯").
*/
export function Popover({
  rotulo,
  gatilho,
  dica,
  classeDoBotao = "ui-popover-botao",
  className,
  lado = "direita",
  acao,
  tour,
  children,
}: PropriedadesDoPopover) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();
  const fechar = () => setAberto(false);

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
      className={classes("ui-popover", className)}
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
        className={classeDoBotao}
        aria-label={rotulo}
        title={dica ?? rotulo}
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        data-acao={acao}
        onClick={() => setAberto(!aberto)}
      >
        {gatilho}
      </button>
      {aberto ? (
        <div
          className="ui-popover-painel"
          id={id}
          role="region"
          aria-label={rotulo}
          data-lado={lado}
        >
          {typeof children === "function" ? children(fechar) : children}
        </div>
      ) : null}
    </div>
  );
}
