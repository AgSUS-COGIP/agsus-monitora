import type { ReactNode } from "react";
import { formatNumberBR } from "../lib/formatters";
import { classes } from "./classes.ts";

/*
  A faixa de situação das telas da seleção (`.ui-card.ui-faixa`): um card só
  com os números da lista lado a lado, cada um um botão-filtro (bolinha na
  cor do estado, rótulo, número grande e uma linha de contexto pequena: %,
  detalhe). O escolhido fica com fundo leve e o sublinhado na cor do estado
  (`aria-pressed`). Cada número aparece uma vez só: a faixa substitui cards
  de indicador, a barra do andamento e a fileira de abas.

  Embaixo, na mesma caixa, a linha da faixa: a barra de distribuição
  empilhada (`distribuicao`, `role="img"` com a proporção por situação no
  nome acessível) e o que a tela põe como filhos (selo de ritmo, meta do
  dia, links). `rodape` entra depois da linha (um bloco recolhível, como o
  "Por vaga" da Fila).

  `tom` (info, alerta, destaque, sucesso, perigo, neutro) escolhe a cor da
  bolinha, do sublinhado e da parte da barra (`data-tom`).
*/

export interface ItemDaFaixa {
  chave: string;
  rotulo: string;
  /** null: ainda carregando (o número vira skeleton). */
  valor: number | null;
  tom: string;
  contexto?: ReactNode;
  ativo?: boolean;
  aoClicar?: () => void;
  /** Dica (title) do botão. */
  titulo?: string;
}

export interface ParteDaDistribuicao {
  chave: string;
  rotulo: string;
  valor: number;
  tom: string;
}

export interface PropriedadesDaFaixaDeSituacao {
  /** O nome acessível da faixa ("Situação do lote"). */
  rotulo: string;
  itens: readonly ItemDaFaixa[];
  distribuicao?: readonly ParteDaDistribuicao[] | null;
  /** O nome da barra antes das partes ("Distribuição do lote"). */
  rotuloDaDistribuicao?: string;
  /** O todo da barra (o lote): o que as partes não cobrem fica vazio. */
  totalDaDistribuicao?: number;
  className?: string;
  tour?: string;
  /** A linha embaixo dos números (selo de ritmo, meta, links). */
  children?: ReactNode;
  rodape?: ReactNode;
}

/** "82,5%" (uma casa, para baixo: 100% só com tudo); "" sem total. */
export function porcentagemDe(parte: number, total: number): string {
  if (!total) return "";
  const p = parte >= total ? 100 : Math.floor((parte / total) * 1000) / 10;
  return `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** O nome acessível da barra: "Distribuição: 82,5% concluídas, 2,5% em análise". */
export function textoDaDistribuicao(
  partes: readonly ParteDaDistribuicao[],
  rotulo = "Distribuição",
  totalDaBarra = 0,
): string {
  const total = Math.max(
    totalDaBarra,
    partes.reduce((soma, p) => soma + Math.max(0, p.valor), 0),
  );
  if (!total) return `${rotulo}: sem dados`;
  return `${rotulo}: ${partes
    .filter((p) => p.valor > 0)
    .map((p) => `${porcentagemDe(p.valor, total)} ${p.rotulo.toLowerCase()}`)
    .join(", ")}`;
}

export function FaixaDeSituacao({
  rotulo,
  itens,
  distribuicao = null,
  rotuloDaDistribuicao = "Distribuição",
  totalDaDistribuicao = 0,
  className,
  tour,
  children,
  rodape,
}: PropriedadesDaFaixaDeSituacao) {
  const total = Math.max(
    totalDaDistribuicao,
    (distribuicao ?? []).reduce((soma, p) => soma + Math.max(0, p.valor), 0),
  );
  const temLinha = Boolean(distribuicao?.length) || Boolean(children);
  return (
    <section
      className={classes("ui-card ui-faixa", className)}
      aria-label={rotulo}
      data-tour={tour}
    >
      <div className="ui-faixa-itens">
        {itens.map((item) => {
          const conteudo = (
            <>
              <span className="ui-faixa-rotulo">
                <span className="ui-ponto" aria-hidden="true" />
                {item.rotulo}
              </span>
              {item.valor === null ? (
                <span className="ui-faixa-numero ui-esqueleto" />
              ) : (
                <span className="ui-faixa-numero">
                  {formatNumberBR(item.valor)}
                </span>
              )}
              <span className="ui-faixa-contexto">{item.contexto || null}</span>
            </>
          );
          return item.aoClicar ? (
            <button
              key={item.chave}
              type="button"
              className="ui-faixa-item"
              data-valor={item.chave}
              data-tom={item.tom}
              aria-pressed={Boolean(item.ativo)}
              title={item.titulo}
              onClick={item.aoClicar}
            >
              {conteudo}
            </button>
          ) : (
            <div
              key={item.chave}
              className="ui-faixa-item"
              data-valor={item.chave}
              data-tom={item.tom}
              title={item.titulo}
            >
              {conteudo}
            </div>
          );
        })}
      </div>
      {temLinha ? (
        <div className="ui-faixa-linha">
          {distribuicao?.length ? (
            <span
              className="ui-faixa-barra"
              role="img"
              aria-label={textoDaDistribuicao(
                distribuicao,
                rotuloDaDistribuicao,
                totalDaDistribuicao,
              )}
            >
              {total
                ? distribuicao
                    .filter((p) => p.valor > 0)
                    .map((p) => (
                      <span
                        key={p.chave}
                        data-parte={p.chave}
                        data-tom={p.tom}
                        style={{ width: `${(p.valor / total) * 100}%` }}
                      />
                    ))
                : null}
            </span>
          ) : null}
          {children}
        </div>
      ) : null}
      {rodape}
    </section>
  );
}
