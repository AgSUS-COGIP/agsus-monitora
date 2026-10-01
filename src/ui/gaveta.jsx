import { Modal } from "./modal.jsx";
import { classes } from "./classes.js";

/*
  A gaveta lateral dos painéis (`.analises-drawer-backdrop` >
  `.analises-drawer`, desenho do painel de análises): um <Modal> (portal, Esc,
  foco preso) com o topo — sobretítulo, título, resumo e fechar — e o corpo
  como filhos.
*/

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
    <div className="analises-drawer-head">
      <div>
        {sobretitulo ? <span className="eyebrow">{sobretitulo}</span> : null}
        <h2 id={tituloId}>{titulo}</h2>
        {resumo ? (
          <div className="analises-drawer-summary">{resumo}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="analises-drawer-close"
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
  children,
}) {
  return (
    <Modal
      id={id}
      rotuloId={tituloId}
      aoFechar={aoFechar}
      fecharAoClicarFora={fecharAoClicarFora}
      className={classes("analises-drawer-backdrop", className)}
      cartaoClassName={classes("analises-drawer", cartaoClassName)}
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
