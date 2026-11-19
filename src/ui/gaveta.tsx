import type { ReactNode } from "react";
import { Modal, usarFecharModal } from "./modal.tsx";
import { classes } from "./classes.ts";

/*
  A gaveta lateral: um <Modal> (portal, Esc, foco preso) com o topo —
  sobretítulo, título, resumo e fechar — e o corpo como filhos. Como no
  Modal, clicar fora não fecha, e `alterado` faz o fechar perguntar antes.

  Marcação: `.ui-gaveta-fundo` > `.ui-gaveta` (`.ui-gaveta-topo`…).
  `usarClassesDaGaveta()` dá as duas classes, para quem monta a gaveta direto
  no <Modal> (o formulário de Recursos).
*/

export function usarClassesDaGaveta() {
  return { fundo: "ui-gaveta-fundo", cartao: "ui-gaveta" };
}

export interface PropriedadesDoTopoDaGaveta {
  sobretitulo?: ReactNode;
  titulo: ReactNode;
  tituloId?: string;
  resumo?: ReactNode;
  rotuloDoFechar?: string;
}

/*
  O topo da gaveta (e do formulário): sobretítulo, título, resumo e fechar.
  O fechar é o do <Modal> em volta (com a pergunta de descarte).
*/
export function TopoDaGaveta({
  sobretitulo,
  titulo,
  tituloId,
  resumo,
  rotuloDoFechar = "Fechar",
}: PropriedadesDoTopoDaGaveta) {
  const fechar = usarFecharModal();
  return (
    <div className="ui-gaveta-topo">
      <div>
        {sobretitulo ? (
          <span className="ui-gaveta-sobretitulo">{sobretitulo}</span>
        ) : null}
        <h2 id={tituloId}>{titulo}</h2>
        {resumo ? <div className="ui-gaveta-resumo">{resumo}</div> : null}
      </div>
      <button
        type="button"
        className="ui-gaveta-fechar"
        aria-label={rotuloDoFechar}
        title="Fechar"
        onClick={() => fechar?.()}
      >
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * `className` vai no fundo, `cartaoClassName` no cartão; `tituloId` liga o
 * título ao `aria-labelledby` do diálogo.
 */
export interface PropriedadesDaGaveta {
  id?: string;
  tituloId?: string;
  aoFechar: () => void;
  /** Há alterações não salvas: fechar pergunta antes (ver <Modal>). */
  alterado?: boolean;
  aoDescartar?: () => void;
  className?: string;
  cartaoClassName?: string;
  sobretitulo?: ReactNode;
  titulo: ReactNode;
  resumo?: ReactNode;
  rotuloDoFechar?: string;
  tour?: string;
  children?: ReactNode;
}

export function Gaveta({
  id,
  tituloId,
  aoFechar,
  alterado,
  aoDescartar,
  className,
  cartaoClassName,
  sobretitulo,
  titulo,
  resumo,
  rotuloDoFechar,
  tour,
  children,
}: PropriedadesDaGaveta) {
  const { fundo, cartao } = usarClassesDaGaveta();
  return (
    <Modal
      id={id}
      rotuloId={tituloId}
      aoFechar={aoFechar}
      alterado={alterado}
      aoDescartar={aoDescartar}
      tour={tour}
      className={classes(fundo, className)}
      cartaoClassName={classes(cartao, cartaoClassName)}
    >
      <TopoDaGaveta
        sobretitulo={sobretitulo}
        titulo={titulo}
        tituloId={tituloId}
        resumo={resumo}
        rotuloDoFechar={rotuloDoFechar}
      />
      {children}
    </Modal>
  );
}
