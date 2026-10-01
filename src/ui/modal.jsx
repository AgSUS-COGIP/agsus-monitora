import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { classes } from "./classes.js";

/*
  Modal do DESIGN.md (seção 4): `.modal` > `.modal-card`, no fim do `body`
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
*/

const FOCAVEIS = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/* Um painel de aba escondido continua no DOM; o que está nele não recebe foco. */
const focaveisDe = (cartao) =>
  [...cartao.querySelectorAll(FOCAVEIS)].filter(
    (elemento) => !elemento.closest(".hidden, [hidden]"),
  );

export function Modal({
  id,
  rotuloId,
  rotulo,
  aoFechar,
  fecharAoClicarFora = true,
  className = "",
  cartaoClassName = "",
  children,
}) {
  const cartao = useRef(null);
  const fechar = useRef(aoFechar);
  useLayoutEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    const anterior = document.activeElement;
    const inicial =
      cartao.current?.querySelector("[data-foco-inicial]") ||
      focaveisDe(cartao.current)[0];
    inicial?.focus();

    function aoTeclar(evento) {
      if (evento.key === "Escape") {
        fechar.current?.();
        return;
      }
      if (evento.key !== "Tab" || !cartao.current) return;
      const itens = focaveisDe(cartao.current);
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens.at(-1);
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
      if (anterior?.isConnected) anterior.focus?.();
    };
  }, []);

  return createPortal(
    <div
      id={id}
      className={classes("modal", className, "show")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={rotuloId}
      aria-label={rotuloId ? undefined : rotulo}
      onClick={(evento) => {
        // Clique no fundo escuro fecha (se permitido); dentro do cartão, não.
        if (fecharAoClicarFora && evento.target === evento.currentTarget)
          aoFechar();
      }}
    >
      <div ref={cartao} className={classes("modal-card", cartaoClassName)}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
