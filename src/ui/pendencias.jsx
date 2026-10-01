import { classes } from "./classes.js";

/*
  Lista de pendências prioritárias (Recursos, Análises curriculares): cada
  item é o título em negrito e o detalhe embaixo, com a borda à esquerda no
  tom ("perigo" vermelho; "alerta", o padrão, âmbar). Com `aoClicar`, o item é
  um botão que filtra a tela (`ativo` liga `aria-pressed`). `carregando`: o
  skeleton da lista. Sem itens, o `vazio`.
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
  if (!itens.length)
    return (
      <div className="ui-pendencias">
        <div className="ui-vazio">{vazio}</div>
      </div>
    );
  return (
    <div className="ui-pendencias">
      {itens.map(({ chave, titulo, detalhe, tom, ativo, aoClicar }) => {
        const conteudo = (
          <>
            <b>{titulo}</b>
            {detalhe ? <small>{detalhe}</small> : null}
          </>
        );
        const props = {
          className: classes("ui-pendencia", ativo && "is-ativo"),
          "data-tom": tom || "alerta",
          "data-pendencia": chave,
        };
        return aoClicar ? (
          <button
            type="button"
            key={chave}
            {...props}
            aria-pressed={Boolean(ativo)}
            onClick={aoClicar}
          >
            {conteudo}
          </button>
        ) : (
          <div key={chave} {...props}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}
