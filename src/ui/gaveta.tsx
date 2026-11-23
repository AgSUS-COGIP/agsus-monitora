import { Fragment } from "react";
import type { ReactNode } from "react";
import { Modal, usarFecharModal } from "./modal.tsx";
import { classes } from "./classes.ts";
import { NavegacaoDaFicha } from "./navegacao-da-ficha.tsx";
import type { NavegacaoDaFicha as Navegacao } from "./navegacao-da-ficha.tsx";

/*
  A gaveta lateral: um <Modal> (portal, Esc, foco preso) com o topo —
  sobretítulo, título, resumo e fechar — e o corpo como filhos. Como no
  Modal, clicar fora não fecha, e `alterado` faz o fechar perguntar antes.

  Marcação: `.ui-gaveta-fundo` > `.ui-gaveta` (`.ui-gaveta-topo`…).
  `usarClassesDaGaveta()` dá as duas classes, para quem monta a gaveta direto
  no <Modal> (o formulário de Recursos).

  `navegacao` (de `usarNavegacaoDaLista`): ‹ "3 de 41" › ao lado do fechar,
  para ir ao anterior e ao próximo da lista sem fechar a ficha. O corpo
  recomeça a cada item (`key` pela chave dele): o estado dos filhos — um
  formulário, uma seção aberta — não passa de um item para o outro. A gaveta
  em si não remonta, e o foco fica no botão.
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
  /** Anterior/Próximo da lista de onde a ficha abriu. */
  navegacao?: Navegacao;
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
  navegacao,
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
      <div className="ui-gaveta-topo-acoes">
        {navegacao ? <NavegacaoDaFicha {...navegacao} /> : null}
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
  /** Anterior/Próximo da lista de onde a ficha abriu (`usarNavegacaoDaLista`). */
  navegacao?: Navegacao;
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
  navegacao,
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
        navegacao={navegacao}
      />
      <Fragment key={navegacao?.chave}>{children}</Fragment>
    </Modal>
  );
}
