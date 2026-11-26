import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { classes } from "./classes.ts";

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

/* A folga mínima entre o painel e a borda da janela (o `--space-4`). */
const FOLGA_DA_JANELA = 16;

/**
 * Quanto o painel precisa andar na horizontal para caber na janela, com a
 * folga das bordas: positivo para a direita, negativo para a esquerda.
 */
export function desvioParaCaber(
  esquerda: number,
  direita: number,
  largura: number,
  folga = FOLGA_DA_JANELA,
): number {
  if (esquerda < folga) return folga - esquerda;
  if (direita > largura - folga)
    return Math.max(folga - esquerda, largura - folga - direita);
  return 0;
}

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
  const painel = useRef<HTMLDivElement>(null);
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

  /*
    O painel abre preso ao botão; perto da borda (o número no cartão, a
    375px), ele sairia da janela. Ao abrir, mede e anda o que falta.
  */
  useLayoutEffect(() => {
    const elemento = painel.current;
    if (!aberto || !elemento) return;
    const { left, right } = elemento.getBoundingClientRect();
    const largura =
      document.documentElement.clientWidth || window.innerWidth || 0;
    if (!largura) return;
    const desvio = desvioParaCaber(left, right, largura);
    if (desvio)
      elemento.style.setProperty("--ui-popover-desvio", `${desvio}px`);
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
          ref={painel}
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
