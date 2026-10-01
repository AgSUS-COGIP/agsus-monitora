import { classes } from "./classes.js";
import { EstadoVazio } from "./estados.jsx";

/*
  Pendências de uma tela (`.ui-pendencias`): cada item é um botão com o
  título e o detalhe (quantos e o porquê), com a borda à esquerda no tom
  ("perigo" em vermelho; "alerta", o padrão, em âmbar). O clique filtra a tela
  (`ativo` liga `aria-pressed` e o destaque; clicar de novo tira) ou abre uma
  lista (sem `ativo`, sem `aria-pressed`).

  `carregando`: quatro blocos de skeleton (carregando não é zero). Sem itens,
  o `vazio` (texto curto). Usada por Recursos e Entrevistas.

  `itens`: `[{ chave, titulo, detalhe, tom?, ativo?, aoClicar }]`.
*/

const ITENS_DO_ESQUELETO = 4;

export function ListaDePendencias({ itens, carregando = false, vazio }) {
  if (carregando)
    return (
      <div className="ui-pendencias" aria-hidden="true">
        {Array.from({ length: ITENS_DO_ESQUELETO }, (_, indice) => (
          <span className="ui-esqueleto ui-pendencia-esqueleto" key={indice} />
        ))}
      </div>
    );
  return (
    <div className="ui-pendencias">
      {itens.length ? (
        itens.map((item) => (
          <button
            type="button"
            key={item.chave}
            className={classes("ui-pendencia", item.ativo && "is-ativo")}
            data-tom={item.tom || "alerta"}
            data-pendencia={item.chave}
            aria-pressed={item.ativo === undefined ? undefined : item.ativo}
            onClick={item.aoClicar}
          >
            <b>{item.titulo}</b>
            <small>{item.detalhe}</small>
          </button>
        ))
      ) : (
        <EstadoVazio>{vazio}</EstadoVazio>
      )}
    </div>
  );
}
