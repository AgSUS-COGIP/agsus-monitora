import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { classes } from "./classes.ts";
import { ContextoDoGrafico } from "./tabela-do-grafico.tsx";

/*
  Bloco de gráfico: título e o corpo (`altura`: "short", "alto"…). Sem
  sobretítulo nem dica: quem explica o gráfico é a Aya. `elemento="section"`
  para o bloco que ocupa a linha inteira. `carregando`: o corpo pulsa (o
  gráfico continua montado por baixo e só é atualizado quando o dado chega).

  Com um `Grafico` dentro, o título ganha o botão "Tabela" (aria-pressed):
  ligado, a tabela dos valores ocupa o lugar do gráfico (TabelaDoGrafico; o
  Chart.js continua montado, escondido). A escolha é de cada card.

  Marcação: `.ui-card.ui-card-de-grafico` > `.ui-card-de-grafico-topo` (o
  título e o botão `.ui-grafico-alternar`) + `.ui-grafico[data-altura]`.
*/
export interface PropriedadesDoCardDeGrafico {
  titulo: string;
  className?: string;
  altura?: string;
  carregando?: boolean;
  elemento?: "article" | "section";
  tour?: string;
  children?: ReactNode;
}

export function CardDeGrafico({
  titulo,
  className,
  altura,
  carregando = false,
  elemento: Elemento = "article",
  tour,
  children,
}: PropriedadesDoCardDeGrafico) {
  const [emTabela, definirEmTabela] = useState(false);
  const [graficos, definirGraficos] = useState(0);
  const registrar = useCallback(() => {
    definirGraficos((n) => n + 1);
    return () => definirGraficos((n) => n - 1);
  }, []);
  const contexto = useMemo(
    () => ({ emTabela, registrar }),
    [emTabela, registrar],
  );
  return (
    <Elemento
      className={classes("ui-card ui-card-de-grafico", className)}
      aria-busy={carregando || undefined}
      data-tour={tour}
    >
      <div className="ui-card-de-grafico-topo">
        <h2 className="ui-titulo">{titulo}</h2>
        {graficos > 0 ? (
          <button
            type="button"
            className="ui-grafico-alternar"
            aria-pressed={emTabela}
            title={emTabela ? "Ver o gráfico" : "Ver dados em tabela"}
            onClick={() => definirEmTabela((atual) => !atual)}
          >
            <i
              className={`fa-solid ${emTabela ? "fa-chart-column" : "fa-table-list"}`}
              aria-hidden="true"
            />
            Tabela
          </button>
        ) : null}
      </div>
      <div
        className={classes(
          "ui-grafico",
          carregando && "is-carregando",
          emTabela && "is-em-tabela",
        )}
        data-altura={altura || undefined}
      >
        <ContextoDoGrafico.Provider value={contexto}>
          {children}
        </ContextoDoGrafico.Provider>
      </div>
    </Elemento>
  );
}
