import { classes } from "./classes.js";
import { usarNoQuadro } from "./no-quadro.jsx";

/*
  Indicador em card compacto (~78px; DESIGN.md, "Indicador"): o ícone num tile
  na cor do estado, o rótulo e o número já formatado. Com `aoClicar`, o card
  vira botão — filtro (`ativo` liga `aria-pressed`) ou atalho. `carregando`:
  o número vira skeleton (carregando não é zero).

  `cor` é o nome de antes (k-cyan, k-green, k-yellow, k-orange, k-red,
  k-purple, k-slate) e vira o tom do tile (`data-tom`: info, sucesso, alerta,
  perigo, destaque, neutro); `icone` é a classe `fa-*` do tile.

  No quadro (<PainelNoQuadro>): o `.kpi` do painel de análises, com a barra
  colorida em cima (a `cor` como classe) e `.is-active`.
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

function KpiNoQuadro({ cor, rotulo, valor, chave, titulo, ativo, aoClicar }) {
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

export function Kpi(props) {
  const noQuadro = usarNoQuadro();
  if (noQuadro) return <KpiNoQuadro {...props} />;
  const {
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
  } = props;
  const conteudo = (
    <>
      <span className="ui-kpi-rotulo">
        <span className="ui-kpi-icone" aria-hidden="true">
          <i className={`fa-solid ${icone}`} />
        </span>
        {rotulo}
      </span>
      {carregando ? (
        <span className="ui-kpi-valor ui-esqueleto" aria-hidden="true" />
      ) : (
        <b className="ui-kpi-valor">{valor}</b>
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
export function GradeDeKpis({ id, className, rotulo, children }) {
  const noQuadro = usarNoQuadro();
  return (
    <section
      className={classes(noQuadro ? "kpis" : "ui-kpis", className)}
      id={id}
      aria-label={rotulo}
    >
      {children}
    </section>
  );
}
