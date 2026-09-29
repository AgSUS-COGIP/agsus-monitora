import { formatNumberBR } from "../../lib/formatters.js";

/*
  Peças comuns da gaveta do painel de recursos (detalhe, formulário, resposta,
  anexos e modelos): data e nota formatadas, o `.kv` e a seção
  `.analises-detail-section` do painel de análises e o topo da gaveta.
*/

export const dataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export const nota = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : formatNumberBR(Number(valor), { maximumFractionDigits: 2 });

/* Um `.kv` do painel de análises; vazio, some (`data-empty`). */
export function Kv({ rotulo, children }) {
  const vazio =
    children === null ||
    children === undefined ||
    children === "" ||
    children === "—";
  return (
    <div className="kv" data-empty={vazio || undefined}>
      <div className="kv-label">{rotulo}</div>
      <div className="kv-value">{vazio ? "—" : children}</div>
    </div>
  );
}

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
        <span className="eyebrow">{sobretitulo}</span>
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
