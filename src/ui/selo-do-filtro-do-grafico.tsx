import { classes } from "./classes.ts";

/*
  O selo do filtro que veio de um clique no gráfico (o padrão das telas do
  SIGEPSI): diz o que está filtrado e, num clique, tira o filtro. É um botão
  (Tab, Enter, Espaço); o texto diz tudo, o ícone só acompanha.

  Usado no ranking de unidades da Seleção (`CardDeGrafico` `acoes`).
  Marcação: `button.ui-selo-do-filtro-do-grafico[data-acao="remover-filtro-do-grafico"]`.
*/
export interface PropriedadesDoSeloDoFiltroDoGrafico {
  /** O que o clique no gráfico filtrou ("DSEI Xingu"). */
  valor: string;
  aoRemover: () => void;
  className?: string;
}

export function SeloDoFiltroDoGrafico({
  valor,
  aoRemover,
  className,
}: PropriedadesDoSeloDoFiltroDoGrafico) {
  return (
    <button
      type="button"
      className={classes("ui-selo-do-filtro-do-grafico", className)}
      data-acao="remover-filtro-do-grafico"
      onClick={aoRemover}
    >
      <i className="fa-solid fa-filter" aria-hidden="true" />
      <span>
        Filtro de gráfico ativo: <strong>{valor}</strong> — clique para remover
      </span>
      <i className="fa-solid fa-xmark" aria-hidden="true" />
    </button>
  );
}
