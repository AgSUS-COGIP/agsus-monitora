/*
  Seção de detalhe (na gaveta) e o par rótulo/valor dentro dela. Usados pela
  gaveta de Recursos e pela de Entrevistas. Um `Kv` vazio mostra "—" e fica
  marcado (`data-empty`) para o CSS apagá-lo.
*/

const vazio = (valor) =>
  valor === null || valor === undefined || valor === "" || valor === "—";

/* Um par rótulo/valor; vazio, some (`data-empty`). */
export function Kv({ rotulo, children }) {
  const semValor = vazio(children);
  return (
    <div className="kv" data-empty={semValor || undefined}>
      <div className="kv-label">{rotulo}</div>
      <div className="kv-value">{semValor ? "—" : children}</div>
    </div>
  );
}

/* Uma seção da gaveta: ícone, título e o conteúdo. */
export function Secao({ icone, titulo, secao, children }) {
  return (
    <section
      className="analises-detail-section"
      data-section={secao}
      aria-label={titulo}
    >
      <div className="analises-detail-section-head">
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
        <span>{titulo}</span>
      </div>
      {children}
    </section>
  );
}
