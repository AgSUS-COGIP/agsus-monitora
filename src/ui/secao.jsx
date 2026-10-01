import { usarNoQuadro } from "./no-quadro.jsx";

/*
  Seção de detalhe (na gaveta), o par rótulo/valor e a grade deles. Usados
  pela gaveta de Recursos e pela de Entrevistas. Um `Kv` vazio mostra "—" e
  fica marcado (`data-empty`) para o CSS apagá-lo.

  Dentro do app: `.ui-secao`, `.ui-kv`, `.ui-kv-grade`. No quadro
  (<PainelNoQuadro>): `.analises-detail-section`, `.kv`,
  `.analises-detail-section-grid`, do painel de análises.
*/

const vazio = (valor) =>
  valor === null || valor === undefined || valor === "" || valor === "—";

/* Um par rótulo/valor; vazio, some (`data-empty`). */
export function Kv({ rotulo, children }) {
  const noQuadro = usarNoQuadro();
  const semValor = vazio(children);
  return (
    <div
      className={noQuadro ? "kv" : "ui-kv"}
      data-empty={semValor || undefined}
    >
      <div className={noQuadro ? "kv-label" : "ui-kv-rotulo"}>{rotulo}</div>
      <div className={noQuadro ? "kv-value" : "ui-kv-valor"}>
        {semValor ? "—" : children}
      </div>
    </div>
  );
}

/* A grade de pares rótulo/valor; `className` acrescenta a de quem usa. */
export function GradeDeKv({ className, rotulo, children }) {
  const noQuadro = usarNoQuadro();
  const base = noQuadro ? "analises-detail-section-grid" : "ui-kv-grade";
  return (
    <div
      className={className ? `${base} ${className}` : base}
      aria-label={rotulo}
    >
      {children}
    </div>
  );
}

/* Uma seção da gaveta: ícone, título e o conteúdo. */
export function Secao({ icone, titulo, secao, children }) {
  const noQuadro = usarNoQuadro();
  return (
    <section
      className={noQuadro ? "analises-detail-section" : "ui-secao"}
      data-section={secao}
      aria-label={titulo}
    >
      <div
        className={noQuadro ? "analises-detail-section-head" : "ui-secao-topo"}
      >
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
        <span>{titulo}</span>
      </div>
      {children}
    </section>
  );
}
