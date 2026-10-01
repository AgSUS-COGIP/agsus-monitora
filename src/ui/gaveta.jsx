import { Modal } from "./modal.jsx";
import { classes } from "./classes.js";
import { usarNoQuadro } from "./no-quadro.jsx";

/*
  A gaveta lateral: um <Modal> (portal, Esc, foco preso) com o topo —
  sobretítulo, título, resumo e fechar — e o corpo como filhos.

  Dentro do app: `.ui-gaveta-fundo` > `.ui-gaveta` (`.ui-gaveta-topo`…). No
  quadro (<PainelNoQuadro>): `.analises-drawer-backdrop` > `.analises-drawer`,
  do painel de análises. `usarClassesDaGaveta()` dá as duas, para quem monta a
  gaveta direto no <Modal> (o formulário de Recursos).
*/

export function usarClassesDaGaveta() {
  return usarNoQuadro()
    ? { fundo: "analises-drawer-backdrop", cartao: "analises-drawer" }
    : { fundo: "ui-gaveta-fundo", cartao: "ui-gaveta" };
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
  const noQuadro = usarNoQuadro();
  const c = (antiga, nova) => (noQuadro ? antiga : nova);
  return (
    <div className={c("analises-drawer-head", "ui-gaveta-topo")}>
      <div>
        {sobretitulo ? (
          <span className={c("eyebrow", "ui-gaveta-sobretitulo")}>
            {sobretitulo}
          </span>
        ) : null}
        <h2 id={tituloId}>{titulo}</h2>
        {resumo ? (
          <div className={c("analises-drawer-summary", "ui-gaveta-resumo")}>
            {resumo}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={c("analises-drawer-close", "ui-gaveta-fechar")}
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
  const { fundo, cartao } = usarClassesDaGaveta();
  return (
    <Modal
      id={id}
      rotuloId={tituloId}
      aoFechar={aoFechar}
      fecharAoClicarFora={fecharAoClicarFora}
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
