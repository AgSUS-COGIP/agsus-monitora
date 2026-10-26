import type { ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  Bloco de gráfico: título e o corpo (`altura`: "short", "alto"…). Sem
  sobretítulo nem dica: quem explica o gráfico é a Aya. `elemento="section"`
  para o bloco que ocupa a linha inteira. `carregando`: o corpo pulsa (o
  gráfico continua montado por baixo e só é atualizado quando o dado chega).

  Marcação: `.ui-card.ui-card-de-grafico` > `.ui-grafico[data-altura]`.
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
  return (
    <Elemento
      className={classes("ui-card ui-card-de-grafico", className)}
      aria-busy={carregando || undefined}
      data-tour={tour}
    >
      <h2 className="ui-titulo">{titulo}</h2>
      <div
        className={classes("ui-grafico", carregando && "is-carregando")}
        data-altura={altura || undefined}
      >
        {children}
      </div>
    </Elemento>
  );
}
