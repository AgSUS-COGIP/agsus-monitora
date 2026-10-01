import { classes } from "./classes.js";

/*
  Indicador em card compacto (`.kpi`, desenho do painel de análises): a barra
  colorida em cima (`cor`: k-cyan, k-green, k-yellow, k-orange, k-red,
  k-purple, k-slate), o rótulo e o número já formatado. Com `aoClicar`, o card
  vira botão — filtro (`ativo` liga `aria-pressed` e `.is-active`) ou atalho.
*/
export function Kpi({ cor, rotulo, valor, chave, titulo, ativo, aoClicar }) {
  if (!aoClicar)
    return (
      <article className={classes("kpi", cor)} data-kpi={chave} title={titulo}>
        <span>{rotulo}</span>
        <b>{valor}</b>
      </article>
    );
  return (
    <article
      className={classes("kpi", cor, ativo && "is-active")}
      data-kpi={chave}
    >
      <button
        type="button"
        aria-pressed={ativo === undefined ? undefined : ativo}
        title={titulo || "Filtrar o painel"}
        onClick={aoClicar}
      >
        <span>{rotulo}</span>
        <b>{valor}</b>
      </button>
    </article>
  );
}

/** A grade de indicadores (`.kpis`). */
export function GradeDeKpis({ id, className, rotulo, children }) {
  return (
    <section className={classes("kpis", className)} id={id} aria-label={rotulo}>
      {children}
    </section>
  );
}
