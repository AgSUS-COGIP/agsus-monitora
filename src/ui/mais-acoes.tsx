import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

/*
  "Mais ações" do topo da tela (Design System, seção 16): a partir de 768px as
  ações entram em linha, como filhas diretas do topo (o invólucro é
  `display: contents`); abaixo, ficam atrás de um botão "Mais ações", numa
  lista que abre embaixo dele. Os botões são os mesmos nas duas larguras (só o
  CSS troca): os ids, o tour e os testes continuam achando cada um.

  Esc, clicar fora ou escolher uma ação fecham; o foco vai para a primeira
  ação ao abrir e volta ao botão com Esc. Sem ação nenhuma (os filhos não
  desenham nada), o botão não aparece. `.ui-mais-acoes`, em ui.css.

  Não é o MaisOpcoes: aquele mostra os filtros adicionais em qualquer
  largura; este recolhe ações só no celular.
*/
export interface PropriedadesDeMaisAcoes {
  rotulo?: string;
  children?: ReactNode;
}

const FOCAVEL = "button:not(:disabled), a[href], input, select";

export function MaisAcoes({
  rotulo = "Mais ações",
  children,
}: PropriedadesDeMaisAcoes) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return undefined;
    lista.current?.querySelector<HTMLElement>(FOCAVEL)?.focus();
    const fora = (ev: MouseEvent) => {
      if (!raiz.current?.contains(ev.target as Node | null)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div
      className="ui-mais-acoes"
      ref={raiz}
      data-aberto={aberto ? "" : undefined}
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
        className="btn secondary ui-mais-acoes-botao"
        data-acao="mais-acoes"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto(!aberto)}
      >
        <i className="fa-solid fa-ellipsis" aria-hidden="true" /> {rotulo}
      </button>
      <div
        className="ui-mais-acoes-lista"
        id={id}
        ref={lista}
        onClick={(ev) => {
          if (aberto && (ev.target as Element).closest("button, a[href]"))
            setAberto(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
