import { useState } from "react";
import { classes } from "./classes.js";
import { usarNoQuadro } from "./no-quadro.jsx";

/*
  "Refinar resultados": os filtros de uma tela, num card. Os campos vêm como
  filhos. Recolhível (o padrão): resumo de quantos filtros estão ativos,
  "Ocultar/Mostrar filtros" e "Limpar tudo". `recolhivel={false}`: só o título
  e os filhos (o painel de seleção).

  Dentro do app: `.ui-card.ui-filtros`. No quadro (<PainelNoQuadro>): o
  `.filter-panel` do painel de análises, com os ids de antes (filterSummary,
  toggleFiltersBtn, clearBtn, filtersBody).
*/
export function PainelDeFiltros({
  idDoTitulo,
  className,
  recolhivel = true,
  quantos = 0,
  aoLimpar,
  aoRecolher,
  children,
}) {
  const noQuadro = usarNoQuadro();
  const [recolhido, setRecolhido] = useState(false);
  const c = (antiga, nova) => (noQuadro ? antiga : nova);
  const titulo = (
    <div>
      <h2 className={c("title", "ui-titulo")} id={idDoTitulo}>
        Refinar resultados
      </h2>
    </div>
  );
  const moldura = c("panel filter-panel", "ui-card ui-filtros");

  if (!recolhivel)
    return (
      <section
        className={classes(moldura, className)}
        aria-labelledby={idDoTitulo}
      >
        <div className={c("filter-head", "ui-filtros-topo")}>{titulo}</div>
        {children}
      </section>
    );

  const alternar = () => {
    const novo = !recolhido;
    setRecolhido(novo);
    aoRecolher?.(novo);
  };

  return (
    <section
      className={classes(
        moldura,
        className,
        recolhido && c("is-collapsed", "is-recolhido"),
      )}
      aria-labelledby={idDoTitulo}
    >
      <div className={c("filter-head", "ui-filtros-topo")}>
        {titulo}
        <div className={c("filter-actions", "ui-filtros-acoes")}>
          <span
            id={noQuadro ? "filterSummary" : undefined}
            className={classes(
              c("filter-summary", "ui-filtros-resumo"),
              quantos && c("has-filters", "tem-filtros"),
            )}
            aria-live="polite"
          >
            <i
              className={`fa-solid ${quantos ? "fa-filter-circle-check" : "fa-layer-group"}`}
              aria-hidden="true"
            />
            <span>
              Todos ·{" "}
              {quantos
                ? `${quantos} ${quantos === 1 ? "filtro adicional" : "filtros adicionais"}`
                : "nenhum filtro adicional"}
            </span>
          </span>
          <button
            type="button"
            className={c("btn secondary", "btn secondary small")}
            id={noQuadro ? "toggleFiltersBtn" : undefined}
            data-acao={noQuadro ? undefined : "recolher-filtros"}
            aria-expanded={!recolhido}
            title={
              recolhido
                ? "Mostrar os filtros da visualização"
                : "Ocultar os filtros da visualização"
            }
            onClick={alternar}
          >
            <i
              className={`fa-solid ${recolhido ? "fa-filter" : "fa-chevron-up"}`}
              aria-hidden="true"
            />
            <span className={noQuadro ? "toggle-label" : undefined}>
              {recolhido ? "Mostrar filtros" : "Ocultar filtros"}
            </span>
          </button>
          <button
            type="button"
            className={c("btn secondary", "btn secondary small")}
            id={noQuadro ? "clearBtn" : undefined}
            data-acao={noQuadro ? undefined : "limpar-filtros"}
            disabled={!quantos}
            title="Limpar filtros"
            onClick={aoLimpar}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div
        id={noQuadro ? "filtersBody" : undefined}
        className={c("filters-body", "ui-filtros-corpo")}
        hidden={recolhido}
      >
        {children}
      </div>
    </section>
  );
}

/** A faixa de filtros aplicados. */
export function ChipsDeFiltro({ children }) {
  const noQuadro = usarNoQuadro();
  return (
    <div
      id={noQuadro ? "filterChips" : undefined}
      className={noQuadro ? "chips" : "ui-chips"}
      aria-label="Filtros aplicados"
    >
      {children}
    </div>
  );
}

/** Um filtro aplicado: rótulo em negrito, o valor e o "x" que o tira. */
export function ChipDeFiltro({ rotulo, aoTirar, children }) {
  const noQuadro = usarNoQuadro();
  return (
    <button
      type="button"
      className={noQuadro ? "chip-filter" : "ui-chip"}
      title={`Tirar o filtro ${rotulo}`}
      onClick={aoTirar}
    >
      <b>{rotulo}</b> {children}{" "}
      <i className="fa-solid fa-xmark" aria-hidden="true" />
    </button>
  );
}
