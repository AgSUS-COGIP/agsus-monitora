import { classes } from "./classes.js";

/*
  Peças de skeleton (carregando não é zero): o que a tela desenha no lugar do
  conteúdo antes da primeira carga, no formato dele. Só `.ui-esqueleto*`.

  - `LinhasEsqueleto`: linhas `<tr>` de uma tabela (TabelaInfinita, Acessos,
    Lista de aprovados), uma célula por coluna;
  - `BlocosEsqueleto`: `quantos` blocos (`.ui-esqueleto-bloco`) — itens de uma
    lista, cartões, dias de um calendário; `className` dá o tamanho.
*/

export function LinhasEsqueleto({ colunas, linhas = 8 }) {
  return Array.from({ length: linhas }, (_, linha) => (
    <tr key={linha} className="ui-esqueleto-tr" aria-hidden="true">
      {Array.from({ length: colunas }, (__, coluna) => (
        <td key={coluna}>
          <span className="ui-esqueleto ui-esqueleto-linha" />
        </td>
      ))}
    </tr>
  ));
}

/**
 * @param {{ quantos?: number, className?: string, como?: import("react").ElementType }} props
 */
export function BlocosEsqueleto({ quantos = 3, className, como: Elemento }) {
  return Array.from({ length: quantos }, (_, indice) => {
    const bloco = (
      <span
        key={indice}
        className={classes("ui-esqueleto ui-esqueleto-bloco", className)}
        aria-hidden="true"
      />
    );
    return Elemento ? (
      <Elemento key={indice} aria-hidden="true">
        {bloco}
      </Elemento>
    ) : (
      bloco
    );
  });
}
