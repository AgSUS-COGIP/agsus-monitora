import { classes } from "./classes.js";
import { usarNoQuadro } from "./no-quadro.jsx";

/*
  Bloco de gráfico: título e o corpo (`altura`: "short", "alto"…). Sem
  sobretítulo nem dica: quem explica o gráfico é a Aya. `elemento="section"`
  para o bloco que ocupa a linha inteira. `carregando`: o corpo pulsa (o
  gráfico continua montado por baixo e só é atualizado quando o dado chega).

  Dentro do app: `.ui-card.ui-card-de-grafico` > `.ui-grafico[data-altura]`.
  No quadro (<PainelNoQuadro>): `.panel.panel-pad` > `.chart-wrap`.
*/
export function CardDeGrafico({
  titulo,
  className,
  altura,
  carregando = false,
  elemento: Elemento = "article",
  children,
}) {
  const noQuadro = usarNoQuadro();
  if (noQuadro)
    return (
      <Elemento className={classes("panel panel-pad", className)}>
        <h2 className="title">{titulo}</h2>
        <div className={classes("chart-wrap", altura)}>{children}</div>
      </Elemento>
    );
  return (
    <Elemento
      className={classes("ui-card ui-card-de-grafico", className)}
      aria-busy={carregando || undefined}
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
