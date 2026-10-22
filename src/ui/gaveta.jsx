import { Modal } from "./modal.jsx";
import { classes } from "./classes.js";

/*
  A gaveta lateral: um <Modal> (portal, Esc, foco preso) com o topo —
  sobretítulo, título, resumo e fechar — e o corpo como filhos.

  Marcação: `.ui-gaveta-fundo` > `.ui-gaveta` (`.ui-gaveta-topo`…).
  `usarClassesDaGaveta()` dá as duas classes, para quem monta a gaveta direto
  no <Modal> (o formulário de Recursos).
*/

export function usarClassesDaGaveta() {
  return { fundo: "ui-gaveta-fundo", cartao: "ui-gaveta" };
}

/* O topo da gaveta (e do formulário): sobretítulo, título, resumo e fechar. */
export function TopoDaGaveta({
  sobretitulo,
  titulo,
  tituloId,
  resumo,
  aoFechar,
  rotuloDoFechar,
}) {
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
        onClick={aoFechar}
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
/**
 * @param {{id?: string, tituloId?: string, aoFechar: () => void, fecharAoClicarFora?: boolean, className?: string, cartaoClassName?: string, sobretitulo?: import("react").ReactNode, titulo: import("react").ReactNode, resumo?: import("react").ReactNode, rotuloDoFechar?: string, tour?: string, children?: import("react").ReactNode}} props
 */
export function Gaveta({
  id,
  tituloId,
  aoFechar,
  fecharAoClicarFora = true,
  className,
  cartaoClassName,
  sobretitulo,
  titulo,
  resumo,
  rotuloDoFechar,
  tour,
  children,
}) {
  const { fundo, cartao } = usarClassesDaGaveta();
  return (
    <Modal
      id={id}
      rotuloId={tituloId}
      aoFechar={aoFechar}
      fecharAoClicarFora={fecharAoClicarFora}
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
        aoFechar={aoFechar}
      />
      {children}
    </Modal>
  );
}
