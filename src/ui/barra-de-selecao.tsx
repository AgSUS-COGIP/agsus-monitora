import type { ReactNode } from "react";
import {
  conviteParaTodos,
  paginaMarcada,
  rotuloDaPagina,
  textoDoAlcance,
  type AlcanceDaSelecao,
  type NomeDosItens,
} from "../lib/base/alcance-da-selecao.ts";
import { classes } from "./classes.ts";

/*
  A barra da seleção em lote, em cima da tabela: "Selecionar esta página (N)"
  (as linhas já desenhadas) e, com a página toda marcada e mais resultados no
  recorte, o botão "Selecionar todos os N resultados". A linha do alcance diz
  sem ambiguidade o que está marcado ("50 candidatos desta página
  selecionados (de 13.184 no resultado)" ou "Todos os 13.184 candidatos do
  resultado selecionados"); as ações (`children`) e "Limpar seleção" só
  aparecem com algo marcado. As contas são de lib/base/alcance-da-selecao.ts;
  a confirmação de cada ação usa textoDaConfirmacao de lá.
*/
export interface PropriedadesDaBarraDeSelecao {
  alcance: AlcanceDaSelecao;
  nome: NomeDosItens;
  /** O aria-label da barra (ex.: "Seleção de candidatos"). */
  rotulo: string;
  aoMarcarPagina: (sim: boolean) => void;
  aoMarcarTodos: () => void;
  aoLimpar: () => void;
  /** As ações em lote (botões). */
  children?: ReactNode;
  className?: string;
  tour?: string;
}

export function BarraDeSelecao({
  alcance,
  nome,
  rotulo,
  aoMarcarPagina,
  aoMarcarTodos,
  aoLimpar,
  children,
  className,
  tour,
}: PropriedadesDaBarraDeSelecao) {
  if (!alcance.total) return null;
  const convite = conviteParaTodos(alcance);
  const algum = alcance.quantos > 0;
  return (
    <div
      className={classes("ui-lista-selecao ui-barra-de-selecao", className)}
      role="toolbar"
      aria-label={rotulo}
      data-tour={tour}
      data-alcance={alcance.tipo}
    >
      <label className="ui-barra-de-selecao__pagina">
        <input
          type="checkbox"
          data-acao="selecionar-pagina"
          checked={paginaMarcada(alcance)}
          onChange={(ev) => aoMarcarPagina(ev.target.checked)}
        />
        {rotuloDaPagina(alcance)}
      </label>
      {convite ? (
        <button
          type="button"
          className="btn contorno small"
          data-acao="selecionar-todos-os-resultados"
          onClick={aoMarcarTodos}
        >
          {convite}
        </button>
      ) : null}
      <strong
        className="ui-barra-de-selecao__alcance"
        data-alcance-da-selecao
        aria-live="polite"
      >
        {algum ? textoDoAlcance(alcance, nome) : ""}
      </strong>
      {algum ? (
        <>
          {children}
          <button
            type="button"
            className="btn ghost small"
            data-acao="limpar-selecao"
            onClick={aoLimpar}
          >
            Limpar seleção
          </button>
        </>
      ) : null}
    </div>
  );
}
