import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { notificacoes } from "../avisos.ts";
import type { Notificacao, TomDaNotificacao } from "../avisos.ts";

/*
  As notificações curtas (toast) em `#toastBox`, abertas por
  `window.monitoraToast` (src/app/avisos.ts). Cartão claro com o ícone na cor
  do estado (o mesmo padrão dos KPIs); some sozinho em 4,5s, mas parado sob o
  mouse espera, para dar tempo de ler uma mensagem longa.
*/

export const DURACAO_MS = 4500;
/** A animação de saída (`.toast.is-saindo`) antes de tirar da caixa. */
const SAIDA_MS = 180;
/** Ao tirar o mouse, ainda fica pelo menos isto. */
const MINIMO_DEPOIS_DO_MOUSE_MS = 1200;

const ICONES: Record<TomDaNotificacao, string> = {
  ok: "fa-circle-check",
  info: "fa-circle-info",
  warn: "fa-triangle-exclamation",
  error: "fa-circle-xmark",
};

export function CaixaDeNotificacoes() {
  const lista = useSyncExternalStore(notificacoes.assinar, notificacoes.obter);
  return (
    // A caixa já é aria-live="polite"; só o erro interrompe o leitor (role="alert").
    <div
      id="toastBox"
      className="toast-box"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {lista.map((item) => (
        <CartaoDeNotificacao key={item.id} {...item} />
      ))}
    </div>
  );
}

function CartaoDeNotificacao({ id, texto, tom }: Notificacao) {
  const [saindo, definirSaindo] = useState(false);
  const [sobOMouse, definirSobOMouse] = useState(false);
  const restante = useRef(DURACAO_MS);
  const cartao = useRef<HTMLDivElement>(null);

  /*
    Os eventos nativos, não o onMouseEnter do React: quando o cartão de cima
    sai, este sobe para baixo do mouse parado, e só o `mouseenter` do navegador
    percebe (o do React depende do par mouseout/mouseover, que não vem).
  */
  useEffect(() => {
    const elemento = cartao.current;
    if (!elemento) return;
    const entrar = () => definirSobOMouse(true);
    const sair = () => definirSobOMouse(false);
    elemento.addEventListener("mouseenter", entrar);
    elemento.addEventListener("mouseleave", sair);
    return () => {
      elemento.removeEventListener("mouseenter", entrar);
      elemento.removeEventListener("mouseleave", sair);
    };
  }, []);

  // O tempo na tela corre só fora do mouse; o que já passou é descontado.
  useEffect(() => {
    if (saindo || sobOMouse) return;
    const inicio = Date.now();
    const temporizador = window.setTimeout(
      () => definirSaindo(true),
      Math.max(restante.current, MINIMO_DEPOIS_DO_MOUSE_MS),
    );
    return () => {
      window.clearTimeout(temporizador);
      restante.current -= Date.now() - inicio;
    };
  }, [saindo, sobOMouse]);

  useEffect(() => {
    if (!saindo) return;
    const temporizador = window.setTimeout(
      () => notificacoes.tirar(id),
      SAIDA_MS,
    );
    return () => window.clearTimeout(temporizador);
  }, [saindo, id]);

  return (
    <div
      ref={cartao}
      className={`toast ${tom}${saindo ? " is-saindo" : ""}`}
      role={tom === "error" ? "alert" : undefined}
    >
      <i
        className={`fa-solid ${ICONES[tom]} toast-icone`}
        aria-hidden="true"
      ></i>
      <p className="toast-texto">{texto}</p>
      <button
        type="button"
        className="toast-fechar"
        aria-label="Fechar notificação"
        onClick={() => definirSaindo(true)}
      >
        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  );
}
