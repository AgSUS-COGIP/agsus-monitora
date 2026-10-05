import { classes } from "./classes.js";

/*
  Indicador em card compacto (~78px; DESIGN.md, "Indicador"): o ícone num tile
  na cor do estado, o rótulo e o número já formatado. Com `aoClicar`, o card
  vira botão — filtro (`ativo` liga `aria-pressed`) ou atalho. `carregando`:
  o número vira skeleton (carregando não é zero). O rótulo para em duas
  linhas, com reticências, e o texto inteiro fica no `title`: todos os
  cards de uma grade têm a mesma altura.

  `cor` é o nome de antes (k-cyan, k-green, k-yellow, k-orange, k-red,
  k-purple, k-slate) e vira o tom do tile (`data-tom`: info, sucesso, alerta,
  perigo, destaque, neutro); `icone` é a classe `fa-*` do tile. `idDoValor`
  põe um id no número (contrato de teste/DOM de telas antigas).
*/

const TOM_DA_COR = {
  "k-cyan": "info",
  "k-green": "sucesso",
  "k-yellow": "alerta",
  "k-orange": "alerta",
  "k-red": "perigo",
  "k-purple": "destaque",
  "k-slate": "neutro",
};

export function Kpi({
  cor,
  tom,
  icone = "fa-chart-simple",
  rotulo,
  valor,
  chave,
  titulo,
  ativo,
  aoClicar,
  carregando = false,
  idDoValor,
  tour,
}) {
  const conteudo = (
    <>
      <span className="ui-kpi-rotulo">
        <span className="ui-kpi-icone" aria-hidden="true">
          <i className={`fa-solid ${icone}`} />
        </span>
        <span
          className="ui-kpi-texto"
          title={typeof rotulo === "string" ? rotulo : undefined}
        >
          {rotulo}
        </span>
      </span>
      {carregando ? (
        <span
          id={idDoValor}
          className="ui-kpi-valor ui-esqueleto"
          aria-hidden="true"
        />
      ) : (
        <b id={idDoValor} className="ui-kpi-valor">
          {valor}
        </b>
      )}
    </>
  );
  return (
    <article
      className={classes(
        "ui-kpi",
        aoClicar && "ui-kpi-clicavel",
        ativo && "is-ativo",
      )}
      data-kpi={chave}
      data-tour={tour}
      data-tom={tom || TOM_DA_COR[cor] || "info"}
      title={aoClicar ? undefined : titulo}
      aria-busy={carregando || undefined}
    >
      {aoClicar ? (
        <button
          type="button"
          className="ui-kpi-alvo"
          aria-pressed={ativo === undefined ? undefined : ativo}
          title={titulo || "Filtrar a tela"}
          onClick={aoClicar}
        >
          {conteudo}
        </button>
      ) : (
        conteudo
      )}
    </article>
  );
}

/** A grade de indicadores. */
export function GradeDeKpis({ id, className, rotulo, tour, children }) {
  return (
    <section
      className={classes("ui-kpis", className)}
      id={id}
      aria-label={rotulo}
      data-tour={tour}
    >
      {children}
    </section>
  );
}
