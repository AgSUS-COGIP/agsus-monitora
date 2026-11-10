import type { ElementType, ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  Peças de skeleton (carregando não é zero): o que a tela desenha no lugar do
  conteúdo antes da primeira carga, no formato dele. Só `.ui-esqueleto*`.

  - `LinhasEsqueleto`: linhas `<tr>` de uma tabela (TabelaInfinita, Acessos,
    Lista de aprovados), uma célula por coluna;
  - `BlocosEsqueleto`: `quantos` blocos (`.ui-esqueleto-bloco`) — itens de uma
    lista, cartões, dias de um calendário; `className` dá o tamanho;
  - `CarregandoConteudo`: o bloco inteiro que espera a leitura (o edital
    escolhido, a fila, a regra…): o que está carregando, por escrito, com o
    indicador girando, e as linhas de esqueleto abaixo. Anunciado ao leitor de
    tela (`role="status"`). Antes, cada tela desenhava um cartão com linhas
    `.ui-esqueleto-linha` sem a classe base: um cartão em branco por segundos.
*/

export interface PropriedadesDasLinhasEsqueleto {
  colunas: number;
  linhas?: number;
}

export function LinhasEsqueleto({
  colunas,
  linhas = 8,
}: PropriedadesDasLinhasEsqueleto) {
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

export interface PropriedadesDosBlocosEsqueleto {
  quantos?: number;
  className?: string;
  como?: ElementType;
}

export function BlocosEsqueleto({
  quantos = 3,
  className,
  como: Elemento,
}: PropriedadesDosBlocosEsqueleto) {
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

export interface PropriedadesDoCarregandoConteudo {
  /** O que está carregando ("Carregando o edital 93/2026…"). */
  rotulo?: ReactNode;
  /** Linhas de esqueleto abaixo do texto. */
  linhas?: number;
  /** Sem a moldura de cartão (dentro de um bloco que já é cartão). */
  semMoldura?: boolean;
  className?: string;
}

export function CarregandoConteudo({
  rotulo = "Carregando…",
  linhas = 2,
  semMoldura = false,
  className,
}: PropriedadesDoCarregandoConteudo) {
  return (
    <div
      className={classes(
        semMoldura ? "ui-carregando" : "ui-card ui-carregando",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="ui-carregando-texto">
        <span className="ui-carregando-indicador" aria-hidden="true" />
        {rotulo}
      </p>
      {Array.from({ length: linhas }, (_, indice) => (
        <span
          key={indice}
          className="ui-esqueleto ui-esqueleto-linha"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
