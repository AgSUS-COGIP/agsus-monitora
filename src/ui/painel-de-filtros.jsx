import { useState } from "react";
import { classes } from "./classes.js";

/*
  "Refinar resultados" dos painéis (`.filter-panel`, desenho do painel de
  análises). Os campos vêm como filhos. Recolhível (o padrão): resumo de
  quantos filtros estão ativos, "Ocultar/Mostrar filtros" e "Limpar tudo", com
  os filhos dentro de `#filtersBody`. `recolhivel={false}`: só o título e os
  filhos (o painel de seleção).
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
  const [recolhido, setRecolhido] = useState(false);
  const titulo = (
    <div>
      <h2 className="title" id={idDoTitulo}>
        Refinar resultados
      </h2>
    </div>
  );

  if (!recolhivel)
    return (
      <section
        className={classes("panel filter-panel", className)}
        aria-labelledby={idDoTitulo}
      >
        <div className="filter-head">{titulo}</div>
        {children}
      </section>
    );

  return (
    <section
      className={classes(
        "panel filter-panel",
        className,
        recolhido && "is-collapsed",
      )}
      aria-labelledby={idDoTitulo}
    >
      <div className="filter-head">
        {titulo}
        <div className="filter-actions">
          <span
            id="filterSummary"
            className={classes("filter-summary", quantos && "has-filters")}
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
            className="btn secondary"
            id="toggleFiltersBtn"
            aria-expanded={!recolhido}
            title={
              recolhido
                ? "Mostrar os filtros da visualização"
                : "Ocultar os filtros da visualização"
            }
            onClick={() => {
              const novo = !recolhido;
              setRecolhido(novo);
              aoRecolher?.(novo);
            }}
          >
            <i
              className={`fa-solid ${recolhido ? "fa-filter" : "fa-chevron-up"}`}
              aria-hidden="true"
            />
            <span className="toggle-label">
              {recolhido ? "Mostrar filtros" : "Ocultar filtros"}
            </span>
          </button>
          <button
            type="button"
            className="btn secondary"
            id="clearBtn"
            disabled={!quantos}
            title="Limpar filtros"
            onClick={aoLimpar}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div id="filtersBody" className="filters-body" hidden={recolhido}>
        {children}
      </div>
    </section>
  );
}

/** A faixa de filtros aplicados (`#filterChips`). */
export function ChipsDeFiltro({ children }) {
  return (
    <div id="filterChips" className="chips" aria-label="Filtros aplicados">
      {children}
    </div>
  );
}

/** Um filtro aplicado: rótulo em negrito, o valor e o "x" que o tira. */
export function ChipDeFiltro({ rotulo, aoTirar, children }) {
  return (
    <button
      type="button"
      className="chip-filter"
      title={`Tirar o filtro ${rotulo}`}
      onClick={aoTirar}
    >
      <b>{rotulo}</b> {children}{" "}
      <i className="fa-solid fa-xmark" aria-hidden="true" />
    </button>
  );
}
