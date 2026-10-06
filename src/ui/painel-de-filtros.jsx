import { useState } from "react";
import { classes } from "./classes.js";

/*
  "Refinar resultados": os filtros de uma tela, num card
  (`.ui-card.ui-filtros`). Os campos vêm como filhos. Recolhível (o padrão):
  resumo de quantos filtros estão ativos, "Ocultar/Mostrar filtros" e "Limpar
  tudo". `recolhivel={false}`: só o título e os filhos. `escopo` abre o
  resumo ("Ativo · 2 filtros adicionais"; o padrão é "Todos"); `podeLimpar`
  liga o "Limpar tudo" quando há o que limpar além dos filtros contados (o
  padrão é `quantos`). `titulo`, `subtitulo`, `rotuloMostrar` e
  `rotuloOcultar` trocam os textos (a Visão geral os lê de Configurações ›
  Página inicial).
*/
export function PainelDeFiltros({
  idDoTitulo,
  className,
  recolhivel = true,
  quantos = 0,
  escopo = "Todos",
  podeLimpar,
  aoLimpar,
  aoRecolher,
  titulo: textoDoTitulo = "Refinar resultados",
  subtitulo,
  rotuloMostrar = "Mostrar filtros",
  rotuloOcultar = "Ocultar filtros",
  tour,
  children,
}) {
  // Nasce recolhido (pedido de 02/10): a tela abre com os dados; os filtros
  // aparecem no botão. Quem tem filtro ativo vê o resumo ao lado.
  const [recolhido, setRecolhido] = useState(true);
  const titulo = (
    <div>
      <h2 className="ui-titulo" id={idDoTitulo}>
        {textoDoTitulo}
      </h2>
      {subtitulo ? <p className="ui-filtros-subtitulo">{subtitulo}</p> : null}
    </div>
  );

  if (!recolhivel)
    return (
      <section
        className={classes("ui-card ui-filtros", className)}
        aria-labelledby={idDoTitulo}
        data-tour={tour}
      >
        <div className="ui-filtros-topo">{titulo}</div>
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
        "ui-card ui-filtros",
        className,
        recolhido && "is-recolhido",
      )}
      aria-labelledby={idDoTitulo}
      data-tour={tour}
    >
      <div className="ui-filtros-topo">
        {titulo}
        <div className="ui-filtros-acoes">
          <span
            className={classes("ui-filtros-resumo", quantos && "tem-filtros")}
            aria-live="polite"
          >
            <i
              className={`fa-solid ${quantos ? "fa-filter-circle-check" : "fa-layer-group"}`}
              aria-hidden="true"
            />
            <span>
              {escopo} ·{" "}
              {quantos
                ? `${quantos} ${quantos === 1 ? "filtro adicional" : "filtros adicionais"}`
                : "nenhum filtro adicional"}
            </span>
          </span>
          <button
            type="button"
            className="btn secondary small"
            data-acao="recolher-filtros"
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
            <span>{recolhido ? rotuloMostrar : rotuloOcultar}</span>
          </button>
          <button
            type="button"
            className="btn secondary small"
            data-acao="limpar-filtros"
            disabled={!(podeLimpar ?? quantos)}
            title="Limpar filtros"
            onClick={aoLimpar}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div className="ui-filtros-corpo" hidden={recolhido}>
        {children}
      </div>
    </section>
  );
}

/** A faixa de filtros aplicados. */
export function ChipsDeFiltro({ children }) {
  return (
    <div className="ui-chips" aria-label="Filtros aplicados">
      {children}
    </div>
  );
}

/** Um filtro aplicado: rótulo em negrito, o valor e o "x" que o tira. */
export function ChipDeFiltro({ rotulo, aoTirar, children }) {
  return (
    <button
      type="button"
      className="ui-chip"
      title={`Tirar o filtro ${rotulo}`}
      onClick={aoTirar}
    >
      <b>{rotulo}</b> {children}{" "}
      <i className="fa-solid fa-xmark" aria-hidden="true" />
    </button>
  );
}
