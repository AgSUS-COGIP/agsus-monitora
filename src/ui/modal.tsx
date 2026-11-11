import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { classes } from "./classes.ts";

/*
  Modal (Design System 11.11): `.modal` > `.modal-card`, no fim do `body`
  (portal), para escapar de qualquer `transform` ou `overflow` da página que o
  abriu — o de listas do edital, por exemplo, abre a partir do Núcleo, com a
  página de aprovados escondida.

  Só existe enquanto está aberto: quem o usa decide quando o desenha. Ao abrir,
  o foco vai para o primeiro controle (ou para o marcado com
  `data-foco-inicial`) e fica preso no cartão; `Esc` e clique no fundo escuro
  chamam `aoFechar`; ao fechar, o foco volta a quem abriu.

  `fecharAoClicarFora={false}` desliga o clique no fundo: formulário longo (o
  do edital) não pode sumir com um clique perdido fora do cartão. O `Esc`
  continua chamando `aoFechar`, e quem usa decide se pergunta antes de fechar.

  Sem título visível (a busca global), `rotulo` dá o nome do diálogo.

  `tamanho` (pequeno, medio, grande) é o modal padrão: o cartão ganha o
  respiro (padding), a largura da variante e o conteúdo em coluna, com o
  mesmo espaço entre título, campos e ações — quem usa só escreve o
  conteúdo. Sem `tamanho`, o cartão é livre: o layout vem de quem usa
  (`.modal-head` + `.modal-body`, ou a classe própria em `cartaoClassName`).
    - pequeno: confirmação curta (até 440 px);
    - medio: formulário de poucos campos (até 640 px);
    - grande: listas, tabelas e prévias (até 960 px).
  No celular (mobile-app.css) todos ocupam a largura toda, em uma coluna.
*/

export type TamanhoDoModal = "pequeno" | "medio" | "grande";

const FOCAVEIS = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/* Os modais abertos, na ordem em que abriram: o teclado é do último. */
const ABERTOS: object[] = [];

/* Um painel de aba escondido continua no DOM; o que está nele não recebe foco. */
const focaveisDe = (cartao: HTMLElement) =>
  [...cartao.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(
    (elemento) => !elemento.closest(".hidden, [hidden]"),
  );

export interface PropriedadesDoModal {
  id?: string;
  rotuloId?: string;
  rotulo?: string;
  aoFechar: () => void;
  fecharAoClicarFora?: boolean;
  className?: string;
  cartaoClassName?: string;
  tamanho?: TamanhoDoModal;
  tour?: string;
  children?: ReactNode;
}

export function Modal({
  id,
  rotuloId,
  rotulo,
  aoFechar,
  fecharAoClicarFora = true,
  className = "",
  cartaoClassName = "",
  tamanho,
  tour,
  children,
}: PropriedadesDoModal) {
  const cartao = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  useLayoutEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const inicial =
      cartao.current?.querySelector<HTMLElement>("[data-foco-inicial]") ||
      focaveisDe(cartao.current!)[0];
    inicial?.focus();
    const eu = {};
    ABERTOS.push(eu);

    function aoTeclar(evento: KeyboardEvent) {
      // Modal aberto por cima de outro (a montagem do parecer sobre a gaveta):
      // Esc e Tab são só do de cima.
      if (ABERTOS.at(-1) !== eu) return;
      if (evento.key === "Escape") {
        // Um controle de dentro (menu aberto) já tratou o Esc: só ele fecha.
        if (!evento.defaultPrevented) fechar.current?.();
        return;
      }
      if (evento.key !== "Tab" || !cartao.current) return;
      const itens = focaveisDe(cartao.current);
      if (!itens.length) return;
      const primeiro = itens[0]!;
      const ultimo = itens.at(-1)!;
      const foraDoCartao = !cartao.current.contains(document.activeElement);
      if (
        evento.shiftKey &&
        (document.activeElement === primeiro || foraDoCartao)
      ) {
        evento.preventDefault();
        ultimo.focus();
      } else if (
        !evento.shiftKey &&
        (document.activeElement === ultimo || foraDoCartao)
      ) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      ABERTOS.splice(ABERTOS.indexOf(eu), 1);
      if (anterior?.isConnected) anterior.focus?.();
    };
  }, []);

  return createPortal(
    <div
      id={id}
      className={classes("modal", className, "show")}
      role="dialog"
      aria-modal="true"
      data-tour={tour}
      aria-labelledby={rotuloId}
      aria-label={rotuloId ? undefined : rotulo}
      onClick={(evento) => {
        // Clique no fundo escuro fecha (se permitido); dentro do cartão, não.
        if (fecharAoClicarFora && evento.target === evento.currentTarget)
          aoFechar();
      }}
    >
      <div
        ref={cartao}
        className={classes(
          "modal-card",
          tamanho && `ui-modal ui-modal-${tamanho}`,
          cartaoClassName,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
